"""Bounded synthetic-fixture probes. Windows/Linux; Python standard library only.

The scenario implementations live in probes/. This module only parses arguments,
applies the shared target/fixture guards, dispatches one probe and prints one JSON
report on stdout. Use --observe for a normal demonstration; --expect is only an
optional PASS/FAIL assertion for CI.
"""
import argparse
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

import core
from core import DEFAULT_FIXTURE, SQLI_PAYLOADS, Inconclusive, data, require
from probes import auth, idor, release, sqli

SCENARIOS = ('release', 'sqli', 'idor', 'idor-update', 'idor-cancel', 'auth')


def main(fixed_scenario=None):
    core.TRACE.clear()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', help='Default: http://127.0.0.1:3000; remote targets require explicit fixture and revision.')
    parser.add_argument('--fixture', type=Path)
    expectation = parser.add_mutually_exclusive_group()
    expectation.add_argument('--expect', choices=['vulnerable', 'secure'])
    expectation.add_argument('--observe', action='store_true', help='Report observed behavior without an expectation.')
    parser.add_argument('--trace', action='store_true', help='Stream request method/path/status to stderr; JSON stays on stdout.')
    parser.add_argument('--revision', help='Exact reviewed revision (required by release check)')
    parser.add_argument('--order', help='Optional order UUID; owner control must prove ownership before any mutation.')
    parser.add_argument('--address', help='Synthetic shipping address for idor-update (5..255 characters).')
    parser.add_argument('--payload', choices=SQLI_PAYLOADS, default=SQLI_PAYLOADS[0], help='SQLi: bounded read-only demo search payload.')
    parser.add_argument('--wrong-password', default=core.DEFAULT_WRONG_PASSWORD, help='Auth: a deliberately incorrect synthetic password, never the real password.')
    parser.add_argument('--show-evidence', action='store_true', help='Show observed evidence for a non-loopback target after authorization.')
    parser.add_argument('--scenario', choices=SCENARIOS, default=fixed_scenario, required=fixed_scenario is None)
    args = parser.parse_args()
    core.TRACE_ENABLED = args.trace
    if args.address is not None and args.scenario != 'idor-update':
        parser.error('--address is only valid for idor-update')
    if args.order is not None and not args.scenario.startswith('idor'):
        parser.error('--order is only valid for IDOR scenarios')
    explicit_fixture = args.fixture is not None
    args.url = args.url or 'http://127.0.0.1:3000'
    if args.scenario != 'release' and args.fixture is None:
        args.fixture = DEFAULT_FIXTURE
    local = core.is_loopback(args.url)
    if args.scenario != 'release' and args.expect is None and not args.observe:
        args.observe = True
    report = {'scenario': args.scenario, 'target': args.url, 'at': datetime.now(timezone.utc).isoformat()}
    report['evidence'] = {}
    try:
        client = core.Client(args.url)
        if not local and args.scenario != 'release':
            require(explicit_fixture and bool(args.revision), 'Remote targets require --fixture and --revision explicitly.')
        if args.scenario == 'release':
            result, evidence = release.run(client, args.revision or '', local, args.show_evidence)
        else:
            require(args.fixture is not None, 'Supply --fixture.')
            fixture = json.loads(Path(args.fixture).read_text(encoding='utf-8'))
            require(fixture.get('schema') == 1, 'Unsupported fixture manifest.')
            if args.order:
                require(str(uuid.UUID(args.order)) == args.order.lower(), 'Use a valid order UUID.')
                fixture['orderId'] = args.order
            version = data(client, '/api/version')
            report['revision'] = version.get('revision')
            report['run'] = fixture['run']
            if args.expect:
                report['expected'] = args.expect
            report['accounts'] = {name: fixture[name]['email'] for name in ('owner', 'attacker')}
            report['orderId'] = fixture.get('orderId')
            report['productId'] = fixture.get('productId')
            report['frontend'] = 'http://127.0.0.1:5173' if local else args.url
            report['dirty'] = version.get('dirty')
            if args.scenario == 'sqli':
                report['payload'] = args.payload
            if args.revision:
                require(version.get('revision') == args.revision and version.get('dirty') is False, 'Backend revision mismatch or dirty build.')
            if args.scenario == 'sqli':
                result, evidence = sqli.run(client, fixture, args.payload, local, args.show_evidence)
            elif args.scenario == 'auth':
                result, evidence = auth.run(client, fixture, args.wrong_password, local, args.show_evidence)
            else:
                result, evidence = idor.run(client, fixture, args.scenario, args.address, local, args.show_evidence)
        report['result'] = result
        report['evidence'] = evidence
        if args.observe and args.scenario != 'release':
            report['completed'] = True
            code = 0
        else:
            expected = 'RELEASE_VERIFIED' if args.scenario == 'release' else 'EXPLOIT_CONFIRMED' if args.expect == 'vulnerable' else 'DEFENSE_VERIFIED'
            report['passed'] = result == expected
            code = 0 if report['passed'] else 1
    except (Inconclusive, OSError, ValueError, KeyError, TypeError, AttributeError, IndexError) as error:
        # Do not print exception payloads, cookies, fixture credentials or response bodies.
        report.update(result='INCONCLUSIVE', detail=str(error) if isinstance(error, Inconclusive) else type(error).__name__)
        report['completed' if args.observe else 'passed'] = False
        code = 2
    report['requests'] = core.TRACE
    print(json.dumps(report, ensure_ascii=True))
    return code


if __name__ == '__main__':
    sys.exit(main())
