const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { action } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  switch (action) {
    case 'login':
      return login(event, openid);
    case 'updateProfile':
      return updateProfile(event, openid);
    case 'getProfile':
      return getProfile(event, openid);
    default:
      return { code: -1, msg: '未知操作' };
  }
};

async function login(event, openid) {
  const { nickName, avatarUrl } = event;

  // 查找或创建用户
  const exist = await db.collection('users').where({ _openid: openid }).get();
  if (exist.data.length > 0) {
    await db.collection('users').where({ _openid: openid }).update({
      data: {
        nickName,
        avatarUrl,
        updatedAt: new Date(),
      },
    });
    return { code: 0, data: exist.data[0] };
  }

  await db.collection('users').add({
    data: {
      _openid: openid,
      nickName,
      avatarUrl,
      phone: '',
      schoolId: '',
      createdAt: new Date(),
    },
  });

  const user = await db.collection('users').where({ _openid: openid }).get();
  return { code: 0, data: user.data[0] };
}

async function updateProfile(event, openid) {
  const { phone, schoolId } = event;
  await db.collection('users').where({ _openid: openid }).update({
    data: {
      phone: phone || '',
      schoolId: schoolId || '',
      updatedAt: new Date(),
    },
  });
  return { code: 0 };
}

async function getProfile(event, openid) {
  let { targetOpenid } = event;
  if (!targetOpenid) targetOpenid = openid;

  const result = await db.collection('users').where({ _openid: targetOpenid }).get();
  if (result.data.length === 0) return { code: -1, msg: '用户不存在' };

  const user = result.data[0];
  // 统计发布数
  const productCount = await db.collection('products')
    .where({ _openid: targetOpenid, status: 'selling' }).count();

  return {
    code: 0,
    data: {
      ...user,
      productCount: productCount.total,
    },
  };
}
