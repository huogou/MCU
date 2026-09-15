'use strict';
/* 中间件：进程内频率限制（固定窗口）
 * - key 维度由调用方决定（uid / ip:动作）
 * - 超出阈值返回 429
 * - 内存护栏：桶总数超 10000 时清理过期桶（896Mi 机器上的自我保护）
 */
const { httpError } = require('../lib/http');
const config = require('../config');

const buckets = new Map();

function hit(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size <= 8000) break;
    }
  }
  return b.count <= max;
}

/* 便捷封装：超出即抛 429 */
function limit(key, max, windowMs) {
  if (!hit(key, max, windowMs)) {
    throw httpError(429, 'RATE_LIMITED', '操作过于频繁，请稍后再试');
  }
}

const MIN10 = 10 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

module.exports = {
  limit,
  registerByIp: (ip) => limit('reg:' + ip, config.LIMITS.REGISTER_PER_HOUR_PER_IP, HOUR),
  profileByUid: (uid) => limit('pf:' + uid, config.LIMITS.PROFILE_PER_HOUR, HOUR),
  topicByUid:   (uid) => limit('tp:' + uid, config.LIMITS.TOPIC_PER_10MIN, MIN10),
  replyByUid:   (uid) => limit('rp:' + uid, config.LIMITS.REPLY_PER_10MIN, MIN10),
  likeByUid:    (uid) => limit('lk:' + uid, config.LIMITS.LIKE_PER_10MIN, MIN10),
  reportByUid:  (uid) => limit('rt:' + uid, config.LIMITS.REPORT_PER_10MIN, MIN10),
};
