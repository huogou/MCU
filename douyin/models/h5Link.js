/* ============================================================
 * h5Link · H5 出口统一模块（抖音端唯一 H5 链接来源）
 * ------------------------------------------------------------
 * 纪律：URL 单一常量，禁散落硬编码；复制逻辑唯一实现。
 * 历史：V2.0.0 真机验收发现「showModal 确认弹窗 success 回调中
 *       调用 tt.setClipboardData」在真机 fail（Toast 复制失败），
 *       疑似弹窗关闭动画期间异步调用被丢弃 → 改为点击直接复制；
 *       fail 时透出 errMsg 便于真机定位残余问题。
 * ============================================================ */

const H5_URL = 'https://mcuatlas.xyz/';

function copyH5Link() {
  tt.setClipboardData({
    data: H5_URL,
    success: function () {
      tt.showToast({ title: '链接已复制 · 浏览器粘贴打开', icon: 'none', duration: 2200 });
    },
    fail: function (e) {
      var msg = (e && e.errMsg) ? ('复制失败: ' + e.errMsg) : '复制失败 · 请稍后重试';
      tt.showToast({ title: msg, icon: 'none', duration: 2600 });
    }
  });
}

module.exports = {
  H5_URL: H5_URL,
  copy: copyH5Link
};
