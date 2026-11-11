# MCU Atlas H5 第一轮基础修复生产部署与验收报告

- **执行方**：CodeBuddy
- **日期**：2026-11-09
- **目标**：将本地已完成的第一轮基础修复 + www 域名统一 SEO 地址部署到生产并线上验收
- **生产站点**：`https://www.mcuatlas.xyz` → `/www/wwwroot/mcu-h5/`（宝塔面板 Nginx 1.26.3）
- **结论**：**部署完成，线上验收通过，无回滚**。19 个文件全部与本地哈希一致；首页 59 部 / 11 条路线 / 全部 62 部 / 3 部未上映不泄漏；www 301 保持生效；缓存已按站点内最小方案处理。

---

## 1. 部署前核对

### 1.1 Git 状态与他人改动保护

| 项 | 实测 |
|---|---|
| HEAD | `519a820 chore: GenUI 小工具视觉基线更新与外宣物料补充`（**未推送 Git**） |
| 全仓未提交改动 | 部署前 **257** 项（`D=97 / M=33 / ??=127`），部署后复核 **255** 项（他人在途工作自身变化） |
| 本轮前一轮报告记录 | 232 项（审计阶段）；期间他人在途工作持续变化 |
| 保护结果 | **未执行任何 `git reset` / `checkout` / clean / stash**，未触碰 `h5/` 与 `docs/审计/` 之外任何文件 |

### 1.2 本地最终版本确认

部署前逐项确认本地包含：

- 第一轮基础修复（`content.js` 双集合、`app.js` `ALL_CONTENT` / `isUpcoming`、`movie.html` 未上映视图、`next.html` 去重、片名统一、待核实标记等）
- www canonical（5 个静态 canonical + `app.js` 的 `CANON_ORIGIN = 'https://www.mcuatlas.xyz'`）
- www 版 `robots.txt` / `sitemap.xml`（76 条 URL）
- 最新 `h5/tools/` 三个工具

部署前检查结果：`regression-basic.cjs` **45 项全 PASS**、`generate-sitemap.cjs --check` PASS、`check-live-local-diff.cjs` PASS（条目集合一致）。

### 1.3 版本覆盖风险核对（逐文件哈希比对）

对本地 `h5/` 下 156 个可部署文件与生产目录逐一 SHA256 比对：

| 结果 | 数量 |
|---|---|
| 完全一致 | 138 |
| 需部署（内容不同） | 18 |

**发现 2 项版本覆盖风险并处置**：

| 文件 | 风险 | 处置 |
|---|---|---|
| `data/news.js` | 线上由资讯流水线每日更新（`110060` 字节 / 54 条 / 2026-11-06 时间戳） | 本地与线上**哈希完全一致**，无覆盖风险；**明确排除出部署清单**，未上传、未改动（部署后校验哈希仍为 `bcd5eecf…`） |
| `assets/css/v1-special.css` | 线上 `17427` 字节 vs 本地 `17417` 字节，线上更新 | `diff` 确认仅 2 行**注释路径**差异（线上 `docs/同步/…`、本地 `同步/…`），无功能差别，且本轮未修改该文件 → **排除出部署清单**，避免用旧注释覆盖线上内容 |

其余 18 个差异文件中，`data/relations.js`（2 字节）等均为第一轮修复的预期内容。

### 1.4 生产目录与备份

- 生产目录 `/www/wwwroot/mcu-h5/` 体积 15M；线上已有 `index.html.bak-20260923`、`data/news.js.bak-*`（5 份）、`.bak-favicon-*`、`.bak-homecard-*`、`.bak-special-*` 等历史备份 → **全部未删除、未覆盖**。
- 部署前备份（均在 `/root/mcu-atlas-h5-backup-20261109/`）：

| 备份 | 内容 |
|---|---|
| `mcu-h5-before-firstround-deploy.tar.gz` | 全量目录 tar，13,053,858 字节，`SHA256=27acc0481bd6ae914ef6d574805b4f8a963752d4c69d5227366262804560091b` |
| `files/` | 本次将被覆盖的 19 个文件逐文件 `cp -a`（保留属主/权限），19 个齐全 |
| `mcuatlas.xyz.conf.before-cache-rule` | 当时生效的 Nginx 配置（`SHA256=23be94fb…`），www 301 规则版本 |

### 1.5 已生效配置基线

