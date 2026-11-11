# M6 G3 guard 调用链与负向测试设计

> V1.4 附件；基于冻结版 `app/build/build.cjs` 的静态审计。**未执行**。
> 目标：验证 `NODE_OPTIONS` preload guard 能拦截 sitemap 工具的两处 `spawnSync`，且失败不产生 release/CURRENT/sitemap 变化。

## 1. 注入时机与模块加载顺序

1. systemd 启动 `/opt/node24/bin/node app/server.cjs`，环境含：
   `NODE_OPTIONS=--require /www/wwwroot/mcu-cms/ops/sitemap-spawn-guard.cjs`。
2. Node 先执行 guard，再执行入口 `server.cjs`；guard 替换 `child_process.spawnSync`/`spawn`/`execFile` 并打标记。
3. `build.cjs` 在请求处理时才 `const { spawnSync } = require('child_process')`，取到的是替换后的函数。
4. 子进程继承 `NODE_OPTIONS`，guard 在 sitemap 工具进程内再次加载并校验自身哈希；日志写 `guard_child_loaded`。
5. 若 `build.cjs` 在 guard 前被加载（入口改写/缺 NODE_OPTIONS），G3 不生效；T0/T4 必须用真实 unit 验证。

## 2. 冻结版调用点

| # | 文件/函数 | API | 参数特征 | 拦截条件 |
|---|---|---|---|---|
| C1 | `app/build/build.cjs` `buildSite()`（约 431 行） | `spawnSync(process.execPath, [tool, '--h5', ...])` | base-only 回退 | `args[0]` 规范化后等于已签字工具路径；文件哈希匹配；无 `shell`；env 含 guard |
| C2 | `app/build/build.cjs` `buildSite()`（约 473 行） | `spawnSync(process.execPath, args)` | 正式生成 | 同上；参数白名单（`--h5/--out/--min-count/--extra/--prev/--allow-remove`） |
| — | `app/publish/release.cjs`（约 119 行） | 无 | 只传 `sitemapTool` | 不执行 |
| — | 其他 app 代码 | 无 sitemap spawn | — | 审计未发现第二入口 |

## 3. 负向测试矩阵

| ID | 注入/操作 | 预期 |
|---|---|---|
| G3-1 | 部署副本改 1 字节（保留备份） | CMS 启动 G2 失败；若已启动，C1/C2 调用抛错；无新 release |
| G3-2 | `CMS_SITEMAP_TOOL` 指向副本 | guard 拒绝非白名单路径；无新 release |
| G3-3 | 调用 `spawnSync` 时 `shell:true` | guard 抛错 |
| G3-4 | 自定义 `env` 删除/清空 `NODE_OPTIONS` | guard 抛错 |
| G3-5 | 自定义 `env` 把 guard 路径改掉 | guard 抛错 |
| G3-6 | 参数含未白名单项（如 `--exec`） | guard 抛错 |
| G3-7 | 直接 `node app/server.cjs`（不带 unit） | 不属于正常链；T0 记录/停止，不据此通过 |
| G3-8 | C1 base 回退与 C2 正式生成分别触发 | guard 日志各记录一次；缺一即失败 |
| G3-9 | guard 抛错后检查 | `releases/CURRENT` 不变；无新 `releases/<seq>`；sitemap 未写 |
| G3-10 | 子进程继承 `NODE_OPTIONS` | sitemap 子进程日志出现 `guard_child_loaded`；参数/输出不受影响 |

## 4. 失败后状态验证

```bash
readlink -f /www/wwwroot/mcu-h5/article
sha256sum /www/wwwroot/mcu-h5/sitemap.xml
cat /www/wwwroot/mcu-cms/releases/CURRENT
ls -1 /www/wwwroot/mcu-cms/releases
```

预期：与失败前快照一致；不得出现部分新 release。

## 5. 直接入口的检测约束

- `systemctl show -p MainPID mcu-cms.service` 与 `systemctl status` 的 cgroup 中应只有 unit 主进程。
- `pgrep -af 'node.*app/server.cjs'` 若发现不在 unit cgroup 的进程，记录违规并停止；这是**检测**，不是技术阻断。
- 不修改 `server.cjs`/`build.cjs`；若 guard 无法拦截，停止并提交证据。

## 6. 停止条件

- 两处 `spawnSync` 任一无法拦截；
- 必须修改 M1–M5 冻结代码；
- guard 失败后仍产生 release/CURRENT/sitemap 变化；
- 子进程未继承/可绕过 guard 且无替代方案。
