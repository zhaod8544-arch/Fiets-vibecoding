# 单前端 server 块模板。占位符由 gateway-entrypoint.sh 替换：
#   __PORT__         该前端在网关内监听的端口（来自 frontends.json，如 8080、8081）
#   __NAME__         前端名（= 静态产物目录 /usr/share/nginx/html/<name>）
#   __API_PREFIX__   反代到后端的路径前缀（来自 frontends.json，如 /admin、/api）
# 按端口分流：每个前端独占一个端口，不依赖域名。宝塔各子域名反代到对应端口即可。
server {
    listen __PORT__ default_server;
    server_name _;

    # 前端静态文件（构建产物已 COPY 进镜像）
    location / {
        root /usr/share/nginx/html/__NAME__;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理（backend 为 compose 服务名，端口与后端实际监听一致：9001）
    location __API_PREFIX__ {
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_pass http://backend:9001;

        # WebSocket
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        limit_req zone=api_limit burst=50 nodelay;
    }

    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
