const { timeAgo, catMap } = require('../../utils/util');
const { db } = require('../../utils/supabase');
const app = getApp();

Page({
  data: {
    activeTab: 'reports',
    reports: [],
    products: [],
    filteredProducts: [],
    searchKeyword: '',
    profiles: {},
  },

  onLoad() {
    // Check admin permission
    var p = app.globalData.profile;
    if (!p || !p.is_admin) {
      wx.showToast({ title: '无管理员权限', icon: 'none' });
      setTimeout(function() { wx.navigateBack(); }, 1500);
      return;
    }
    this.loadReports();
  },

  switchTab(e) {
    var tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    if (tab === 'reports') this.loadReports();
    else this.loadAllProducts();
  },

  // ========== Reports ==========
  loadReports() {
    db('reports').select('*').order('created_at', 'desc').then(res => {
      if (res.error) { console.error(res.error); return; }
      var reports = res.data || [];
      this.setData({ reports: reports });

      // Load product info for each report
      var pids = reports.map(function(r) { return r.product_id; }).filter(Boolean);
      if (pids.length === 0) return;
      db('products').select('id,title,status,user_id').in('id', pids).then(r2 => {
        var pm = {};
        (r2.data || []).forEach(function(p) { pm[p.id] = p; });
        var uidSet = {};
        reports.forEach(function(r) { uidSet[r.reporter_id] = true; if (pm[r.product_id]) uidSet[pm[r.product_id].user_id] = true; });
        var uids = Object.keys(uidSet);
        if (uids.length === 0) { this.setData({ products: pm }); return; }
        db('profiles').select('id,nickname').in('id', uids).then(r3 => {
          var um = {};
          (r3.data || []).forEach(function(u) { um[u.id] = u; });
          this.setData({ products: pm, profiles: um });
        });
      });
    });
  },

  resolveReport(e) {
    var id = e.currentTarget.dataset.id;
    db('reports').update({ status: 'resolved' }).eq('id', id).then(function() {
      wx.showToast({ title: '已标记为已处理', icon: 'success' });
    });
  },

  deleteProduct(e) {
    var id = e.currentTarget.dataset.id;
    var self = this;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个商品吗？此操作不可撤销。',
      success: function(modalRes) {
        if (!modalRes.confirm) return;
        db('products').delete_().eq('id', id).then(function() {
          wx.showToast({ title: '商品已删除', icon: 'success' });
          self.loadReports();
        });
      }
    });
  },

  // ========== Products ==========
  loadAllProducts() {
    db('products').select('*').order('created_at', 'desc').limit(50).then(res => {
      if (res.error) { console.error(res.error); return; }
      var products = (res.data || []).map(function(p) {
        var cat = catMap[p.category] || {};
        return Object.assign({}, p, { catLabel: cat.label || '', catEmoji: cat.emoji || '📦' });
      });
      this.setData({ products: products, filteredProducts: products });
    });
  },

  onSearchInput(e) {
    var kw = e.detail.value.trim().toLowerCase();
    this.setData({ searchKeyword: kw });
    if (!kw) {
      this.setData({ filteredProducts: this.data.products });
      return;
    }
    var filtered = this.data.products.filter(function(p) {
      return p.title.toLowerCase().indexOf(kw) !== -1;
    });
    this.setData({ filteredProducts: filtered });
  },

  adminDeleteProduct(e) {
    var id = e.currentTarget.dataset.id;
    var self = this;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个商品吗？',
      success: function(modalRes) {
        if (!modalRes.confirm) return;
        db('products').delete_().eq('id', id).then(function() {
          wx.showToast({ title: '已删除', icon: 'success' });
          self.loadAllProducts();
        });
      }
    });
  },
});
