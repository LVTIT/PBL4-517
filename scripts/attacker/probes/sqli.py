"""Read-only SQLi search probe with bounded product disclosure evidence."""
from urllib.parse import urlencode

from core import SQLI_PAYLOADS, data, redact_evidence, require, truncate


def _summarize_rows(rows):
    names = []
    for row in rows[:5]:
        if isinstance(row, dict):
            names.append(f"{row.get('name') or '?'} ({row.get('id') or '?'})")
    if len(rows) > 5:
        names.append(f'+{len(rows) - 5} sản phẩm')
    return truncate('; '.join(names) or '(không có)')


def run(client, fixture, payload=SQLI_PAYLOADS[0], local=True, show_evidence=False):
    path = '/api/products?'
    control = data(client, path + urlencode({'search': fixture['productName']}))
    require(isinstance(control, list) and any(row.get('id') == fixture['productId'] for row in control), 'Positive search control missing fixture.')
    missing = 'absent-' + fixture['run']
    require(data(client, path + urlencode({'search': missing})) == [], 'Negative search control not empty.')
    require(payload in SQLI_PAYLOADS, 'Choose one of the bounded read-only demo payloads.')
    result = data(client, path + urlencode({'search': payload}))
    require(isinstance(result, list), 'Unexpected search result.')
    exploited = any(row.get('id') == fixture['productId'] for row in result)
    if not exploited:
        require(result == [], 'Unexpected rows: cannot establish defense.')

    observed = [
        {'label': 'Payload', 'value': payload},
        {'label': 'Số dòng', 'value': str(len(result))},
    ]
    if exploited:
        observed.append({'label': 'Sản phẩm lộ', 'value': _summarize_rows(result)})
    else:
        observed.append({'label': 'Kết luận', 'value': 'payload được xử lý như dữ liệu tìm kiếm'})
    evidence = {
        'observedTitle': 'Dữ liệu payload trả về',
        'observed': observed,
        'controlsTitle': 'Đối chứng',
        'controls': [
            {'label': 'Tìm đúng tên', 'value': f'{len(control)} kết quả, có fixture'},
            {'label': 'Chuỗi không tồn tại', 'value': '0 kết quả'},
        ],
        'limits': ['Chỉ đo search đọc; không chứng minh xóa bảng/chiếm DB/chạy lệnh OS.'],
    }
    return ('EXPLOIT_CONFIRMED' if exploited else 'DEFENSE_VERIFIED'), redact_evidence(evidence, local, show_evidence)