- 四种访问：`http/https` apex、`http` www 均 `301 → https://www.mcuatlas.xyz/`，www HTTPS `200`（部署前复核）。
- 缓存基线：`data/movies.js`、`assets/js/app.js` 为 `Cache-Control: max-age=604800` + `public`（7 天强缓存）；`data/news.js` 与 `.html` 已是 `no-cache, must-revalidate`。

---

## 2. 实际部署文件清单（19 个）

仅部署 H5 所需页面、数据、脚本与 SEO 文件；**未上传** `h5/tools/`、`h5/review/`、`docs/审计/`、`_redirects`、`project*.json`、`workspace-tokenize-map6.js`，也未上传任何图片/CSS 资源（与线上哈希一致）。

| # | 文件 | 字节 | SHA256 前 12 |
|---|---|---|---|
| 1 | `assets/js/app.js` | 81387 | `26176b3962b0` |
| 2 | `assets/js/components.js` | 40710 | `c72d2ad5bbc1` |
| 3 | `data/content.js` | 5886 | `cc431f004ba8` |
| 4 | `data/movies.js` | 34105 | `0c6433761c03` |
| 5 | `data/relations.js` | 26416 | `b4a155956ac5` |
| 6 | `data/routes.js` | 9381 | `8bb5366d11e6` |
| 7 | `data/series.js` | 8629 | `8b4d6d5d2063` |
| 8 | `data/special-routes.js` | 6073 | `928f7c6c0fec` |
| 9 | `data/upcoming.js` | 4404 | `710d1f99bd7a` |
| 10 | `index.html` | 25799 | `dc91283d317c` |
| 11 | `map.html` | 43260 | `2a50a847cc22` |
| 12 | `map-pc.html` | 80360 | `a116879c5462` |
| 13 | `movie.html` | 14130 | `29deb8698bc7` |
| 14 | `news.html` | 5113 | `aa2f50b9781c` |
| 15 | `next.html` | 17809 | `a7ba567e643f` |
| 16 | `routes.html` | 9245 | `f3d5caa7003f` |
| 17 | `special.html` | 17563 | `5c7d5e369012` |
| 18 | `robots.txt` | 91 | `07d68cbc4e67` |
| 19 | `sitemap.xml` | 6121 | `9ce7ffb0bf50` |

**部署方式**：本地暂存目录 → `scp -r` 到服务器 `/tmp/mcu_h5_deploy/` → 服务器端脚本按清单逐个 `cp`，**保留原文件属主与权限**（`www:www`，`644`/`666`），逐文件校验哈希；部署结果 `failed=0`，19 个全部 `OK`。

**未授权改动校验**（部署脚本输出，哈希与部署前一致）：`data/news.js`、`assets/css/v1-special.css`、`assets/js/forum.js`、`/www/server/panel/vhost/nginx/mcuatlas.xyz.conf` 均未被触碰。

**部署内容覆盖**：双集合处理（`MCU_CONTENT` 59 / `MCU_CONTENT_ALL` 62）、未上映详情限制、首页/路线/进度统计纠错、下一部推荐去重、中文片名统一、未来档期 `pendingReview` 待核实标记、www canonical、`robots.txt`/`sitemap.xml`、以及第一轮涉及的全部页面与脚本。Canonical **未被恢复为非 www**；www 301 配置**未被覆盖**。

---

## 3. 缓存处理

### 3.1 问题

部署涉及 9 个 `data/*.js` 与 2 个 `assets/js/*.js`，而生产 Nginx 对 `.js` 使用 `expires 7d` + `Cache-Control: public`，回访用户在 7 天内会继续使用旧版本 JS，导致「新 HTML + 旧数据」不一致。

### 3.2 采用方案（站点内最小范围）

在 **MCU Atlas 站点 vhost 的 www 443 业务站内部**、通用 `location ~* \.(css|js|json)$` 规则**之前**插入 14 行，仅对本次涉及的两类路径改为协商缓存：

```nginx
location ~* ^/data/.*\.js$ {
    add_header Cache-Control "no-cache, must-revalidate";
    add_header Expires "0";
    add_header Strict-Transport-Security "max-age=31536000" always;
}
location ~* ^/assets/js/.*\.js$ {
    add_header Cache-Control "no-cache, must-revalidate";
    add_header Expires "0";
    add_header Strict-Transport-Security "max-age=31536000" always;
}
```

