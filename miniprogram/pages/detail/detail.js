const { timeAgo, conditionMap, categoryMap } = require('../../utils/util');
const app = getApp();

Page({
  data: {
    productId: '',
    product: null,
    seller: {},
    images: [],
    priceText: '',
    isFav: false,
    isOwner: false,
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({ title: '商品不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ productId: options.id });
    this.loadDetail();
    this.checkFav();
  },

  loadDetail() {
    wx.cloud.callFunction({
      name: 'product',
      data: { action: 'detail', productId: this.data.productId },
    }).then(res => {
      if (!res.result.data) {
        wx.showToast({ title: '商品不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }
      const product = res.result.data;
      const seller = product.seller || {};
      const isOwner = app.globalData.isLogin &&
        wx.getStorageSync('userInfo')?._openid === product._openid;

      this.setData({
        product,
        seller,
        images: product.images || [],
        priceText: '¥' + (Number(product.price) || 0).toFixed(2),
        isOwner,
        product: {
          ...product,
          categoryLabel: categoryMap[product.category] ? categoryMap[product.category].label : '',
          conditionLabel: conditionMap[product.condition] || '',
          timeAgo: timeAgo(product.createdAt),
        },
      });
    });
  },

  checkFav() {
    if (!app.globalData.isLogin) return;
    wx.cloud.callFunction({
      name: 'favorite',
      data: { action: 'check', productId: this.data.productId },
    }).then(res => {
      this.setData({ isFav: res.result.data.isFav });
    });
  },

  toggleFav() {
    if (!app.globalData.isLogin) {
      return wx.showToast({ title: '请先登录', icon: 'none' });
    }
    const action = this.data.isFav ? 'remove' : 'add';
    wx.cloud.callFunction({
      name: 'favorite',
      data: { action, productId: this.data.productId },
    }).then(() => {
      this.setData({ isFav: !this.data.isFav });
      wx.showToast({ title: action === 'add' ? '已收藏' : '已取消', icon: 'none' });
    });
  },

  toggleStatus() {
    const { product } = this.data;
    const newStatus = product.status === 'selling' ? 'sold' : 'selling';
    const tips = newStatus === 'sold' ? '确定标记为已售吗？' : '确定重新上架吗？';

    wx.showModal({ title: '提示', content: tips, success: (res) => {
      if (!res.confirm) return;
      wx.cloud.callFunction({
        name: 'product',
        data: { action: 'toggleStatus', productId: product._id, status: newStatus },
      }).then(() => {
        product.status = newStatus;
        this.setData({ product });
        wx.showToast({ title: newStatus === 'sold' ? '已标记售出' : '已重新上架', icon: 'success' });
      });
    }});
  },

  contactSeller() {
    if (!app.globalData.isLogin) {
      return wx.showToast({ title: '请先登录', icon: 'none' });
    }
    const { product } = this.data;
    if (this.data.isOwner) return;

    const openid = product._openid;
    wx.navigateTo({
      url: `/pages/chat/chat?openid=${openid}&productId=${product._id}`,
    });
  },

  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      urls: this.data.images,
      current: this.data.images[index],
    });
  },
});
