"""Exact-release verification probe for the EC2 lab/release path."""
import hashlib
import json

from core import data, redact_evidence, require


def run(client, revision, local=True, show_evidence=False):
    require(len(revision) == 40 and all(c in '0123456789abcdef' for c in revision), 'Supply exact 40-character tested revision.')
    health = data(client, '/api/health')
    require(health.get('database') == 'connected', 'Database health failed.')
    backend = data(client, '/api/version')
    status, raw = client.raw('/release.json')
    require(status == 200, 'Frontend release manifest unavailable.')
    frontend = json.loads(raw)
    for component, metadata in [('backend', backend), ('frontend', frontend)]:
        require(metadata.get('component') == component and metadata.get('revision') == revision and metadata.get('dirty') is False, f'{component} is not the clean expected release.')
    files = frontend.get('files', {})
    require('index.html' in files and any(name.endswith('.js') for name in files), 'Incomplete frontend release manifest.')
    for name, expected in files.items():
        require(not name.startswith('/') and all(part not in ('', '.', '..') for part in name.split('/')) and '\\' not in name and '?' not in name and '#' not in name, 'Invalid artifact path.')
        status, raw = client.raw('/' + name)
        require(status == 200 and hashlib.sha256(raw).hexdigest() == expected, f'Frontend artifact mismatch: {name}')
    evidence = {
        'observedTitle': 'Thành phần release',
        'observed': [
            {'label': 'Backend', 'value': f"{backend.get('revision')} (dirty={backend.get('dirty')})"},
            {'label': 'Frontend', 'value': f"{frontend.get('revision')} (dirty={frontend.get('dirty')})"},
            {'label': 'Artifact', 'value': f'{len(files)} file đã đối chiếu hash'},
        ],
        'controlsTitle': 'Đối chứng',
        'controls': [{'label': 'Database health', 'value': str(health.get('database'))}],
        'limits': ['Metadata do server cung cấp; không chống giả mạo máy chủ.'],
    }
    return 'RELEASE_VERIFIED', redact_evidence(evidence, local, show_evidence)
