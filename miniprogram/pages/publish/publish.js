const app = getApp();
const { categoryMap, conditionMap } = require('../../utils/util');

Page({
  data: {
    currentType: 'sell',
    images: [],
    uploading: false,
    categoryOptions: [],
    categoryKeys: [],
    categoryIndex: 0,
    conditionOptions: [],
    conditionKeys: [],
    conditionIndex: 0,
  },

  onLoad(options) {
    const catOpts = [];
    const catKeys = [];
    Object.entries(categoryMap).forEach(([key, val]) => {
      catOpts.push(val.icon + ' ' + val.label);
      catKeys.push(key);
    });

    const condOpts = [];
    const condKeys = [];
    Object.entries(conditionMap).forEach(([key, val]) => {
      condOpts.push(val);
      condKeys.push(key);
    });

    this.setData({
      categoryOptions: catOpts,
      categoryKeys: catKeys,
      conditionOptions: condOpts,
      conditionKeys: condKeys,
    });

    if (options.type === 'want') {
      this.setData({ currentType: 'want' });
    }
  },

  switchType(e) {
    this.setData({ currentType: e.currentTarget.dataset.type });
  },

  chooseImage() {
    wx.chooseMedia({
      count: 9 - this.data.images.length,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPaths = res.tempFiles.map(f => f.tempFilePath);
        this.setData({ images: [...this.data.images, ...tempPaths] });
      }
    });
  },

  removeImage(e) {
    const idx = e.currentTarget.dataset.index;
    const images = this.data.images.filter((_, i) => i !== idx);
    this.setData({ images });
  },

  onCategoryChange(e) {
    this.setData({ categoryIndex: Number(e.detail.value) });
  },

  onConditionChange(e) {
    this.setData({ conditionIndex: Number(e.detail.value) });
  },

  // 上传图片到云存储
  async uploadImages() {
    const { images } = this.data;
    if (images.length === 0) return [];

    const promises = images.map((path) => {
      return wx.cloud.uploadFile({
        cloudPath: 'products/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.jpg',
        filePath: path,
      });
    });
    const results = await Promise.all(promises);
    return results.map(r => r.fileID);
  },

  submitSell(e) {
    const { title, price, description, originalPrice } = e.detail.value;
    if (!title.trim()) return wx.showToast({ title: '请输入标题', icon: 'none' });
    if (!price || Number(price) <= 0) return wx.showToast({ title: '请输入有效的价格', icon: 'none' });
    if (this.data.images.length === 0) return wx.showToast({ title: '请至少上传一张图片', icon: 'none' });

    if (!app.globalData.isLogin) {
      return wx.showToast({ title: '请先登录', icon: 'none' });
    }

    this.setData({ uploading: true });

    this.uploadImages().then(fileIDs => {
      return wx.cloud.callFunction({
        name: 'product',
        data: {
          action: 'create',
          data: {
            title: title.trim(),
            description: description.trim(),
            price: Number(price),
            originalPrice: originalPrice ? Number(originalPrice) : null,
            images: fileIDs,
            category: this.data.categoryKeys[this.data.categoryIndex] || 'other',
            condition: this.data.conditionKeys[this.data.conditionIndex] || 'normal',
          }
        }
      });
    }).then(() => {
      wx.showToast({ title: '发布成功', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 1500);
    }).catch(err => {
      console.error('发布失败:', err);
      wx.showToast({ title: '发布失败，请重试', icon: 'none' });
    }).finally(() => {
      this.setData({ uploading: false });
    });
  },

  submitWant(e) {
    const { title, description, budget } = e.detail.value;
    if (!title.trim()) return wx.showToast({ title: '请输入求购物品', icon: 'none' });
    if (!budget || Number(budget) <= 0) return wx.showToast({ title: '请输入有效预算', icon: 'none' });

    if (!app.globalData.isLogin) {
      return wx.showToast({ title: '请先登录', icon: 'none' });
    }

    wx.cloud.callFunction({
      name: 'wantBuy',
      data: {
        action: 'create',
        data: {
          title: title.trim(),
          description: description.trim(),
          budget: Number(budget),
          category: this.data.categoryKeys[this.data.categoryIndex] || 'other',
        }
      }
    }).then(() => {
      wx.showToast({ title: '发布成功', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/want-buy/want-buy' });
      }, 1500);
    }).catch(err => {
      console.error('发布失败:', err);
      wx.showToast({ title: '发布失败，请重试', icon: 'none' });
    });
  },
});