- 放在通用 `.js` 规则之前，利用 Nginx 正则 location「首个命中生效」；`location = /data/news.js`（原本就是 no-cache）优先级更高，不受影响。
- `diff -u` 审阅确认 **仅新增该缓存块**，`server_name` / `listen` / 3 处 `return 301` 全部原样保留；`nginx -t` 通过、`nginx -s reload` 成功（`reload_rc=0`）。
- **未修改全站 Nginx 主配置、未修改其他站点 vhost、未改 CSS/图片缓存规则**。
- 配置已备份为 `/root/mcu-atlas-h5-backup-20261109/mcuatlas.xyz.conf.before-cache-rule`；生效配置 `SHA256=8e216716…`。

### 3.3 缓存实测

| 资源 | 部署后响应头 |
|---|---|
| `data/movies.js` / `data/content.js` / `assets/js/app.js` | `Cache-Control: no-cache, must-revalidate`、`Expires: 0`、保留 ETag / Last-Modified |
| `data/news.js` | `no-cache, must-revalidate`（原有规则，未变） |
| `index.html` | `no-cache, must-revalidate`（原有规则，未变） |
| `assets/css/style.css` | `max-age=604800` + `public`（**保持原 7 天策略，未被本次改动影响**） |
| 条件请求 | `If-None-Match` → **`HTTP/1.1 304`**，协商缓存生效，未变更时无响应体 |

用户每次访问都会对数据/逻辑脚本做条件请求，新版本可立即生效；未变更时 304，性能影响可控。

---

## 4. 线上测试通过

### 4.1 作品数据（Playwright 线上实测）

| 验收项 | 结果 |
|---|---|
| 首页统计 | `59` 部已上映、`11` 条路线、`6` 个阶段 |
| 全部内容 | `MCU_CONTENT_ALL.length = 62`，未上映作品未丢失 |
| 未上映集合 | `[doomsday, secretwars, visionquest]`，`MCU_CONTENT` 中泄漏数 `[]` |
| 未上映不能标记已看 | `movie.html?id=doomsday` → `seenBtn=false`、title「复仇者联盟：末日（未上映）」、正文含「尚未上映」 |
| 已上映详情正常 | `movie.html?id=iron-man` → H1「钢铁侠」、`seenBtn=true`、「第 1 部」 |
| 上映序号连续 | `MCU_CONTENT.every((m,i)=>m.ro===i+1)` → `true` |
| 观影进度历史 | 注入含 `doomsday` 的 `mcu_nav_user_v1` 并 reload：原始记录**完整保留**（`isSeen('doomsday')=true`），`count()=1`（统计排除未上映）、`total()=59`、`favIds()=['endgame']`、`seenIds()=['iron-man']` |

### 4.2 核心功能

| 验收项 | 结果 |
|---|---|
| 11 条观影路线 | `MCU_ROUTES` 11 条；`route-detail.html?id=release` 显示「**59 部作品**」、无「62 部」 |
| 复联5专题 | 核心 `8` 部、完整 `15` 部；终点「复仇者联盟：末日 · 2026.12.18」、圆点序号「5」 |
| 下一部推荐 | 41 个选项（含占位）、2 个 `disabled`；`doomsday`/`secretwars` 值 **0 个**；含「末日/毁灭之日」文本 **0 个**；禁用项为「恶灵骑士」「黑豹3」 |
| 未来计划 / 待核实 | 首页 4 条未来计划名称统一为「复仇者联盟：末日」「复仇者联盟：秘密战争」「恶灵骑士」「黑豹3」；**2 个「档期待核实」徽标** |
| 作品详情 / 人物关系 / 地图 | 作品详情正常；关系地图 40 个节点；`map.html` canonical www |
| 资讯列表 / 详情 | 列表 10 张卡片；详情 H1 正常、`noindex` 保留、canonical 含 `?id=` |
| `/api/topics` | `200 application/json`，`{"items":[],"page":1,"size":10,"total":0}` |
| 浏览器 Console | 首页与路线页 **0 错误 / 0 警告**；无新增错误 |

### 4.3 SEO

