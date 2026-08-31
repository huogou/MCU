// 我要吐槽 feedback（抖音版 V1.2.0）
// 策略：选项一 本地队列（策划 GPT 拍板）——抖音端不走云端，所有反馈仅写入本地 Storage，不汇总、不上传
// 治理铁律：不建复杂后台 / 不新增账号体系 / 最小必要字段 / 不暴露技术错误
// V1.2.1 审核合规：删除联系方式等身份信息字段，提交仅保留最小必要字段
//（feedbackType/content/createdAt）。H5 / 微信端仍沿用其自身反馈策略，抖音端物理隔离。

const TYPES = [
  { key: 'sequence',   label: '观影顺序问题' },
  { key: 'movie_info', label: '电影信息错误' },
  { key: 'name_error', label: '名称错误' },
  { key: 'ux',         label: '页面体验问题' },
  { key: 'feature',    label: '功能建议' },
  { key: 'other',      label: '其他' }
];

// 本地兜底队列键（仅云写入不可达时缓冲，非独立库）
const FB_QUEUE_KEY = '_mcu_feedback_queue';

Page({
  data: {
    types: TYPES,
    activeType: '',
    content: '',
    submitting: false,
    done: false,
    fail: false
  },

  selectType: function (e) {
    this.setData({ activeType: e.currentTarget.dataset.key });
  },

  onContent: function (e) {
    this.setData({ content: e.detail.value });
  },

  submit: function () {
    var t = this.data.activeType;
    var c = (this.data.content || '').trim();
    if (!t) { tt.showToast({ title: '先选个反馈类型', icon: 'none' }); return; }
    if (!c) { tt.showToast({ title: '先说说哪里不对', icon: 'none' }); return; }
    if (this.data.submitting) return;
    this.setData({ submitting: true, fail: false });

    /* 审核合规：仅提交最小必要字段，不采集任何用户身份信息（联系方式/来源/渠道均不收集） */
    var record = {
      feedbackType: t,
      content: c,
      createdAt: new Date().toISOString()
    };

    var self = this;
    this._write(record).then(function () {
      self.setData({ submitting: false, done: true });
    }).catch(function () {
      self.setData({ submitting: false, fail: true });
    });
  },

  /* 写反馈：抖音端选项一，直接写入本地 Storage 队列（不调用任何云端接口） */
  _write: function (record) {
    return new Promise(function (resolve, reject) {
      try {
        var q = tt.getStorageSync(FB_QUEUE_KEY) || [];
        q.push(record);
        tt.setStorageSync(FB_QUEUE_KEY, q);
        resolve();
      } catch (err) { reject(err); }
    });
  },

  retry: function () {
    this.setData({ fail: false });
    this.submit();
  },

  goAgain: function () {
    this.setData({
      done: false, activeType: '', content: '',
      submitting: false, fail: false
    });
  },

  back: function () {
    tt.navigateBack({ delta: 1 });
  }
});
