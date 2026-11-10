"""Short, interactive commands for operator-run OWASP lab probes.

The script only reads the private fixture, sends requests and checks the
result. It never starts/restarts a server, edits .env or changes a VULN flag.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import uuid
from urllib.parse import urlsplit

from report import RESULT_LABELS, print_sections, render_markdown

ROOT = Path(__file__).resolve().parents[2]
SCENARIOS = ('idor', 'idor-update', 'idor-cancel', 'sqli', 'xss', 'auth')
PAYLOADS = ("' OR '1'='1", "' OR TRUE OR '1'='1")
DEFAULT_WRONG_PASSWORD = 'WrongSynthetic517!'
DEFAULT_ADDRESS = 'Dia chi demo moi cua attacker'


def configure_stdout():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')


def read_backend_env():
    path = ROOT / 'website/backend/.env'
    values = {}
    if not path.is_file():
        return values
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        else:
            value = value.split(' #', 1)[0].rstrip()
        values[key.strip()] = value
    return values


def default_api_url():
    port = read_backend_env().get('PORT', '3000')
    return f'http://127.0.0.1:{port}'


def ask(label, default=''):
    answer = input(f'{label} [{default}]: ').strip()
    return answer or default


def is_loopback(url):
    return urlsplit(url).hostname in ('127.0.0.1', 'localhost', '::1')


def normalize_order(value):
    text = value.strip()
    if '/orders/' in text:
        text = text.split('/orders/', 1)[1]
    text = text.split('?', 1)[0].split('#', 1)[0].strip('/')
    try:
        return str(uuid.UUID(text))
    except (ValueError, AttributeError):
        raise ValueError('Order phải là UUID hoặc URL .../orders/<UUID>.') from None


def load_fixture(args):
    fixture_path = Path(args.fixture).resolve() if args.fixture else ROOT / '.local/private/lab-fixtures.json'
    if not fixture_path.is_file():
        raise ValueError('Chưa có fixture. Chạy .\\dev setup trước.')
    fixture = json.loads(fixture_path.read_text(encoding='utf-8-sig'))
    if fixture.get('schema') != 1:
        raise ValueError('Fixture không đúng schema.')
    return fixture


def fixture_summary(fixture):
    """Synthetic run identifiers only; never passwords or tokens."""
    return ' | '.join(
        f'{label}={fixture[key]}'
        for key, label in (('run', 'run'), ('orderId', 'order'), ('productId', 'product'), ('reviewId', 'review'))
        if fixture.get(key)
    )


def prompt(args):
    if args.url is None:
        default = 'http://127.0.0.1:5173' if args.scenario == 'xss' else default_api_url()
        args.url = ask('Frontend URL' if args.scenario == 'xss' else 'API URL', default)
    if not is_loopback(args.url):
        if not args.fixture:
            args.fixture = ask('Đường dẫn fixture riêng cho target ngoài loopback')
        if not args.revision:
            args.revision = ask('SHA 40 ký tự của bản release đã được duyệt')
    fixture = load_fixture(args)
    if args.scenario.startswith('idor'):
        default_order = fixture.get('orderId', '')
        args.order = normalize_order(args.order or ask('Order ID hoặc URL đơn của owner', default_order))
    if args.scenario == 'idor-update':
        args.address = args.address or ask('Địa chỉ giao hàng mới sẽ gửi trong PATCH', DEFAULT_ADDRESS)
        if not 5 <= len(args.address.strip()) <= 255:
            raise ValueError('Địa chỉ cần 5..255 ký tự.')
    if args.scenario == 'sqli' and args.payload is None:
        print("Payload 1: ' OR '1'='1")
        print("Payload 2: ' OR TRUE OR '1'='1")
        choice = ask('Chọn payload chỉ đọc: 1 / 2', '1')
        if choice not in ('1', '2'):
            raise ValueError('Chọn 1 hoặc 2.')
        args.payload = PAYLOADS[int(choice) - 1]
    if args.scenario == 'auth':
        args.wrong_password = args.wrong_password or ask('Mật khẩu sai dùng cho 12 lần thử', DEFAULT_WRONG_PASSWORD)
    if args.scenario == 'xss':
        print('Chromium sẽ đọc review đã lưu; script không sửa/xóa review.')
    if args.scenario in ('idor-update', 'idor-cancel'):
        print('Request sẽ gửi:')
        if args.scenario == 'idor-update':
            print('  PATCH /api/orders/' + args.order)
            print('  Body: ' + json.dumps({'shippingAddress': args.address}, ensure_ascii=False))
        else:
            print('  POST /api/orders/' + args.order + '/cancel')
            print('  Body: {}')
        if input('Gửi request này? [y/N]: ').strip().lower() not in ('y', 'yes'):
            return False
    return True


def non_interactive_defaults(args, fixture):
    args.url = args.url or ('http://127.0.0.1:5173' if args.scenario == 'xss' else default_api_url())
    if args.scenario.startswith('idor'):
        args.order = normalize_order(args.order or fixture.get('orderId', ''))
    if args.scenario == 'idor-update' and not args.address:
        args.address = DEFAULT_ADDRESS
    if args.scenario == 'sqli' and args.payload is None:
        args.payload = PAYLOADS[0]
    if args.scenario == 'auth' and not args.wrong_password:
        args.wrong_password = DEFAULT_WRONG_PASSWORD
    if not is_loopback(args.url) and (not args.fixture or not args.revision):
        raise ValueError('Target ngoài loopback cần --fixture và --revision rõ ràng.')


def command(args):
    target = ['node', str(ROOT / 'scripts/attacker/xss.mjs')] if args.scenario == 'xss' else [sys.executable, str(ROOT / 'scripts/attacker/demo.py'), '--scenario', args.scenario]
    target += ['--expect', args.expect] if args.expect else ['--observe']
    target += ['--trace']
    if args.show_evidence:
        target += ['--show-evidence']
    for key in ('url', 'fixture', 'revision', 'order', 'address', 'payload', 'wrong_password'):
        value = getattr(args, key)
        if value is not None:
            target += ['--' + key.replace('_', '-'), value]
    return target


def main(argv=None):
    configure_stdout()
    parser = argparse.ArgumentParser(
        description=__doc__,
        epilog='Ví dụ: .\\demo idor | .\\demo idor-update | .\\demo sqli | .\\demo xss | .\\demo auth',
    )
    parser.add_argument('scenario', choices=SCENARIOS)
    parser.add_argument('--expect', choices=('vulnerable', 'secure'), help='Kỳ vọng tùy chọn cho kiểm thử tự động; mặc định chỉ báo hành vi quan sát được.')
    parser.add_argument('--url', help='API origin; với XSS dùng frontend origin.')
    parser.add_argument('--fixture', help='Manifest riêng cho target ngoài loopback.')
    parser.add_argument('--revision', help='SHA release đã duyệt; bắt buộc cho target ngoài loopback.')
    parser.add_argument('--order', help='UUID hoặc URL đơn của owner; mặc định lấy từ fixture.')
    parser.add_argument('--address', help='Địa chỉ giả cho idor-update.')
    parser.add_argument('--payload', choices=PAYLOADS, help='Payload chỉ đọc cho SQLi.')
    parser.add_argument('--wrong-password', help='Mật khẩu sai có chủ đích cho auth.')
    parser.add_argument('--show-evidence', action='store_true', help='Hiện chi tiết evidence cho target ngoài loopback khi được phép.')
    parser.add_argument('--non-interactive', action='store_true', help='Không hỏi; dùng giá trị mặc định/CI.')
    args = parser.parse_args(argv)
    if args.address is not None and args.scenario != 'idor-update':
        parser.error('--address chỉ dùng với idor-update')
    if args.order is not None and not args.scenario.startswith('idor'):
        parser.error('--order chỉ dùng với bài IDOR')
    if args.payload is not None and args.scenario != 'sqli':
        parser.error('--payload chỉ dùng với sqli')
    if args.wrong_password is not None and args.scenario != 'auth':
        parser.error('--wrong-password chỉ dùng với auth')
    try:
        if not args.non_interactive and sys.stdin.isatty():
            if not prompt(args):
                print('Đã hủy; chưa gửi request tấn công.')
                return 0
        else:
            fixture = load_fixture(args)
            non_interactive_defaults(args, fixture)
        fixture = load_fixture(args)
        if args.fixture:
            args.fixture = str(Path(args.fixture).resolve())
        print()
        print('Bài: ' + args.scenario + ' | target: ' + args.url)
        if args.scenario.startswith('idor'):
            print('Owner: ' + fixture['owner']['email'] + ' | Attacker: ' + fixture['attacker']['email'])
        elif args.scenario == 'auth':
            print('Tài khoản: ' + fixture['owner']['email'])
        print('Fixture: ' + fixture_summary(fixture))
        print()
        sys.stdout.flush()
        result = subprocess.run(command(args), cwd=ROOT, stdout=subprocess.PIPE, text=True, encoding='utf-8', errors='replace', timeout=120)
        report_data = json.loads(result.stdout.strip().splitlines()[-1])
    except (EOFError, KeyboardInterrupt):
        print('\nĐã hủy.')
        return 130
    except (OSError, subprocess.TimeoutExpired, ValueError, KeyError, IndexError, json.JSONDecodeError):
        print('INCONCLUSIVE: kiểm tra Python/Node/Chromium, API đang chạy và fixture. Không có service nào bị khởi động hay sửa.')
        return 2
    reports = ROOT / '.local/reports/security'
    reports.mkdir(parents=True, exist_ok=True)
    stem = f'{args.scenario}-{args.expect}' if args.expect else args.scenario
    filename = stem + '.json'
    markdown_name = stem + '.md'
    (reports / filename).write_text(json.dumps(report_data, indent=2, ensure_ascii=True) + '\n', encoding='utf-8')
    (reports / markdown_name).write_text(render_markdown(report_data), encoding='utf-8')
    result_name = str(report_data.get('result'))
    result_label = RESULT_LABELS.get(result_name, 'xem lý do bên dưới')
    print(f'Kết quả: {result_name} — {result_label}')
    if args.expect:
        print(f"Kỳ vọng: {args.expect} | passed: {report_data.get('passed')}")
    print_sections(report_data.get('evidence'))
    if report_data.get('detail'):
        print()
        print('Lý do: ' + report_data['detail'])
        if args.scenario in ('idor-update', 'idor-cancel') and 'PENDING' in str(report_data['detail']):
            print('Gợi ý: chạy .\\dev reset-order rồi restart backend để có đơn PENDING mới.')
    origin = (report_data.get('frontend') or report_data.get('target') or args.url).rstrip('/')
    print()
    if args.scenario.startswith('idor') and report_data.get('orderId'):
        print('URL đơn: ' + origin + '/orders/' + report_data['orderId'])
    if args.scenario == 'xss' and report_data.get('productId'):
        print('URL sản phẩm: ' + origin + '/products/' + report_data['productId'])
    print('Báo cáo JSON: .local/reports/security/' + filename)
    print('Báo cáo đọc được: .local/reports/security/' + markdown_name)
    return result.returncode


if __name__ == '__main__':
    sys.exit(main())
