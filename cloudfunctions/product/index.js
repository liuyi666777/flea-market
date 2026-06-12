const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { action } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  switch (action) {
    case 'list':
      return list(event);
    case 'detail':
      return detail(event);
    case 'create':
      return create(event, openid);
    case 'update':
      return update(event, openid);
    case 'myList':
      return myList(event, openid);
    case 'toggleStatus':
      return toggleStatus(event, openid);
    default:
      return { code: -1, msg: '未知操作' };
  }
};

// 商品列表（支持分类筛选、分页）
async function list(event) {
  const { category, page = 1, pageSize = 20, keyword } = event;

  const where = { status: 'selling' };
  if (category) where.category = category;
  if (keyword) {
    where.title = db.RegExp({
      regexp: keyword,
      options: 'i',
    });
  }

  const result = await db.collection('products')
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  return { code: 0, data: result.data };
}

// 商品详情
async function detail(event) {
  const { productId } = event;
  const result = await db.collection('products').doc(productId).get();
  if (!result.data) return { code: -1, msg: '商品不存在' };

  // 增加浏览量
  await db.collection('products').doc(productId).update({
    data: { viewCount: _.inc(1) },
  });

  // 获取卖家信息
  const sellerId = result.data._openid;
  const userResult = await db.collection('users').where({ _openid: sellerId }).get();
  const seller = userResult.data.length > 0 ? userResult.data[0] : null;

  return {
    code: 0,
    data: {
      ...result.data,
      seller: seller ? {
        nickName: seller.nickName,
        avatarUrl: seller.avatarUrl,
        schoolId: seller.schoolId,
      } : null,
    },
  };
}

// 发布商品
async function create(event, openid) {
  const { data } = event;
  const result = await db.collection('products').add({
    data: {
      ...data,
      _openid: openid,
      status: 'selling',
      viewCount: 0,
      createdAt: new Date(),
    },
  });
  return { code: 0, data: { _id: result._id } };
}

// 编辑商品
async function update(event, openid) {
  const { productId, data } = event;
  const product = await db.collection('products').doc(productId).get();
  if (!product.data || product.data._openid !== openid) {
    return { code: -1, msg: '无权操作' };
  }
  await db.collection('products').doc(productId).update({ data });
  return { code: 0 };
}

// 我的发布
async function myList(event, openid) {
  const { page = 1, pageSize = 20, status } = event;
  const where = { _openid: openid };
  if (status) where.status = status;

  const result = await db.collection('products')
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  return { code: 0, data: result.data };
}

// 切换状态（标记已售/下架）
async function toggleStatus(event, openid) {
  const { productId, status } = event;
  const product = await db.collection('products').doc(productId).get();
  if (!product.data || product.data._openid !== openid) {
    return { code: -1, msg: '无权操作' };
  }
  await db.collection('products').doc(productId).update({
    data: { status, updatedAt: new Date() },
  });
  return { code: 0 };
}
