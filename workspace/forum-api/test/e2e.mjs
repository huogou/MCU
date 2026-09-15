'use strict';
/* V3.0 论坛 API e2e 测试（在服务器本机执行：node e2e.mjs）
 * 覆盖拍板指令第四~六节：正常流 / 权限 / 越权 / 状态机 / 身份 / 防刷
 * 仅请求 127.0.0.1:8787，不经过 Nginx。
 * 输出：逐项 [PASS]/[FAIL]，末尾汇总；任一 FAIL 退出码 1。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createHmac } from 'node:crypto';

const BASE = 'http://127.0.0.1:8787';
const SECRET = fs.readFileSync('/www/wwwroot/forum-api/data/secret.key', 'utf8').trim();
const ADMIN_TOKEN = fs.readFileSync('/www/wwwroot/forum-api/data/admin-token.key', 'utf8').trim();

let pass = 0, fail = 0, current = '';
function section(name) { current = name; }
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fail++; console.log(`  [FAIL] ${name}${extra ? ' | ' + extra : ''}`); }
}
async function j(method, path, body, token, admin) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const bearer = admin ? ADMIN_TOKEN : token;
  if (bearer) headers['Authorization'] = 'Bearer ' + bearer;
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await r.json(); } catch (e) {}
  return { status: r.status, data, headers: r.headers };
}
function signTokenForced(uid, expMs) {
  const payload = { uid, iat: Date.now() - 1000, exp: expMs };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', SECRET).update(body).digest('base64url');
  return body + '.' + mac;
}
const uuid = () => crypto.randomUUID();

/* ===================== 1. 身份 ===================== */
section('身份');
const d1 = uuid();
const r1 = await j('POST', '/api/me/register', { deviceId: d1 });
ok('register 返回 uid+token', r1.status === 200 && r1.data.uid && r1.data.token);
const uid1 = r1.data.uid, tk1 = r1.data.token;

const r1b = await j('POST', '/api/me/register', { deviceId: d1 });
ok('同 deviceId 重复 register 幂等（同 uid）', r1b.status === 200 && r1b.data.uid === uid1);

const r2 = await j('POST', '/api/me/register', { deviceId: uuid() });
const uid2 = r2.data.uid, tk2 = r2.data.token;
ok('第二用户注册', r2.status === 200 && uid2 !== uid1);

const badReg = await j('POST', '/api/me/register', { deviceId: 'x' });
ok('非法 deviceId 被拒', badReg.status === 400);

const p1 = await j('POST', '/api/me/profile', { nickname: '钢铁影迷', avatar: 'a01' }, tk1);
ok('设置昵称头像', p1.status === 200 && p1.data.profile.nickname === '钢铁影迷');

const badAv = await j('POST', '/api/me/profile', { nickname: '测试', avatar: 'http://evil' }, tk2);
ok('非预设头像被拒', badAv.status === 400);

const p2 = await j('POST', '/api/me/profile', { nickname: '直男影迷', avatar: 'a02' }, tk2);
ok('第二用户设置昵称头像', p2.status === 200);

const meBad = await j('GET', '/api/me', null, 'garbage.token.value');
ok('伪造 token 访问 /api/me → 401', meBad.status === 401);

const expired = signTokenForced(uid1, Date.now() - 1000);
const meExp = await j('GET', '/api/me', null, expired);
ok('过期 token → 401', meExp.status === 401);

/* ===================== 2. 发帖（先审后发） ===================== */
section('发帖与 pending 可见性');
const t1 = await j('POST', '/api/topics', { title: '复仇者联盟5阵容猜想', content: '多元宇宙动荡之后，复仇者如何重组？大家来聊聊。', category: 'movie' }, tk1);
ok('发帖成功且 status=pending', t1.status === 201 && t1.data.status === 'pending');
const topic1 = t1.data.id;

const forge = await j('POST', '/api/topics', { title: '伪造作者测试', content: '尝试伪造 author_id', category: 'general', author_id: uid1 }, tk2);
ok('伪造 author_id 被显式拒绝 → 400', forge.status === 400 && forge.data.error.code === 'FORBIDDEN_FIELD');
const forgeId = forge.data.id;

const pub0 = await j('GET', '/api/topics');
ok('pending 不出现在公开列表', pub0.status === 200 && !pub0.data.items.some((i) => i.id === topic1));

const det1ByOther = await j('GET', `/api/topics/${topic1}`, null, tk2);
ok('他人访问他人 pending 详情 → 404', det1ByOther.status === 404);

const det1ByAuthor = await j('GET', `/api/topics/${topic1}`, null, tk1);
ok('作者可见自己 pending 详情', det1ByAuthor.status === 200 && det1ByAuthor.data.status === 'pending');

const myTopics = await j('GET', '/api/me/topics', null, tk1);
ok('我的帖子含 pending', myTopics.status === 200 && myTopics.data.items.some((i) => i.id === topic1));

