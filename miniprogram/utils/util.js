/**
 * 格式化时间
 * @param {Date|string|number} date
 * @param {string} format
 */
function formatTime(date, format) {
  if (typeof date === 'string' || typeof date === 'number') {
    date = new Date(date);
  }
  if (!(date instanceof Date) || isNaN(date)) return '';

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  if (format) {
    return format
      .replace(/YYYY/g, year)
      .replace(/MM/g, padZero(month))
      .replace(/DD/g, padZero(day))
      .replace(/HH/g, padZero(hour))
      .replace(/mm/g, padZero(minute))
      .replace(/ss/g, padZero(second));
  }

  return year + '/' + padZero(month) + '/' + padZero(day) + ' ' +
    padZero(hour) + ':' + padZero(minute);
}

function padZero(n) {
  return n < 10 ? '0' + n : n;
}

/**
 * 获取相对时间描述
 */
function timeAgo(date) {
  if (typeof date === 'string' || typeof date === 'number') {
    date = new Date(date);
  }
  const now = Date.now();
  const diff = now - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (diff < minute) return '刚刚';
  if (diff < hour) return Math.floor(diff / minute) + '分钟前';
  if (diff < day) return Math.floor(diff / hour) + '小时前';
  if (diff < week) return Math.floor(diff / day) + '天前';
  return formatTime(date, 'MM-DD');
}

/**
 * 价格格式化
 */
function formatPrice(price) {
  return '¥' + (Number(price) || 0).toFixed(2);
}

// 分类映射
const categoryMap = {
  textbook: { label: '教材', icon: '📚' },
  digital: { label: '数码', icon: '📱' },
  living: { label: '生活', icon: '🏠' },
  clothing: { label: '服饰', icon: '👗' },
  sports: { label: '运动', icon: '⚽' },
  other: { label: '其他', icon: '📦' },
};

const conditionMap = {
  brandnew: '全新',
  likenew: '几乎全新',
  slightuse: '轻微使用',
  normal: '正常使用',
};

module.exports = {
  formatTime,
  timeAgo,
  formatPrice,
  categoryMap,
  conditionMap,
};
