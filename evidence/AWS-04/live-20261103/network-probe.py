"""Bounded read-only #33 probes. Run only after confirming this EC2 is Running."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import http.client
import json
from pathlib import Path
import re
import socket
import ssl
import time
import urllib.request


TARGET = '52.221.157.206'
PORTS = (22, 80, 443, 3000, 5432, 8080)


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def tcp_probe(port):
    results = []
    for attempt in (1, 2):
        started = time.monotonic()
        result = {'attempt': attempt, 'started_utc': timestamp()}
        try:
            with socket.create_connection((TARGET, port), timeout=4):
                result['outcome'] = 'reachable'
        except (TimeoutError, socket.timeout):
            result['outcome'] = 'timeout_inconclusive_or_filtered'
        except ConnectionRefusedError:
            result['outcome'] = 'refused'
        except OSError as error:
            result.update(outcome='network_error', error_type=type(error).__name__,
                          error_code=error.errno)
        result['elapsed_ms'] = round((time.monotonic() - started) * 1000)
        results.append(result)
    return {'port': port, 'attempts': results}


def http_probe(path, secure=True):
    result = {'path': path, 'scheme': 'https' if secure else 'http',
              'started_utc': timestamp()}
    connection = (http.client.HTTPSConnection(TARGET, timeout=10,
                  context=ssl.create_default_context()) if secure
                  else http.client.HTTPConnection(TARGET, timeout=10))
    try:
        connection.request('GET', path, headers={'User-Agent': 'PBL4-517-AWS04-readonly'})
        response = connection.getresponse()
        body = response.read(65537)
        result.update(status=response.status, location=response.getheader('Location'),
                      content_type=response.getheader('Content-Type'),
                      bytes_read=len(body), body_sha256=hashlib.sha256(body).hexdigest())
        if path == '/':
            title = re.search(rb'<title[^>]*>(.*?)</title>', body, re.I | re.S)
            result['title'] = title.group(1).decode('utf-8', 'replace') if title else None
        if response.status == 200 and path != '/':
            try:
                value = json.loads(body)
                data = value.get('data', value)
                keys = ('status', 'database') if path == '/api/health' else ('component', 'revision', 'dirty')
                result['public_metadata'] = {key: data[key] for key in keys if key in data}
            except (ValueError, TypeError):
                result['public_metadata'] = 'not_json'
        result['tls_verified'] = secure
    except Exception as error:
        result.update(outcome='request_failed', error_type=type(error).__name__,
                      error=str(error), tls_verified=False)
    finally:
        connection.close()
    return result


def tls_probe():
    result = {'started_utc': timestamp()}
    try:
        with socket.create_connection((TARGET, 443), timeout=10) as raw:
            with ssl.create_default_context().wrap_socket(raw, server_hostname=TARGET) as secured:
                cert = secured.getpeercert()
                result.update(verified=True, protocol=secured.version(),
                              cipher=secured.cipher()[0],
                              subject_alt_names=cert.get('subjectAltName'),
                              not_before=cert.get('notBefore'), not_after=cert.get('notAfter'))
    except Exception as error:
        result.update(verified=False, error_type=type(error).__name__, error=str(error))
    return result


def main():
    # Never starts/stops EC2 or changes any AWS/OS/application configuration.
    # No login, exploit, alert send, scanner-state writes or certificate bypass.
    report = {'started_utc': timestamp(), 'target': TARGET,
              'instance': 'i-0ccfb2772f854e78b', 'region': 'ap-southeast-1',
              'precondition': 'AWS Console refreshed: expected instance Running before invocation',
              'attempts_per_port': 2, 'tcp_timeout_seconds': 4}
    with urllib.request.urlopen('https://checkip.amazonaws.com', timeout=10) as response:
        report['source_public_ipv4'] = response.read(100).decode('ascii').strip()
    with ThreadPoolExecutor(max_workers=6) as pool:
        report['tcp'] = list(pool.map(tcp_probe, PORTS))
    report['tls'] = tls_probe()
    report['http'] = [http_probe('/', secure=False), http_probe('/'),
                      http_probe('/api/health'), http_probe('/api/version'),
                      http_probe('/release.json')]
    report['finished_utc'] = timestamp()
    output = Path(__file__).with_name('results.json')
    output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
