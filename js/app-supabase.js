/* ============================================================
   校园跳蚤市场 - Supabase 集成版
   使用 Supabase 作为后端，支持真实注册/登录
   ============================================================ */

// ==================== SUPABASE CLIENT ====================
if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL.includes('xxxxxxxxxxxx')) {
  document.body.innerHTML = '<div style="text-align:center;padding:60px 20px;font-family:sans-serif"><h2>Supabase 未配置</h2><p>请在 js/supabase-config.js 中填入你的 Supabase URL 和 anon key</p></div>';
  throw new Error('Supabase 未配置');
}
let supabase;
try {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  document.body.innerHTML = '<div style="text-align:center;padding:60px 20px;font-family:sans-serif"><h2>初始化失败</h2><p>' + e.message + '</p></div>';
  throw e;
}

// ==================== CONSTANTS ====================
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

// ==================== LOCAL HELPERS (search history stays local) ====================
const LocalStore = {
  get(key, def) {
    try { const v = localStorage.getItem('fm_' + key); return v ? JSON.parse(v) : def; }
    catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem('fm_' + key, JSON.stringify(val)); } catch {}
  },
};

// ==================== AUTH STATE ====================
let currentUser = null;
let currentProfile = null;

supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    currentUser = session.user;
    loadProfile();
  } else {
    currentUser = null;
    currentProfile = null;
  }
  App.updateUserUI();
});

// Restore session on load
async function restoreSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    await loadProfile();
  }
}

async function loadProfile() {
  if (!currentUser) return;
  const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
  currentProfile = data;
}

function getMyId() {
  return currentUser?.id || null;
}

