const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { EventEmitter } = require('node:events');

// Docker and long-running services are replaced at the process boundary.
async function exercise({ count = '0', fail = '', mode = 'init' } = {}) {
  assert.ok(existsSync(join(__dirname, 'dev-setup.cjs')), 'a Node startup entry must exist so Windows does not require Bash');
  const { main } = require('./dev-setup.cjs');
  const calls = [];
  const run = (command, args) => {
    const line = [command, ...args].join(' ');
    calls.push(line);
    if (line.includes(fail) && fail) throw new Error('dependency unavailable');
    return line.includes('SELECT COUNT') ? count : '';
  };
  await main(mode, { run, log() {}, sleep: async () => {} });
  return calls;
}

test('initializes containers and schema before seeding without Bash or pnpm', async () => {
  const calls = await exercise();
  assert.deepEqual(calls.slice(0, 3), [
    'docker compose version',
    'docker compose -f docker/docker-compose.dev.yaml up -d',
    'docker exec agentpm-mysql-dev mysqladmin ping -uroot -p123456 --silent',
  ]);
  assert.ok(calls.indexOf('prisma db push') < calls.indexOf('prisma db seed'));
  assert.ok(calls.includes('ts-node scripts/sync-db-comments.ts'));
  assert.ok(calls.every((line) => !/bash|pnpm|npx/.test(line)));
});

test('preserves existing users by skipping seed', async () => {
  const calls = await exercise({ count: ' 2\r\n' });
  assert.ok(!calls.includes('prisma db seed'));
});

test('stops initialization when Docker is unavailable', async () => {
  await assert.rejects(exercise({ fail: 'docker compose version' }), /Docker/);
});

test('times out when MySQL never becomes ready', async () => {
  await assert.rejects(exercise({ fail: 'mysqladmin' }), /MySQL.*超时/);
});

test('launches Studio and watch server and cleans up its children', async () => {
  const { main } = require('./dev-setup.cjs');
  const started = [];
  const stopped = [];
  await main('serve', {
    run: (command, args) => args.includes('-N') ? '1' : '',
    log() {},
    launch(command, args) {
      const child = new EventEmitter();
      started.push({ command, args, child });
      if (command === 'nest') setImmediate(() => child.emit('exit', 0));
      return child;
    },
    stop: (child) => stopped.push(child),
  });
  assert.deepEqual(started.map(({ command, args }) => [command, ...args]), [
    ['prisma', 'studio', '--port', '5555', '--browser', 'none'],
    ['nest', 'start', '--watch'],
  ]);
  assert.deepEqual(stopped, started.map(({ child }) => child));
});

test('resolves installed JavaScript CLIs without Windows cmd wrappers', () => {
  const { commandFor } = require('./dev-setup.cjs');
  for (const command of ['prisma', 'ts-node', 'nest']) {
    const [file, args] = commandFor(command, ['--version']);
    assert.equal(file, process.execPath);
    assert.ok(existsSync(args[0]));
    assert.equal(args[1], '--version');
  }
});