const anon = await j('GET', '/api/topics?status=pending');
ok('公开列表无视 status 参数（恒 approved）', anon.status === 200 && !anon.data.items.some((i) => i.status !== 'approved'));

/* ===================== 3. 审核状态机（合法转换） ===================== */
section('状态机·合法转换');
const ap1 = await j('POST', `/api/admin/topics/${topic1}/approve`, null, null, true);
ok('pending → approved（admin）', ap1.status === 200 && ap1.data.status === 'approved');

const pub1 = await j('GET', '/api/topics');
ok('approved 出现在公开列表', pub1.data.items.some((i) => i.id === topic1));

const t2 = await j('POST', '/api/topics', { title: '会被驳回的帖子', content: '这条将被驳回，仅作者可见。', category: 'general' }, tk1);
const topic2 = t2.data.id;
const rj2 = await j('POST', `/api/admin/topics/${topic2}/reject`, null, null, true);
ok('pending → rejected', rj2.status === 200 && rj2.data.status === 'rejected');
const pub2 = await j('GET', '/api/topics');
ok('rejected 不在公开列表', !pub2.data.items.some((i) => i.id === topic2));
const det2ByAuthor = await j('GET', `/api/topics/${topic2}`, null, tk1);
ok('作者可见自己 rejected', det2ByAuthor.status === 200 && det2ByAuthor.data.status === 'rejected');
const det2ByOther = await j('GET', `/api/topics/${topic2}`, null, tk2);
ok('他人不可见 rejected → 404', det2ByOther.status === 404);

const hd = await j('POST', `/api/admin/topics/${topic1}/hide`, null, null, true);
ok('approved → hidden', hd.status === 200 && hd.data.status === 'hidden');
const pub3 = await j('GET', '/api/topics');
ok('hidden 不在公开列表', !pub3.data.items.some((i) => i.id === topic1));
const rs = await j('POST', `/api/admin/topics/${topic1}/restore`, null, null, true);
ok('hidden → approved（恢复）', rs.status === 200 && rs.data.status === 'approved');

const t3 = await j('POST', '/api/topics', { title: '将被删除的帖子', content: '删除测试', category: 'general' }, tk1);
const dl = await j('POST', `/api/admin/topics/${t3.data.id}/delete`, null, null, true);
ok('pending → deleted（逻辑删除）', dl.status === 200 && dl.data.status === 'deleted');
const det3 = await j('GET', `/api/topics/${t3.data.id}`, null, tk1);
ok('deleted 详情 → 410（所有人）', det3.status === 410);
const my3 = await j('GET', '/api/me/topics', null, tk1);
ok('我的帖子不出现 deleted', !my3.data.items.some((i) => i.id === t3.data.id));

/* ===================== 4. 状态机（非法转换） ===================== */
section('状态机·非法转换');
const ill1 = await j('POST', `/api/admin/topics/${topic1}/approve`, null, null, true);
ok('approved → approve 非法', ill1.status === 400 && ill1.data.error.code === 'INVALID_TRANSITION');
const ill2 = await j('POST', `/api/admin/topics/${topic2}/hide`, null, null, true);
ok('rejected → hide 非法', ill2.status === 400);
const ill3 = await j('POST', `/api/admin/topics/${topic1}/restore`, null, null, true);
ok('approved → restore 非法', ill3.status === 400);
const ill4 = await j('POST', `/api/admin/topics/${t3.data.id}/approve`, null, null, true);
ok('deleted → approve 非法（终态）', ill4.status === 400);
const ill5b = await j('POST', `/api/admin/topics/${topic1}/approve`, null, tk1);
ok('用户 token 调 admin → 401', ill5b.status === 401);
const wrongAdmin = await fetch(BASE + `/api/admin/topics/${topic1}/approve`, { method: 'POST', headers: { Authorization: 'Bearer wrong-token-123' } });
ok('错误 admin token → 401', wrongAdmin.status === 401);

/* ===================== 5. 回复（先审后发） ===================== */
section('回复');
const rp = await j('POST', `/api/topics/${topic1}/replies`, { content: '我猜神奇先生会回归。' }, tk2);
ok('approved 话题可回复且 pending', rp.status === 201 && rp.data.status === 'pending');
const reply1 = rp.data.id;

const pubR0 = await j('GET', `/api/topics/${topic1}/replies`, null, tk2);
ok('pending 回复不出现在回复列表', !pubR0.data.items.some((i) => i.id === reply1));

const apr = await j('POST', `/api/admin/replies/${reply1}/approve`, null, null, true);
ok('回复 pending → approved', apr.status === 200);

const pubR1 = await j('GET', `/api/topics/${topic1}/replies`);
ok('approved 回复出现（floor=1）', pubR1.data.items.length === 1 && pubR1.data.items[0].floor === 1);

const det1 = await j('GET', `/api/topics/${topic1}`);
ok('reply_count 联动 =1', det1.data.replyCount === 1);

