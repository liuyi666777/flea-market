const { timeAgo, catMap, getBrowseHistory, clearBrowseHistory } = require('../../utils/util');
const { db } = require('../../utils/supabase');

const PAGE_SIZE = 20;

Page({
  data: {
    categories: [],
    activeCategory: '',
    list: [],
    leftList: [],
    rightList: [],
    page: 0,
    loading: false,
    noMore: false,
    sort: 'created_at',
    sortDir: 'desc',
    condition: -1,
    browseHistory: [],
    showBrowseHistory: false,
  },

  onLoad() {
    const cats = [{ key: '', label: '全部', emoji: '🔥' }];
    Object.entries(catMap).forEach(([key, val]) => {
      cats.push({ key, ...val });
    });
    this.setData({ categories: cats });
    this.loadBrowseHistory();
    this.loadProducts();
  },

  onShow() {
    this.loadBrowseHistory();
  },

  onPullDownRefresh() {
    this.setData({ page: 0, list: [], leftList: [], rightList: [], noMore: false });
    this.loadBrowseHistory();
    this.loadProducts().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.noMore && !this.data.loading) {
      this.loadProducts();
    }
  },

  loadBrowseHistory() {
    var h = getBrowseHistory();
    // add category emoji
    h = h.map(function(p) {
      var cat = catMap[p.category] || {};
      return Object.assign({}, p, { catEmoji: cat.emoji || '📦' });
    });
    this.setData({ browseHistory: h, showBrowseHistory: h.length > 0 });
  },

  clearBrowseHistory() {
    clearBrowseHistory();
    this.setData({ browseHistory: [], showBrowseHistory: false });
  },

  goHistoryDetail(e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  },

  switchCategory(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeCategory) return;
    this.setData({ activeCategory: key, page: 0, list: [], leftList: [], rightList: [], noMore: false });
    this.loadProducts();
  },

  setSort(e) {
    const val = e.detail.value || e.currentTarget.dataset.value;
    const [sort, dir] = val.split('_');
    this.setData({ sort: sort === 'price' ? 'price' : 'created_at', sortDir: dir || 'desc', page: 0, list: [], leftList: [], rightList: [], noMore: false });
    this.loadProducts();
  },

  setCondition(e) {
    const val = parseInt(e.detail.value !== undefined ? e.detail.value : e.currentTarget.dataset.value);
    this.setData({ condition: val, page: 0, list: [], leftList: [], rightList: [], noMore: false });
    this.loadProducts();
  },

  loadProducts() {
    this.setData({ loading: true });
    const { activeCategory, page, sort, sortDir, condition } = this.data;
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = db('products').select('*').eq('status', 'selling').order(sort, sortDir).range(from, to);
    if (activeCategory) q = q.eq('category', activeCategory);
    if (condition >= 0 && condition <= 3) q = q.eq('condition', condition);

    return q.then(res => {
      if (res.error) { console.error('加载失败:', res.error); this.setData({ loading: false }); return; }
      const items = (res.data || []).map(item => ({
        ...item,
        categoryLabel: catMap[item.category] ? catMap[item.category].label : '',
        timeAgo: timeAgo(item.created_at),
      }));

      let newList = this.data.list;
      if (page === 0) newList = [];
      newList = [...newList, ...items];

      const leftList = newList.filter((_, i) => i % 2 === 0);
      const rightList = newList.filter((_, i) => i % 2 === 1);

      this.setData({
        list: newList,
        leftList,
        rightList,
        page: page + 1,
        loading: false,
        noMore: items.length < PAGE_SIZE,
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
