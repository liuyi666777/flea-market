const { timeAgo, categoryMap } = require('../../utils/util');

Page({
  data: {
    tabs: [
      { key: 'selling', label: '在售' },
      { key: 'sold', label: '已售' },
      { key: '', label: '全部' },
    ],
    activeTab: 'selling',
    list: [],
    leftList: [],
    rightList: [],
  },

  onShow() {
    this.loadList();
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeTab: key });
    this.loadList();
  },

  loadList() {
    wx.cloud.callFunction({
      name: 'product',
      data: {
        action: 'myList',
        status: this.data.activeTab || '',
      },
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

  goPublish() {
    wx.switchTab({ url: '/pages/publish/publish' });
  },
});
