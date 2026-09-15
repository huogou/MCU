#!/bin/bash
# MCU Forum API · SQLite 每日备份（拍板指令第十二节）
# - sqlite3 .backup 在线备份（WAL 安全）
# - 输出 /www/backup/forum-db/（不在任何 Web root）
# - 滚动保留 14 份
set -e
DB=/www/wwwroot/forum-api/data/forum.db
DIR=/www/backup/forum-db
mkdir -p "$DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
sqlite3 "$DB" ".backup '$DIR/forum-$STAMP.db'"
find "$DIR" -name 'forum-*.db' -mtime +13 -type f -delete
echo "$(date '+%F %T') backup ok: $DIR/forum-$STAMP.db"