// ==================== APP CONTROLLER ====================
const App = {
  currentPage: 'home',
  currentCat: '',
  currentDetailId: null,
  currentChatUser: null,

  async init() {
    // 先渲染页面骨架，不阻塞
    this.renderCategories();
    this.buildTabBars();
    this.renderSearchHistory();
    this.updateUserUI();

    // 后台恢复会话
    restoreSession().catch(e => console.warn('会话恢复失败:', e.message));

    // 加载商品（带超时保护）
    const timeout = new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 8000));
    try {
      await Promise.race([this.renderHome(), timeout]);
    } catch (e) {
      console.warn('加载商品失败:', e.message);
      document.getElementById('homeList').innerHTML = '';
      document.getElementById('homeEmpty').style.display = 'flex';
    }
    this.updateUserUI();

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
    if (page === 'search') this.renderSearchHistory();
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

  async filterCat(cat) {
    this.currentCat = cat;
    this.renderCategories();
    this.renderHome();
  },

  // ========== Render Home ==========
  async renderHome() {
    let query = supabase.from('products').select('*').eq('status', 'selling').order('created_at', { ascending: false });
    if (this.currentCat) query = query.eq('category', this.currentCat);

    const { data: products, error } = await query;
    if (error) { console.warn('查询商品失败:', error.message); return; }

    const container = document.getElementById('homeList');
    const empty = document.getElementById('homeEmpty');
    if (!products || products.length === 0) { container.innerHTML = ''; empty.style.display = 'flex'; return; }
    empty.style.display = 'none';
    container.innerHTML = products.map((p, i) => this.productCard(p, i)).join('');
  },

  productCard(p, i) {
    const cat = CATEGORY_MAP[p.category] || {};
    const time = this.timeAgo(p.created_at);
    const isSold = p.status === 'sold';
    return `
      <div class="product-card fade-in" onclick="App.navTo('detail','${p.id}')" style="animation-delay:${i*0.03}s">
        <div class="product-img" style="background:${this.gradientForCat(p.category)}">${cat.emoji || '📦'}</div>
        ${isSold ? '<div class="product-badge" style="background:rgba(0,0,0,0.5)">已售</div>' : ''}
        <div class="product-body">
          <div class="product-title">${this.escapeHtml(p.title)}</div>
          <div class="product-price"><span class="yen">¥</span>${p.price}</div>
          <div class="product-footer">
            <span class="product-tag">${cat.label || ''}</span>
            <span class="product-meta">👀 ${p.view_count || 0} · ${time}</span>
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
  async renderDetail(productId) {
    this.currentDetailId = productId;

    // Fetch product
    const { data: p } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();
    if (!p) { this.toast('商品不存在'); return; }

    // Increment view count
    await supabase.from('products').update({ view_count: (p.view_count || 0) + 1 }).eq('id', productId);
    p.view_count = (p.view_count || 0) + 1;

    // Check if favorited
    let isFav = false;
    if (currentUser) {
      const { count } = await supabase.from('favorites').select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id).eq('product_id', productId);
      isFav = count > 0;
    }

    const isOwner = getMyId() === p.user_id;
    const cat = CATEGORY_MAP[p.category] || {};

    // Fetch seller profile
    let sellerName = '匿名用户';
    const { data: sellerProfile } = await supabase.from('profiles').select('nickname').eq('id', p.user_id).maybeSingle();
    if (sellerProfile) sellerName = sellerProfile.nickname || '用户';

    document.getElementById('detailContent').innerHTML = `
      <div class="gallery" style="background:${this.gradientForCat(p.category)}">
        <span style="font-size:100px">${cat.emoji || '📦'}</span>
        <div class="gallery-dots"><div class="gallery-dot active"></div><div class="gallery-dot"></div><div class="gallery-dot"></div></div>
      </div>
      <div class="detail-card">
        <div style="display:flex;align-items:flex-end;gap:10px">
          <span class="detail-price-main">¥${p.price}</span>
          ${p.original_price ? `<span class="detail-price-orig">原价 ¥${p.original_price}</span>` : ''}
        </div>
        <div class="detail-title-text">${this.escapeHtml(p.title)}</div>
        <div class="detail-tag-row">
          <span class="detail-tag green">${cat.label}</span>
          <span class="detail-tag blue">${CONDITION_MAP[p.condition] || '正常'}</span>
          <span style="font-size:12px;color:#999;margin-left:auto">👀 ${p.view_count}次浏览 · ${this.timeAgo(p.created_at)}</span>
        </div>
      </div>
      <div class="seller-card">
        <div class="seller-left">
          <div class="seller-avatar">👤</div>
          <div>
            <div class="seller-name">${this.escapeHtml(sellerName)}</div>
            <div class="seller-badge">已认证</div>
          </div>
        </div>
        ${!isOwner ? `<button class="btn-sm-outline" onclick="App.navTo('chat','${p.user_id}')">联系卖家</button>` : ''}
      </div>
      <div class="detail-desc-card">
        <div class="detail-desc-title">📝 商品描述</div>
        <div class="detail-desc-text">${this.escapeHtml(p.description || '卖家很懒，什么都没写~').replace(/\n/g,'<br>')}</div>
      </div>
    `;

    document.getElementById('detailBottom').innerHTML = currentUser ? (isOwner ? `
      <button class="btn-fav ${isFav ? 'liked' : ''}" onclick="App.toggleFav()"><span>${isFav ? '❤️' : '🤍'}</span><span class="lbl">收藏</span></button>
      <button class="btn-primary" onclick="App.toggleProductStatus('${p.id}')">
        ${p.status === 'selling' ? '🏷️ 标记为已售' : '🔄 重新上架'}
      </button>
    ` : `
      <button class="btn-fav ${isFav ? 'liked' : ''}" onclick="App.toggleFav()"><span>${isFav ? '❤️' : '🤍'}</span><span class="lbl">收藏</span></button>
      <button class="btn-primary" onclick="App.navTo('chat','${p.user_id}')">💬 我想要</button>
    `) : `
      <button class="btn-primary" style="width:100%" onclick="App.showAuth('login')">登录后联系卖家</button>
    `;
  },

  async toggleFav() {
    if (!currentUser) { this.toast('请先登录'); return; }
    const pid = this.currentDetailId;

    const { data: existing } = await supabase.from('favorites').select('id')
      .eq('user_id', currentUser.id).eq('product_id', pid).maybeSingle();

    if (existing) {
      await supabase.from('favorites').delete().eq('id', existing.id);
      this.toast('已取消收藏');
    } else {
      await supabase.from('favorites').insert({ user_id: currentUser.id, product_id: pid });
      this.toast('已收藏');
    }
    this.renderDetail(pid);
  },

  async toggleProductStatus(id) {
    const { data: p } = await supabase.from('products').select('status').eq('id', id).maybeSingle();
    if (!p) return;
    const newStatus = p.status === 'selling' ? 'sold' : 'selling';
    await supabase.from('products').update({ status: newStatus }).eq('id', id);
    this.toast(newStatus === 'sold' ? '已标记为已售' : '已重新上架');
    this.renderDetail(id);
  },

  // ========== Publish ==========
  pubType: 'sell',
  pubImages: [],

  switchPubTab(type) {
    this.pubType = type;
    document.querySelectorAll('#page-publish .pub-tab').forEach((t, i) => {
      t.classList.toggle('active', (i === 0 && type === 'sell') || (i === 1 && type === 'want'));
    });
    this.renderPublish();
  },

  renderPublish() {
    if (!currentUser) {
      document.getElementById('publishContent').innerHTML = `
        <div class="empty"><div class="empty-icon">📦</div><div class="empty-desc">请先登录后再发布</div>
        <button class="btn-primary" style="width:auto;padding:8px 30px;margin:0" onclick="App.showAuth('login')">去登录</button></div>`;
      return;
    }
    const isSell = this.pubType === 'sell';
    document.getElementById('publishContent').innerHTML = isSell ? `
      <div class="form-block">
        <label class="form-label">商品图片</label>
        <div class="upload-row" id="uploadRow">
          ${this.pubImages.map((url, i) => `<div class="upload-preview" style="background-image:url(${url})"><div class="upload-remove" onclick="App.removeImage(${i})">×</div></div>`).join('')}
          <div class="upload-box" onclick="App.pickImage()"><span style="font-size:32px">+</span><span style="font-size:11px;margin-top:4px">添加图片</span></div>
        </div>
      </div>
      <div class="form-block"><label class="form-label">商品标题</label><input class="form-input" id="pubTitle" placeholder="写一个吸引人的标题吧~"></div>
      <div class="form-block"><label class="form-label">商品描述</label><textarea class="form-textarea" id="pubDesc" placeholder="描述一下成色、使用情况等..."></textarea></div>
      <div style="display:flex;gap:12px;margin:0 16px">
        <div class="form-block" style="flex:1;margin:0"><label class="form-label">售价 (元)</label><input class="form-input" id="pubPrice" type="number" placeholder="0.00"></div>
        <div class="form-block" style="flex:1;margin:0"><label class="form-label">原价 (元)</label><input class="form-input" id="pubOrigPrice" type="number" placeholder="选填"></div>
      </div>
      <div class="form-block"><label class="form-label">分类</label><select class="form-select" id="pubCat">${Object.entries(CATEGORY_MAP).map(([k, v]) => `<option value="${k}">${v.emoji} ${v.label}</option>`).join('')}</select></div>
      <div class="form-block"><label class="form-label">成色</label><select class="form-select" id="pubCondition">${CONDITION_MAP.map((c, i) => `<option value="${i}">${c}</option>`).join('')}</select></div>
      <button class="btn-submit" onclick="App.submitPublish()">✨ 立即发布</button>
    ` : `
      <div class="form-block"><label class="form-label">求购物品</label><input class="form-input" id="wantTitle" placeholder="比如：二手自行车"></div>
      <div class="form-block"><label class="form-label">详细描述</label><textarea class="form-textarea" id="wantDesc" placeholder="说说你的具体需求..."></textarea></div>
      <div class="form-block"><label class="form-label">预算 (元)</label><input class="form-input" id="wantBudget" type="number" placeholder="0.00"></div>
      <div class="form-block"><label class="form-label">分类</label><select class="form-select" id="wantCat">${Object.entries(CATEGORY_MAP).map(([k, v]) => `<option value="${k}">${v.emoji} ${v.label}</option>`).join('')}</select></div>
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

  async submitPublish() {
    if (!currentUser) { this.toast('请先登录'); return; }
    const title = document.getElementById('pubTitle')?.value.trim();
    const price = parseFloat(document.getElementById('pubPrice')?.value);
    if (!title) return this.toast('请输入商品标题');
    if (!price || price <= 0) return this.toast('请输入有效价格');

    const { error } = await supabase.from('products').insert({
      user_id: currentUser.id,
      title,
      price,
      original_price: parseFloat(document.getElementById('pubOrigPrice')?.value) || null,
      category: document.getElementById('pubCat')?.value || 'other',
      condition: parseInt(document.getElementById('pubCondition')?.value) || 0,
      description: document.getElementById('pubDesc')?.value.trim() || '',
      images: this.pubImages,
      status: 'selling',
      view_count: 0,
    });

    if (error) { this.toast('发布失败: ' + error.message); return; }
    this.pubImages = [];
    this.toast('发布成功！');
    setTimeout(() => this.navTo('home'), 800);
  },

  async submitWant() {
    if (!currentUser) { this.toast('请先登录'); return; }
    const title = document.getElementById('wantTitle')?.value.trim();
    const budget = parseFloat(document.getElementById('wantBudget')?.value);
    if (!title) return this.toast('请输入求购物品');
    if (!budget || budget <= 0) return this.toast('请输入有效预算');

    const { error } = await supabase.from('want_buys').insert({
      user_id: currentUser.id,
      title,
      budget,
      category: document.getElementById('wantCat')?.value || 'other',
      description: document.getElementById('wantDesc')?.value.trim() || '',
      status: 'active',
    });

    if (error) { this.toast('发布求购失败: ' + error.message); return; }
    this.toast('求购发布成功！');
    setTimeout(() => this.navTo('home'), 800);
  },

  // ========== Messages ==========
  async renderMessages() {
    if (!currentUser) {
      document.getElementById('messagesContent').innerHTML = `
        <div class="empty"><div class="empty-icon">💬</div><div class="empty-desc">登录后可查看消息</div>
        <button class="btn-primary" style="width:auto;padding:8px 30px;margin:0" onclick="App.showAuth('login')">去登录</button></div>`;
      return;
    }

    // Get all messages involving current user, ordered by time
    const { data: messages } = await supabase.from('messages')
      .select('*').or(`from_user.eq.${currentUser.id},to_user.eq.${currentUser.id}`)
      .order('created_at', { ascending: false });

    if (!messages || messages.length === 0) {
      document.getElementById('messagesContent').innerHTML = `<div class="empty"><div class="empty-icon">💬</div><div class="empty-desc">暂无消息</div></div>`;
      return;
    }

    // Group by conversation partner
    const convMap = {};
    for (const m of messages) {
      const partnerId = m.from_user === currentUser.id ? m.to_user : m.from_user;
      if (!convMap[partnerId]) convMap[partnerId] = { msgs: [], unread: 0 };
      convMap[partnerId].msgs.push(m);
      if (m.to_user === currentUser.id && !m.is_read) convMap[partnerId].unread++;
    }

    // Fetch all partner profiles in one query
    const partnerIds = Object.keys(convMap);
    const { data: profiles } = await supabase.from('profiles').select('id,nickname').in('id', partnerIds);
    const profileMap = {};
    if (profiles) profiles.forEach(p => { profileMap[p.id] = p; });

    const convs = Object.entries(convMap).map(([id, data]) => {
      const lastMsg = data.msgs[0]; // Most recent (sorted desc)
      const profile = profileMap[id] || {};
      return { id, name: profile.nickname || '用户', lastMsg: lastMsg.content, time: lastMsg.created_at, unread: data.unread };
    });
    convs.sort((a, b) => new Date(b.time) - new Date(a.time));

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
  async openChat(partnerId) {
    if (!currentUser) return;
    this.currentChatUser = partnerId;

    // Fetch partner name
    const { data: profile } = await supabase.from('profiles').select('nickname').eq('id', partnerId).maybeSingle();
    document.getElementById('chatTitle').textContent = profile?.nickname || '用户';

    // Mark messages from partner as read
    await supabase.from('messages').update({ is_read: true })
      .eq('from_user', partnerId).eq('to_user', currentUser.id).eq('is_read', false);

    this.renderChatMessages();
    setTimeout(() => {
      const area = document.getElementById('chatArea');
      if (area) area.scrollTop = area.scrollHeight;
    }, 100);
  },

  async renderChatMessages() {
    if (!currentUser) return;
    const { data: messages } = await supabase.from('messages').select('*')
      .or(`and(from_user.eq.${currentUser.id},to_user.eq.${this.currentChatUser}),and(from_user.eq.${this.currentChatUser},to_user.eq.${currentUser.id})`)
      .order('created_at', { ascending: true });

    const area = document.getElementById('chatArea');
    if (!area) return;

    if (!messages || messages.length === 0) {
      area.innerHTML = `<div style="text-align:center;color:#999;padding:40px">开始聊天吧~</div>`;
      return;
    }

    area.innerHTML = messages.map((m, i) => {
      const isMine = m.from_user === currentUser.id;
      const prev = i > 0 ? messages[i - 1] : null;
      const showDate = !prev || (new Date(m.created_at) - new Date(prev.created_at)) > 1800000;
      const dateHtml = showDate ? `<div class="chat-date"><span>${this.formatTime(m.created_at)}</span></div>` : '';
      return dateHtml + `
        <div class="chat-row ${isMine ? 'mine' : ''}">
          <div class="chat-avatar-sm" style="background:${isMine ? '#d4e4ff' : AVATAR_COLORS[Math.abs(this.currentChatUser.charCodeAt(0)||0) % 5]}">${isMine ? '👤' : '🙋'}</div>
          <div class="chat-bubble ${isMine ? 'mine' : 'other'}">${this.escapeHtml(m.content)}</div>
        </div>`;
    }).join('');
    setTimeout(() => { area.scrollTop = area.scrollHeight; }, 50);
  },

  async sendChat() {
    if (!currentUser) { this.toast('请先登录'); return; }
    const input = document.getElementById('chatInputField');
    const text = input.value.trim();
    if (!text) return;

    const { error } = await supabase.from('messages').insert({
      from_user: currentUser.id,
      to_user: this.currentChatUser,
      content: text,
      is_read: false,
    });

    if (error) { this.toast('发送失败'); return; }
    input.value = '';
    this.renderChatMessages();
  },

  // ========== Search ==========
  renderSearchHistory() {
    const history = LocalStore.get('searchHistory', []);
    document.getElementById('historyTags').innerHTML = history.map(h =>
      `<div class="history-tag" onclick="App.searchThis('${h}')">${h}</div>`
    ).join('');
  },

  searchThis(keyword) {
    document.getElementById('searchInput').value = keyword;
    this.doSearch(keyword);
  },

  clearHistory() {
    LocalStore.set('searchHistory', []);
    this.renderSearchHistory();
  },

  async doSearch(keyword) {
    if (!keyword || keyword.length < 1) {
      document.getElementById('searchResults').innerHTML = '';
      return;
    }

    // Save to local history
    let history = LocalStore.get('searchHistory', []).filter(h => h !== keyword);
    history.unshift(keyword);
    if (history.length > 10) history = history.slice(0, 10);
    LocalStore.set('searchHistory', history);

    const { data: products } = await supabase.from('products').select('*')
      .eq('status', 'selling').ilike('title', `%${keyword}%`).order('created_at', { ascending: false });

    document.getElementById('searchResults').innerHTML = (products || []).map((p, i) => this.productCard(p, i)).join('');
    if (!products || products.length === 0) {
      document.getElementById('searchResults').innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><div class="empty-desc">没有找到"${keyword}"相关商品</div></div>`;
    }
    this.renderSearchHistory();
  },

  // ========== Favorites ==========
  async renderFavorites() {
    if (!currentUser) {
      document.getElementById('favList').innerHTML = '';
      document.getElementById('favEmpty').style.display = 'flex';
      return;
    }

    const { data: favs } = await supabase.from('favorites').select('product_id').eq('user_id', currentUser.id);
    if (!favs || favs.length === 0) {
      document.getElementById('favList').innerHTML = '';
      document.getElementById('favEmpty').style.display = 'flex';
      return;
    }

    const productIds = favs.map(f => f.product_id);
    const { data: products } = await supabase.from('products').select('*').in('id', productIds);

    document.getElementById('favList').innerHTML = (products || []).map((p, i) => this.productCard(p, i)).join('');
    document.getElementById('favEmpty').style.display = products?.length === 0 ? 'flex' : 'none';
  },

  // ========== My Publish ==========
  myPubTab: 'selling',

  switchMyTab(tab) {
    this.myPubTab = tab;
    document.querySelectorAll('#page-mypublish .pub-tab').forEach((t, i) => {
      t.classList.toggle('active', (i === 0 && tab === 'selling') || (i === 1 && tab === 'sold') || (i === 2 && tab === 'all'));
    });
    this.renderMyPublish();
  },

  async renderMyPublish() {
    if (!currentUser) {
      document.getElementById('myPubList').innerHTML = '';
      document.getElementById('myPubEmpty').style.display = 'flex';
      return;
    }

    let query = supabase.from('products').select('*').eq('user_id', currentUser.id);
    if (this.myPubTab === 'selling') query = query.eq('status', 'selling');
    else if (this.myPubTab === 'sold') query = query.eq('status', 'sold');
    query = query.order('created_at', { ascending: false });

    const { data: products } = await query;

    document.getElementById('myPubList').innerHTML = (products || []).map((p, i) => this.productCard(p, i)).join('');
    document.getElementById('myPubEmpty').style.display = !products || products.length === 0 ? 'flex' : 'none';
  },

  // ========== Auth ==========
  showAuth(mode) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-auth').classList.add('active');
    document.querySelectorAll('.tab-bar').forEach(t => t.style.display = 'none');

    document.getElementById('authTitle').textContent = mode === 'login' ? '登录' : '注册';
    document.getElementById('authFormLogin').style.display = mode === 'login' ? 'block' : 'none';
    document.getElementById('authFormRegister').style.display = mode === 'register' ? 'block' : 'none';
  },

  closeAuth() {
    document.getElementById('page-auth').classList.remove('active');
    this.navTo('user');
  },

  async doLogin() {
    const email = document.getElementById('loginEmail')?.value.trim();
    const pass = document.getElementById('loginPass')?.value;
    if (!email || !pass) return this.toast('请输入邮箱和密码');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
      this.toast(error.message === 'Invalid login credentials' ? '邮箱或密码错误' : error.message);
      return;
    }
    currentUser = data.user;
    await loadProfile();
    this.toast('登录成功！');
    this.closeAuth();
  },

  async doRegister() {
    const email = document.getElementById('regEmail')?.value.trim();
    const pass = document.getElementById('regPass')?.value;
    const nickname = document.getElementById('regNickname')?.value.trim();
    const schoolId = document.getElementById('regSchoolId')?.value.trim();
    if (!email || !pass) return this.toast('请输入邮箱和密码');
    if (pass.length < 6) return this.toast('密码至少6位');
    if (!nickname) return this.toast('请输入昵称');

    const btn = document.getElementById('regBtn');
    btn.disabled = true;
    btn.textContent = '注册中...';

    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { nickname } },
    });

    if (error) {
      btn.disabled = false;
      btn.textContent = '注册';
      this.toast(error.message);
      return;
    }

    // If email confirmation is not required, the trigger creates the profile automatically.
    // We also need to handle the school_id — update the profile after signup.
    if (data.user && schoolId) {
      await supabase.from('profiles').upsert({ id: data.user.id, school_id: schoolId, nickname }, { onConflict: 'id' });
    }

    btn.disabled = false;
    btn.textContent = '注册';

    if (data.user && !data.session) {
      // Email confirmation required
      this.toast('注册成功！请查收邮箱验证邮件后登录。');
      this.showAuth('login');
    } else {
      this.toast('注册成功！');
      currentUser = data.user;
      await loadProfile();
      this.closeAuth();
    }
  },

  async logout() {
    await supabase.auth.signOut();
    currentUser = null;
    currentProfile = null;
    this.updateUserUI();
    this.toast('已退出登录');
  },

  // ========== User UI ==========
  async updateUserUI() {
    if (currentUser && currentProfile) {
      document.getElementById('userName').textContent = currentProfile.nickname || '用户';
      document.getElementById('userSubInfo').textContent = currentProfile.school_id
        ? '学号: ' + currentProfile.school_id
        : currentUser.email;
      document.getElementById('userAvatar').textContent = '👤';
      document.getElementById('logoutSection').style.display = 'block';
      document.getElementById('userActionArea').innerHTML = `
        <button class="btn-primary" style="width:auto;padding:10px 40px;margin:0" onclick="App.showAuth('register')">📧 注册新账号</button>`;

      // Load stats
      const { count: sellCount } = await supabase.from('products').select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id).eq('status', 'selling');
      const { count: soldCount } = await supabase.from('products').select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id).eq('status', 'sold');
      const { count: favCount } = await supabase.from('favorites').select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id);

      document.getElementById('statSell').textContent = sellCount || 0;
      document.getElementById('statSold').textContent = soldCount || 0;
      document.getElementById('statFav').textContent = favCount || 0;
    } else {
      document.getElementById('userName').textContent = '未登录';
      document.getElementById('userSubInfo').textContent = '注册/登录后使用完整功能';
      document.getElementById('userAvatar').textContent = '👤';
      document.getElementById('logoutSection').style.display = 'none';
      document.getElementById('statSell').textContent = '0';
      document.getElementById('statSold').textContent = '0';
      document.getElementById('statFav').textContent = '0';
      document.getElementById('userActionArea').innerHTML = `
        <button class="btn-primary" style="width:auto;padding:10px 40px;margin:0" onclick="App.showAuth('login')">📧 邮箱登录 / 注册</button>`;
    }
  },

  // ========== Tab Bars ==========
  buildTabBars() {
    const tabs = (active) => [
      { page: 'home', icon: '🏠', label: '逛一逛' },
      { page: 'publish', icon: '', label: '', center: true },
      { page: 'messages', icon: '💬', label: '消息' },
      { page: 'user', icon: '👤', label: '我的' },
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
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
    return this.formatTime(ts);
  },

  formatTime(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  },
};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => App.init());

// Handle back button
window.addEventListener('popstate', () => {
  if (App.currentPage !== 'home') App.navBack();
});
