Component({
  properties: {
    product: {
      type: Object,
      value: {},
      observer: function (val) {
        if (val) {
          this.setData({
            id: val._id || '',
            title: val.title || '',
            image: (val.images && val.images.length) ? val.images[0] : '/images/placeholder.png',
            priceText: '¥' + (Number(val.price) || 0).toFixed(2),
            category: val.categoryLabel || '',
            time: val.timeAgo || '',
            viewCount: val.viewCount,
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
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', { id: this.data.id });
    }
  }
});
