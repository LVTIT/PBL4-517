// Offline contract tests: execute the actual probe module with a mocked browser/API.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
import test from 'node:test';

const sourceUrl = new URL('../xss.mjs', import.meta.url);
const source = readFileSync(sourceUrl, 'utf8');

async function runProbe({ vulnerable = false, values = { observe: true, trace: true }, missingReview = false } = {}) {
  const stdout = [], stderr = [], requests = [];
  let closed = false;
  const fixture = { run: 'synthetic-run', productId: 'product', reviewId: 'review', xssPayload: '<img onerror="window.__pbl517_xss_probe=1">' };
  const product = { name: 'KEVILO lab synthetic-run', reviews: missingReview ? [] : [{ id: fixture.reviewId, comment: fixture.xssPayload }], labUnsafeReviewHtml: vulnerable };
  const review = { waitFor: async () => {}, locator: () => ({ count: async () => (vulnerable ? 1 : 0) }) };
  const page = {
    request: { get: async url => {
      requests.push(url);
      return { status: () => 200, json: async () => ({ data: url.endsWith('/version') ? { revision: values.revision || 'unbuilt', dirty: !values.revision } : product }) };
    } },
    goto: async url => { requests.push(url); return { status: () => 200 }; },
    locator: () => ({ filter: () => review, count: async () => (vulnerable ? 1 : 0) }),
    waitForFunction: async () => { assert.ok(vulnerable); },
    evaluate: async () => (vulnerable ? 1 : undefined),
  };
  const processStub = {};
  const context = createContext({ URL, process: processStub, console: { log: text => stdout.push(text), error: text => stderr.push(text) } });
  const dependencies = {
    'node:assert/strict': { default: assert },
    'node:fs': { readFileSync: () => JSON.stringify(fixture) },
    'node:module': { createRequire: () => () => ({ chromium: { launch: async () => ({ newPage: async () => page, close: async () => { closed = true; } }) } }) },
    'node:util': { parseArgs: () => ({ values }) },
    'node:url': { fileURLToPath },
  };
  const module = new SourceTextModule(source, { context, initializeImportMeta: meta => { meta.url = sourceUrl.href; } });
  await module.link(async name => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    const exports = dependencies[name];
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  assert.equal(stdout.length, 1, 'stdout retains a single JSON report');
  assert.ok(closed, 'probe closes its mocked browser');
  return { report: JSON.parse(stdout[0]), stderr, requests, exitCode: processStub.exitCode };
}

for (const vulnerable of [true, false]) {
  test(`XSS observation reports ${vulnerable ? 'execution' : 'escaped text'} without an expectation`, async () => {
    const run = await runProbe({ vulnerable });
    assert.equal(run.exitCode, 0);
    assert.equal(run.report.result, vulnerable ? 'EXPLOIT_CONFIRMED' : 'DEFENSE_VERIFIED');
    assert.equal(run.report.completed, true);
    assert.equal(Object.hasOwn(run.report, 'passed'), false);
    assert.equal(Object.hasOwn(run.report, 'expected'), false);
    assert.equal(run.requests.length, 3);
    assert.equal(run.stderr.length, 3);
    assert.match(run.stderr[0], /GET \/api\/version -> 200/);
    const observed = Object.fromEntries(run.report.evidence.observed.map(row => [row.label, row.value]));
    assert.equal(observed['<img> trong review'], vulnerable ? '1' : '0');
    assert.equal(observed['window.__pbl517_xss_probe'], vulnerable ? '1' : 'undefined');
    assert.equal(observed['Review ID'], 'review');
    assert.equal(run.report.evidence.limits.length, 1);
  });
}

test('XSS remote evidence is redacted unless explicitly allowed', async () => {
  const run = await runProbe({ vulnerable: true, values: { observe: true, url: 'https://example.invalid', fixture: 'private.json', revision: 'a'.repeat(40) } });
  assert.equal(run.exitCode, 0);
  assert.equal(run.report.evidence.redacted, true);
  assert.ok(run.report.evidence.observed.every(row => row.value.includes('redacted')));
  assert.ok(run.report.evidence.limits.some(limit => limit.includes('--show-evidence')));
});

test('XSS explicit secure expectation still fails on observed execution', async () => {
  const run = await runProbe({ vulnerable: true, values: { expect: 'secure' } });
  assert.equal(run.exitCode, 1);
  assert.equal(run.report.expected, 'secure');
  assert.equal(run.report.passed, false);
  assert.equal(Object.hasOwn(run.report, 'completed'), false);
  assert.equal(run.stderr.length, 0);
});

test('XSS missing persisted payload stays inconclusive in observation mode', async () => {
  const run = await runProbe({ missingReview: true });
  assert.equal(run.exitCode, 2);
  assert.equal(run.report.result, 'INCONCLUSIVE');
  assert.equal(run.report.completed, false);
  assert.equal(run.requests.length, 2);
});
