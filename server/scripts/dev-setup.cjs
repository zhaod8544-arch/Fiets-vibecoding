// Cross-platform development setup. Uses installed CLIs directly, without a shell.
const { spawn, spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const { setTimeout: sleep } = require('node:timers/promises');

const root = resolve(__dirname, '..');
const env = { ...process.env, NODE_ENV: 'development' };
const bins = {
  prisma: 'prisma/build/index.js',
  'ts-node': 'ts-node/dist/bin.js',
  nest: '@nestjs/cli/bin/nest.js',
};

function commandFor(command, args) {
  return bins[command]
    ? [process.execPath, [require.resolve(bins[command]), ...args]]
    : [command, args];
}

function run(command, args, { quiet = false } = {}) {
  const [file, argv] = commandFor(command, args);
  const result = spawnSync(file, argv, {
    cwd: root, env, encoding: 'utf8', windowsHide: true,
    stdio: quiet ? 'pipe' : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} 执行失败（${result.status}）${result.stderr ? `: ${result.stderr.trim()}` : ''}`);
  return result.stdout || '';
}

function launch(command, args) {
  const [file, argv] = commandFor(command, args);
  return spawn(file, argv, { cwd: root, env, stdio: 'inherit', windowsHide: true });
}

function stop(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    // Terminate only the process trees created by this startup command.
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  } else {
    child.kill('SIGTERM');
  }
}

async function serve(launchProcess = launch, stopProcess = stop) {
  env.PRISMA_STUDIO_PORT = '5555';
  const children = [];
  const cleanup = () => children.forEach(stopProcess);
  const interrupt = () => { cleanup(); process.exitCode = 130; };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    await new Promise((resolveDone, reject) => {
      const studio = launchProcess('prisma', ['studio', '--port', '5555', '--browser', 'none']);
      children.push(studio);
      studio.once('error', reject);
      studio.once('exit', (code) => {
        if (code) reject(new Error(`Prisma Studio 退出（${code}），请检查 5555 端口是否被占用`));
      });
      const server = launchProcess('nest', ['start', '--watch']);
      children.push(server);
      server.once('error', reject);
      server.once('exit', (code, signal) => {
        if (code === 0 || signal === 'SIGINT' || signal === 'SIGTERM' || process.exitCode === 130) resolveDone();
        else reject(new Error(`开发服务退出（${code}）`));
      });
    });
  } finally {
    cleanup();
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
}

async function main(mode = 'init', deps = {}) {
  const execute = deps.run || run;
  const wait = deps.sleep || sleep;
  const log = deps.log || console.log;
  if (!['init', 'serve'].includes(mode)) throw new Error('用法：node scripts/dev-setup.cjs [init|serve]');
  log('初始化开发环境...');
  try {
    execute('docker', ['compose', 'version'], { quiet: true });
  } catch {
    throw new Error('未找到 Docker Compose。请安装并启动 Docker Desktop，再运行 npm run dev；无需安装 WSL 发行版来运行此脚本。');
  }
  execute('docker', ['compose', '-f', 'docker/docker-compose.dev.yaml', 'up', '-d']);
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      execute('docker', ['exec', 'agentpm-mysql-dev', 'mysqladmin', 'ping', '-uroot', '-p123456', '--silent'], { quiet: true });
      ready = true;
      break;
    } catch {
      await wait(2000);
    }
  }
  if (!ready) throw new Error('MySQL 等待超时（60s），请检查：docker logs agentpm-mysql-dev');
  execute('prisma', ['db', 'push']);
  execute('ts-node', ['scripts/sync-db-comments.ts']);
  const count = execute('docker', ['exec', 'agentpm-mysql-dev', 'mysql', '-uroot', '-p123456', '-N', '-e', 'USE agentpm; SELECT COUNT(*) FROM base_sys_user;'], { quiet: true }).trim();
  if (!/^\d+$/.test(count)) throw new Error('无法读取用户数量，停止种子初始化');
  if (Number(count) === 0) execute('prisma', ['db', 'seed']);
  else log('种子数据已存在，跳过初始化');
  log('开发环境初始化完成');
  if (mode === 'serve') {
    log('启动开发服务和 Prisma Studio：http://localhost:5555');
    await serve(deps.launch, deps.stop);
  } else log('启动开发服务：npm run dev');
}

module.exports = { main, commandFor };
if (require.main === module) {
  main(process.argv[2]).catch((error) => {
    console.error(`[ERROR] ${error.message}`);
    process.exitCode = 1;
  });
}
