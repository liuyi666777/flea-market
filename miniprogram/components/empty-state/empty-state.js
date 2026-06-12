Component({
  properties: {
    icon: { type: String, value: '📭' },
    text: { type: String, value: '暂无数据' },
    showBtn: { type: Boolean, value: false },
    btnText: { type: String, value: '去逛逛' },
  },

  methods: {
    onBtnTap() {
      this.triggerEvent('btntap');
    }
  }
});
