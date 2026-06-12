const { timeAgo, categoryMap } = require('../../utils/util');

Page({
  data: {
    categories: [],
    activeCategory: '',
    list: [],
    leftList: [],
    rightList: [],
    page: 1,
    pageSize: 20,
    loading: false,
    noMore: false,
  },

  onLoad() {
    const cats = [{ key: '', label: '全部', icon: '🔥' }];
    Object.entries(categoryMap).forEach(([key, val]) => {
      cats.push({ key, ...val });
    });
    this.setData({ categories: cats });
    this.loadProducts();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, list: [], noMore: false });
    this.loadProducts().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.noMore && !this.data.loading) {
      this.loadProducts();
    }
  },

  switchCategory(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeCategory) return;
    this.setData({ activeCategory: key, page: 1, list: [], leftList: [], rightList: [], noMore: false });
    this.loadProducts();
  },

  loadProducts() {
    this.setData({ loading: true });
    const { activeCategory, page, pageSize } = this.data;
    return wx.cloud.callFunction({
      name: 'product',
      data: {
        action: 'list',
        category: activeCategory || '',
        page,
        pageSize,
      },
    }).then(res => {
      let list = this.data.list;
      if (page === 1) list = [];

      const items = (res.result.data || []).map(item => ({
        ...item,
        categoryLabel: categoryMap[item.category] ? categoryMap[item.category].label : '',
        timeAgo: timeAgo(item.createdAt),
      }));

      const newList = [...list, ...items];
      const leftList = newList.filter((_, i) => i % 2 === 0);
      const rightList = newList.filter((_, i) => i % 2 === 1);

      this.setData({
        list: newList,
        leftList,
        rightList,
        page: page + 1,
        loading: false,
        noMore: items.length < pageSize,
      });
    }).catch(err => {
      console.error('加载商品失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  goSearch() {
    wx.navigateTo({ url: '/pages/search/search' });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.detail.id });
  },
});
