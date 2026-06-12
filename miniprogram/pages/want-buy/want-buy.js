const { timeAgo, formatPrice, categoryMap } = require('../../utils/util');

Page({
  data: {
    categories: [],
    activeCategory: '',
    list: [],
  },

  onLoad() {
    const cats = [{ key: '', label: '全部', icon: '📋' }];
    Object.entries(categoryMap).forEach(([key, val]) => {
      cats.push({ key, ...val });
    });
    this.setData({ categories: cats });
    this.loadList();
  },

  onShow() {
    this.loadList();
  },

  switchCategory(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeCategory: key });
    this.loadList();
  },

  loadList() {
    wx.cloud.callFunction({
      name: 'wantBuy',
      data: {
        action: 'list',
        category: this.data.activeCategory || '',
      },
    }).then(res => {
      const list = (res.result.data || []).map(item => ({
        ...item,
        timeAgo: timeAgo(item.createdAt),
        budgetText: '预算: ' + formatPrice(item.budget),
      }));
      this.setData({ list });
    });
  },

  goDetail(e) {
    wx.showToast({ title: '求购详情开发中', icon: 'none' });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/publish/publish?type=want' });
  },
});
