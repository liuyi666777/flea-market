/* ============================================================
   校园跳蚤市场 - Web App
   数据当前存储在 localStorage，后续接入 Supabase 即可升级
   ============================================================ */

const CATEGORY_MAP = {
  textbook: { label: '教材', emoji: '📚' },
  digital: { label: '数码', emoji: '📱' },
  living: { label: '生活', emoji: '🏠' },
  clothing: { label: '服饰', emoji: '👗' },
  sports: { label: '运动', emoji: '⚽' },
  other: { label: '其他', emoji: '📦' },
};

const CONDITION_MAP = ['全新', '几乎全新', '轻微使用痕迹', '正常使用痕迹'];

const COLOR_CLASSES = ['c1','c2','c3','c4','c5','c6'];
const AVATAR_COLORS = [
  'linear-gradient(135deg,#ffd4c4,#ffc4b0)',
  'linear-gradient(135deg,#d4e4ff,#c4d8ff)',
  'linear-gradient(135deg,#e4ffd4,#d0ffc4)',
  'linear-gradient(135deg,#ffe4d4,#ffd0c4)',
  'linear-gradient(135deg,#d4ffe4,#c4ffd0)',
];

// ==================== DATA STORE ====================
const Store = {
  get(key, def) {
    try { const v = localStorage.getItem('fm_' + key); return v ? JSON.parse(v) : def; }
    catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem('fm_' + key, JSON.stringify(val)); } catch {}
  },
};

