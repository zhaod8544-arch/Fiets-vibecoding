#!/usr/bin/env bash
# CI 自动补迁移脚本（方案 A：主流安全性 + 全自动）。
#
# 作用：比对 prisma/migrations（迁移历史）与 prisma/schema.prisma（当前模型），
#   - 无差异           → 直接通过，什么都不做。
#   - 有差异且【安全】  → 自动生成迁移文件（加表/加可空字段/加索引），供 CI 提交回仓库。
#   - 有差异且【危险】  → 退出码 1，CI 报红拦住，需人工确认，绝不自动上生产。
#
# 危险操作定义（可能丢生产数据）：DROP TABLE / DROP COLUMN / MODIFY COLUMN（改类型）/
#   加 NOT NULL 且无默认值 的列。命中任一即判危险。
#
# 依赖环境变量：
#   SHADOW_DATABASE_URL  空的 MySQL 库连接串（CI 里由 MySQL service 提供）
#
# 输出（写入 $GITHUB_OUTPUT，供后续 job 判断）：
#   changed=true|false   是否生成了新迁移文件
#   migration_dir=...    新迁移目录名（changed=true 时）
set -euo pipefail

cd "$(dirname "$0")/.."   # 切到 server/

: "${SHADOW_DATABASE_URL:?需要 SHADOW_DATABASE_URL 环境变量}"

MIGRATIONS_DIR="prisma/migrations"
SCHEMA="prisma/schema.prisma"
TMP_SQL="$(mktemp)"
# CI runner 一次性环境，仍显式清理临时文件（含 diff 的 stderr 捕获）
trap 'rm -f "$TMP_SQL" "$TMP_SQL.err"' EXIT

# 1) 生成"迁移历史 → 当前 schema"的差异 SQL
#    不吞错误：diff 命令本身失败（shadow 库异常/迁移历史损坏等）必须报红，
#    否则空文件会被下面误判为"无差异"而绿灯放行。
echo "[auto-migrate] 比对迁移历史与 schema..."
if ! npx prisma migrate diff \
  --from-migrations "$MIGRATIONS_DIR" \
  --to-schema-datamodel "$SCHEMA" \
  --shadow-database-url "$SHADOW_DATABASE_URL" \
  --script > "$TMP_SQL" 2>"$TMP_SQL.err"; then
  echo "::error::prisma migrate diff 执行失败，无法判断 schema 差异："
  cat "$TMP_SQL.err"
  exit 1
fi

# 去掉 prisma 的 warn 提示行，仅留 SQL（grep 写临时文件，跨平台兼容）
grep -vE '^warn |^For more information' "$TMP_SQL" > "${TMP_SQL}.clean" || true
mv "${TMP_SQL}.clean" "$TMP_SQL"

# 2) 无实质差异 → 通过（注意：Prisma 唯一索引是 CREATE UNIQUE INDEX，必须一并匹配）
if ! grep -qiE "CREATE TABLE|ALTER TABLE|CREATE( UNIQUE)? INDEX|DROP" "$TMP_SQL"; then
  echo "[auto-migrate] schema 与迁移一致，无需补迁移 ✓"
  echo "changed=false" >> "${GITHUB_OUTPUT:-/dev/stdout}"
  exit 0
fi

echo "[auto-migrate] 检测到 schema 漂移，生成的差异 SQL："
echo "--------------------------------------------------"
cat "$TMP_SQL"
echo "--------------------------------------------------"

# 3) 危险操作扫描：命中即拦截
DANGER=""
grep -qiE "DROP TABLE"   "$TMP_SQL" && DANGER="${DANGER}删表(DROP TABLE) "
grep -qiE "DROP COLUMN"  "$TMP_SQL" && DANGER="${DANGER}删列(DROP COLUMN) "
grep -qiE "MODIFY COLUMN|ALTER COLUMN" "$TMP_SQL" && DANGER="${DANGER}改列类型(MODIFY/ALTER COLUMN) "
# 加 NOT NULL 且无 DEFAULT 的新列，会导致既有行迁移失败
if grep -iE "ADD COLUMN" "$TMP_SQL" | grep -iE "NOT NULL" | grep -viE "DEFAULT" >/dev/null; then
  DANGER="${DANGER}新增非空无默认值列(ADD COLUMN NOT NULL 无 DEFAULT) "
fi

if [ -n "$DANGER" ]; then
  echo "::error::检测到可能破坏生产数据的迁移操作：${DANGER}"
  echo "[auto-migrate] 为保护生产数据，已拦截。请开发者本地执行 pnpm prisma migrate dev --name <描述>"
  echo "[auto-migrate] 人工确认迁移 SQL（含数据处理策略）后再提交。"
  echo "changed=false" >> "${GITHUB_OUTPUT:-/dev/stdout}"
  exit 1
fi

# 4) 安全漂移 → 生成正式迁移文件
TS="$(date -u +%Y%m%d%H%M%S)"
MIG_DIR="${MIGRATIONS_DIR}/${TS}_auto"
mkdir -p "$MIG_DIR"
cp "$TMP_SQL" "$MIG_DIR/migration.sql"
echo "[auto-migrate] 已生成安全迁移：$MIG_DIR/migration.sql"

# 5) 验证：含新迁移的完整历史，重放后应与 schema 零漂移（非破坏性，仅用 shadow 库）
echo "[auto-migrate] 验证新迁移重放后零漂移..."
if npx prisma migrate diff \
     --from-migrations "$MIGRATIONS_DIR" \
     --to-schema-datamodel "$SCHEMA" \
     --shadow-database-url "$SHADOW_DATABASE_URL" \
     --exit-code >/dev/null 2>&1; then
  echo "[auto-migrate] 迁移验证通过（零漂移）✓"
else
  echo "::error::生成的迁移重放后仍与 schema 不一致，请人工检查"
  exit 1
fi

echo "changed=true" >> "${GITHUB_OUTPUT:-/dev/stdout}"
echo "migration_dir=${TS}_auto" >> "${GITHUB_OUTPUT:-/dev/stdout}"

