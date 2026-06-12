const { isHotProduct, isNewProduct } = require('../../utils/util');

Component({
  properties: {
    product: {
      type: Object,
      value: {},
      observer: function (val) {
        if (val) {
          var isSold = val.status === 'sold';
          var isHot = !isSold && isHotProduct(val);
          var isNew = !isSold && !isHot && isNewProduct(val);
          this.setData({
            id: val.id || '',
            title: val.title || '',
            image: (val.images && val.images.length) ? val.images[0] : '',
            priceText: '¥' + (Number(val.price) || 0).toFixed(2),
            category: val.categoryLabel || '',
            time: val.timeAgo || '',
            viewCount: val.view_count || 0,
            isSold: isSold,
            isHot: isHot,
            isNew: isNew,
            badgeText: isSold ? '已售' : (isHot ? '🔥 热门' : (isNew ? '🆕 新品' : '')),
            badgeClass: isSold ? 'badge-sold' : (isHot ? 'badge-hot' : (isNew ? 'badge-new' : '')),
          });
        }
      }
    }
  },

  data: {
    id: '',
    title: '',
    image: '',
    priceText: '',
    category: '',
    time: '',
    viewCount: 0,
    isSold: false,
    isHot: false,
    isNew: false,
    badgeText: '',
    badgeClass: '',
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', { id: this.data.id });
    }
  }
});