// Initialize mock data
function initData() {
  if (!Store.get('inited')) {
    const products = [
      { id:'p1',title:'高等数学 第七版 上下册',price:25,origPrice:58,views:156,category:'textbook',condition:2,images:[],desc:'几乎全新，只有几页有笔记划线。\n\n毕业清仓，欲购从速。',sellerName:'小明同学',sellerId:'u1',status:'selling',createdAt:Date.now()-86400000*1,badge:'new' },
      { id:'p2',title:'iPad Pro 2022 11寸 128G 几乎全新带壳',price:4200,origPrice:6199,views:892,category:'digital',condition:1,images:[],desc:'去年买的，使用不到半年。\n\n无划痕无磕碰，电池健康96%。\n原装配件齐全，送一个保护壳。',sellerName:'张三',sellerId:'u2',status:'selling',createdAt:Date.now()-86400000*2,badge:'hot' },
      { id:'p3',title:'LED护眼台灯 可调光 宿舍学习必备',price:35,origPrice:89,views:78,category:'living',condition:2,images:[],desc:'三档调光，暖白光。\n\n用了一年，功能完好。',sellerName:'小明同学',sellerId:'u1',status:'selling',createdAt:Date.now()-86400000*3,badge:'' },
      { id:'p4',title:'Nike Air Force 1 白色 42码 穿了几次',price:299,origPrice:799,views:234,category:'clothing',condition:2,images:[],desc:'正品，穿了不到10次。\n有点脏了需要自己清洗一下。',sellerName:'李四',sellerId:'u3',status:'selling',createdAt:Date.now()-86400000*2,badge:'' },
      { id:'p5',title:'瑜伽垫 加厚防滑 NBR材质',price:45,origPrice:99,views:56,category:'sports',condition:1,images:[],desc:'只用过一次，几乎全新。\n送一个收纳绑带。',sellerName:'小明同学',sellerId:'u1',status:'selling',createdAt:Date.now()-86400000*1,badge:'new' },
      { id:'p6',title:'桌面书架 木质置物架 宿舍收纳神器',price:20,origPrice:45,views:123,category:'living',condition:3,images:[],desc:'稳固好用，宿舍必备。\n可以放书、杂物等。',sellerName:'王五',sellerId:'u4',status:'selling',createdAt:Date.now()-86400000*5,badge:'' },
      { id:'p7',title:'机械键盘 IKBC C87 樱桃红轴',price:180,origPrice:399,views:445,category:'digital',condition:2,images:[],desc:'红轴，手感很好。\n键帽有轻微打油，功能一切正常。',sellerName:'张三',sellerId:'u2',status:'selling',createdAt:Date.now()-86400000*4,badge:'' },
      { id:'p8',title:'毛呢大衣 深灰色 M码 九成新',price:159,origPrice:459,views:67,category:'clothing',condition:1,images:[],desc:'含30%羊毛，很保暖。\n只穿了一个冬天，洗过一次。',sellerName:'赵六',sellerId:'u5',status:'selling',createdAt:Date.now()-86400000*6,badge:'' },
      { id:'p9',title:'概率论与数理统计 浙大第四版',price:15,origPrice:38,views:89,category:'textbook',condition:3,images:[],desc:'有笔记，但不影响阅读。\n考试过了，便宜出。',sellerName:'小明同学',sellerId:'u1',status:'sold',createdAt:Date.now()-86400000*4,badge:'' },
      { id:'p10',title:'斯伯丁篮球 标准7号 送打气筒',price:88,origPrice:199,views:112,category:'sports',condition:2,images:[],desc:'室外打的，有正常磨损。\n送一个打气筒和网兜。',sellerName:'李四',sellerId:'u3',status:'selling',createdAt:Date.now()-86400000*1,badge:'hot' },
      { id:'p11',title:'初学者吉他 卡马D1C 送调音器+教材',price:350,origPrice:599,views:201,category:'other',condition:1,images:[],desc:'买来没怎么弹，几乎全新。\n弦距已调好，新手友好。',sellerName:'王五',sellerId:'u4',status:'selling',createdAt:Date.now()-86400000*7,badge:'' },
      { id:'p12',title:'USB桌面加湿器 静音迷你 喷雾细腻',price:28,origPrice:59,views:45,category:'living',condition:1,images:[],desc:'小巧不占地方。\n宿舍用刚刚好，喷雾很细。',sellerName:'赵六',sellerId:'u5',status:'selling',createdAt:Date.now()-43200000,badge:'new' },
    ];

    const messages = [
      { id:'m1',from:'u2',to:'u0',productId:'p2',content:'你好，iPad还在吗？',isRead:true,createdAt:Date.now()-3600000 },
      { id:'m2',from:'u0',to:'u2',productId:'p2',content:'在的，你要看看吗？',isRead:true,createdAt:Date.now()-3500000 },
      { id:'m3',from:'u2',to:'u0',productId:'p2',content:'能便宜点吗？',isRead:true,createdAt:Date.now()-3400000 },
      { id:'m4',from:'u3',to:'u0',productId:'p4',content:'鞋还在吗？',isRead:false,createdAt:Date.now()-1800000 },
      { id:'m5',from:'u3',to:'u0',productId:'p4',content:'42码合适我想要',isRead:false,createdAt:Date.now()-1700000 },
    ];

    Store.set('products', products);
    Store.set('messages', messages);
    Store.set('favorites', ['p2', 'p7', 'p10']);
    Store.set('searchHistory', ['高等数学', 'iPad', '台灯', '键盘']);
    Store.set('inited', true);
  }
}

// Get current user
function getMyId() {
  const user = Store.get('user');
  return user ? user.id : null;
}

