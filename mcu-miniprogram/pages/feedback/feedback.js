// 我要吐槽 feedback（D10-B，P2） - D12-A Step3-8 恢复
// 数据单一源：与 H5 共用 CloudBase feedback 集合（env 同 app.js globalData.envId）
// 治理铁律：不建复杂后台 / 不新增账号体系 / 最小必要字段 / 不暴露技术错误
// 提交优先级：wx.cloud 写入 feedback 集合（与 H5 同一集合）→ 失败兜底本地队列（不丢反馈）
// 字段与 H5 assets/js/app.js:1239 严格对齐，禁第二套结构。

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
    contact: '',
    source: '',
    channel: '',
    submitting: false,
    done: false,
    fail: false
  },

  onLoad: function (query) {
    // from=来源页面（my-mcu 等）；channel=投放渠道（douyin/xiaohongshu/...，为 H5 来源统计预留）
    this.setData({
      source: (query && query.from) || 'unknown',
      channel: (query && query.channel) || ''
    });
  },

  selectType: function (e) {
    this.setData({ activeType: e.currentTarget.dataset.key });
  },

  onContent: function (e) {
    this.setData({ content: e.detail.value });
  },

  onContact: function (e) {
    this.setData({ contact: e.detail.value });
  },

  submit: function () {
    var t = this.data.activeType;
    var c = (this.data.content || '').trim();
    if (!t) { wx.showToast({ title: '先选个反馈类型', icon: 'none' }); return; }
    if (!c) { wx.showToast({ title: '先说说哪里不对', icon: 'none' }); return; }
    if (this.data.submitting) return;
    this.setData({ submitting: true, fail: false });

    var record = {
      feedbackType: t,
      content: c,
      contact: (this.data.contact || '').trim(),
      page: this.data.source || 'unknown',
      movieId: '',
      routeId: '',
      exploreId: '',
      contextName: '',
      platform: 'miniprogram',
      channel: this.data.channel || '',
      createdAt: new Date().toISOString(),
      status: 'new'
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
      done: false, activeType: '', content: '', contact: '',
      submitting: false, fail: false
    });
  },

  back: function () {
    wx.navigateBack({ delta: 1 });
  }
});
