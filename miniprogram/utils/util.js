const padZero = n => n < 10 ? '0' + n : n;

function formatTime(date, format) {
  if (typeof date === 'string' || typeof date === 'number') date = new Date(date);
  if (!(date instanceof Date) || isNaN(date)) return '';
  const y = date.getFullYear(), M = date.getMonth() + 1, d = date.getDate(), h = date.getHours(), m = date.getMinutes(), s = date.getSeconds();
  if (format) return format.replace(/YYYY/g, y).replace(/MM/g, padZero(M)).replace(/DD/g, padZero(d)).replace(/HH/g, padZero(h)).replace(/mm/g, padZero(m)).replace(/ss/g, padZero(s));
  return `${y}/${padZero(M)}/${padZero(d)} ${padZero(h)}:${padZero(m)}`;
}

function timeAgo(date) {
  if (typeof date === 'string' || typeof date === 'number') date = new Date(date);
  const diff = Date.now() - date.getTime();
  if (diff < 6e4) return '刚刚';
  if (diff < 36e5) return Math.floor(diff / 6e4) + '分钟前';
  if (diff < 864e5) return Math.floor(diff / 36e5) + '小时前';
  if (diff < 6048e5) return Math.floor(diff / 864e5) + '天前';
  return formatTime(date, 'MM-DD');
}

const catMap = {
  textbook: { label: '教材', emoji: '📚' },
  digital: { label: '数码', emoji: '📱' },
  living: { label: '生活', emoji: '🏠' },
  clothing: { label: '服饰', emoji: '👗' },
  sports: { label: '运动', emoji: '⚽' },
  other: { label: '其他', emoji: '📦' },
};

const condMap = ['全新', '几乎全新', '轻微使用痕迹', '正常使用痕迹'];

function formatPrice(n) { return '¥' + (Number(n) || 0).toFixed(2); }

const HOT_VIEW_THRESHOLD = 30;
const NEW_PRODUCT_HOURS = 24;

function renderStars(rating) {
  var stars = '';
  for (var i = 1; i <= 5; i++) {
    if (rating >= i) { stars += '★'; }
    else if (rating >= i - 0.5) { stars += '☆'; }
    else { stars += '☆'; }
  }
  return stars;
}

function getBrowseHistory() {
  try { return wx.getStorageSync('browseHistory') || []; } catch(e) { return []; }
}

function trackBrowseHistory(product) {
  var h = getBrowseHistory();
  h = h.filter(function(x) { return x.id !== product.id; });
  h.unshift({ id: product.id, title: product.title, price: product.price, images: product.images, category: product.category });
  if (h.length > 15) h = h.slice(0, 15);
  try { wx.setStorageSync('browseHistory', h); } catch(e) {}
}

function clearBrowseHistory() {
  try { wx.removeStorageSync('browseHistory'); } catch(e) {}
}

function isHotProduct(product) {
  return (product.view_count || 0) >= HOT_VIEW_THRESHOLD;
}

function isNewProduct(product) {
  return (Date.now() - new Date(product.created_at).getTime()) < NEW_PRODUCT_HOURS * 3600000;
}

module.exports = { formatTime, timeAgo, formatPrice, catMap, condMap, HOT_VIEW_THRESHOLD, NEW_PRODUCT_HOURS, renderStars, getBrowseHistory, trackBrowseHistory, clearBrowseHistory, isHotProduct, isNewProduct };
