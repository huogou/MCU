# Step4-1-C 补丁 · 真机写入修复报告

> 生成时间：2026-08-24 12:10
> 关联：Step4-1-C 数据统计上线验证（之前报告已交付，本次为上线后发现「真机浏览记录不新增」的修复）

## 一、问题现象

用户按 `?from=douyin` 打开 H5 后，CloudBase 控制台 `stats` 集合记录数无变化（不新增）。
（注：Step4-1-C 自动化测试曾报「通过」，但该测试用的是 Node 直连 SDK，绕过了浏览器运行时，属**测试盲区**。）

## 二、根因（用本机 Chrome 真机 headless 验证定位）

**两层 bug 叠加：**

### Bug 1：`env` 字段值写错（字段语义冲突）
- 代码里存在两个同名概念：`getEnv()`（第 1179 行）是**设备/平台分类器**，返回 `wechat/desktop/mobile`；而 `write()` 误把它当作 **CloudBase 环境 ID** 写入 `doc.env`。
- 结果：记录 `env` 字段全是 `desktop`/`mobile`/`wechat`，而不是环境 ID `mcu-d6gw0brqoa9521b58`。
- 这是你早先在控制台看到的 2 条 `env:desktop` 记录的来源。

### Bug 2：`add` 回读校验误判成功为失败 → 数据滞留本地（致命）
- `write()` 在 `db.collection('stats').add(doc)` 拿到返回的 `_id` 后，又用 `db.collection('stats').doc(id).get()` **回读校验**是否真写入。
- 但 `stats` 集合安全规则 `read: "doc._openid == auth.openid"` 限制了读权限，回读直接报 `DATABASE_PERMISSION_DENIED`。
- 代码把「回读失败」当成「写入失败」，把**已经成功落库**的记录又塞回 `localStorage` 本地队列 → 刷新即丢，后台永远看不到新增。

### 实测证据（本机 Chrome headless 真机）
- `window.cloudbase` = true、`window.MCU.stats` = true（SDK 加载正常）
- `auth().signInAnonymously()` 与 `anonymousAuthProvider().signIn()` 均返回 OK（**浏览器内匿名登录正常**）
- `db.collection('stats').add(doc)` 返回真实 `_id`（如 `932125986a8bc405...`）→ **记录实际已写入 CloudBase**
- 但回读 `doc(id).get()` 报 `DATABASE_PERMISSION_DENIED` → 代码误判 → 进本地队列
- 控制台 `stats` 集合确能查到该 `_id` 记录（证明 add 成功）

## 三、修复方案

修改文件：`mcu-navigator/assets/js/app.js`（仅 Stats 模块，H5 统计层，未动页面/数据/小程序）

1. **`env` 字段改用环境常量 `ENV`**（`mcu-d6gw0brqoa9521b58`），设备分类另存新字段 `device`（值 wechat/desktop/mobile）。
2. **删除 `doc(id).get()` 回读校验**。依据：浏览器内 `add` 返回真实 `_id` 即代表写入成功；回读会因安全规则 read 限制触发误判。仅在 `add` **抛出异常（reject）** 时才进本地队列，下次 pageview 经 `flushQueue` 重试。
3. `ensureAuth()` 优先 `signInAnonymously()`，回落 `anonymousAuthProvider().signIn()`，两者皆失败也继续尝试 `add`（部分环境允许未登录写），由 `add` reject 兜底。

## 四、真机验证结果（决定性）

本机 Chrome headless 加载 `https://mcu-d6gw0brqoa9521b58-1307093647.tcloudbaseapp.com/index.html?from=douyin`：

| 验证项 | 结果 |
|---|---|
| 本地队列 `_mcu_stats_queue` | **EMPTY**（说明记录已成功上传，无滞留） |
| 后台 `stats` 新增记录 `channel` | `douyin` ✅ |
| 后台 `stats` 新增记录 `env` | `mcu-d6gw0brqoa9521b58` ✅（环境 ID 正确，不再是 desktop） |
| 后台 `stats` 新增记录 `device` | `desktop` ✅（新增设备分类字段） |
| `type` | `pageview` / `event` ✅ |

**结论：真机链路完全跑通，浏览器访问 → stats 产生记录 → 后台可查看，闭环成立。**

## 五、当前线上存量数据说明（重要）

修复过程中发现：**此前已有真实用户流量进入**（`stats` 集合原有 27 条，清理 8 条 headless 探针后剩 19 条真实记录）。包含：
- `channel`: douyin ×3、xiaohongshu ×1、wechat ×2、direct ×13
- 真实设备 UA：小米浏览器、iPhone、微信内、Edge 等

这 19 条为**真实访客数据，已保留**。其 `env` 字段为旧值（desktop/mobile/wechat，即设备类型），属 Bug 1 历史残留，仅影响该字段语义，不影响 `channel`/`page`/`type` 等核心维度。新记录已正确使用环境 ID。

## 六、部署结果

- `app.js` 重新发布至静态托管 ✅（2 次发布：去登录版 → 回读修复版）
- 静态托管域名已在 CloudBase 安全白名单（ENABLE）✅
- `stats` 集合存在、匿名写权限（CUSTOM: create=true）✅
- 真机写入闭环验证通过 ✅
- 测试/探针数据已清理 ✅

## 七、当前可统计指标（不变，详见 Step4-1-B/C 报告）

PV / 来源(douyin,xiaohongshu,wechat,direct) / 页面(home,routes,route_detail,movie,panorama,next) / 行为(click_start_watch,click_movie_detail,click_relation_explore,click_enter_miniprogram,click_<data-stat>) ；精确 UV 仍待 V1.1 补 sessionId。

## 八、待办（非阻塞）

1. 后台 `stats` 历史 19 条旧 `env` 值（desktop/mobile/wechat）如需统一，可脚本批量改写为环境 ID（不影响分析，可选）。
2. V1.1：sessionId（精确 UV）、stats 看板/运营后台、动态小程序码 scene。
