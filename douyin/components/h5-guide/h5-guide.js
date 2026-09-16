/* ============================================================
 * h5-guide · H5 引导卡（可复用组件）· V2.0.0
 * ------------------------------------------------------------
 * 交互：点击 → 直接复制 H5 链接 + Toast（不经确认弹窗）。
 *       真机验收发现「showModal 回调内 setClipboardData」会 fail，
 *       已收敛到 models/h5Link.js 单一实现（弹窗移除，直调修复）。
 * ============================================================ */
const h5Link = require('../../models/h5Link.js');

Component({
  properties: {
    title: { type: String, value: '想了解更多？' },
    desc: { type: String, value: '前往 H5 查看完整内容' }
  },

  methods: {
    onTap() {
      h5Link.copy();
    }
  }
});
