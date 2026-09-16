/* ============================================================
 * h5Link · H5 出口统一模块（抖音端唯一 H5 链接来源）
 * ------------------------------------------------------------
 * 纪律：URL 单一常量，禁散落硬编码；复制逻辑唯一实现。
 * 历史：
 *   V2.0.0 真机①：showModal 回调内调用 tt.setClipboardData
 *   fail → 改为点击直接复制。
 *   V2.0.0 真机②（09-16）：直调仍 fail，toast 仅见
 *   "setClipboardData:fail"（errMsg 被截断）。对照官方错误码：
 *   剪贴板为隐私接口——104179 隐私协议未声明剪贴板（平台控制台
 *   配置问题，代码不可修）；104180/104190 用户未授权（可引导
 *   tt.openSetting）；104194 小程序退后台。
 *   → fail 处理升级：console 全量透出 + 错误码映射 + 授权引导。
 * ============================================================ */

var H5_URL = 'https://mcuatlas.xyz/';

/* 对照 tt.setClipboardData 官方错误码表，把 fail 原因映射为用户可读短文案 */
function explainFail(e) {
  var no = (e && e.errNo !== undefined) ? e.errNo
    : (e && e.errCode !== undefined) ? e.errCode
    : (e && e.errorCode !== undefined) ? e.errorCode
    : undefined;
  var msg = (e && e.errMsg) || '';
  if (no === 104179 || msg.indexOf('not declared') !== -1) {
    return '剪贴板未在隐私协议声明(104179)';
  }
  if (no === 104180 || no === 104190 ||
      msg.indexOf('auth deny') !== -1 || msg.indexOf('privacy permission') !== -1) {
    return 'AUTH_DENIED';
  }
  if (no === 104194 || msg.indexOf('background') !== -1) return '小程序退后台(104194)';
  if (no === 104191 || msg.indexOf('ApiControl') !== -1) return '框架拦截(104191)';
  if (no === 104199 || msg.indexOf('null') !== -1 || msg.indexOf('string') !== -1) return '参数错误(104199)';
  return (no !== undefined ? no + ' ' : '') + (msg || '未知原因');
}

/* 授权类失败：弹窗引导去设置页开启剪贴板权限，授权成功自动重试一次 */
function guideAuth() {
  tt.showModal({
    title: '需要剪贴板权限',
    content: '复制链接需要「剪贴板」权限，请在设置中开启后重试。',
    confirmText: '去设置',
    cancelText: '取消',
    success: function (r) {
      if (r && r.confirm) {
        tt.openSetting({
          success: function (s) {
            if (s && s.authSetting && s.authSetting['scope.clipboard']) {
              copyH5Link();
            } else {
              tt.showToast({ title: '未开启权限，可稍后重试', icon: 'none' });
            }
          },
          fail: function () {
            tt.showToast({ title: '打开设置失败，请稍后重试', icon: 'none' });
          }
        });
      }
    }
  });
}

function copyH5Link() {
  tt.setClipboardData({
    data: H5_URL,
    success: function () {
      tt.showToast({ title: '链接已复制 · 浏览器粘贴打开', icon: 'none', duration: 2200 });
    },
    fail: function (e) {
      /* 全量错误对象写入 console（开发者工具 vConsole 可查完整 errMsg/errNo） */
      try { console.error('[h5Link] setClipboardData fail:', JSON.stringify(e)); } catch (err) {}
      var reason = explainFail(e);
      if (reason === 'AUTH_DENIED') { guideAuth(); return; }
      tt.showToast({ title: '复制失败：' + reason, icon: 'none', duration: 3000 });
    }
  });
}

module.exports = {
  H5_URL: H5_URL,
  copy: copyH5Link
};
