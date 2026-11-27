"""Measure the configured TCP ports of one IPv4 address with Nmap."""

import ipaddress
import math
import os
from pathlib import Path
import shutil
import subprocess
import xml.etree.ElementTree as ET

from scanner.config import resolve_path, setting

SCAN_DEADLINE_SECONDS = 30


def nmap_executable() -> str:
    configured = setting('SCANNER_NMAP_PATH')
    if configured:
        return str(resolve_path(configured))

    executable = shutil.which('nmap')
    if executable:
        return executable

    if os.name == 'nt':
        for variable in ('ProgramFiles(x86)', 'ProgramFiles'):
            directory = os.environ.get(variable)
            if directory:
                candidate = Path(directory) / 'Nmap' / 'nmap.exe'
                if candidate.is_file():
                    return str(candidate)

    raise RuntimeError('Nmap chưa được cài hoặc chưa có trên PATH. Có thể đặt SCANNER_NMAP_PATH.')


def _port_state(state: str | None) -> str:
    return state if state in ('open', 'closed') else 'filtered'


def _port_spec(ports: list[int]) -> str:
    """Keep contiguous ranges compact enough for the Windows command line."""
    ordered = sorted(set(ports))
    start = end = ordered[0]
    ranges = []
    for port in ordered[1:]:
        if port != end + 1:
            ranges.append(str(start) if start == end else f'{start}-{end}')
            start = port
        end = port
    ranges.append(str(start) if start == end else f'{start}-{end}')
    return ','.join(ranges)


def parse_nmap_xml(output: bytes, target: str, ports: list[int]) -> dict[int, str]:
    try:
        root = ET.fromstring(output)
    except ET.ParseError as error:
        raise RuntimeError('Nmap trả XML không hợp lệ.') from error
    finished = root.find('./runstats/finished')
    if root.tag != 'nmaprun' or finished is None or finished.get('exit') != 'success':
        raise RuntimeError('Nmap XML không xác nhận lượt quét hoàn tất.')

    hosts = root.findall('./host')
    if len(hosts) != 1 or hosts[0].find(f"./address[@addrtype='ipv4'][@addr='{target}']") is None:
        raise RuntimeError('Nmap XML thiếu kết quả cho đúng địa chỉ IPv4 đã chọn.')

    requested = set(ports)
    observed = {}
    for port_node in hosts[0].findall('./ports/port'):
        port = int(port_node.get('portid', '0'))
        if port_node.get('protocol') != 'tcp' or port not in requested or port in observed:
            raise RuntimeError('Nmap XML chứa cổng ngoài phạm vi hoặc trùng lặp.')
        state = port_node.find('state')
        observed[port] = _port_state(state.get('state') if state is not None else None)

    missing = requested - observed.keys()
    groups = hosts[0].findall('./ports/extraports')
    # A single group can identify every omitted port only if its count matches.
    if len(groups) == 1 and groups[0].get('count') == str(len(missing)):
        group_state = _port_state(groups[0].get('state'))
        observed.update(dict.fromkeys(missing, group_state))

    return {port: observed.get(port, 'filtered') for port in ports}


def scan_tcp_ports(host: str, ports: list[int], timeout: float) -> dict[int, str]:
    target = str(ipaddress.IPv4Address(host))
    rtt_limit_ms = max(100, math.ceil(min(timeout, SCAN_DEADLINE_SECONDS) * 1000))
    rtt_limit = f'{rtt_limit_ms}ms'
    try:
        result = subprocess.run(
            [nmap_executable(), '-sT', '-Pn', '-n', '--max-retries', '0',
             '--initial-rtt-timeout', rtt_limit, '--max-rtt-timeout', rtt_limit,
             '-p', _port_spec(ports), '-oX', '-', target],
            capture_output=True,
            timeout=SCAN_DEADLINE_SECONDS,
        )
    except FileNotFoundError as error:
        raise RuntimeError('Không tìm thấy Nmap. Kiểm tra SCANNER_NMAP_PATH hoặc PATH.') from error
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(f'Nmap vượt quá {SCAN_DEADLINE_SECONDS}s cho một lượt quét.') from error

    if result.returncode != 0:
        raise RuntimeError(f'Nmap kết thúc với mã lỗi {result.returncode}. Kiểm tra quyền chạy và cấu hình.')
    return parse_nmap_xml(result.stdout, target, ports)
