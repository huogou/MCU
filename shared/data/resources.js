/* ============================================================
 * MCU 宇宙导航（小程序） - 资源配置层（resources）
 * ------------------------------------------------------------
 * D10-A 新增独立配置层：contentId → 夸克网盘观看资源链接。
 * 设计纪律：
 *   1. 独立配置层，不触碰 CONTENT / RELATIONS 等内容事实数据。
 *   2. 当前项目方尚未提供资源链接，仅建结构（status='pending' 占位）。
 *   3. 链接由项目方提供后填入本文件即可生效，无需修改任何页面逻辑。
 *   4. 页面一律经 get(contentId) 读取，禁止页面硬编码链接。
 *
 * 字段说明：
 *   contentId  内容 id（与 CONTENT 单一源对齐）
 *   title      资源标题（展示用）
 *   quarkUrl   夸克网盘链接（空字符串 = 未提供）
 *   status     'pending'（整理中）| 'ready'（已有链接）
 *   updateTime 最近更新时间（YYYY-MM-DD，未提供留空）
 * ============================================================ */

const RESOURCES = [
  /* 资源链接由项目方提供后按此结构填入，示例：
  { contentId: 'iron-man', title: '钢铁侠', quarkUrl: '', status: 'pending', updateTime: '' },
  */
];

/**
 * 按内容 id 获取观看资源
 * @param {string} contentId 内容 id
 * @returns {Object|null} 资源对象；未配置或未提供链接时返回 null
 */
function get(contentId) {
  if (!contentId) return null;
  const item = RESOURCES.find(function (r) { return r.contentId === contentId; });
  if (!item || !item.quarkUrl) return null;
  return item;
}

/** 全量资源（供调试/管理用） */
function all() {
  return RESOURCES.slice();
}

module.exports = { RESOURCES, get, all };
