const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { action } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  switch (action) {
    case 'send':
      return send(event, openid);
    case 'list':
      return list(event, openid);
    case 'conversation':
      return conversation(event, openid);
    case 'markRead':
      return markRead(event, openid);
    default:
      return { code: -1, msg: '未知操作' };
  }
};

// 发送消息
async function send(event, openid) {
  const { toOpenid, productId, content } = event;
  if (!toOpenid || !content) return { code: -1, msg: '参数错误' };

  await db.collection('messages').add({
    data: {
      fromOpenid: openid,
      toOpenid,
      productId: productId || '',
      content,
      isRead: false,
      createdAt: new Date(),
    },
  });

  return { code: 0 };
}

// 会话列表（按对方用户分组，显示最后一条消息）
async function list(event, openid) {
  // 获取与我相关的所有消息
  const sent = await db.collection('messages')
    .where({ fromOpenid: openid })
    .orderBy('createdAt', 'desc')
    .get();

  const received = await db.collection('messages')
    .where({ toOpenid: openid })
    .orderBy('createdAt', 'desc')
    .get();

  // 按对方openid分组，取最新消息
  const conversationMap = {};

  sent.data.forEach(msg => {
    const key = msg.toOpenid;
    if (!conversationMap[key] || conversationMap[key].createdAt < msg.createdAt) {
      conversationMap[key] = { ...msg, unreadCount: 0 };
    }
  });

  received.data.forEach(msg => {
    const key = msg.fromOpenid;
    if (!conversationMap[key] || conversationMap[key].createdAt < msg.createdAt) {
      conversationMap[key] = { ...msg, unreadCount: 0 };
    }
    if (!msg.isRead) {
      if (conversationMap[key]) conversationMap[key].unreadCount++;
    }
  });

  // 获取用户信息
  const openids = Object.keys(conversationMap);
  if (openids.length === 0) return { code: 0, data: [] };

  const users = await db.collection('users').where({ _openid: _.in(openids) }).get();
  const userMap = {};
  users.data.forEach(u => { userMap[u._openid] = u; });

  const conversations = openids.map(oid => {
    const msg = conversationMap[oid];
    const user = userMap[oid] || {};
    return {
      openid: oid,
      nickName: user.nickName,
      avatarUrl: user.avatarUrl,
      lastMessage: msg.content,
      lastTime: msg.createdAt,
      productId: msg.productId,
      unreadCount: msg.unreadCount,
    };
  });

  // 按时间排序
  conversations.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

  return { code: 0, data: conversations };
}

// 与某人的聊天记录
async function conversation(event, openid) {
  const { targetOpenid, productId } = event;
  const where = _.or([
    { fromOpenid: openid, toOpenid: targetOpenid },
    { fromOpenid: targetOpenid, toOpenid: openid },
  ]);
  if (productId) where.productId = productId;

  const result = await db.collection('messages')
    .where(where)
    .orderBy('createdAt', 'asc')
    .limit(100)
    .get();

  return { code: 0, data: result.data };
}

// 标记已读
async function markRead(event, openid) {
  const { fromOpenid } = event;
  await db.collection('messages').where({
    fromOpenid,
    toOpenid: openid,
    isRead: false,
  }).update({
    data: { isRead: true },
  });
  return { code: 0 };
}