/* hidden 话题不可互动：直接对 topic1 hide→测→restore（避免占用发帖配额） */
const hideT1 = await j('POST', `/api/admin/topics/${topic1}/hide`, null, null, true);
ok('t1 进入 hidden（供互动封锁测试）', hideT1.status === 200);
const rpBlocked = await j('POST', `/api/topics/${topic1}/replies`, { content: '试图回复隐藏话题' }, tk2);
ok('hidden 话题不可回复 → 403', rpBlocked.status === 403);
const rsT1 = await j('POST', `/api/admin/topics/${topic1}/restore`, null, null, true);
ok('t1 恢复 approved', rsT1.status === 200 && rsT1.data.status === 'approved');

/* ===================== 6. 点赞（幂等/防重/计数） ===================== */
section('点赞');
const lk1 = await j('POST', `/api/topics/${topic1}/like`, null, tk2);
ok('点赞 likeCount=1', lk1.status === 200 && lk1.data.likeCount === 1);
const lk2 = await j('POST', `/api/topics/${topic1}/like`, null, tk2);
ok('重复点赞幂等 likeCount=1', lk2.status === 200 && lk2.data.likeCount === 1);
const lk3 = await j('DELETE', `/api/topics/${topic1}/like`, null, tk2);
ok('取消点赞 likeCount=0', lk3.status === 200 && lk3.data.likeCount === 0);
const lk4 = await j('DELETE', `/api/topics/${topic1}/like`, null, tk2);
ok('未赞再取消幂等 likeCount=0', lk4.status === 200 && lk4.data.likeCount === 0);
const lk5 = await j('POST', `/api/topics/${topic1}/like`, null, tk2);
ok('再点赞（保留供后续测试）', lk5.status === 200 && lk5.data.likeCount === 1);
const lk6 = await j('POST', `/api/replies/${reply1}/like`, null, tk1);
ok('回复可点赞', lk6.status === 200 && lk6.data.likeCount === 1);

const detHot = await j('GET', '/api/topics?sort=hot');
ok('最热排序可用', detHot.status === 200 && detHot.data.items.length >= 1);
const detLiked = await j('GET', `/api/topics/${topic1}`, null, tk2);
ok('详情返回 liked=true（当前用户）', detLiked.data.liked === true);
const detLiked2 = await j('GET', `/api/topics/${topic1}`, null, tk1);
ok('详情返回 liked=false（未赞用户）', detLiked2.data.liked === false);

/* ===================== 7. 举报（防重复） ===================== */
section('举报');
const rp1 = await j('POST', `/api/topics/${topic1}/report`, { reason: 'spam' }, tk2);
ok('举报成功', rp1.status === 201);
const rp2 = await j('POST', `/api/topics/${topic1}/report`, { reason: 'spam' }, tk2);
ok('同用户重复举报 → 409', rp2.status === 409 && rp2.data.error.code === 'ALREADY_REPORTED');
const rp3 = await j('POST', `/api/topics/${topic1}/report`, { reason: 'hacking' }, tk1);
ok('非法 reason 被拒', rp3.status === 400);

/* ===================== 8. 越权（无修改通道） ===================== */
section('越权');
const put1 = await j('PUT', `/api/topics/${topic1}`, { title: '篡改' }, tk2);
ok('无 PUT 修改端点（→404）', put1.status === 404);
const patch1 = await j('PATCH', `/api/topics/${topic1}`, { status: 'approved' }, tk2);
ok('无 PATCH status 端点（→404）', patch1.status === 404);
const st1 = await j('POST', `/api/topics/${topic1}/status`, { status: 'approved' }, tk2);
ok('无 /status 自定义端点（→404）', st1.status === 404);
const lc1 = await j('POST', `/api/topics/${topic1}/like_count`, { like_count: 999 }, tk2);
ok('无 like_count 修改端点（→404）', lc1.status === 404);
const delByUser = await j('POST', `/api/admin/topics/${topic1}/delete`, null, tk2);
ok('用户 token 不可删除他人内容（admin 401）', delByUser.status === 401);

/* ===================== 9. 防刷（频率限制） ===================== */
section('防刷');
const s1 = await j('POST', '/api/topics', { title: '限流测试1', content: 'rate limit probe 1', category: 'general' }, tk2);
const s2 = await j('POST', '/api/topics', { title: '限流测试2', content: 'rate limit probe 2', category: 'general' }, tk2);
const s3 = await j('POST', '/api/topics', { title: '限流测试3', content: 'rate limit probe 3', category: 'general' }, tk2);
ok('第4帖触发 429（阈值 3/10min）', s1.status === 201 && s2.status === 201 && s3.status === 429);

/* ===================== 汇总 ===================== */
console.log(`\n===== e2e 汇总：PASS ${pass} / FAIL ${fail} =====`);
process.exit(fail > 0 ? 1 : 0);
