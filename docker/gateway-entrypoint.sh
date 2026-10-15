#!/bin/sh
# 网关启动期脚本（由 nginx 官方镜像的 /docker-entrypoint.d/ 机制自动执行，先于 nginx 启动）。
# 读 frontends.json，对每个前端按其 port 渲染 nginx server 块（按端口分流，不依赖域名）。
# 用 nginx-server.conf.tpl 渲染出 /etc/nginx/conf.d/<name>.conf。
# 新增前端：frontends.json 加一行（含 port）+ docker-compose.yaml 加该端口映射，本脚本自动生成 server 块。
set -eu

MANIFEST=/etc/nginx/frontends.json
TEMPLATE=/etc/nginx/nginx-server.conf.tpl
CONF_D=/etc/nginx/conf.d

# 清掉基础镜像自带的 default.conf 及历史渲染，避免残留
rm -f "$CONF_D"/*.conf 2>/dev/null || true

count=$(jq 'length' "$MANIFEST")
i=0
rendered=0
while [ "$i" -lt "$count" ]; do
  name=$(jq -r ".[$i].name" "$MANIFEST")
  api_prefix=$(jq -r ".[$i].apiPrefix" "$MANIFEST")
  port=$(jq -r ".[$i].port" "$MANIFEST")

  if [ -z "$port" ] || [ "$port" = "null" ]; then
    echo "[gateway] 警告：前端 '$name' 未在 frontends.json 配置 port，跳过（该前端将无法访问）"
    i=$((i + 1))
    continue
  fi

  sed -e "s|__PORT__|${port}|g" \
      -e "s|__NAME__|${name}|g" \
      -e "s|__API_PREFIX__|${api_prefix}|g" \
      "$TEMPLATE" > "$CONF_D/$name.conf"
  echo "[gateway] 渲染 $name → listen ${port}  api=$api_prefix"
  rendered=$((rendered + 1))
  i=$((i + 1))
done

if [ "$rendered" -eq 0 ]; then
  echo "[gateway] 错误：没有任何前端被渲染，请检查 frontends.json 的 port 配置" >&2
  exit 1
fi
echo "[gateway] 共渲染 $rendered 个前端 server 块"
