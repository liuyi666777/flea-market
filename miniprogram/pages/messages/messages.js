const { timeAgo } = require('../../utils/util');
const app = getApp();

Page({
  data: {
    conversations: [],
  },

  onShow() {
    if (!app.globalData.isLogin) {
      this.setData({ conversations: [] });
      return;
    }
    this.loadConversations();
  },

  loadConversations() {
    wx.cloud.callFunction({
      name: 'message',
      data: { action: 'list' },
    }).then(res => {
      const conversations = (res.result.data || []).map(item => ({
        ...item,
        timeAgo: timeAgo(item.lastTime),
      }));
      this.setData({ conversations });
    });
  },

  goChat(e) {
    const { openid, productId } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/chat/chat?openid=${openid}&productId=${productId || ''}`,
    });
  },
});
