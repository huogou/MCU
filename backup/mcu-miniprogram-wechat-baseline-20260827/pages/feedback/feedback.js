// 我要吐槽 feedback（D10-B，P2） - D12-A Step3-8 恢复
// 数据单一源：与 H5 共用 CloudBase feedback 集合（env 同 app.js globalData.envId）
// 治理铁律：不建复杂后台 / 不新增账号体系 / 最小必要字段 / 不暴露技术错误
// 提交优先级：wx.cloud 写入 feedback 集合（与 H5 同一集合）→ 失败兜底本地队列（不丢反馈）
// V1.2.1 审核合规：删除联系方式等身份信息字段，提交仅保留最小必要字段
//（feedbackType/content/createdAt，字段名与集合既有约定一致；H5 侧仍沿用其自身结构，NoSQL 异构文档允许）。

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
    if (!t) { wx.showToast({ title: '先选个反馈类型', icon: 'none' }); return; }
    if (!c) { wx.showToast({ title: '先说说哪里不对', icon: 'none' }); return; }
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

  /* 写集合：优先云端（与 H5 同一 feedback 集合）；无云能力则本地兜底队列（不丢） */
  _write: function (record) {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (typeof wx === 'undefined' || !wx.cloud || !wx.cloud.database) {
        // 云能力不可用：本地缓冲，对用户表现为已提交（不暴露技术错误）
        try {
          var q = wx.getStorageSync(FB_QUEUE_KEY) || [];
          q.push(record);
          wx.setStorageSync(FB_QUEUE_KEY, q);
          resolve();
        } catch (err) { reject(err); }
        return;
      }
      try {
        wx.cloud.database().collection('feedback').add({
          data: record
        }).then(function () {
          resolve();
        }).catch(function (err) {
          // 云端失败：写入本地队列缓冲，容后续同步；并向用户暴露可重试
          try {
            var q = wx.getStorageSync(FB_QUEUE_KEY) || [];
            q.push(record);
            wx.setStorageSync(FB_QUEUE_KEY, q);
          } catch (e) { /* 忽略本地缓冲失败 */ }
          reject(err);
        });
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
    wx.navigateBack({ delta: 1 });
  }
});
