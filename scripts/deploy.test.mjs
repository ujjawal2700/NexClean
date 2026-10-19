import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Exercise deployment control flow without touching Git, PM2, nginx or a database.
function deploy(options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'nexclean-deploy-'));
  try {
    const bin = join(root, 'bin');
    mkdirSync(bin);
    mkdirSync(join(root, 'backend/dist/config'), { recursive: true });
    mkdirSync(join(root, 'frontend/dist'), { recursive: true });
    copyFileSync(new URL('../deploy.sh', import.meta.url), join(root, 'deploy.sh'));
    copyFileSync(new URL('../backend/ecosystem.config.js', import.meta.url), join(root, 'backend/ecosystem.config.js'));
    writeFileSync(join(root, 'backend/dist/index.js'), '');
    writeFileSync(join(root, 'backend/dist/config/env.js'), `exports.assertProductionConfig = () => {
      if (process.env.INVALID_CONFIG) throw new Error('Invalid production config');
    };`);
    const command = `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const tool = path.basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CALLS, JSON.stringify([tool, ...args]) + '\\n');
if (tool === 'npm' && process.env.BUILD_FAIL && args.join(' ') === 'run build') process.exit(1);
if (tool === 'sudo' && process.env.NGINX_FAIL && args[0] === 'nginx') process.exit(1);
if (tool === 'pm2' && args[0] === 'jlist') {
  const count = process.env.BAD_WORKERS ? 0 : 4;
  console.log(JSON.stringify(Array.from({ length: count }, () => ({
    name: 'nexclean-api', pm2_env: { status: 'online', exec_mode: 'cluster_mode' },
  }))));
}
`;
    for (const tool of ['git', 'npm', 'pm2', 'sudo', 'sleep']) {
      writeFileSync(join(bin, tool), command, { mode: 0o755 });
    }
    const calls = join(root, 'calls');
    const result = spawnSync('bash', [join(root, 'deploy.sh')], {
      cwd: root,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, CALLS: calls, ...options },
      encoding: 'utf8', timeout: 20000,
    });
    return { ...result, calls: readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('deploy starts or reloads from the ecosystem and saves healthy workers without deleting apps', () => {
  const result = deploy();
  assert.equal(result.status, 0, result.stderr);
  const pm2 = result.calls.filter(([tool]) => tool === 'pm2');
  assert.deepEqual(pm2[0], ['pm2', 'startOrReload', 'ecosystem.config.js', '--only', 'nexclean-api', '--update-env']);
  assert(pm2.some(([, action]) => action === 'save'));
  assert(!pm2.some(([, action]) => ['delete', 'stop', 'kill'].includes(action)));
  assert(result.calls.some(call => call.join(' ') === 'sudo systemctl reload nginx'));
});

test('a failed build leaves PM2 untouched', () => {
  const result = deploy({ BUILD_FAIL: '1' });
  assert.notEqual(result.status, 0);
  assert(!result.calls.some(([tool]) => tool === 'pm2'));
  assert(!result.calls.some(call => call.join(' ') === 'sudo systemctl reload nginx'));
});

test('invalid production settings fail before PM2 reload', () => {
  const result = deploy({ INVALID_CONFIG: '1' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid production config/);
  assert(!result.calls.some(([tool]) => tool === 'pm2'));
});

test('invalid nginx configuration prevents a build or PM2 action', () => {
  const result = deploy({ NGINX_FAIL: '1' });
  assert.notEqual(result.status, 0);
  assert(!result.calls.some(([tool]) => tool === 'npm' || tool === 'pm2'));
});

test('missing workers fail deployment without saving an empty process list', () => {
  const result = deploy({ BAD_WORKERS: '1' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Expected four online cluster workers/);
  assert(!result.calls.some(call => call.join(' ') === 'pm2 save'));
  assert(!result.calls.some(call => call.join(' ') === 'sudo systemctl reload nginx'));
});
