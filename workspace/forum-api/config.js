'use strict';
/* MCU Forum API · V3.0 —— 全局配置
 * 零 npm 依赖。所有阈值集中于此，任何调整需同步技术文档。
 */
const path = require('path');

module.exports = {
  // HTTP 服务（仅本地监听，公网经 Nginx ^~ /api/ 反代）
  HOST: '127.0.0.1',
  PORT: 8787,

  // 数据与密钥（data/ 不在任何 Nginx root 之下，公网不可直访）
  DATA_DIR: path.join(__dirname, 'data'),
  DB_PATH: path.join(__dirname, 'data', 'forum.db'),
  SECRET_PATH: path.join(__dirname, 'data', 'secret.key'),        // 用户 token HMAC 密钥（自动生成，0600）
  ADMIN_TOKEN_PATH: path.join(__dirname, 'data', 'admin-token.key'), // 管理端 token（自动生成，0600）

  // 用户 token：HMAC-SHA256，payload {uid, iat, exp}
  TOKEN_TTL_MS: 180 * 24 * 3600 * 1000,        // 有效期 180 天
  TOKEN_RENEW_AHEAD_MS: 30 * 24 * 3600 * 1000, // 剩余 <30 天时响应头下发续签 token

  // 频率限制（滑动窗口内最多次数，超出返回 429）——来源：拍板指令第十一节
  LIMITS: {
    REGISTER_PER_HOUR_PER_IP: 5,   // 建号
    PROFILE_PER_HOUR: 3,           // 资料修改
    TOPIC_PER_10MIN: 3,            // 发帖
    REPLY_PER_10MIN: 10,           // 回复
    LIKE_PER_10MIN: 30,            // 点赞/取消
    REPORT_PER_10MIN: 5,           // 举报
  },

  // 业务规则
  TOPIC_CATEGORIES: ['movie', 'series', 'char', 'timeline', 'new', 'general'],
  REPORT_REASONS: ['spam', 'abuse', 'porn', 'illegal', 'other'],
  TITLE_MIN: 2, TITLE_MAX: 50,
  TOPIC_MAX: 2000, REPLY_MAX: 500,
  EXCERPT_LEN: 60,
  NICKNAME_MAX: 16,
  AVATAR_RE: /^a\d{2}$/,          // 预设头像：a01 ~ a99（本地资源映射，不上传图片）
  DEVICE_ID_RE: /^[A-Za-z0-9-]{8,64}$/,

  BODY_LIMIT: 64 * 1024,          // 请求体上限
  PAGE_DEFAULT: 1, PAGE_SIZE_DEFAULT: 10, PAGE_SIZE_MAX: 50,
};
