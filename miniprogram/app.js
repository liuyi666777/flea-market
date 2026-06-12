App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'your-env-id',
        traceUser: true,
      });
    }

    this.globalData = {
      userInfo: null,
      isLogin: false,
    };
  },

  checkLogin() {
    return new Promise((resolve) => {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        this.globalData.userInfo = userInfo;
        this.globalData.isLogin = true;
        resolve(true);
      } else {
        resolve(false);
      }
    });
  },

  setUserInfo(info) {
    this.globalData.userInfo = info;
    this.globalData.isLogin = true;
    wx.setStorageSync('userInfo', info);
  },
});
