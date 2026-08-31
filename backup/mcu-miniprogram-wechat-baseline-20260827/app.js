// MCU观影导航 V1.0 - 小程序全局逻辑
// 重建依据：D10-A 冻结稿 + D11 验收清单（恢复，不重新设计）
// 数据唯一源：H5 data/*.js（经 Step3-2 数据层机械适配后接入，不重新录入）
App({
  globalData: {
    envId: 'mcu-d6gw0brqoa9521b58',
    appId: 'wx78f00e7f0a5948b7',
    // 用户态持久化键（与 H5 localStorage 逻辑对齐，物理隔离；
    // Step3-2 数据层接入：键名统一为 H5 的 mcu_nav_user_v1，见 models/userState.js）
    storeKey: 'mcu_nav_user_v1'
  },

  onLaunch() {
    if (!wx.cloud) {
      console.warn('[mcu] 当前基础库不支持 wx.cloud，反馈云存储(D10-B)将不可用');
      return;
    }
    wx.cloud.init({
      env: this.globalData.envId,
      traceUser: true
    });
  }
});
