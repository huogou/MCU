# M6 helper / spool 权限矩阵

> V1.4 方案附件；**未执行**。所有权限均需在 M6 沙箱真实 unit 验证。

## 1. 用户与组

| 主体 | 类型 | 说明 |
|---|---|---|
| `mcucms` | 系统用户 | CMS service；nologin；**不是** `mcucms-publish` 成员 |
| `mcucms-publish` | 系统组 | 仅用于 helper 补充组；无普通登录成员 |
| `root` | helper | `SupplementaryGroups=mcucms-publish`；`CapabilityBoundingSet=` 空 |

## 2. 目录/文件矩阵

| 对象 | owner:group | mode | ACL | 访问 |
|---|---|---|---|---|
| `spool` | root:root | 0755 | 无 | 仅穿越 |
| `spool/incoming` | mcucms:mcucms-publish | **2770** | 无 | mcucms owner rwx；helper group rwx；other none |
| `spool/incoming/*.req` | mcucms:mcucms-publish | **0640** | 无 | mcucms rw；helper group r；other none |
| `spool/work` | root:root | **0700** | 无 | 仅 root；mcucms 不可进入 |
| `spool/done` | root:mcucms | **0750** | 无 | helper root rwx；mcucms group r-x |
| `spool/done/*.res` | root:mcucms | **0640** | 无 | mcucms group r |
| `spool/failed` | root:mcucms | **0750** | 无 | helper 写；mcucms 组只读失败结果 |
| `spool/failed/*.res` | root:mcucms | **0640** | 无 | mcucms 只读 |
| `/var/log/mcu-cms-publish` | root:root | 0750 | 无 | 仅 root |
| `/var/log/mcu-cms-publish/publish.log` | root:root | 0640 | 无 | helper append |
| `/www/backup/cms-sitemap` | root:root | 0750 | 无 | helper |
| `/usr/local/sbin/mcu-cms-publish` | root:root | 0755 | 无 | helper |

## 3. 为什么不用 ACL

- 组 + `incoming 2770` setgid 已满足：mcucms 写、helper 组穿越/读/rename、other 无权限。
- `setgid` 让新文件自动继承 `mcucms-publish` 组；文件 0640 组读。
- ACL（`setfacl -m g:mcucms-publish:rwx` + default ACL）可行，但增加 `setfacl` 依赖、备份/恢复 ACL 元数据与审计复杂度；**本方案不用 ACL**。
- **不增加 `CAP_DAC_OVERRIDE`**；不依赖 root 对 0700 目录的超级用户假设。

## 4. 验证命令与预期

```bash
getent group mcucms-publish
id mcucms                                   # 不含 mcucms-publish
systemctl show -p SupplementaryGroups mcu-cms-publish.service

namei -l /www/wwwroot/mcu-cms/spool/incoming
stat -c '%U %G %a %n' /www/wwwroot/mcu-cms/spool/incoming
stat -c '%U %G %a %n' /www/wwwroot/mcu-cms/spool/work
stat -c '%U %G %a %n' /www/wwwroot/mcu-cms/spool/done

runuser -u mcucms -- sh -c 'umask 0027; printf "{}" > /www/wwwroot/mcu-cms/spool/incoming/probe.req; chmod 0640 /www/wwwroot/mcu-cms/spool/incoming/probe.req'
stat -c '%U %G %a %n' /www/wwwroot/mcu-cms/spool/incoming/probe.req
# 预期：mcucms mcucms-publish 640

runuser -u mcucms -- ls /www/wwwroot/mcu-cms/spool/work
# 预期：Permission denied

# 仅探索；最终以真实 mcu-cms-publish.service 为准
setpriv --reuid=0 --regid=0 --clear-groups --groups=mcucms-publish \
  --inh-caps=-all --ambient-caps=-all --bounding-set=-all \
  sh -c 'id; cat /www/wwwroot/mcu-cms/spool/incoming/probe.req >/dev/null; mv /www/wwwroot/mcu-cms/spool/incoming/probe.req /www/wwwroot/mcu-cms/spool/work/probe.req'
# 预期：读/rename 成功；CapEff 无 CAP_DAC_OVERRIDE
```

## 5. 失败处理

- helper 不能读/rename → 先检查 `incoming` 2770、setgid、文件 0640、`SupplementaryGroups`；仍失败则停止，重新设计，**不得加 `CAP_DAC_OVERRIDE`**。
- mcucms 能进入 work → 立即停止，修权限/组成员，重新 T4。
- helper 能写其他日志/目录 → 停止，收窄 `ReadWritePaths`，不得放宽。