// ==================== APP CONTROLLER ====================
const App = {
  currentPage: 'home',
  currentCat: '',
  currentDetailId: null,
  currentChatUser: null,

  init() {
    initData();
    this.renderCategories();
    this.renderHome();
    this.buildTabBars();
    this.renderSearchHistory();
    this.updateUserUI();

    // Search input handler
    const si = document.getElementById('searchInput');
    if (si) si.addEventListener('input', (e) => this.doSearch(e.target.value));
  },

  // ========== Navigation ==========
  navTo(page, data) {
    this.currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('active');

    const hasTab = ['home','publish','messages','user'].includes(page);
    document.querySelectorAll('.tab-bar').forEach(t => t.style.display = hasTab ? 'flex' : 'none');

    if (page === 'home') { this.currentCat = ''; this.renderCategories(); this.renderHome(); }
    if (page === 'detail' && data) this.renderDetail(data);
    if (page === 'publish') this.renderPublish();
    if (page === 'messages') this.renderMessages();
    if (page === 'chat' && data) this.openChat(data);
    if (page === 'favorites') this.renderFavorites();
    if (page === 'mypublish') this.renderMyPublish();
    if (page === 'user') this.updateUserUI();
  },

  navBack() {
    const map = { detail:'home', chat:'messages', search:'home', favorites:'user', mypublish:'user' };
    this.navTo(map[this.currentPage] || 'home');
  },

  // ========== Categories ==========
  renderCategories() {
    const cats = [{ key:'',label:'全部',emoji:'🔥' }];
    Object.entries(CATEGORY_MAP).forEach(([k,v]) => cats.push({ key:k, ...v }));

    document.getElementById('catScroll').innerHTML = cats.map(c =>
      `<div class="cat-pill ${c.key === this.currentCat ? 'active' : ''}" onclick="App.filterCat('${c.key}')"><span class="emoji">${c.emoji}</span>${c.label}</div>`
    ).join('');
  },

  filterCat(cat) {
    this.currentCat = cat;
    this.renderCategories();
    this.renderHome();
  },

  // ========== Render Home ==========
  renderHome() {
    let products = Store.get('products', []).filter(p => p.status === 'selling');
    if (this.currentCat) products = products.filter(p => p.category === this.currentCat);
    products.sort((a,b) => b.createdAt - a.createdAt);

    const container = document.getElementById('homeList');
    const empty = document.getElementById('homeEmpty');
    if (products.length === 0) { container.innerHTML = ''; empty.style.display = 'flex'; return; }
    empty.style.display = 'none';
    container.innerHTML = products.map((p,i) => this.productCard(p, i)).join('');
  },

  productCard(p, i) {
    const cat = CATEGORY_MAP[p.category] || {};
    const clr = COLOR_CLASSES[i % 6];
    const badge = p.badge === 'hot' ? '<div class="product-badge badge-hot">🔥 热门</div>' :
                  p.badge === 'new' ? '<div class="product-badge badge-new">✨ 新品</div>' : '';
    const time = this.timeAgo(p.createdAt);
    return `
      <div class="product-card fade-in" onclick="App.navTo('detail','${p.id}')" style="animation-delay:${i*0.03}s">
        <div class="product-img" style="background:${this.gradientForCat(p.category)}">${cat.emoji || '📦'}</div>
        ${badge}
        <div class="product-body">
          <div class="product-title">${this.escapeHtml(p.title)}</div>
          <div class="product-price"><span class="yen">¥</span>${p.price}</div>
          <div class="product-footer">
            <span class="product-tag">${cat.label || ''}</span>
            <span class="product-meta">👀 ${p.views} · ${time}</span>
          </div>
        </div>
      </div>`;
  },

  gradientForCat(cat) {
    const gradients = {
      textbook: 'linear-gradient(135deg,#e8f8ef,#d0f0df)',
      digital: 'linear-gradient(135deg,#e8f4fd,#dceaf8)',
      living: 'linear-gradient(135deg,#fef3e2,#fde8c8)',
      clothing: 'linear-gradient(135deg,#fce4ec,#f8d0da)',
      sports: 'linear-gradient(135deg,#f5f0ff,#e8dff8)',
      other: 'linear-gradient(135deg,#fdf2e8,#fce4d4)',
    };
    return gradients[cat] || gradients.other;
  },

  // ========== Render Detail ==========
  renderDetail(productId) {
    this.currentDetailId = productId;
    const products = Store.get('products', []);
    const p = products.find(x => x.id === productId);
    if (!p) return;

    const cat = CATEGORY_MAP[p.category] || {};
    const favs = Store.get('favorites', []);
    const isFav = favs.includes(productId);
    const isOwner = getMyId() === p.sellerId;

    // Increment views
    p.views = (p.views || 0) + 1;
    Store.set('products', products);

    document.getElementById('detailContent').innerHTML = `
      <div class="gallery" style="background:${this.gradientForCat(p.category)}">
        <span style="font-size:100px">${cat.emoji || '📦'}</span>
        <div class="gallery-dots"><div class="gallery-dot active"></div><div class="gallery-dot"></div><div class="gallery-dot"></div></div>
      </div>
      <div class="detail-card">
        <div style="display:flex;align-items:flex-end;gap:10px">
          <span class="detail-price-main">¥${p.price}</span>
          ${p.origPrice ? `<span class="detail-price-orig">原价 ¥${p.origPrice}</span>` : ''}
        </div>
        <div class="detail-title-text">${this.escapeHtml(p.title)}</div>
        <div class="detail-tag-row">
          <span class="detail-tag green">${cat.label}</span>
          <span class="detail-tag blue">${CONDITION_MAP[p.condition] || '正常'}</span>
          <span style="font-size:12px;color:#999;margin-left:auto">👀 ${p.views}次浏览 · ${this.timeAgo(p.createdAt)}</span>
        </div>
      </div>
      <div class="seller-card">
        <div class="seller-left">
          <div class="seller-avatar">👤</div>
          <div>
            <div class="seller-name">${this.escapeHtml(p.sellerName || '匿名用户')}</div>
            <div class="seller-badge">已认证</div>
          </div>
        </div>
        ${!isOwner ? `<button class="btn-sm-outline" onclick="App.navTo('chat','${p.sellerId}')">联系卖家</button>` : ''}
      </div>
      <div class="detail-desc-card">
        <div class="detail-desc-title">📝 商品描述</div>
        <div class="detail-desc-text">${this.escapeHtml(p.desc || '卖家很懒，什么都没写~').replace(/\n/g,'<br>')}</div>
      </div>
    `;

    document.getElementById('detailBottom').innerHTML = isOwner ? `
      <button class="btn-fav ${isFav ? 'liked' : ''}" onclick="App.toggleFav()"><span>${isFav ? '❤️' : '🤍'}</span><span class="lbl">收藏</span></button>
      <button class="btn-primary" onclick="App.toggleProductStatus('${p.id}')">
        ${p.status === 'selling' ? '🏷️ 标记为已售' : '🔄 重新上架'}
      </button>
    ` : `
      <button class="btn-fav ${isFav ? 'liked' : ''}" onclick="App.toggleFav()"><span>${isFav ? '❤️' : '🤍'}</span><span class="lbl">收藏</span></button>
      <button class="btn-primary" onclick="App.navTo('chat','${p.sellerId}')">💬 我想要</button>
    `;
  },

  toggleFav() {
    const id = this.currentDetailId;
    let favs = Store.get('favorites', []);
    if (favs.includes(id)) favs = favs.filter(x => x !== id);
    else favs.push(id);
    Store.set('favorites', favs);
    this.renderDetail(id);
  },

  toggleProductStatus(id) {
    const products = Store.get('products', []);
    const p = products.find(x => x.id === id);
    if (!p) return;
    p.status = p.status === 'selling' ? 'sold' : 'selling';
    Store.set('products', products);
    this.toast(p.status === 'sold' ? '已标记为已售' : '已重新上架');
    this.renderDetail(id);
  },

  // ========== Publish ==========
  pubType: 'sell',
  pubImages: [],

  switchPubTab(type) {
    this.pubType = type;
    document.querySelectorAll('#page-publish .pub-tab').forEach((t,i) => {
      t.classList.toggle('active', (i===0 && type==='sell') || (i===1 && type==='want'));
    });
    this.renderPublish();
  },

  renderPublish() {
    const isSell = this.pubType === 'sell';
    document.getElementById('publishContent').innerHTML = isSell ? `
      <div class="form-block">
        <label class="form-label">商品图片</label>
        <div class="upload-row" id="uploadRow">
          ${this.pubImages.map((url,i) => `<div class="upload-preview" style="background-image:url(${url})"><div class="upload-remove" onclick="App.removeImage(${i})">×</div></div>`).join('')}
          <div class="upload-box" onclick="App.pickImage()"><span style="font-size:32px">+</span><span style="font-size:11px;margin-top:4px">添加图片</span></div>
        </div>
      </div>
      <div class="form-block"><label class="form-label">商品标题</label><input class="form-input" id="pubTitle" placeholder="写一个吸引人的标题吧~"></div>
      <div class="form-block"><label class="form-label">商品描述</label><textarea class="form-textarea" id="pubDesc" placeholder="描述一下成色、使用情况等..."></textarea></div>
      <div style="display:flex;gap:12px;margin:0 16px">
        <div class="form-block" style="flex:1;margin:0"><label class="form-label">售价 (元)</label><input class="form-input" id="pubPrice" type="number" placeholder="0.00"></div>
        <div class="form-block" style="flex:1;margin:0"><label class="form-label">原价 (元)</label><input class="form-input" id="pubOrigPrice" type="number" placeholder="选填"></div>
      </div>
      <div class="form-block"><label class="form-label">分类</label><select class="form-select" id="pubCat">${Object.entries(CATEGORY_MAP).map(([k,v]) => `<option value="${k}">${v.emoji} ${v.label}</option>`).join('')}</select></div>
      <div class="form-block"><label class="form-label">成色</label><select class="form-select" id="pubCondition">${CONDITION_MAP.map((c,i) => `<option value="${i}">${c}</option>`).join('')}</select></div>
      <button class="btn-submit" onclick="App.submitPublish()">✨ 立即发布</button>
    ` : `
      <div class="form-block"><label class="form-label">求购物品</label><input class="form-input" id="wantTitle" placeholder="比如：二手自行车"></div>
      <div class="form-block"><label class="form-label">详细描述</label><textarea class="form-textarea" id="wantDesc" placeholder="说说你的具体需求..."></textarea></div>
      <div class="form-block"><label class="form-label">预算 (元)</label><input class="form-input" id="wantBudget" type="number" placeholder="0.00"></div>
      <div class="form-block"><label class="form-label">分类</label><select class="form-select" id="wantCat">${Object.entries(CATEGORY_MAP).map(([k,v]) => `<option value="${k}">${v.emoji} ${v.label}</option>`).join('')}</select></div>
      <button class="btn-submit" onclick="App.submitWant()">✨ 发布求购</button>
    `;
  },

  pickImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e) => {
      Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.pubImages.push(ev.target.result);
          this.renderPublish();
        };
        reader.readAsDataURL(file);
      });
    };
    input.click();
  },

  removeImage(i) {
    this.pubImages.splice(i, 1);
    this.renderPublish();
  },

  submitPublish() {
    const title = document.getElementById('pubTitle')?.value.trim();
    const price = parseFloat(document.getElementById('pubPrice')?.value);
    if (!title) return this.toast('请输入商品标题');
    if (!price || price <= 0) return this.toast('请输入有效价格');

    const user = Store.get('user');
    if (!user) return this.toast('请先登录');

    const products = Store.get('products', []);
    products.unshift({
      id: 'p' + Date.now(),
      title,
      price,
      origPrice: parseFloat(document.getElementById('pubOrigPrice')?.value) || null,
      category: document.getElementById('pubCat')?.value || 'other',
      condition: parseInt(document.getElementById('pubCondition')?.value) || 0,
      desc: document.getElementById('pubDesc')?.value.trim() || '',
      images: [...this.pubImages],
      sellerName: user.name || '用户',
      sellerId: user.id,
      status: 'selling',
      views: 0,
      createdAt: Date.now(),
      badge: 'new',
    });
    Store.set('products', products);
    this.pubImages = [];
    this.toast('发布成功！');
    setTimeout(() => this.navTo('home'), 800);
  },

  submitWant() {
    const title = document.getElementById('wantTitle')?.value.trim();
    const budget = parseFloat(document.getElementById('wantBudget')?.value);
    if (!title) return this.toast('请输入求购物品');
    if (!budget || budget <= 0) return this.toast('请输入有效预算');
    const user = Store.get('user');
    if (!user) return this.toast('请先登录');

    const wants = Store.get('wantBuys', []);
    wants.unshift({
      id: 'w' + Date.now(),
      title,
      budget,
      category: document.getElementById('wantCat')?.value || 'other',
      desc: document.getElementById('wantDesc')?.value.trim() || '',
      userName: user.name || '用户',
      userId: user.id,
      status: 'active',
      createdAt: Date.now(),
    });
    Store.set('wantBuys', wants);
    this.toast('求购发布成功！');
    setTimeout(() => this.navTo('home'), 800);
  },

  // ========== Messages ==========
  renderMessages() {
    const myId = getMyId();
    if (!myId) {
      document.getElementById('messagesContent').innerHTML = `
        <div class="empty"><div class="empty-icon">💬</div><div class="empty-desc">登录后可查看消息</div>
        <button class="btn-primary" style="width:auto;padding:8px 30px;margin:0" onclick="App.mockLogin()">模拟登录</button></div>`;
      return;
    }

    const messages = Store.get('messages', []);
    // Group by conversation partner
    const convMap = {};
    messages.forEach(m => {
      const partnerId = m.from === myId ? m.to : m.from;
      if (!convMap[partnerId]) convMap[partnerId] = { msgs:[], unread:0 };
      convMap[partnerId].msgs.push(m);
      if (m.to === myId && !m.isRead) convMap[partnerId].unread++;
    });

    const users = Store.get('users', []);
    const userMap = {};
    users.forEach(u => userMap[u.id] = u);

    const convs = Object.entries(convMap).map(([id, data]) => {
      const lastMsg = data.msgs[data.msgs.length - 1];
      const user = userMap[id] || { name: '用户'+id.slice(-4) };
      return { id, name: user.name, lastMsg: lastMsg.content, time: lastMsg.createdAt, unread: data.unread };
    });
    convs.sort((a,b) => b.time - a.time);

    if (convs.length === 0) {
      document.getElementById('messagesContent').innerHTML = `<div class="empty"><div class="empty-icon">💬</div><div class="empty-desc">暂无消息</div></div>`;
      return;
    }

    document.getElementById('messagesContent').innerHTML = convs.map(c => `
      <div class="msg-item fade-in" onclick="App.navTo('chat','${c.id}')">
        <div class="msg-avatar" style="background:${AVATAR_COLORS[Math.abs(c.id.charCodeAt(0)||0) % 5]}">👤${c.unread ? '<div class="msg-dot"></div>' : ''}</div>
        <div class="msg-body">
          <div class="msg-top"><span class="msg-name">${this.escapeHtml(c.name)}</span><span class="msg-time">${this.timeAgo(c.time)}</span></div>
          <div class="msg-bottom">
            <span class="msg-preview">${this.escapeHtml(c.lastMsg)}</span>
            ${c.unread ? `<span class="msg-badge">${c.unread}</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');
  },

  // ========== Chat ==========
  openChat(partnerId) {
    this.currentChatUser = partnerId;
    const myId = getMyId();
    if (!myId) return;

    const users = Store.get('users', []);
    const user = users.find(u => u.id === partnerId) || { name: '用户'+partnerId.slice(-4) };
    document.getElementById('chatTitle').textContent = user.name;

    // Mark messages as read
    const messages = Store.get('messages', []);
    messages.forEach(m => { if (m.from === partnerId && m.to === myId) m.isRead = true; });
    Store.set('messages', messages);

    this.renderChatMessages();
    setTimeout(() => {
      const area = document.getElementById('chatArea');
      if (area) area.scrollTop = area.scrollHeight;
    }, 100);
  },

  renderChatMessages() {
    const myId = getMyId();
    const messages = Store.get('messages', []).filter(m =>
      (m.from === myId && m.to === this.currentChatUser) ||
      (m.from === this.currentChatUser && m.to === myId)
    ).sort((a,b) => a.createdAt - b.createdAt);

    const area = document.getElementById('chatArea');
    if (!area) return;

    if (messages.length === 0) {
      area.innerHTML = `<div style="text-align:center;color:#999;padding:40px">开始聊天吧~</div>`;
      return;
    }

    area.innerHTML = messages.map((m,i) => {
      const isMine = m.from === myId;
      const prev = i > 0 ? messages[i-1] : null;
      const showDate = !prev || (m.createdAt - prev.createdAt) > 1800000;
      const dateHtml = showDate ? `<div class="chat-date"><span>${this.formatTime(m.createdAt)}</span></div>` : '';
      return dateHtml + `
        <div class="chat-row ${isMine ? 'mine' : ''}">
          <div class="chat-avatar-sm" style="background:${isMine ? '#d4e4ff' : AVATAR_COLORS[Math.abs(this.currentChatUser.charCodeAt(0)||0)%5]}">${isMine ? '👤' : '🙋'}</div>
          <div class="chat-bubble ${isMine ? 'mine' : 'other'}">${this.escapeHtml(m.content)}</div>
        </div>`;
    }).join('');
    setTimeout(() => { area.scrollTop = area.scrollHeight; }, 50);
  },

  sendChat() {
    const input = document.getElementById('chatInputField');
    const text = input.value.trim();
    if (!text) return;

    const myId = getMyId();
    if (!myId) return this.toast('请先登录');

    const messages = Store.get('messages', []);
    messages.push({
      id: 'm' + Date.now(),
      from: myId,
      to: this.currentChatUser,
      content: text,
      isRead: false,
      createdAt: Date.now(),
    });
    Store.set('messages', messages);
    input.value = '';
    this.renderChatMessages();
  },

  // ========== Search ==========
  renderSearchHistory() {
    const history = Store.get('searchHistory', []);
    document.getElementById('historyTags').innerHTML = history.map(h =>
      `<div class="history-tag" onclick="App.searchThis('${h}')">${h}</div>`
    ).join('');
  },

  searchThis(keyword) {
    document.getElementById('searchInput').value = keyword;
    this.doSearch(keyword);
  },

  clearHistory() {
    Store.set('searchHistory', []);
    this.renderSearchHistory();
  },

  doSearch(keyword) {
    if (!keyword || keyword.length < 1) {
      document.getElementById('searchResults').innerHTML = '';
      return;
    }

    // Save to history
    let history = Store.get('searchHistory', []).filter(h => h !== keyword);
    history.unshift(keyword);
    if (history.length > 10) history = history.slice(0, 10);
    Store.set('searchHistory', history);

    const products = Store.get('products', []).filter(p =>
      p.status === 'selling' && p.title.toLowerCase().includes(keyword.toLowerCase())
    );

    document.getElementById('searchResults').innerHTML = products.map((p,i) => this.productCard(p,i)).join('');
    if (products.length === 0 && keyword.length >= 2) {
      document.getElementById('searchResults').innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><div class="empty-desc">没有找到"${keyword}"相关商品</div></div>`;
    }
    this.renderSearchHistory();
  },

  // ========== Favorites ==========
  renderFavorites() {
    const favIds = Store.get('favorites', []);
    const products = Store.get('products', []).filter(p => favIds.includes(p.id));
    document.getElementById('favList').innerHTML = products.map((p,i) => this.productCard(p,i)).join('');
    document.getElementById('favEmpty').style.display = products.length === 0 ? 'flex' : 'none';
  },

  // ========== My Publish ==========
  myPubTab: 'selling',
  switchMyTab(tab) {
    this.myPubTab = tab;
    document.querySelectorAll('#page-mypublish .pub-tab').forEach((t,i) => {
      t.classList.toggle('active', (i===0 && tab==='selling') || (i===1 && tab==='sold') || (i===2 && tab==='all'));
    });
    this.renderMyPublish();
  },

  renderMyPublish() {
    const myId = getMyId();
    if (!myId) {
      document.getElementById('myPubList').innerHTML = '';
      document.getElementById('myPubEmpty').style.display = 'flex';
      return;
    }
    let products = Store.get('products', []).filter(p => p.sellerId === myId);
    if (this.myPubTab === 'selling') products = products.filter(p => p.status === 'selling');
    else if (this.myPubTab === 'sold') products = products.filter(p => p.status === 'sold');
    products.sort((a,b) => b.createdAt - a.createdAt);

    document.getElementById('myPubList').innerHTML = products.map((p,i) => this.productCard(p,i)).join('');
    document.getElementById('myPubEmpty').style.display = products.length === 0 ? 'flex' : 'none';
  },

  // ========== User ==========
  updateUserUI() {
    const user = Store.get('user');
    if (user) {
      document.getElementById('userName').textContent = user.name || '用户';
      document.getElementById('userSchoolId').textContent = (user.schoolId ? '学号: ' + user.schoolId + ' · ' : '') + '已认证 ✓';
      document.getElementById('userAvatar').textContent = '👤';
      document.getElementById('logoutSection').style.display = 'block';

      const products = Store.get('products', []);
      const myId = user.id;
      document.getElementById('statSell').textContent = products.filter(p => p.sellerId === myId && p.status === 'selling').length;
      document.getElementById('statSold').textContent = products.filter(p => p.sellerId === myId && p.status === 'sold').length;
      document.getElementById('statFav').textContent = Store.get('favorites', []).length;
    } else {
      document.getElementById('userName').textContent = '点击登录';
      document.getElementById('userSchoolId').textContent = '登录后使用完整功能';
      document.getElementById('logoutSection').style.display = 'none';
      document.getElementById('statSell').textContent = '0';
      document.getElementById('statSold').textContent = '0';
      document.getElementById('statFav').textContent = '0';
    }
  },

  mockLogin() {
    const users = Store.get('users', []);
    let user = users.find(u => u.id === 'u0');
    if (!user) {
      user = { id: 'u0', name: '小明同学', schoolId: '2024001', avatar: '' };
      users.push(user);
      Store.set('users', users);
    }
    Store.set('user', user);
    this.updateUserUI();
    this.toast('登录成功（模拟）');
    if (this.currentPage === 'messages') this.renderMessages();
    if (this.currentPage === 'mypublish') this.renderMyPublish();
  },

  logout() {
    Store.set('user', null);
    this.updateUserUI();
    this.toast('已退出登录');
  },

  // ========== Tab Bars ==========
  buildTabBars() {
    const tabs = (active) => [
      { page:'home', icon:'🏠', label:'逛一逛' },
      { page:'publish', icon:'', label:'', center:true },
      { page:'messages', icon:'💬', label:'消息' },
      { page:'user', icon:'👤', label:'我的' },
    ].map(t => {
      if (t.center) return `<div class="tab-publish" onclick="App.navTo('publish')">＋</div>`;
      return `<div class="tab-item ${t.page === active ? 'active' : ''}" onclick="App.navTo('${t.page}')"><span class="icon">${t.icon}</span><span>${t.label}</span></div>`;
    }).join('');

    document.getElementById('tabHome').innerHTML = tabs('home');
    document.getElementById('tabPublish').innerHTML = tabs('publish');
    document.getElementById('tabMessages').innerHTML = tabs('messages');
    document.getElementById('tabUser').innerHTML = tabs('user');
  },

  // ========== Utilities ==========
  timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff/60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff/3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff/86400000) + '天前';
    return this.formatTime(ts);
  },

  formatTime(ts) {
    const d = new Date(ts);
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  },

  closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
  },
};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => App.init());

// Handle back button
window.addEventListener('popstate', () => {
  if (App.currentPage !== 'home') App.navBack();
});
