const { formatTime } = require('../../utils/util');
const app = getApp();

Page({
  data: {
    targetOpenid: '',
    productId: '',
    messages: [],
    inputText: '',
    scrollToView: '',
    myAvatar: '',
    otherAvatar: '',
  },

  onLoad(options) {
    this.setData({
      targetOpenid: options.openid || '',
      productId: options.productId || '',
      myAvatar: (app.globalData.userInfo && app.globalData.userInfo.avatarUrl) || '',
    });
    this.loadMessages();
    this.markRead();

    this._timer = setInterval(() => this.loadMessages(), 3000);
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer);
  },

  loadMessages() {
    if (!this.data.targetOpenid) return;

    wx.cloud.callFunction({
      name: 'message',
      data: {
        action: 'conversation',
        targetOpenid: this.data.targetOpenid,
        productId: this.data.productId,
      },
    }).then(res => {
      const messages = (res.result.data || []).map((msg, i) => {
        const isMine = msg.fromOpenid !== this.data.targetOpenid;
        const prev = i > 0 ? res.result.data[i - 1] : null;
        const showTime = !prev ||
          (new Date(msg.createdAt) - new Date(prev.createdAt)) > 300000;
        return {
          ...msg,
          isMine,
          showTime,
          timeText: showTime ? formatTime(msg.createdAt, 'MM-DD HH:mm') : '',
        };
      });

      this.setData({ messages, scrollToView: 'msg-bottom' });

      // 设置对方头像
      if (messages.length > 0) {
        const otherMsg = messages.find(m => !m.isMine);
        if (otherMsg) {
          // 从消息中看不到头像，需额外获取
        }
      }
    });
  },

  markRead() {
    wx.cloud.callFunction({
      name: 'message',
      data: { action: 'markRead', fromOpenid: this.data.targetOpenid },
    });
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  sendMessage() {
    const text = this.data.inputText.trim();
    if (!text) return;

    if (!app.globalData.isLogin) {
      return wx.showToast({ title: '请先登录', icon: 'none' });
    }

    wx.cloud.callFunction({
      name: 'message',
      data: {
        action: 'send',
        toOpenid: this.data.targetOpenid,
        productId: this.data.productId,
        content: text,
      },
    }).then(() => {
      this.setData({ inputText: '' });
      this.loadMessages();
    });
  },
});
