const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { action } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  switch (action) {
    case 'add':
      return add(event, openid);
    case 'remove':
      return remove(event, openid);
    case 'list':
      return list(event, openid);
    case 'check':
      return check(event, openid);
    default:
      return { code: -1, msg: '未知操作' };
  }
};

async function add(event, openid) {
  const { productId } = event;
  const exist = await db.collection('favorites').where({
    _openid: openid,
    productId,
  }).get();

  if (exist.data.length > 0) return { code: 0, msg: '已收藏' };

  await db.collection('favorites').add({
    data: {
      _openid: openid,
      productId,
      createdAt: new Date(),
    },
  });

  // 收藏数 +1
  await db.collection('products').doc(productId).update({
    data: { favCount: _.inc(1) },
  });

  return { code: 0 };
}

async function remove(event, openid) {
  const { productId } = event;
  await db.collection('favorites').where({
    _openid: openid,
    productId,
  }).remove();

  await db.collection('products').doc(productId).update({
    data: { favCount: _.inc(-1) },
  });

  return { code: 0 };
}

async function list(event, openid) {
  const { page = 1, pageSize = 20 } = event;
  const result = await db.collection('favorites')
    .where({ _openid: openid })
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  // 获取关联的商品信息
  const productIds = result.data.map(f => f.productId);
  if (productIds.length === 0) return { code: 0, data: [] };

  const products = await db.collection('products')
    .where({ _id: _.in(productIds) })
    .get();

  const productMap = {};
  products.data.forEach(p => { productMap[p._id] = p; });

  const data = result.data
    .filter(f => productMap[f.productId])
    .map(f => ({
      ...productMap[f.productId],
      favId: f._id,
      favTime: f.createdAt,
    }));

  return { code: 0, data };
}

async function check(event, openid) {
  const { productId } = event;
  const result = await db.collection('favorites').where({
    _openid: openid,
    productId,
  }).get();
  return { code: 0, data: { isFav: result.data.length > 0 } };
}
