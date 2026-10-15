#!/usr/bin/env node

/**
 * 后端「空框架」清理脚本
 *
 * 功能：清理后端业务模块，只保留一套可直接启动的空框架 —— 登录登出 + 组织管理 + 权限管理（含操作日志）。
 *
 * 保留：
 * - src/common、src/config、app.module、main（框架基座，不动）
 * - src/modules/base（登录登出 open/auth、组织 user/department/position、权限 role/menu、日志 log）
 * - prisma schema 中的 base_sys_* 表 + sys_operation_log（全局操作日志拦截器依赖）
 * - seed 中的：超管、默认角色、系统菜单（组织/权限）、默认岗位
 *
 * 清理：
 * - src/modules 下除 base 外的所有模块目录（coding/dict/exam/plugin/recycle/space/task/system 等）
 * - prisma/schema.prisma 中上述被删模块对应的 model
 * - seed.service.ts 中导航菜单/参数配置/AI模型/数据字典的初始化
 * - prisma/migrations 旧迁移（表结构已变，需重新生成初始迁移）
 *
 * 用法：
 *   node scripts/clean-demo-modules.js
 *
 * 策略：白名单模式 —— 只声明要保留的，其余一律删除（新增的业务模块也会被自动清理）。
 * 兜底：删除前用 git 提交一次，出错可 git 恢复。
 */

const fs = require('fs');
const path = require('path');

// ==================== 配置区域（白名单） ====================

const KEEP = {
  // src/modules 下要保留的模块目录（其余全删）
  modules: [
    'base', // 登录登出 + 组织管理 + 权限管理 + 操作日志，三块核心全在这
  ],

  // prisma/schema.prisma 中要保留的 model（其余 model 全删）
  // 注意：SysOperationLog 必须保留 —— 全局 OperationLogInterceptor 依赖它，删了会编译失败
  schemaModels: [
    'SysUser',
    'SysRole',
    'SysMenu',
    'SysDepartment',
    'SysUserRole',
    'SysRoleMenu',
    'SysRoleDepartment',
    'SysLog',
    'SysPosition',
    'SysParam',
    'SysOperationLog',
  ],

  // seed.service.ts 中要删除的「初始化调用 + 方法定义」（保留 admin/角色/菜单/岗位）
  seedMethodsToRemove: [
    'seedNavMenus', // 导航菜单（系统管理/外部考生/考点/题库）—— 依赖已删模块
    'seedParamConfig', // 参数配置 —— system 模块已删
    'seedAiModel', // AI 模型 —— system 模块已删
    'seedDict', // 数据字典 —— dict 模块已删
  ],
};

// ==================== 工具函数 ====================

/** 递归删除文件或目录 */
function deleteFileOrDir(target) {
  if (!fs.existsSync(target)) {
    console.log(`⚠️  路径不存在，跳过: ${target}`);
    return;
  }
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`✅ 已删除: ${path.relative(process.cwd(), target)}`);
}

/**
 * 从源码文本中删除一个「方法定义」（大括号配平，安全处理嵌套）
 * @param {string} src 源码
 * @param {string} methodName 方法名，如 seedDict
 * @returns {string} 删除后的源码
 */
function removeMethodBlock(src, methodName) {
  // 只匹配方法声明本身（不含 JSDoc），避免跨方法的贪婪匹配吞掉中间代码
  const declRe = new RegExp(`private\\s+async\\s+${methodName}\\s*\\(`);
  const m = declRe.exec(src);
  if (!m) return src;

  // 起点：方法声明处；若其上方紧邻一段 JSDoc（/** ... */），一并纳入删除
  let start = m.index;
  const before = src.slice(0, start);
  // 吸附声明前的缩进空白
  const wsMatch = /[ \t]*$/.exec(before);
  let cut = start - (wsMatch ? wsMatch[0].length : 0);
  // 若紧邻上一行是 JSDoc 结尾，回溯到 /** 起点
  const beforeWs = src.slice(0, cut).replace(/\s*$/, '');
  if (beforeWs.endsWith('*/')) {
    const jsdocStart = src.lastIndexOf('/**', beforeWs.length - 1);
    if (jsdocStart !== -1) cut = jsdocStart;
  }
  start = cut;

  // 从声明后的第一个 '{' 开始大括号配平，找方法体结束的 '}'
  let i = m.index;
  while (i < src.length && src[i] !== '{') i++;
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  // 删除 [start, i]（含结尾 '}'）
  return src.slice(0, start) + src.slice(i + 1);
}

// ==================== 清理逻辑 ====================

/**
 * 1) 清理 src/modules：删除白名单外的模块目录
 * app.module 用 discoverModules() 自动发现模块，删目录即生效，无需改注册代码
 */
function cleanModules() {
  console.log('\n📁 清理 src/modules...');
  const modulesDir = path.join(process.cwd(), 'src/modules');
  if (!fs.existsSync(modulesDir)) {
    console.log('⚠️  src/modules 不存在，跳过');
    return;
  }
  const dirs = fs.readdirSync(modulesDir).filter((d) => !d.startsWith('.'));
  const toDelete = dirs.filter((d) => !KEEP.modules.includes(d));
  if (toDelete.length === 0) {
    console.log('✅ 没有需要删除的模块');
    return;
  }
  console.log(`📋 将删除 ${toDelete.length} 个模块: ${toDelete.join(', ')}`);
  toDelete.forEach((d) => deleteFileOrDir(path.join(modulesDir, d)));
}

/**
 * 2) 清理 prisma/schema.prisma：保留白名单 model，删其余
 * 按 model 块大括号配平解析；保留 model 前的 /// 文档注释；generator/datasource 原样保留
 */
