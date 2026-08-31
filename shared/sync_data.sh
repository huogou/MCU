#!/usr/bin/env bash
# ============================================================
# 单一数据源同步脚本
# 权威源 : shared/data/*.js  (module.exports 格式，与微信/抖音一致)
# 目标   : wechat/data/  douyin/data/  (两者数据格式相同，可直接复制)
#
# 重要   : H5 数据为 window.MCU_* 全局格式，与小程序 module.exports 不同，
#          不在此脚本范围内，需另行机械适配(去 window 前缀)，请勿直接复制。
# ============================================================
set -e

# 定位仓库根目录（本脚本位于 shared/ 下）
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/shared/data"

echo "仓库根: $ROOT"
echo "权威源: $SRC"

for tgt in wechat/data douyin/data; do
  dst="$ROOT/$tgt"
  mkdir -p "$dst"
  cp -f "$SRC"/*.js "$dst"/
  echo "✓ 已同步 shared/data -> $tgt"
done

echo ""
echo "完成。wechat/data 与 douyin/data 已与 shared/data 对齐。"
echo "⚠ H5 数据格式不同，未同步；如需更新 h5/data，请走 H5 专属适配流程。"
