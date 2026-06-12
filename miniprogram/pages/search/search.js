const { timeAgo, categoryMap } = require('../../utils/util');

Page({
  data: {
    keyword: '',
    list: [],
    leftList: [],
    rightList: [],
    searched: false,
    history: [],
  },

  onLoad() {
    const history = wx.getStorageSync('searchHistory') || [];
    this.setData({ history });
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  doSearch() {
    const keyword = this.data.keyword.trim();
    if (!keyword) return;

    // 保存历史
    let history = this.data.history.filter(h => h !== keyword);
    history.unshift(keyword);
    if (history.length > 10) history = history.slice(0, 10);
    this.setData({ history });
    wx.setStorageSync('searchHistory', history);

    wx.cloud.callFunction({
      name: 'product',
      data: { action: 'list', keyword, page: 1, pageSize: 50 },
    }).then(res => {
      const list = (res.result.data || []).map(item => ({
        ...item,
        categoryLabel: categoryMap[item.category] ? categoryMap[item.category].label : '',
        timeAgo: timeAgo(item.createdAt),
      }));
      const leftList = list.filter((_, i) => i % 2 === 0);
      const rightList = list.filter((_, i) => i % 2 === 1);
      this.setData({ list, leftList, rightList, searched: true });
    });
  },

  clearSearch() {
    this.setData({ keyword: '', searched: false, list: [], leftList: [], rightList: [] });
  },

  clearHistory() {
    this.setData({ history: [] });
    wx.removeStorageSync('searchHistory');
  },

  tapHistory(e) {
    this.setData({ keyword: e.currentTarget.dataset.keyword });
    this.doSearch();
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.detail.id });
  },

  goBack() {
    wx.navigateBack();
  },
});
