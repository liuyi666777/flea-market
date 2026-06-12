const { timeAgo, catMap, condMap, renderStars, trackBrowseHistory } = require('../../utils/util');
const { db } = require('../../utils/supabase');
const app = getApp();

Page({
  data: {
    product: null,
    seller: {},
    images: [],
    priceText: '',
    isFav: false,
    isOwner: false,
    ratingStars: '',
    ratingText: '',
    showRating: false,
    ratingScore: 0,
    ratingComment: '',
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({ title: '商品不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.loadDetail(options.id);
    this.checkFav(options.id);
  },

  loadDetail(productId) {
    db('products').select('*').eq('id', productId).single().then(res => {
      if (res.error || !res.data || !res.data.length) {
        wx.showToast({ title: '商品不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }
      const product = res.data[0];
      const uid = app.globalData.user && app.globalData.user.id;
      const isOwner = uid && uid === product.user_id;

      // Track browse history
      trackBrowseHistory(product);

      // Increment view count
      db('products').update({ view_count: (product.view_count || 0) + 1 }).eq('id', productId).then(() => {});

      this.setData({
        product,
        images: product.images || [],
        priceText: '¥' + (Number(product.price) || 0).toFixed(2),
        isOwner,
        product: {
          ...product,
          categoryLabel: catMap[product.category] ? catMap[product.category].label : '',
          conditionLabel: condMap[product.condition] || '',
          timeAgo: timeAgo(product.created_at),
        },
      });

      // Load seller profile with rating
      if (product.user_id) {
        db('profiles').select('*').eq('id', product.user_id).single().then(r => {
          if (r.data && r.data.length) {
            var seller = r.data[0];
            var sr = seller.rating || 0;
            var src = seller.rating_count || 0;
            this.setData({
              seller: seller,
              showRating: src > 0,
              ratingStars: renderStars(sr),
              ratingText: src > 0 ? sr.toFixed(1) + ' (' + src + '条)' : '',
            });
          }
        });
      }
    });
  },

  checkFav(productId) {
    const uid = app.globalData.user && app.globalData.user.id;
    if (!uid) return;
    db('favorites').select('*').eq('user_id', uid).eq('product_id', productId).single().then(res => {
      this.setData({ isFav: !!(res.data && res.data.length) });
    });
  },

  toggleFav() {
    const uid = app.globalData.user && app.globalData.user.id;
    if (!uid) return wx.showToast({ title: '请先登录', icon: 'none' });

    const pid = this.data.product.id;
    if (this.data.isFav) {
      db('favorites').delete_().eq('user_id', uid).eq('product_id', pid).then(() => {
        this.setData({ isFav: false });
        wx.showToast({ title: '已取消收藏', icon: 'none' });
      });
    } else {
      db('favorites').insert({ user_id: uid, product_id: pid }).then(() => {
        this.setData({ isFav: true });
        wx.showToast({ title: '已收藏', icon: 'none' });
      });
    }
  },

  toggleStatus() {
    const { product } = this.data;
    const newStatus = product.status === 'selling' ? 'sold' : 'selling';
    const tips = newStatus === 'sold' ? '确定标记为已售吗？' : '确定重新上架吗？';

    wx.showModal({ title: '提示', content: tips, success: (modalRes) => {
      if (!modalRes.confirm) return;
      db('products').update({ status: newStatus }).eq('id', product.id).then(() => {
        product.status = newStatus;
        this.setData({ product });
        wx.showToast({ title: newStatus === 'sold' ? '已标记售出' : '已重新上架', icon: 'success' });

        // Show rating modal after marking as sold (and not rating self)
        if (newStatus === 'sold' && product.user_id && product.user_id !== app.globalData.user.id) {
          setTimeout(() => this.showRatingModal(), 500);
        }
      });
    }});
  },

  showRatingModal() {
    this.setData({ ratingScore: 0, ratingComment: '', showRatingModal: true });
  },

  hideRatingModal() {
    this.setData({ showRatingModal: false });
  },

  setRatingScore(e) {
    this.setData({ ratingScore: parseInt(e.currentTarget.dataset.score) || 0 });
  },

  onRatingCommentInput(e) {
    this.setData({ ratingComment: e.detail.value });
  },

  submitRating() {
    if (this.data.ratingScore < 1) {
      wx.showToast({ title: '请选择评分', icon: 'none' });
      return;
    }
    var { product } = this.data;
    db('ratings').insert({
      from_user: app.globalData.user.id,
      to_user: product.user_id,
      score: this.data.ratingScore,
      comment: this.data.ratingComment.trim(),
    }).then(res => {
      if (res.error) {
        if (res.error.code === '23505') {
          wx.showToast({ title: '您已评价过该用户', icon: 'none' });
        } else {
          wx.showToast({ title: '评价失败', icon: 'none' });
        }
      } else {
        wx.showToast({ title: '评价成功！', icon: 'success' });
      }
      this.hideRatingModal();
    });
  },

  reportProduct() {
    const uid = app.globalData.user && app.globalData.user.id;
    if (!uid) return wx.showToast({ title: '请先登录', icon: 'none' });

    wx.showActionSheet({
      itemList: ['虚假信息', '违禁商品', '重复发布', '其他问题'],
      success: (res) => {
        const reasons = ['虚假信息', '违禁商品', '重复发布', '其他问题'];
        db('reports').insert({
          reporter_id: uid,
          product_id: this.data.product.id,
          reason: reasons[res.tapIndex],
        }).then(() => {
          wx.showToast({ title: '举报已提交', icon: 'success' });
        });
      }
    });
  },

  contactSeller() {
    const uid = app.globalData.user && app.globalData.user.id;
    if (!uid) return wx.showToast({ title: '请先登录', icon: 'none' });
    if (this.data.isOwner) return;

    const { product } = this.data;
    wx.navigateTo({
      url: `/pages/chat/chat?targetId=${product.user_id}&productId=${product.id}`,
    });
  },

  previewImage(e) {
    const idx = e.currentTarget.dataset.index;
    wx.previewImage({ urls: this.data.images, current: this.data.images[idx] });
  },
});