function cleanSchema() {
  console.log('\n📁 清理 prisma/schema.prisma...');
  const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    console.log('⚠️  schema.prisma 不存在，跳过');
    return;
  }
  const src = fs.readFileSync(schemaPath, 'utf-8');
  const lines = src.split('\n');
  const out = [];
  const removed = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const modelMatch = /^model\s+(\w+)\s*\{/.exec(line.trim());

    if (modelMatch) {
      const modelName = modelMatch[1];
      // 找到本 model 块的结束行（大括号配平）
      let depth = 0;
      let j = i;
      for (; j < lines.length; j++) {
        for (const ch of lines[j]) {
          if (ch === '{') depth++;
          else if (ch === '}') depth--;
        }
        if (depth === 0) break;
      }
      // j 为 model 块结束行下标
      if (KEEP.schemaModels.includes(modelName)) {
        for (let k = i; k <= j; k++) out.push(lines[k]);
      } else {
        removed.push(modelName);
        // 回收该 model 前紧邻的 /// 文档注释行（已 push 进 out 的尾部）
        while (out.length && /^\s*\/\/\//.test(out[out.length - 1])) out.pop();
        // 同时去掉紧邻的空行，避免留大量空白
        while (out.length && out[out.length - 1].trim() === '') out.pop();
      }
      i = j + 1;
      continue;
    }
    out.push(line);
    i++;
  }

  // 折叠 3+ 连续空行为 1 个空行
  const cleaned = out.join('\n').replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(schemaPath, cleaned, 'utf-8');
  if (removed.length) {
    console.log(`✅ 已删除 ${removed.length} 个 model: ${removed.join(', ')}`);
  } else {
    console.log('✅ 没有需要删除的 model');
  }
}

/**
 * 3) 清理 seed.service.ts：移除被删模块的种子（调用行 + 方法定义）
 * 保留：超管、默认角色、seedMenus（组织/权限菜单）、seedPositions
 */
function cleanSeed() {
  console.log('\n📁 清理 src/common/seed.service.ts...');
  const seedPath = path.join(process.cwd(), 'src/common/seed.service.ts');
  if (!fs.existsSync(seedPath)) {
    console.log('⚠️  seed.service.ts 不存在，跳过');
    return;
  }
  let src = fs.readFileSync(seedPath, 'utf-8');

  KEEP.seedMethodsToRemove.forEach((name) => {
    // 删 run() 里的调用行：await this.seedXxx();
    const callRe = new RegExp(`\\n[ \\t]*await this\\.${name}\\([^)]*\\);`, 'g');
    src = src.replace(callRe, '');
    // 删方法定义块
    src = removeMethodBlock(src, name);
  });

  // 只含空白的行归一化为空行，再折叠多余空行，并清理 class 结尾多余空行
  src = src
    .replace(/^[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n\s*\n}\s*$/, '\n}\n');
  fs.writeFileSync(seedPath, src, 'utf-8');
  console.log(`✅ 已移除种子方法: ${KEEP.seedMethodsToRemove.join(', ')}`);
}

/**
 * 4) 删除旧迁移：表结构已变，保留旧迁移会重建被删的表
 * 删除后需重新生成初始迁移（见脚本结尾提示）
 */
function cleanMigrations() {
  console.log('\n📁 清理 prisma/migrations...');
  const migDir = path.join(process.cwd(), 'prisma/migrations');
  if (!fs.existsSync(migDir)) {
    console.log('⚠️  migrations 不存在，跳过');
    return;
  }
  fs.readdirSync(migDir).forEach((entry) => {
    // 保留 migration_lock.toml（记录 provider），只删迁移目录
    if (entry === 'migration_lock.toml') return;
    deleteFileOrDir(path.join(migDir, entry));
  });
  console.log('✅ 旧迁移已清空（保留 migration_lock.toml）');
}

// ==================== 主流程 ====================

function confirmClean() {
  console.log('\n' + '='.repeat(64));
  console.log('⚠️  警告：将把后端裁剪为「空框架」，删除白名单外的全部业务模块！');
  console.log('='.repeat(64));
  console.log('\n保留：登录登出 + 组织管理 + 权限管理 + 操作日志');
  console.log('  - 模块目录:', KEEP.modules.join(', '));
  console.log('  - schema models:', KEEP.schemaModels.join(', '));
  console.log('\n删除：src/modules 其余模块、schema 对应 model、');
  console.log('      seed 的导航/参数/AI/字典初始化、prisma/migrations 旧迁移');
  console.log('\n建议先 git 提交当前代码，出错可 git 恢复。');
  console.log('\n如果要继续，请在 5 秒内按 Ctrl+C 取消...\n');
}

function showSummary() {
  console.log('\n' + '='.repeat(64));
  console.log('✨ 精简完成！后端现在是一套可启动的空框架。');
  console.log('='.repeat(64));
  console.log('\n💡 后续步骤：');
  console.log('  1. 生成初始迁移：pnpm prisma migrate dev --name init');
  console.log('     （schema 已裁剪，会生成只含核心表的干净初始迁移）');
  console.log('  2. 验证编译：pnpm build');
  console.log('  3. 如需恢复：git checkout . 撤销本次删除\n');
}

async function main() {
  try {
    confirmClean();
    await new Promise((r) => setTimeout(r, 5000));

    console.log('🚀 开始精简后端...\n');
    cleanModules();
    cleanSchema();
    cleanSeed();
    cleanMigrations();
    showSummary();
  } catch (e) {
    console.error('\n❌ 精简过程出错:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
