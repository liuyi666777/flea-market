const app = getApp();

Page({
  data: {
    isLogin: false,
    profile: null,
    email: '',
    isAdmin: false,
  },

  onShow() {
    const u = app.globalData.user;
    const p = app.globalData.profile;
    this.setData({
      isLogin: !!u,
      profile: p,
      email: u ? u.email : '',
      isAdmin: p ? !!p.is_admin : false,
    });
  },

  showLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  doLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.logout();
          this.setData({ isLogin: false, profile: null, email: '', isAdmin: false });
        }
      }
    });
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' });
  },

  goMyPublish() {
    if (!this.data.isLogin) return wx.showToast({ title: '请先登录', icon: 'none' });
    wx.navigateTo({ url: '/pages/my-publish/my-publish' });
  },

  goFavorites() {
    if (!this.data.isLogin) return wx.showToast({ title: '请先登录', icon: 'none' });
    wx.navigateTo({ url: '/pages/favorites/favorites' });
  },

  goMessages() {
    wx.switchTab({ url: '/pages/messages/messages' });
  },
});