| 验收项 | 结果 |
|---|---|
| www 正常 / 非 www 301 | 四种访问：`301 / 301 / 301 / 200`，前三者 Location 均 `https://www.mcuatlas.xyz/` |
| Canonical 全部 www | 13 个页面原始 HTML 扫描 `totalNonWwwRefs=0`；浏览器实测首页、专题、作品详情、路线、地图、资讯均 `https://www.mcuatlas.xyz/...` |
| `/index.html` → `/` | 浏览器实测 `canonical = https://www.mcuatlas.xyz/`，且仅 1 个 canonical 标签（**上一轮 301 报告中的未达标项已解决**） |
| `/special` → `/special.html` | 浏览器实测 `canonical = https://www.mcuatlas.xyz/special.html`（**上一轮 301 报告中的未达标项已解决**） |
| 参数化详情页保留 id | `movie.html?id=iron-man` → `.../movie.html?id=iron-man`；`special.html?id=avengers-doomsday` → `.../special.html?id=avengers-doomsday`；`news-detail.html?id=...` 保留 `?id=` |
| `robots.txt` | `200 text/plain`，`Sitemap: https://www.mcuatlas.xyz/sitemap.xml` |
| `sitemap.xml` | `200 text/xml`，**76** 条 `<loc>`，**76 条 www / 0 条非 www** |
| 资讯详情 noindex | `meta[name=robots][content*=noindex]` 存在，**未开放收录** |

### 4.4 数据与文件检查

| 检查 | 结果 |
|---|---|
| `node h5/tools/regression-basic.cjs` | **45 项全部 PASS**，退出码 0 |
| `node h5/tools/generate-sitemap.cjs --check` | PASS，76 条 URL 与当前数据一致 |
| `node h5/tools/check-live-local-diff.cjs` | **PASS**：10 个数据集合线上/本地条目完全一致；`未上映集合 线上=[doomsday, secretwars, visionquest] 本地=[同]` —— 部署后线上已具备 `MCU_CONTENT_ALL`，工具不再提示预期差异 |
| 部署文件线上/本地核对 | 156 个可部署文件中 **155 个哈希一致**，仅 1 个有意排除的 CSS（见第 7 节）；19 个部署文件全部一致 |
| Console 新增错误 | 无 |

---

## 5. 线上与本地最终差异

部署后再次对 156 个可部署文件做全量哈希比对：

| 文件 | 线上 | 本地 | 性质 |
|---|---|---|---|
| `assets/css/v1-special.css` | 17427 字节（`/docs/同步/...` 注释） | 17417 字节（`/同步/...` 注释） | **仅 2 行注释路径差异，无功能差别**；线上版本更新且本轮未修改，故有意不覆盖 |

其余 155 个文件（含 19 个本次部署文件、全部未改动的页面/数据/脚本/图片/SEO 文件）哈希完全一致。

**线上独有文件**（未删除、未覆盖）：`index.html.bak-20260923`、`data/news.js.bak-*`（5 份）、`.bak-favicon-20260928/`、`.bak-homecard-20261013/`、`.bak-special-20261013/`、`baidu_verify_codeva-IsGpEVEsix.html`、`.well-known/`。

**本地独有文件**（未上传）：`h5/tools/`（3 个运维工具）、`h5/review/`（原型审查页）、`docs/审计/`（报告与规范）、`_redirects`、`project*.json`、`workspace-tokenize-map6.js`。

---

## 6. 是否存在回滚

**无回滚**。部署脚本 `failed=0`，缓存规则 `nginx -t` 一次通过并 reload 成功；部署后立即验证的首页统计（59）、未上映隔离、canonical www、301、API 等停止条件项全部正常，未触发任何异常处置条件。

回滚能力已准备但未使用：

```bash
# 恢复 19 个文件（保留原属主/权限）
BK=/root/mcu-atlas-h5-backup-20261109
for f in $(cat /tmp/deploy-list.txt); do cp -a "$BK/files/$f" /www/wwwroot/mcu-h5/$f; done
# 或整目录恢复
tar -xzf "$BK/mcu-h5-before-firstround-deploy.tar.gz" -C /www/wwwroot
# 恢复缓存规则前的 Nginx 配置
cp -a "$BK/mcuatlas.xyz.conf.before-cache-rule" /www/server/panel/vhost/nginx/mcuatlas.xyz.conf
nginx -t && nginx -s reload
```

> 注意：临时脚本已清理，恢复请直接使用上述 `cp -a` 命令或 `tar`；**切勿使用 Git reset / checkout**（会破坏 255 项他人未提交改动）。

---

## 7. 未完成事项

