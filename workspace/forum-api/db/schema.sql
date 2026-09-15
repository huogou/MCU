-- MCU Forum API · V3.0 —— SQLite schema
-- 引擎要求：WAL（由 database.js PRAGMA 启用）
-- 纪律：本库只存论坛数据；CloudBase stats/feedback 与本库无任何关联。

CREATE TABLE IF NOT EXISTS forum_users (
  id         TEXT PRIMARY KEY,              -- 服务端 randomUUID，绝不信任客户端
  device_id  TEXT UNIQUE,                   -- 仅注册时弱幂等键，不参与鉴权
  nickname   TEXT,
  avatar     TEXT,                          -- 预设头像标识 a01~a99
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS forum_topics (
  id         TEXT PRIMARY KEY,
  author_id  TEXT NOT NULL,                 -- 恒为服务端 token 解析出的 uid
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  excerpt    TEXT NOT NULL,                 -- 服务端截取，列表摘要
  category   TEXT NOT NULL,                 -- movie/series/char/timeline/new/general
  status     TEXT NOT NULL DEFAULT 'pending', -- pending/approved/rejected/hidden/deleted
  like_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,   -- 仅统计 approved 回复
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_topics_status_created ON forum_topics(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topics_author   ON forum_topics(author_id, status);

CREATE TABLE IF NOT EXISTS forum_replies (
  id         TEXT PRIMARY KEY,
  topic_id   TEXT NOT NULL,
  author_id  TEXT NOT NULL,
  content    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending', -- 先审后发，与话题同状态机
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
  -- 一层回复，无楼中楼、无 parent_id（拍板指令第六节）
);
CREATE INDEX IF NOT EXISTS idx_replies_topic  ON forum_replies(topic_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_replies_author ON forum_replies(author_id, status);

CREATE TABLE IF NOT EXISTS forum_likes (
  id          TEXT PRIMARY KEY,             -- '{uid}:{targetType}:{targetId}' 复合主键
  user_id     TEXT NOT NULL,
  target_type TEXT NOT NULL,                -- topic | reply
  target_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  UNIQUE(user_id, target_type, target_id)   -- 唯一约束防重复点赞（拍板指令第六节）
);

CREATE TABLE IF NOT EXISTS forum_reports (
  id          TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,                -- topic | reply
  target_id   TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason      TEXT NOT NULL,                -- spam/abuse/porn/illegal/other
  status      TEXT NOT NULL DEFAULT 'open', -- MVP 仅记录，处理流不在本期范围
  created_at  TEXT NOT NULL,
  UNIQUE(reporter_id, target_type, target_id) -- 同一用户同一对象仅一次举报
);
