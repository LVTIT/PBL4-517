"""IDOR read/update/cancel probe with bounded evidence for each scenario."""
import json

from core import data, redact_evidence, require, summarize_order, truncate


def _product_names(order):
    names = {}
    items = order.get('items') if isinstance(order.get('items'), list) else []
    for item in items:
        if not isinstance(item, dict):
            continue
        product = item.get('product') if isinstance(item.get('product'), dict) else {}
        names[item.get('productId')] = product.get('name') or item.get('productId')
    return names


def _stock_items(quantities, before_stock, after_stock=None, names=None):
    items = []
    for product_id, quantity in quantities.items():
        name = (names or {}).get(product_id, product_id)
        before = before_stock.get(product_id)
        if after_stock is None:
            items.append({'label': truncate(name, 36), 'value': f'{before} (đặt {quantity})'})
            continue
        after = after_stock.get(product_id)
        if isinstance(before, int) and isinstance(after, int):
            items.append({'label': truncate(name, 36), 'value': f'{before} → {after} ({after - before:+d})'})
        else:
            items.append({'label': truncate(name, 36), 'value': f'{before} → {after}'})
    return items


def _evidence(scenario, before, after, body, status, stock, after_stock, quantities, names, marker):
    status_label = f' (HTTP {status})' if status in (200, 403) else ''
    observed_title = ('Dữ liệu attacker đọc được' if scenario == 'idor' else 'Tác động lên đơn của owner') + status_label
    observed = []
    if status == 403:
        observed.append({'label': 'HTTP', 'value': '403 FORBIDDEN'})
        observed.append({
            'label': 'Dữ liệu',
            'value': 'không có — attacker không đọc được đơn' if scenario == 'idor' else 'không thay đổi',
        })
    elif status == 200:
        observed.append({'label': 'HTTP', 'value': '200 OK'})
        if scenario == 'idor':
            observed.extend(summarize_order(body.get('data', {})))
        elif scenario == 'idor-update':
            observed.extend([
                {'label': 'Địa chỉ trước', 'value': truncate(before.get('shippingAddress') or '(trống)')},
                {'label': 'Địa chỉ sau', 'value': truncate(after.get('shippingAddress') or '(trống)')},
                {'label': 'Body PATCH', 'value': json.dumps({'shippingAddress': marker}, ensure_ascii=False)},
                {'label': 'Trạng thái', 'value': truncate(after.get('status'))},
            ])
        else:
            observed.extend([
                {'label': 'Trạng thái', 'value': f"{before.get('status')} → {after.get('status')}"},
                *_stock_items(quantities, stock, after_stock, names),
            ])

    controls = [
        {'label': 'Owner GET', 'value': '200 OK'},
        {'label': 'Attacker', 'value': f"{status} {body.get('error', {}).get('code', '')}".strip()},
    ]
    if status == 403:
        controls.append({
            'label': 'Đơn/stock',
            'value': 'không đổi' if before == after and stock == after_stock else 'CÓ THAY ĐỔI',
        })
    elif scenario == 'idor':
        controls.append({
            'label': 'Đơn/stock',
            'value': 'không đổi' if before == after and stock == after_stock else 'CÓ THAY ĐỔI',
        })
    elif scenario == 'idor-update':
        controls.extend(_stock_items(quantities, stock, after_stock, names))
    else:
        controls.append({'label': 'Hoàn kho', 'value': 'khớp số lượng từng sản phẩm'})

    limits = {
        'idor': ['Chỉ chứng minh đơn fixture bị lộ; không suy ra mọi endpoint.'],
        'idor-update': ['Chỉ chứng minh một đơn fixture bị sửa; không kiểm tra concurrency.'],
        'idor-cancel': ['Chỉ chứng minh một đơn fixture bị hủy; không kiểm tra concurrency.'],
    }[scenario]
    return {
        'observedTitle': observed_title,
        'observed': observed,
        'controlsTitle': 'Đối chứng',
        'controls': controls,
        'limits': limits,
    }


def run(client, fixture, scenario, address=None, local=True, show_evidence=False):
    owner = client.spawn()
    owner.login(fixture['owner'])
    client.login(fixture['attacker'])
    require(fixture['owner']['id'] != fixture['attacker']['id'], 'Owner and attacker must differ.')
    path = '/api/orders/' + fixture['orderId']
    before = data(owner, path)
    require(before.get('userId') == fixture['owner']['id'], 'Order ownership precondition failed.')
    quantities = {}
    for item in before.get('items', []):
        quantities[item['productId']] = quantities.get(item['productId'], 0) + item['quantity']
    require(bool(quantities), 'Order has no items; cannot verify stock controls.')
    stock = {product: data(owner, '/api/products/' + product)['stock'] for product in quantities}
    if scenario != 'idor':
        require(before.get('status') == 'PENDING', 'Mutation requires a fresh PENDING fixture order.')
    marker = address.strip() if address is not None else 'Synthetic attacker ' + fixture['run']
    require(isinstance(marker, str) and 5 <= len(marker.strip()) <= 255, 'Address must contain 5 to 255 characters.')
    require(scenario != 'idor-update' or before.get('shippingAddress') != marker, 'Use a fresh run for repeated update tests.')
    if scenario == 'idor-update':
        status, body = client.request(path, 'PATCH', {'shippingAddress': marker})
    elif scenario == 'idor-cancel':
        status, body = client.request(path + '/cancel', 'POST', {})
    else:
        status, body = client.request(path)
    after = data(owner, path)
    after_stock = {product: data(owner, '/api/products/' + product)['stock'] for product in quantities}
    names = _product_names(before)
    evidence = _evidence(scenario, before, after, body, status, stock, after_stock, quantities, names, marker)
    if status == 403 and body.get('error', {}).get('code') == 'FORBIDDEN':
        require(before == after and stock == after_stock, 'Order/stock changed despite forbidden response.')
        return 'DEFENSE_VERIFIED', redact_evidence(evidence, local, show_evidence)
    require(status == 200 and body.get('data', {}).get('id') == fixture['orderId'], f'Unexpected attack response HTTP {status}; not proof of defense.')
    if scenario == 'idor-update':
        require(after['shippingAddress'] == marker and after_stock == stock, 'Update not persisted as expected.')
    elif scenario == 'idor-cancel':
        require(after['status'] == 'CANCELLED' and all(after_stock[p] == stock[p] + q for p, q in quantities.items()), 'Cancellation/stock restoration not persisted.')
    else:
        require(body['data'].get('userId') == fixture['owner']['id'], 'Response did not disclose fixture ownership.')
    return 'EXPLOIT_CONFIRMED', redact_evidence(evidence, local, show_evidence)