| 项 | 说明 |
|---|---|
| 部署后 `h5/` 本地未提交改动仍在工作区 | 按边界**未提交、未推送 Git**（HEAD 仍 `519a820`）；本地与线上内容一致，但 Git 状态为未提交 |
| `assets/css/v1-special.css` 注释路径未对齐 | 有意保留线上 `docs/同步/` 版本；如需完全一致，可在本地把 2 行注释改为 `docs/同步/…` 后单独部署该文件（纯注释、零功能影响） |
| 首页 `/index.html`、`/special` 路径规范化 | 本次部署后线上已达标（运行时 canonical），但 Nginx 层未加 `location = /index.html` 的 301 跳转，浏览器地址栏仍保留原始路径；如需要 URL 级 301 需另行授权 |
| sitemap 中 59 个详情页逐条可访问性 | 已抽样验证主要模板页、专题与作品详情；未对 76 条 URL 逐条发起请求 |
| `pendingReview` 待核实内容 | 已按规格标注并展示「档期待核实」；2028 年档期、VisionQuest 上线日期/剧情关联**仍待内容负责人对照官方来源复核**，本轮未编造任何官方信息 |

---

## 8. 未验证事项

1. **搜索引擎实际收录**：301 与 canonical 变更对搜索引擎的采纳、旧 `www → apex` 301 缓存的过渡期影响未验证。
2. **真机 / 微信内置浏览器 / 小程序扫码链路**：本轮使用 Chrome/Playwright 桌面视口验证，未做真机与 390px 移动端回归。
3. **小程序 request 合法域名**：本轮只读检查过 `wechat/data`、`douyin/data`（仅独立图片 CDN `mcu.yaokaixin.top`，无 apex 绝对 API 地址）；小程序后台域名白名单未全量核验。若仍配置 apex 绝对 POST，301 可能被客户端改为 GET。
4. **HSTS 已缓存客户端**：可能先内部升级到 apex HTTPS 再 301 到 www（多一跳，最终仍到 www），未在真实已缓存浏览器验证。
5. **社区写接口**：发帖/审核/点赞/举报等写操作本轮只读未触发。
6. **证书续签**：证书 `2026-12-14` 到期，ACME 80 端口豁免已保留，但续签结果未实测。
7. **缓存头变更的长期性能影响**：协商缓存每次条件请求（未变更 304）已验证，未做流量/性能压测。
8. **`/api/` 在非 www 域下的 POST**：本轮仅验证 www 域 `/api/topics` GET 200；apex 域 `/api/` 会 301 到 www，POST 语义未单独验证。

---

## 9. 操作边界复核

| 要求 | 状态 |
|---|---|
| 只部署 H5 所需页面/数据/脚本/SEO/资源 | ✅ 19 个文件，均为 H5 运行时文件 |
| 不上传 `h5/tools/`、`docs/审计/` | ✅ 未上传 |
| 不将 canonical 恢复为非 www | ✅ 线上 13 页扫描 `nonWww=0` |
| 不覆盖已生效的 Nginx www 301 配置 | ✅ 仅新增缓存块；`server_name`/`return 301` 全部原样；四种访问复测通过 |
| 不修改论坛 API、小程序、抖音端、shared 数据 | ✅ 均未触碰（`news.js`/`forum.js` 哈希未变） |
| 不推送 Git | ✅ HEAD 未变 |
| 不清理其他未提交修改 | ✅ 未执行任何 Git 清理/重置；全仓 255 项保持原状 |
| 不擅自改全站/其他站点缓存 | ✅ 仅 MCU Atlas vhost 内两条 location；CSS 缓存头实测未变 |
| 不进行额外 SEO 改造 | ✅ 仅按已批准的第一轮修复与 www 地址部署 |
| 临时文件清理 | ✅ 服务器 `/tmp/mcu_*` 与本地临时文件均已清理；备份目录完整保留 |

---

## 10. 附：关键证据路径

| 内容 | 位置 |
|---|---|
| 部署前全量备份 | `/root/mcu-atlas-h5-backup-20261109/mcu-h5-before-firstround-deploy.tar.gz` |
| 逐文件备份 | `/root/mcu-atlas-h5-backup-20261109/files/`（19 个） |
| 缓存规则前 Nginx 配置备份 | `/root/mcu-atlas-h5-backup-20261109/mcuatlas.xyz.conf.before-cache-rule` |
| www 301 配置备份（上一轮） | `/root/mcu-atlas-nginx-backup-20261109/mcuatlas.xyz.conf.before-www301` |
| 生效配置 | `/www/server/panel/vhost/nginx/mcuatlas.xyz.conf` |
| 本地工具 | `h5/tools/{regression-basic,generate-sitemap,check-live-local-diff}.cjs` |
| 本地报告目录 | `docs/审计/`（本轮新增本报告，未上传生产） |
