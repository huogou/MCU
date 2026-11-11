/* ============================================================
 * MCU Atlas × 小红书小工具 V2 — 观影进度 / 想看清单
 * ------------------------------------------------------------
 * 独立实现（不照搬 H5 存储代码），按在线文档 §3.6 / §3.7 契约：
 *   - 优先 xhs.miniTool.setStorage / getStorage / removeStorage（需客户端 ≥9.46）
 *   - 清除优先 removeStorage，缺失或失败时回退 setStorage 空串
 *   - 不可用时降级 localStorage（浏览器兼容兜底，容忍失败与丢失）
 *   - 客户端版本经 getLaunchOptions 异步获取，buildVersion 忽略末3位编译号
 *
 * 数据结构带 version 字段，未来可迁移。
 * 不要求登录、不上传个人数据。
 * ============================================================ */

(function (window) {
  'use strict';

  var STORAGE_KEY = 'mcu-xhs-progress-v1';
  var DATA_VERSION = 1;
  var STORAGE_MIN_CLIENT = 9460;      // 客户端 9.46.0
  var ALBUM_MIN_CLIENT = 9420;        // 客户端 9.42.0（saveImageToPhotosAlbum）

  /* ---------- 空数据 ---------- */
  function emptyData() {
    return {
      version: DATA_VERSION,
      watched: {},        // contentId -> ISO 时间字符串
      want: [],           // contentId[]
      updatedAt: null
    };
  }

  /* ---------- 序列化 / 反序列化（容忍损坏数据） ---------- */
  function parse(raw) {
    if (!raw) return emptyData();
    var obj;
    try {
      obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      return emptyData();
    }
    if (!obj || typeof obj !== 'object') return emptyData();
    var d = emptyData();
    if (obj.watched && typeof obj.watched === 'object') {
      Object.keys(obj.watched).forEach(function (id) {
        if (typeof obj.watched[id] === 'string') d.watched[id] = obj.watched[id];
      });
    }
    if (Array.isArray(obj.want)) {
      d.want = obj.want.filter(function (x) { return typeof x === 'string'; });
    }
    d.updatedAt = typeof obj.updatedAt === 'string' ? obj.updatedAt : null;
    return d;
  }

  /* ---------- 客户端版本（在线文档 §3.6） ---------- */
  function readBuildVersion(launchOptions) {
    var env = launchOptions && launchOptions.miniToolEnv;
    return Number(env && env.buildVersion) || 0;
  }

  function getBuildVersion() {
    var xhs = window.xhs;
    var sync = readBuildVersion(xhs && xhs.launchOptions);
    if (sync) return Promise.resolve(sync);
    var mt = xhs && xhs.miniTool;
    if (!mt || typeof mt.getLaunchOptions !== 'function') return Promise.resolve(0);
    return Promise.resolve()
      .then(function () { return mt.getLaunchOptions(); })
      .then(function (opts) { return readBuildVersion(opts); })
      .catch(function () { return 0; });
  }

  function clientVersionAtLeast(buildVersion, minimum) {
    return Math.floor(buildVersion / 1000) >= minimum;
  }

  /* ---------- 存储适配层 ---------- */
  var backend = 'none';     // 'xhs' | 'localStorage' | 'memory'
  var memoryFallback = null;

  function storageAvailable() {
    var mt = window.xhs && window.xhs.miniTool;
    return !!(mt && typeof mt.setStorage === 'function' && typeof mt.getStorage === 'function');
  }

  function localStorageAvailable() {
    try {
      var k = '__mcu_probe__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  function readRaw() {
    return getBuildVersion().then(function (bv) {
      if (storageAvailable() && clientVersionAtLeast(bv, STORAGE_MIN_CLIENT)) {
        backend = 'xhs';
        return Promise.resolve()
          .then(function () { return window.xhs.miniTool.getStorage({ key: STORAGE_KEY }); })
          .then(function (res) { return res && res.data ? res.data : null; })
          .catch(function () {
            if (localStorageAvailable()) {
              backend = 'localStorage';
              try { return window.localStorage.getItem(STORAGE_KEY); }
              catch (e) { return null; }
            }
            backend = 'memory';
            return memoryFallback;
          });
      }
      if (localStorageAvailable()) {
        backend = 'localStorage';
        try { return window.localStorage.getItem(STORAGE_KEY); }
        catch (e) { return null; }
      }
      backend = 'memory';
      return memoryFallback;
    });
  }

  function writeRaw(str) {
    return getBuildVersion().then(function (bv) {
      if (storageAvailable() && clientVersionAtLeast(bv, STORAGE_MIN_CLIENT)) {
        backend = 'xhs';
        return Promise.resolve()
          .then(function () { return window.xhs.miniTool.setStorage({ key: STORAGE_KEY, data: str }); })
          .then(function () { return true; })
          .catch(function () {
            /* xhs 写失败时降级 localStorage，避免当次操作丢失 */
            if (localStorageAvailable()) {
              backend = 'localStorage';
              try { window.localStorage.setItem(STORAGE_KEY, str); return true; }
              catch (e) { /* fall through */ }
            }
            backend = 'memory';
            memoryFallback = str;
            return false;
          });
      }
      if (localStorageAvailable()) {
        backend = 'localStorage';
        try { window.localStorage.setItem(STORAGE_KEY, str); return true; }
        catch (e) { /* fall through */ }
      }
      backend = 'memory';
      memoryFallback = str;
      return false;
    });
  }

  function removeRaw() {
    return getBuildVersion().then(function (bv) {
      var mt = window.xhs && window.xhs.miniTool;
      var jobs = [];

      function overwriteEmpty() {
        return Promise.resolve()
          .then(function () { return mt.setStorage({ key: STORAGE_KEY, data: '' }); })
          .then(function () { return true; })
          .catch(function () { return false; });
      }

      /* 9.46+ 优先使用官方 removeStorage；接口缺失或调用失败时回退到 setStorage 空串。 */
      if (storageAvailable() && clientVersionAtLeast(bv, STORAGE_MIN_CLIENT)) {
        if (typeof mt.removeStorage === 'function') {
          jobs.push(Promise.resolve()
            .then(function () { return mt.removeStorage({ key: STORAGE_KEY }); })
            .then(function () { return true; })
            .catch(overwriteEmpty));
        } else {
          jobs.push(overwriteEmpty());
        }
      }

      /* 无论 xhs 端结果如何，都清理浏览器兜底副本，避免刷新后旧数据回流。 */
      if (localStorageAvailable()) {
        try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      }
      memoryFallback = null;
      return Promise.all(jobs).then(function () { return true; });
    });
  }

  /* ---------- 数据层（内存缓存 + 持久化） ---------- */
  var cache = emptyData();
  var ready = false;
  var listeners = [];

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(cache); } catch (e) { /* 单个订阅者异常不影响其他 */ }
    });
  }

  function persist() {
    cache.updatedAt = new Date().toISOString();
    var str;
    try { str = JSON.stringify(cache); }
    catch (e) { return Promise.resolve(false); }
    return writeRaw(str).then(function (ok) {
      emit();
      return ok;
    });
  }

  function init() {
    return readRaw().then(function (raw) {
      cache = parse(raw);
      ready = true;
      emit();
      return cache;
    });
  }

  /* ---------- 查询 ---------- */
  function isReleased(id) {
    var list = window.MCU_CONTENT || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return true;
    }
    return false;
  }

  /* 节点键：普通作品用 contentId；专题中的分季条目用「contentId|季标签」 */
  function splitKey(key) {
    var i = String(key).indexOf('|');
    if (i === -1) return { base: String(key), label: '' };
    return { base: key.slice(0, i), label: key.slice(i + 1) };
  }

  function isKnownKey(key) {
    return isReleased(splitKey(key).base);
  }

  /* 已看判定的唯一入口：整部作品的键，或该集/季的独立键均视为已看 */
  function isDone(key) {
    if (cache.watched[key]) return true;
    var s = splitKey(key);
    if (s.label) return !!cache.watched[s.base];
    /* 无分季标签的作品：存在任意同 base 的分季键即视为整部已看 */
    return Object.keys(cache.watched).some(function (k) {
      return splitKey(k).base === s.base;
    });
  }

  function totalReleased() {
    return (window.MCU_CONTENT || []).length;
  }

  var api = {
    STORAGE_KEY: STORAGE_KEY,
    DATA_VERSION: DATA_VERSION,

    init: init,

    isReady: function () { return ready; },

    backend: function () { return backend; },

    subscribe: function (fn) {
      if (typeof fn === 'function') listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i !== -1) listeners.splice(i, 1);
      };
    },

    /* ----- 已看 ----- */
    isWatched: function (id) { return isDone(id); },

    /* 已看统计按「作品」去重；分季节点只影响专题路线，不重复增加全库已看数 */
    watchedIds: function () {
      var seen = {};
      var ids = [];
      Object.keys(cache.watched).forEach(function (key) {
        if (!isKnownKey(key)) return;
        var base = splitKey(key).base;
        if (!seen[base]) { seen[base] = true; ids.push(base); }
      });
      return ids;
    },

    watchedCount: function () { return api.watchedIds().length; },

    watchedAt: function (id) {
      var at = cache.watched[id] || null;
      Object.keys(cache.watched).forEach(function (key) {
        if (splitKey(key).base === id && (!at || cache.watched[key] > at)) at = cache.watched[key];
      });
      return at;
    },

    toggleWatched: function (id) {
      if (!isKnownKey(id)) return Promise.resolve(false);
      var s = splitKey(id);
      if (isDone(id)) {
        delete cache.watched[id];
        if (s.label) {
          delete cache.watched[s.base];
        } else {
          Object.keys(cache.watched).forEach(function (key) {
            if (splitKey(key).base === s.base) delete cache.watched[key];
          });
        }
      } else {
        cache.watched[id] = new Date().toISOString();
        var i = cache.want.indexOf(s.base);
        if (i !== -1) cache.want.splice(i, 1);
      }
      return persist().then(function () { return api.isWatched(id); });
    },

    markWatched: function (id) {
      if (!isKnownKey(id) || isDone(id)) return Promise.resolve(true);
      return api.toggleWatched(id);
    },

    /* 整部作品取消已看时，同时清理其分季记录。 */
    unmarkWatched: function (id) {
      var base = splitKey(id).base;
      var hit = false;
      Object.keys(cache.watched).forEach(function (key) {
        if (splitKey(key).base === base) { delete cache.watched[key]; hit = true; }
      });
      if (!hit) return Promise.resolve(true);
      return persist().then(function () { return false; });
    },

    /* ----- 想看 ----- */
    isWant: function (id) { return cache.want.indexOf(id) !== -1; },

    wantIds: function () {
      return cache.want.filter(isReleased);
    },

    wantCount: function () { return api.wantIds().length; },

    toggleWant: function (id) {
      if (!isReleased(id)) return Promise.resolve(false);
      if (isDone(id)) return Promise.resolve(false);   // 已看（含分季已看）不进想看
      var i = cache.want.indexOf(id);
      if (i === -1) cache.want.push(id);
      else cache.want.splice(i, 1);
      return persist().then(function () { return api.isWant(id); });
    },

    /* ----- 统计 ----- */
    total: totalReleased,

    percent: function () {
      var t = totalReleased();
      return t ? Math.round(api.watchedCount() / t * 100) : 0;
    },

    unwatchedCount: function () {
      return Math.max(0, totalReleased() - api.watchedCount());
    },

    /* 路线进度：items 为 contentId 数组或含 label 的对象数组。
       同一作品的不同季（如 loki S1/S2）以「workId|label」作为独立键，
       保证核心 8 部 / 完整 15 部的分母与展示一致。 */
    routeProgress: function (items) {
      var keys = (items || []).map(function (it) {
        if (typeof it === 'string') return it;
        if (!it || !it.workId) return null;
        return it.workId + '|' + (it.label || '');
      }).filter(Boolean);
      var done = keys.filter(function (key) { return isDone(key); }).length;
      return {
        total: keys.length,
        done: done,
        percent: keys.length ? Math.round(done / keys.length * 100) : 0,
        remaining: keys.length - done
      };
    },

    /* ----- 清除 ----- */
    clear: function () {
      cache = emptyData();
      return removeRaw().catch(function () { return false; }).then(function () {
        emit();
        return true;
      });
    },

    /* ----- 分享卡数据 ----- */
    shareData: function () {
      var byId = {};
      (window.MCU_CONTENT || []).forEach(function (c) { byId[c.id] = c; });
      var watched = api.watchedIds().map(function (id) {
        return {
          id: id,
          cn: byId[id] ? byId[id].cn : id,
          year: byId[id] ? byId[id].year : '',
          at: api.watchedAt(id)
        };
      }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
      return {
        total: totalReleased(),
        watchedCount: watched.length,
        wantCount: api.wantCount(),
        percent: api.percent(),
        watched: watched,
        want: api.wantIds().map(function (id) {
          return { id: id, cn: byId[id] ? byId[id].cn : id, year: byId[id] ? byId[id].year : '' };
        })
      };
    },

    /* 测试用：直接注入原始数据 */
    _parse: parse,
    _emptyData: emptyData
  };

  window.MCUProgress = api;
})(window);
