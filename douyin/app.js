// MCU观影导航 - 小程序全局逻辑（抖音端 AppID: tt00eb76569e914af801）
// 架构：本地优先，无云端后端；用户数据仅保存在本机 storage，不上报任何服务器
// 数据唯一源：H5 data/*.js（经 Step3-2 数据层机械适配后接入，不重新录入）
// 2026-09-07 清理：移除微信端遗留的 wx.cloud 初始化、traceUser 与微信 AppID
App({
  globalData: {
    // 用户态持久化键（与 H5 localStorage 逻辑对齐，物理隔离）
    storeKey: 'mcu_nav_user_v1'
  }
});
