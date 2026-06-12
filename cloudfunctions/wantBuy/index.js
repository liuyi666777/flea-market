const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { action } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  switch (action) {
    case 'list':
      return list(event);
    case 'create':
      return create(event, openid);
    case 'close':
      return close(event, openid);
    default:
      return { code: -1, msg: '未知操作' };
  }
};

async function list(event) {
  const { category, page = 1, pageSize = 20 } = event;
  const where = { status: 'active' };
  if (category) where.category = category;

  const result = await db.collection('want_buys')
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  // 获取发布者信息
  const openids = [...new Set(result.data.map(item => item._openid))];
  const users = openids.length > 0
    ? await db.collection('users').where({ _openid: db.command.in(openids) }).get()
    : { data: [] };

  const userMap = {};
  users.data.forEach(u => { userMap[u._openid] = u; });

  const data = result.data.map(item => {
    const user = userMap[item._openid] || {};
    return {
      ...item,
      nickName: user.nickName,
      avatarUrl: user.avatarUrl,
    };
  });

  return { code: 0, data };
}

async function create(event, openid) {
  const { data } = event;
  await db.collection('want_buys').add({
    data: {
      ...data,
      _openid: openid,
      status: 'active',
      createdAt: new Date(),
    },
  });
  return { code: 0 };
}

async function close(event, openid) {
  const { wantId } = event;
  const item = await db.collection('want_buys').doc(wantId).get();
  if (!item.data || item.data._openid !== openid) {
    return { code: -1, msg: '无权操作' };
  }
  await db.collection('want_buys').doc(wantId).update({
    data: { status: 'done', updatedAt: new Date() },
  });
  return { code: 0 };
}
