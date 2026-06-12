const app = getApp();

Page({
  data: {
    isLogin: false,
    userInfo: null,
  },

  onShow() {
    this.checkLoginStatus();
  },

  checkLoginStatus() {
    app.checkLogin().then(isLogin => {
      this.setData({
        isLogin,
        userInfo: app.globalData.userInfo,
      });
    });
  },

  doLogin() {
    wx.getUserProfile({
      desc: '用于完善个人资料',
      success: (res) => {
        const userInfo = res.userInfo;
        wx.cloud.callFunction({
          name: 'user',
          data: {
            action: 'login',
            nickName: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl,
          }
        }).then(cloudRes => {
          const info = {
            ...userInfo,
            ...(cloudRes.result.data || {}),
          };
          app.setUserInfo(info);
          this.setData({ isLogin: true, userInfo: info });
          wx.showToast({ title: '登录成功', icon: 'success' });
        }).catch(err => {
          console.error('登录失败:', err);
          wx.showToast({ title: '登录失败', icon: 'none' });
        });
      },
      fail: () => {
        wx.showToast({ title: '需要授权才能使用完整功能', icon: 'none' });
      }
    });
  },

  doLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('userInfo');
          app.globalData.userInfo = null;
          app.globalData.isLogin = false;
          this.setData({ isLogin: false, userInfo: null });
        }
      }
    });
  },

  goMyPublish() {
    if (!this.data.isLogin) return this.doLogin();
    wx.navigateTo({ url: '/pages/my-publish/my-publish' });
  },

  goFavorites() {
    if (!this.data.isLogin) return this.doLogin();
    wx.navigateTo({ url: '/pages/favorites/favorites' });
  },

  goMessages() {
    wx.switchTab({ url: '/pages/messages/messages' });
  },
});
