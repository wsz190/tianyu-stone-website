#!/usr/bin/env bash
# ============================================================
# 天宇石材品牌官网 — 一键启动脚本
# 用法：
#   ./start.sh          启动（前端 8080 + 后端 3000）
#   ./start.sh stop     停止
#   ./start.sh status   查看状态
# ============================================================
set -u
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONT_PORT=8080
API_PORT=3000
FRONT_LOG="$BASE_DIR/front.log"
API_LOG="$BASE_DIR/backend/server.log"

is_port() { lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

status() {
  echo "前端 http://localhost:$FRONT_PORT/index.html  -> $(is_port $FRONT_PORT && echo 运行中 || echo 未运行)"
  echo "后端 http://localhost:$API_PORT               -> $(is_port $API_PORT && echo 运行中 || echo 未运行)"
}

start() {
  if is_port $API_PORT; then
    echo "[后端] 端口 $API_PORT 已被占用，跳过启动"
  else
    (cd "$BASE_DIR/backend" && nohup node server.js >> "$API_LOG" 2>&1 &)
    echo "[后端] 已启动（日志：$API_LOG）"
  fi
  if is_port $FRONT_PORT; then
    echo "[前端] 端口 $FRONT_PORT 已被占用，跳过启动"
  else
    (cd "$BASE_DIR/frontend" && nohup python3 -m http.server $FRONT_PORT >> "$FRONT_LOG" 2>&1 &)
    echo "[前端] 已启动（日志：$FRONT_LOG）"
  fi
  echo ""
  echo "✅ 发布地址：http://localhost:$FRONT_PORT/index.html"
}

stop() {
  for port in $API_PORT $FRONT_PORT; do
    if is_port $port; then
      lsof -tiTCP:"$port" -sTCP:LISTEN | xargs kill 2>/dev/null
      echo "[$port] 已停止"
    fi
  done
}

case "${1:-start}" in
  start)  status; start ;;
  stop)   stop ;;
  status) status ;;
  *) echo "用法: $0 [start|stop|status]"; exit 1 ;;
esac
