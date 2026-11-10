"""Human-readable rendering for demo reports (console sections and Markdown)."""

RESULT_LABELS = {
    'EXPLOIT_CONFIRMED': 'đã tái hiện hành vi lỗi',
    'DEFENSE_VERIFIED': 'đã chặn đúng bài',
    'INCONCLUSIVE': 'chưa kết luận được',
    'RELEASE_VERIFIED': 'release khớp',
}


def _rows(items):
    return [item for item in items or [] if isinstance(item, dict)]


def _width(rows, minimum=10, maximum=22):
    return min(maximum, max([minimum, *(len(str(row.get('label', ''))) for row in rows)]))


def print_sections(evidence, expected=''):
    """Print observed/controls/limits exactly as the probe supplied them."""
    if not isinstance(evidence, dict) or not evidence:
        return
    observed = _rows(evidence.get('observed'))
    if observed:
        title = str(evidence.get('observedTitle') or 'Dữ liệu quan sát được')
        print()
        print(f'{title} ({expected}):' if expected else f'{title}:')
        width = _width(observed)
        for row in observed:
            print(f"  {str(row.get('label', '')):<{width}} : {row.get('value', '')}")
    controls = _rows(evidence.get('controls'))
    if controls:
        print()
        print(f"{evidence.get('controlsTitle') or 'Đối chứng'}:")
        width = _width(controls)
        for row in controls:
            print(f"  {str(row.get('label', '')):<{width}} : {row.get('value', '')}")
    limits = [str(item) for item in evidence.get('limits') or [] if item]
    if limits:
        print()
        print('Giới hạn:')
        for item in limits:
            print('  ' + item)


def _cell(value):
    text = '' if value is None else str(value)
    return text.replace('|', '\\|').replace('\r', ' ').replace('\n', ' ')


def _table(rows, empty='(không có)'):
    if not rows:
        return empty + '\n'
    lines = ['| Mục | Giá trị |', '| --- | --- |']
    lines += [f"| {_cell(row.get('label', ''))} | {_cell(row.get('value', ''))} |" for row in rows]
    return '\n'.join(lines) + '\n'


def render_markdown(report):
    """Render one probe report as a readable, non-secret Markdown document."""
    result = str(report.get('result'))
    lines = [
        '# KEVILO security demo report',
        '',
        f"- Bài: `{report.get('scenario', '')}`",
        f"- Target: `{report.get('target', '')}`",
        f"- Thời điểm: {report.get('at', '')}",
        f"- Kết quả: **{result}** — {RESULT_LABELS.get(result, 'xem lý do bên dưới')}",
    ]
    for key, label in (('expected', 'Kỳ vọng'), ('passed', 'Passed'), ('completed', 'Đã hoàn tất'),
                       ('revision', 'Revision'), ('dirty', 'Dirty'), ('run', 'Fixture run'),
                       ('orderId', 'Order'), ('productId', 'Product'), ('reviewId', 'Review'),
                       ('payload', 'Payload')):
        if report.get(key) is not None:
            lines.append(f'- {label}: `{_cell(report[key])}`')
    if report.get('detail'):
        lines += ['', '## Lý do', '', str(report['detail'])]
    evidence = report.get('evidence')
    if isinstance(evidence, dict) and evidence:
        lines += ['', f"## {evidence.get('observedTitle') or 'Dữ liệu quan sát được'}", '',
                  _table(_rows(evidence.get('observed')))]
        lines += ['', f"## {evidence.get('controlsTitle') or 'Đối chứng'}", '',
                  _table(_rows(evidence.get('controls')))]
        limits = [str(item) for item in evidence.get('limits') or [] if item]
        if limits:
            lines += ['', '## Giới hạn', '']
            lines += [f'- {item}' for item in limits]
        if evidence.get('redacted'):
            lines += ['', '> Chi tiết observed đã bị che cho target ngoài loopback.']
    requests = _rows(report.get('requests'))
    if requests:
        lines += ['', '## Request đã gửi', '', '| # | Actor | Method | Path | Status | Error |',
                  '| --- | --- | --- | --- | --- | --- |']
        for index, row in enumerate(requests, start=1):
            lines.append(
                f"| {index} | {_cell(row.get('actor', ''))} | {_cell(row.get('method', ''))} | "
                f"{_cell(row.get('path', ''))} | {_cell(row.get('status', ''))} | {_cell(row.get('error', ''))} |"
            )
    return '\n'.join(lines) + '\n'
