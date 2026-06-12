const { timeAgo, categoryMap } = require('../../utils/util');

Page({
  data: {
    list: [],
    leftList: [],
    rightList: [],
  },

  onShow() {
    this.loadList();
  },

  loadList() {
    wx.cloud.callFunction({
      name: 'favorite',
      data: { action: 'list' },
    }).then(res => {
      const list = (res.result.data || []).map(item => ({
        ...item,
        categoryLabel: categoryMap[item.category] ? categoryMap[item.category].label : '',
        timeAgo: timeAgo(item.createdAt),
      }));
      const leftList = list.filter((_, i) => i % 2 === 0);
      const rightList = list.filter((_, i) => i % 2 === 1);
      this.setData({ list, leftList, rightList });
    });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.detail.id });
  },

  goIndex() {
    wx.switchTab({ url: '/pages/index/index' });
  },
});
