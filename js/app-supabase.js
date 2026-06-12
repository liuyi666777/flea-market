/* ============================================================
   山西应用科技学院校园市场 - Supabase 集成版
   ============================================================ */

function dbg(msg) { const el = document.getElementById('debugBar'); if (el) el.textContent = msg; }

(function() {
try {
dbg('① 检查配置...');

// ==================== SUPABASE CLIENT ====================
if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL.includes('xxxxxxxxxxxx')) {
  document.body.innerHTML = '<div style="text-align:center;padding:60px 20px;font-family:sans-serif"><h2>Supabase 未配置</h2><p>请在 js/supabase-config.js 中填入你的 Supabase URL 和 anon key</p></div>';
  throw new Error('Supabase 未配置');
}
if (typeof window.supabase === 'undefined') {
  document.body.innerHTML = '<div style="text-align:center;padding:60px 20px;font-family:sans-serif"><h2>SDK 未加载</h2><p>js/supabase.min.js 加载失败</p></div>';
  throw new Error('window.supabase 不存在');
}
dbg('② 创建客户端...');
let sb;
try {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  document.body.innerHTML = '<div style="text-align:center;padding:60px 20px;font-family:sans-serif"><h2>初始化失败</h2><p>' + e.message + '</p></div>';
  throw e;
}
dbg('③ 客户端就绪');

// ==================== CONSTANTS ====================
const CATEGORY_MAP = {
  textbook: { label: '教材', emoji: '📚' },
  digital: { label: '数码', emoji: '📱' },
  living: { label: '生活', emoji: '🏠' },
  clothing: { label: '服饰', emoji: '👗' },
  sports: { label: '运动', emoji: '⚽' },
  other: { label: '其他', emoji: '📦' },
};
const CONDITION_MAP = ['全新','几乎全新','轻微使用痕迹','正常使用痕迹'];
const AVATAR_COLORS = [
  'linear-gradient(135deg,#ffd4c4,#ffc4b0)',
  'linear-gradient(135deg,#d4e4ff,#c4d8ff)',
  'linear-gradient(135deg,#e4ffd4,#d0ffc4)',
  'linear-gradient(135deg,#ffe4d4,#ffd0c4)',
  'linear-gradient(135deg,#d4ffe4,#c4ffd0)',
];
const PAGE_SIZE = 20;
const STORAGE_BUCKET = 'product-images';
const SCHOOL_DOMAIN = '@sxast.edu.cn';
const BANNED_WORDS = ['傻逼','操你','操你妈','妈的','他妈的','草泥马','cnm','fuck','shit','bitch','废物','垃圾货','白痴','弱智','脑残','去死','滚蛋','畜生','狗日的','贱人','骚货','婊子','妓女','约炮','裸聊','做爱','性交','色情','黄色','管理员','admin','官方','客服','系统','root'];

const LocalStore = {
  get(key, def) { try { const v = localStorage.getItem('fm_'+key); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(key, val) { try { localStorage.setItem('fm_'+key, JSON.stringify(val)); } catch {} },
};

function hasSensitiveWord(text) {
  const lower = text.toLowerCase();
  for (const w of BANNED_WORDS) { if (lower.includes(w.toLowerCase())) return w; }
  return null;
}

// ==================== IMAGE COMPRESSION ====================
function compressImage(file, maxSize) {
  maxSize = maxSize || 500;
  return new Promise(function(resolve) {
    if (file.size < maxSize * 1024) { resolve(file); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var w = img.width, h = img.height;
        var maxDim = 1200;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        var quality = 0.8;
        var tryCompress = function() {
          canvas.toBlob(function(blob) {
            if (blob.size < maxSize * 1024 || quality <= 0.2) {
              var compressed = new File([blob], file.name, { type: 'image/jpeg' });
              resolve(compressed);
            } else {
              quality -= 0.1;
              tryCompress();
            }
          }, 'image/jpeg', quality);
        };
        tryCompress();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ==================== AUTH STATE ====================
let currentUser = null;
let currentProfile = null;
let msgChannel = null;

sb.auth.onAuthStateChange((event, session) => {
  if (session?.user) { currentUser = session.user; loadProfile(); subscribeMessages(); }
  else { currentUser = null; currentProfile = null; if (msgChannel) { sb.removeChannel(msgChannel); msgChannel = null; } }
  App.updateUserUI();
});

async function restoreSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) { currentUser = session.user; await loadProfile(); subscribeMessages(); App.updateUserUI(); }
}

async function loadProfile() {
  if (!currentUser) return;
  const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
  currentProfile = data;
}

function getMyId() { return currentUser?.id || null; }

// ==================== REALTIME MESSAGES ====================
function subscribeMessages() {
  if (msgChannel) { sb.removeChannel(msgChannel); msgChannel = null; }
  if (!currentUser) return;
  msgChannel = sb.channel('msgs')
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages', filter:`to_user=eq.${currentUser.id}` }, () => {
      if (App.currentPage === 'messages') App.renderMessages();
      if (App.currentPage === 'chat' && App.currentChatUser) App.renderChatMessages();
    })
    .on('postgres_changes', { event:'UPDATE', schema:'public', table:'messages', filter:`from_user=eq.${currentUser.id}` }, () => {
      if (App.currentPage === 'chat' && App.currentChatUser) App.renderChatMessages();
    })
    .subscribe();
}

// ==================== APP CONTROLLER ====================
const App = {
  currentPage: 'home', currentCat: '', currentDetailId: null, currentChatUser: null,
  _page:0, _hasMore:true, _loading:false, _sortBy:'created_at', _sortDir:'desc', _filterCond:-1,
  pubType:'sell', pubImages:[], myPubTab:'selling',
  _editingProduct:null, _homeTab:'sell', _detailImgIdx:0,

  async init() {
    dbg('④ 渲染页面...');
    this.renderCategories(); this.buildTabBars(); this.renderSearchHistory(); this.updateUserUI();
    dbg('⑤ 恢复会话...');
    restoreSession().then(()=>dbg('⑥ 会话恢复')).catch(e=>console.warn('会话恢复失败:',e.message));
    dbg('⑦ 加载商品...');
    await this.renderHome();
    dbg('✅ 页面就绪');
    setTimeout(()=>{ const d=document.getElementById('debugBar'); if(d)d.style.display='none'; },2000);
    this.setupInfiniteScroll(); this.setupPullRefresh();
    document.getElementById('searchInput').addEventListener('input', e=>this.doSearch(e.target.value));
  },

  navTo(page, data) {
    this.currentPage = page;
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    const el = document.getElementById('page-'+page); if(el)el.classList.add('active');
    if (page==='admin' && !(currentProfile&&currentProfile.is_admin)) { this.toast('无管理员权限'); return; }
    if (page==='edit' && !currentUser) { this.toast('请先登录'); this.navTo('user'); return; }
    const hasTab = ['home','publish','messages','user'].includes(page);
    document.querySelectorAll('.tab-bar').forEach(t=>t.style.display=hasTab?'flex':'none');
    if (page==='home') { this.currentCat=''; this._page=0; this._hasMore=true; this.renderCategories(); this.renderHome(); }
    if (page==='detail'&&data) this.renderDetail(data);
    if (page==='publish') this.renderPublish();
    if (page==='edit'&&data) this.renderEdit(data);
    if (page==='messages') this.renderMessages();
    if (page==='chat'&&data) this.openChat(data);
    if (page==='favorites') this.renderFavorites();
    if (page==='mypublish') this.renderMyPublish();
    if (page==='user') this.updateUserUI();
    if (page==='search') this.renderSearchHistory();
    if (page==='admin') this.renderAdmin();
  },
  navBack() { const m={detail:'home',chat:'messages',search:'home',favorites:'user',mypublish:'user',admin:'user',edit:'detail'}; this.navTo(m[this.currentPage]||'home'); },

  // ==================== HOME ====================
  switchHomeTab(tab) { this._homeTab=tab; this._page=0; this._hasMore=true; this.renderHomeTabs(); document.getElementById('homeList').innerHTML=''; this.renderHome(); },
  renderHomeTabs() {
    var tabs = document.getElementById('homeTabs');
    if (!tabs) return;
    tabs.querySelectorAll('.pub-tab').forEach(function(t, i) {
      t.classList.toggle('active', (i===0 && App._homeTab==='sell') || (i===1 && App._homeTab==='want'));
    });
  },

  renderCategories() {
    const cats=[{key:'',label:'全部',emoji:'🔥'}];
    Object.entries(CATEGORY_MAP).forEach(([k,v])=>cats.push({key:k,...v}));
    document.getElementById('catScroll').innerHTML=cats.map(c=>
      `<div class="cat-pill ${c.key===this.currentCat?'active':''}" onclick="App.filterCat('${c.key}')"><span class="emoji">${c.emoji}</span>${c.label}</div>`).join('');
  },
  async filterCat(cat) { this.currentCat=cat; this._page=0; this._hasMore=true; this.renderCategories(); document.getElementById('homeList').innerHTML=''; await this.renderHome(); },

  setSort(s) {
    this._sortBy = s==='price_asc' ? 'price' : s==='price_desc' ? 'price' : 'created_at';
    this._sortDir = s==='price_asc' ? 'asc' : 'desc';
    this._page=0; this._hasMore=true; document.getElementById('homeList').innerHTML=''; this.renderHome();
  },
  setCondition(c) { this._filterCond=c; this._page=0; this._hasMore=true; document.getElementById('homeList').innerHTML=''; this.renderHome(); },

  showSkeleton() {
    document.getElementById('homeList').innerHTML = Array.from({length:6},(_,i)=>`
      <div class="sk-card fade-in" style="animation-delay:${i*0.03}s">
        <div class="sk-img"></div><div class="sk-body"><div class="sk-line w80"></div><div class="sk-line w40 sk-mt"></div><div class="sk-line w60 sk-mt"></div></div>
      </div>`).join('');
  },

  async renderHome() {
    const container = document.getElementById('homeList'), empty = document.getElementById('homeEmpty');
    if (this._page===0) this.showSkeleton();
    if (this._homeTab==='sell') {
      let q = sb.from('products').select('*',{count:'exact'}).eq('status','selling');
      if (this.currentCat) q = q.eq('category', this.currentCat);
      if (this._filterCond >= 0) q = q.eq('condition', this._filterCond);
      q = q.order(this._sortBy, {ascending: this._sortDir==='asc'}).range(0, (this._page+1)*PAGE_SIZE-1);
      const {data:products, count, error}=await q;
      if (error) { console.warn('查询失败:',error.message); return; }
      this._hasMore = products && products.length < (count||0);
      this._loading = false;
      if ((!products||products.length===0) && this._page===0) { container.innerHTML=''; empty.style.display='flex'; return; }
      empty.style.display='none';
      container.innerHTML = products.map((p,i)=>this.productCard(p,i)).join('');
    } else {
      let q = sb.from('want_buys').select('*',{count:'exact'}).eq('status','active');
      if (this.currentCat) q = q.eq('category', this.currentCat);
      q = q.order('created_at',{ascending:false}).range(0, (this._page+1)*PAGE_SIZE-1);
      const {data:items, count, error}=await q;
      if (error) { console.warn('查询失败:',error.message); return; }
      this._hasMore = items && items.length < (count||0);
      this._loading = false;
      if ((!items||items.length===0) && this._page===0) { container.innerHTML=''; empty.style.display='flex'; return; }
      empty.style.display='none';
      container.innerHTML = items.map((w,i)=>this.wantCard(w,i)).join('');
    }
  },

  async loadMore() {
    if (this._loading||!this._hasMore||this.currentPage!=='home') return;
    this._loading=true; this._page++;
    if (this._homeTab==='sell') {
      let q = sb.from('products').select('*').eq('status','selling');
      if (this.currentCat) q=q.eq('category',this.currentCat);
      if (this._filterCond>=0) q=q.eq('condition',this._filterCond);
      q=q.order(this._sortBy,{ascending:this._sortDir==='asc'}).range(this._page*PAGE_SIZE,(this._page+1)*PAGE_SIZE-1);
      const {data:products}=await q;
      if (!products||products.length===0) { this._hasMore=false; this._loading=false; return; }
      this._hasMore = products.length===PAGE_SIZE; this._loading=false;
      const idx=this._page*PAGE_SIZE;
      document.getElementById('homeList').insertAdjacentHTML('beforeend', products.map((p,i)=>this.productCard(p,idx+i)).join(''));
    } else {
      let q = sb.from('want_buys').select('*').eq('status','active');
      if (this.currentCat) q=q.eq('category',this.currentCat);
      q=q.order('created_at',{ascending:false}).range(this._page*PAGE_SIZE,(this._page+1)*PAGE_SIZE-1);
      const {data:items}=await q;
      if (!items||items.length===0) { this._hasMore=false; this._loading=false; return; }
      this._hasMore = items.length===PAGE_SIZE; this._loading=false;
      document.getElementById('homeList').insertAdjacentHTML('beforeend', items.map((w,i)=>this.wantCard(w,i)).join(''));
    }
  },

  setupInfiniteScroll() {
    const el = document.getElementById('page-home').querySelector('.main-content');
    el.addEventListener('scroll', ()=>{ if (el.scrollHeight-el.scrollTop-el.clientHeight<300 && this.currentPage==='home') this.loadMore(); });
  },

  setupPullRefresh() {
    let sy=0, pulling=false;
    const ind = document.getElementById('pullIndicator');
    const el = document.getElementById('page-home').querySelector('.main-content');
    el.addEventListener('touchstart', e=>{ if(el.scrollTop<=0){ sy=e.touches[0].clientY; pulling=true; } }, {passive:true});
    el.addEventListener('touchmove', e=>{
      if(!pulling)return; const dy=e.touches[0].clientY-sy;
      if(dy>40){ ind.classList.add('active'); ind.textContent='↓ 松开刷新'; }
    }, {passive:true});
    el.addEventListener('touchend', async ()=>{
      if(!pulling)return;
      if(ind.classList.contains('active')){ ind.textContent='⟳ 刷新中...'; this._page=0; this._hasMore=true; await this.renderHome(); ind.textContent=''; ind.classList.remove('active'); }
      pulling=false;
    });
  },

  productCard(p,i) {
    const cat=CATEGORY_MAP[p.category]||{}, time=this.timeAgo(p.created_at), isSold=p.status==='sold';
    const img = p.images&&p.images.length>0
      ? `<img src="${p.images[0]}" class="product-img-real" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="product-img-emoji" style="font-size:60px;display:none">${cat.emoji||'📦'}</div>`
      : `<div class="product-img-emoji" style="font-size:60px">${cat.emoji||'📦'}</div>`;
    return `<div class="product-card fade-in" onclick="App.navTo('detail','${p.id}')" style="animation-delay:${(i%20)*0.03}s">
      <div class="product-img">${img}</div>
      ${isSold?'<div class="product-badge" style="background:rgba(0,0,0,0.5)">已售</div>':''}
      <div class="product-body"><div class="product-title">${this.escapeHtml(p.title)}</div>
      <div class="product-price"><span class="yen">¥</span>${p.price}</div>
      <div class="product-footer"><span class="product-tag">${cat.label||''}</span><span class="product-meta">👀 ${p.view_count||0} · ${time}</span></div></div></div>`;
  },

  wantCard(w,i) {
    const cat=CATEGORY_MAP[w.category]||{};
    return `<div class="product-card fade-in" style="animation-delay:${(i%20)*0.03}s;border-left:3px solid #ff6b35">
      <div class="product-img" style="background:linear-gradient(135deg,#fff3ee,#ffe8e0);display:flex;align-items:center;justify-content:center;font-size:50px">🔍</div>
      <div class="product-body">
        <div class="product-title">${this.escapeHtml(w.title)}</div>
        <div class="product-price" style="color:#ff6b35"><span class="yen">¥</span>${w.budget||'面议'}</div>
        <div class="product-footer"><span class="product-tag" style="background:#fff3ee;color:#ff6b35">求购</span><span class="product-meta">${cat.label||''} · ${this.timeAgo(w.created_at)}</span></div>
      </div></div>`;
  },

  // ==================== DETAIL ====================
  async renderDetail(pid) {
    this.currentDetailId=pid; this._detailImgIdx=0;
    const {data:p}=await sb.from('products').select('*').eq('id',pid).maybeSingle();
    if(!p){this.toast('商品不存在');return;}
    await sb.from('products').update({view_count:(p.view_count||0)+1}).eq('id',pid);
    p.view_count=(p.view_count||0)+1;
    let isFav=false;
    if(currentUser){const{count}=await sb.from('favorites').select('*',{count:'exact',head:true}).eq('user_id',currentUser.id).eq('product_id',pid);isFav=count>0;}
    const isOwner=getMyId()===p.user_id, cat=CATEGORY_MAP[p.category]||{};
    let sn='匿名用户'; const{data:sp}=await sb.from('profiles').select('nickname').eq('id',p.user_id).maybeSingle(); if(sp)sn=sp.nickname||'用户';

    var galleryHTML = '';
    var images = p.images && p.images.length > 0 ? p.images : null;
    if (images) {
      var dotsHTML = images.map(function(_, i) {
        return '<div class="gallery-dot' + (i===0?' active':'') + '"></div>';
      }).join('');
      galleryHTML = '<div class="gallery-wrap" id="galleryWrap">' +
        '<div class="gallery-slider" id="gallerySlider" style="width:' + (images.length*100) + '%">' +
        images.map(function(src) {
          return '<div class="gallery-slide"><img src="' + src + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><span style="font-size:100px;display:none">' + (cat.emoji||'📦') + '</span></div>';
        }).join('') +
        '</div>' +
        '<div class="gallery-dots">' + dotsHTML + '</div>' +
        (images.length > 1 ? '<div class="gallery-arrow left" onclick="App.slideGallery(-1)">‹</div><div class="gallery-arrow right" onclick="App.slideGallery(1)">›</div>' : '') +
        '</div>';
    } else {
      galleryHTML = '<div class="gallery"><span style="font-size:100px">' + (cat.emoji||'📦') + '</span></div>';
    }

    document.getElementById('detailContent').innerHTML=
      galleryHTML +
      `<div class="detail-card"><div style="display:flex;align-items:flex-end;gap:10px"><span class="detail-price-main">¥${p.price}</span>${p.original_price?`<span class="detail-price-orig">原价 ¥${p.original_price}</span>`:''}</div>
      <div class="detail-title-text">${this.escapeHtml(p.title)}</div><div class="detail-tag-row"><span class="detail-tag green">${cat.label}</span><span class="detail-tag blue">${CONDITION_MAP[p.condition]||'正常'}</span><span style="font-size:12px;color:#999;margin-left:auto">👀 ${p.view_count}次浏览 · ${this.timeAgo(p.created_at)}</span></div></div>
      <div class="seller-card"><div class="seller-left"><div class="seller-avatar">👤</div><div><div class="seller-name">${this.escapeHtml(sn)}</div><div class="seller-badge">已认证</div></div></div>${!isOwner?`<button class="btn-sm-outline" onclick="App.navTo('chat','${p.user_id}')">联系卖家</button>`:`<button class="btn-sm-outline" onclick="App.navTo('edit','${p.id}')">✏️ 编辑</button>`}</div>
      <div class="detail-desc-card"><div class="detail-desc-title">📝 商品描述</div><div class="detail-desc-text">${this.escapeHtml(p.description||'卖家很懒，什么都没写~').replace(/\n/g,'<br>')}</div></div>
      ${!isOwner?`<div style="text-align:right;padding:0 16px 8px"><span style="font-size:11px;color:#ccc;cursor:pointer" onclick="App.reportProduct('${p.id}')">🚩 举报</span></div>`:''}`;
    document.getElementById('detailBottom').innerHTML=currentUser?(isOwner?`
      <button class="btn-fav ${isFav?'liked':''}" onclick="App.toggleFav()"><span>${isFav?'❤️':'🤍'}</span><span class="lbl">收藏</span></button>
      <button class="btn-primary" onclick="App.toggleProductStatus('${p.id}')">${p.status==='selling'?'🏷️ 标记为已售':'🔄 重新上架'}</button>`
      :`<button class="btn-fav ${isFav?'liked':''}" onclick="App.toggleFav()"><span>${isFav?'❤️':'🤍'}</span><span class="lbl">收藏</span></button>
      <button class="btn-primary" onclick="App.navTo('chat','${p.user_id}')">💬 我想要</button>`)
      :`<button class="btn-primary" style="width:100%" onclick="App.showAuth('login')">登录后联系卖家</button>`;
    this._detailImages = images;
    this._detailImgIdx = 0;
    this.setupGallerySwipe();
  },

  slideGallery(dir) {
    if (!this._detailImages) return;
    var newIdx = this._detailImgIdx + dir;
    if (newIdx < 0 || newIdx >= this._detailImages.length) return;
    this._detailImgIdx = newIdx;
    this.updateGalleryPosition();
  },

  updateGalleryPosition() {
    var slider = document.getElementById('gallerySlider');
    var dots = document.querySelectorAll('#galleryWrap .gallery-dot');
    if (slider) slider.style.transform = 'translateX(-' + (this._detailImgIdx * 100 / (this._detailImages?this._detailImages.length:1)) + '%)';
    if (dots) dots.forEach(function(d, i) { d.classList.toggle('active', i === App._detailImgIdx); });
  },

  setupGallerySwipe() {
    var wrap = document.getElementById('galleryWrap');
    if (!wrap || !this._detailImages || this._detailImages.length < 2) return;
    var sx = 0, swiping = false;
    wrap.addEventListener('touchstart', function(e) { sx = e.touches[0].clientX; swiping = true; }, {passive:true});
    wrap.addEventListener('touchmove', function(e) { if (!swiping) return; }, {passive:true});
    wrap.addEventListener('touchend', function(e) {
      if (!swiping) return; swiping = false;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) App.slideGallery(dx < 0 ? 1 : -1);
    });
  },

  async toggleFav() {
    if(!currentUser){this.toast('请先登录');return;} const pid=this.currentDetailId;
    const{data:existing}=await sb.from('favorites').select('id').eq('user_id',currentUser.id).eq('product_id',pid).maybeSingle();
    if(existing){await sb.from('favorites').delete().eq('id',existing.id);this.toast('已取消收藏');}else{await sb.from('favorites').insert({user_id:currentUser.id,product_id:pid});this.toast('已收藏');}
    this.renderDetail(pid);
  },
  async toggleProductStatus(id) {
    const{data:p}=await sb.from('products').select('status').eq('id',id).maybeSingle(); if(!p)return;
    const ns=p.status==='selling'?'sold':'selling'; await sb.from('products').update({status:ns}).eq('id',id);
    this.toast(ns==='sold'?'已标记为已售':'已重新上架'); this.renderDetail(id);
  },

  async reportProduct(productId) {
    const reason=prompt('请输入举报原因（如：虚假信息、违禁品、其他）：'); if(!reason||!reason.trim())return;
    if(!currentUser){this.toast('请先登录');return;}
    const{error}=await sb.from('reports').insert({reporter_id:currentUser.id,product_id:productId,reason:reason.trim()});
    if(error){this.toast('举报失败: '+error.message);return;} this.toast('举报已提交，我们会尽快处理');
  },

  // ==================== PUBLISH ====================
  renderPublish() {
    this._editingProduct = null;
    if(!currentUser){document.getElementById('publishContent').innerHTML=`<div class="empty"><div class="empty-icon">📦</div><div class="empty-desc">请先登录后再发布</div><button class="btn-primary" style="width:auto;padding:8px 30px;margin:0" onclick="App.showAuth('login')">去登录</button></div>`;return;}
    this.pubImages=[];
    document.getElementById('publishContent').innerHTML = this.pubFormHTML('', '', '', '', '', 'other', 0);
    document.getElementById('pubTitle').value=''; document.getElementById('pubDesc').value='';
    document.getElementById('pubPrice').value=''; document.getElementById('pubOrigPrice').value='';
  },

  pubFormHTML(title, desc, price, origPrice, cat, condition, btnText) {
    btnText = btnText || '✨ 立即发布';
    var isSell = this.pubType === 'sell';
    return isSell ? `
      <div class="form-block"><label class="form-label">商品图片</label><div class="upload-row" id="uploadRow">
        ${this.pubImages.map((f,i)=>`<div class="upload-preview" style="background-image:url(${typeof f==='string'?f:URL.createObjectURL(f)})"><div class="upload-remove" onclick="App.removeImage(${i})">×</div></div>`).join('')}
        <div class="upload-box" onclick="App.pickImage()"><span style="font-size:32px">+</span><span style="font-size:11px;margin-top:4px">添加图片</span></div></div>
        <div style="font-size:11px;color:#999;margin-top:8px" id="uploadProgress"></div></div>
      <div class="form-block"><label class="form-label">商品标题</label><input class="form-input" id="pubTitle" placeholder="写一个吸引人的标题吧~" value="${this.escapeAttr(title)}"></div>
      <div class="form-block"><label class="form-label">商品描述</label><textarea class="form-textarea" id="pubDesc" placeholder="描述一下成色、使用情况等...">${this.escapeHtml(desc)}</textarea></div>
      <div style="display:flex;gap:12px;margin:0 16px"><div class="form-block" style="flex:1;margin:0"><label class="form-label">售价 (元)</label><input class="form-input" id="pubPrice" type="number" placeholder="0.00" min="0.01" max="9999" step="0.01" value="${price}"></div><div class="form-block" style="flex:1;margin:0"><label class="form-label">原价 (元)</label><input class="form-input" id="pubOrigPrice" type="number" placeholder="选填" min="0" max="9999" step="0.01" value="${origPrice}"></div></div>
      <div class="form-block"><label class="form-label">分类</label><select class="form-select" id="pubCat">${Object.entries(CATEGORY_MAP).map(([k,v])=>`<option value="${k}" ${k===cat?'selected':''}>${v.emoji} ${v.label}</option>`).join('')}</select></div>
      <div class="form-block"><label class="form-label">成色</label><select class="form-select" id="pubCondition">${CONDITION_MAP.map((c,i)=>`<option value="${i}" ${i===condition?'selected':''}>${c}</option>`).join('')}</select></div>
      <button class="btn-submit" onclick="App.submitPublish()" id="pubSubmitBtn">${btnText}</button>`
    : `<div class="form-block"><label class="form-label">求购物品</label><input class="form-input" id="wantTitle" placeholder="比如：二手自行车" value="${this.escapeAttr(title)}"></div>
      <div class="form-block"><label class="form-label">详细描述</label><textarea class="form-textarea" id="wantDesc" placeholder="说说你的具体需求...">${this.escapeHtml(desc)}</textarea></div>
      <div class="form-block"><label class="form-label">预算 (元)</label><input class="form-input" id="wantBudget" type="number" placeholder="0.00" min="0.01" max="9999" step="0.01" value="${price}"></div>
      <div class="form-block"><label class="form-label">分类</label><select class="form-select" id="wantCat">${Object.entries(CATEGORY_MAP).map(([k,v])=>`<option value="${k}" ${k===cat?'selected':''}>${v.emoji} ${v.label}</option>`).join('')}</select></div>
      <button class="btn-submit" onclick="App.submitWant()">✨ 发布求购</button>`;
  },

  switchPubTab(type){this.pubType=type;document.querySelectorAll('#page-publish .pub-tab').forEach((t,i)=>{t.classList.toggle('active',(i===0&&type==='sell')||(i===1&&type==='want'));});this.renderPublish();},
  pickImage(){const i=document.createElement('input');i.type='file';i.accept='image/*';i.multiple=true;i.onchange=e=>{Array.from(e.target.files).forEach(f=>{this.pubImages.push(f);});this.renderPublish();};i.click();},
  removeImage(i){this.pubImages.splice(i,1);this.renderPublish();},

  async uploadImages() {
    if(this.pubImages.length===0)return[];
    const urls=[],pe=document.getElementById('uploadProgress');
    for(let i=0;i<this.pubImages.length;i++){
      const f=this.pubImages[i]; if(typeof f==='string'){urls.push(f);continue;}
      if(pe)pe.textContent=`压缩上传中 ${i+1}/${this.pubImages.length}...`;
      const compressed = await compressImage(f);
      const fp=`${getMyId()}/${Date.now()}_${compressed.name||'image.jpg'}`;
      const{error}=await sb.storage.from(STORAGE_BUCKET).upload(fp,compressed,{upsert:false});
      if(error){console.warn('图片上传失败:',error.message);continue;}
      const{data:ud}=sb.storage.from(STORAGE_BUCKET).getPublicUrl(fp);
      if(ud?.publicUrl)urls.push(ud.publicUrl);
    }
    if(pe)pe.textContent=urls.length>0?`✓ 已上传 ${urls.length} 张图片`:'';
    return urls;
  },

  async submitPublish() {
    if(!currentUser){this.toast('请先登录');return;}
    const title=document.getElementById('pubTitle')?.value.trim(), price=parseFloat(document.getElementById('pubPrice')?.value);
    if(!title)return this.toast('请输入商品标题');
    const bannedInTitle = hasSensitiveWord(title);
    if(bannedInTitle){this.toast(`标题包含敏感词"${bannedInTitle}"，请修改`);return;}
    const desc = document.getElementById('pubDesc')?.value.trim()||'';
    const bannedInDesc = hasSensitiveWord(desc);
    if(bannedInDesc){this.toast(`描述包含敏感词"${bannedInDesc}"，请修改`);return;}
    if(!price||price<0.01)return this.toast('价格最低0.01元'); if(price>9999)return this.toast('价格最高9999元');
    const btn=document.getElementById('pubSubmitBtn'); btn.disabled=true; btn.textContent='发布中...';
    const imageUrls=await this.uploadImages();
    const data={
      title, price,
      original_price: parseFloat(document.getElementById('pubOrigPrice')?.value)||null,
      category: document.getElementById('pubCat')?.value||'other',
      condition: parseInt(document.getElementById('pubCondition')?.value)||0,
      description: desc
    };
    if (imageUrls.length > 0) data.images = imageUrls;
    var error;
    if (this._editingProduct) {
      var{error:err}=await sb.from('products').update(data).eq('id', this._editingProduct.id).eq('user_id', currentUser.id);
      error = err;
    } else {
      data.user_id = currentUser.id;
      data.status = 'selling';
      data.view_count = 0;
      var{error:err}=await sb.from('products').insert(data);
      error = err;
    }
    btn.disabled=false; btn.textContent=this._editingProduct?'💾 保存修改':'✨ 立即发布';
    if(error){this.toast((this._editingProduct?'保存':'发布')+'失败: '+error.message);return;}
    this.pubImages=[]; this._editingProduct=null;
    this.toast(this._editingProduct?'保存成功！':'发布成功！');
    setTimeout(()=>this.navTo('home'),800);
  },

  async submitWant() {
    if(!currentUser){this.toast('请先登录');return;}
    const title=document.getElementById('wantTitle')?.value.trim(),budget=parseFloat(document.getElementById('wantBudget')?.value);
    if(!title)return this.toast('请输入求购物品');
    const bannedInTitle = hasSensitiveWord(title);
    if(bannedInTitle){this.toast(`标题包含敏感词"${bannedInTitle}"，请修改`);return;}
    const desc = document.getElementById('wantDesc')?.value.trim()||'';
    const bannedInDesc = hasSensitiveWord(desc);
    if(bannedInDesc){this.toast(`描述包含敏感词"${bannedInDesc}"，请修改`);return;}
    if(!budget||budget<0.01)return this.toast('预算最低0.01元'); if(budget>9999)return this.toast('预算最高9999元');
    const{error}=await sb.from('want_buys').insert({user_id:currentUser.id,title,budget,category:document.getElementById('wantCat')?.value||'other',description:desc,status:'active'});
    if(error){this.toast('发布失败: '+error.message);return;} this.toast('求购发布成功！'); setTimeout(()=>this.navTo('home'),800);
  },

  // ==================== EDIT ====================
  async renderEdit(pid) {
    if(!currentUser){this.toast('请先登录');return;}
    const{data:p}=await sb.from('products').select('*').eq('id',pid).maybeSingle();
    if(!p){this.toast('商品不存在');return;}
    if(p.user_id !== currentUser.id){this.toast('只能编辑自己的商品');return;}
    this._editingProduct = p;
    this.pubImages = (p.images||[]).map(function(u){return u;});
    this.pubType = 'sell';
    this.currentPage = 'edit';
    document.querySelectorAll('.page').forEach(function(pg){pg.classList.remove('active');});
    var el = document.getElementById('page-publish');
    if (el) el.classList.add('active');
    document.querySelectorAll('.tab-bar').forEach(function(t){t.style.display='none';});
    document.querySelectorAll('#page-publish .pub-tab').forEach(function(t,i){t.classList.toggle('active', i===0);});
    document.getElementById('publishContent').innerHTML = this.pubFormHTML(
      p.title, p.description||'', String(p.price||''), String(p.original_price||''),
      p.category, p.condition||0, '💾 保存修改'
    );
  },

  // ==================== MESSAGES ====================
  async renderMessages() {
    if(!currentUser){document.getElementById('messagesContent').innerHTML=`<div class="empty"><div class="empty-icon">💬</div><div class="empty-desc">登录后可查看消息</div><button class="btn-primary" style="width:auto;padding:8px 30px;margin:0" onclick="App.showAuth('login')">去登录</button></div>`;return;}
    const{data:messages}=await sb.from('messages').select('*').or(`from_user.eq.${currentUser.id},to_user.eq.${currentUser.id}`).order('created_at',{ascending:false});
    if(!messages||messages.length===0){document.getElementById('messagesContent').innerHTML=`<div class="empty"><div class="empty-icon">💬</div><div class="empty-desc">暂无消息</div></div>`;return;}
    const cm={};for(const m of messages){const p=m.from_user===currentUser.id?m.to_user:m.from_user;if(!cm[p])cm[p]={msgs:[],unread:0};cm[p].msgs.push(m);if(m.to_user===currentUser.id&&!m.is_read)cm[p].unread++;}
    const pids=Object.keys(cm);const{data:profiles}=await sb.from('profiles').select('id,nickname').in('id',pids);const pm={};if(profiles)profiles.forEach(p=>{pm[p.id]=p;});
    const convs=Object.entries(cm).map(([id,d])=>{const lm=d.msgs[0],pr=pm[id]||{};return{id,name:pr.nickname||'用户',lastMsg:lm.content,time:lm.created_at,unread:d.unread};});
    convs.sort((a,b)=>new Date(b.time)-new Date(a.time));
    document.getElementById('messagesContent').innerHTML=convs.map(c=>`<div class="msg-item fade-in" onclick="App.navTo('chat','${c.id}')"><div class="msg-avatar" style="background:${AVATAR_COLORS[Math.abs(c.id.charCodeAt(0)||0)%5]}">👤${c.unread?'<div class="msg-dot"></div>':''}</div><div class="msg-body"><div class="msg-top"><span class="msg-name">${this.escapeHtml(c.name)}</span><span class="msg-time">${this.timeAgo(c.time)}</span></div><div class="msg-bottom"><span class="msg-preview">${this.escapeHtml(c.lastMsg)}</span>${c.unread?`<span class="msg-badge">${c.unread}</span>`:''}</div></div></div>`).join('');
  },

  async openChat(pid) {
    if(!currentUser)return; this.currentChatUser=pid;
    const{data:p}=await sb.from('profiles').select('nickname').eq('id',pid).maybeSingle();
    document.getElementById('chatTitle').textContent=p?.nickname||'用户';
    await sb.from('messages').update({is_read:true}).eq('from_user',pid).eq('to_user',currentUser.id).eq('is_read',false);
    this.renderChatMessages();
    setTimeout(()=>{const a=document.getElementById('chatArea');if(a)a.scrollTop=a.scrollHeight;},100);
  },

  async renderChatMessages() {
    if(!currentUser)return;
    const{data:messages}=await sb.from('messages').select('*').or(`and(from_user.eq.${currentUser.id},to_user.eq.${this.currentChatUser}),and(from_user.eq.${this.currentChatUser},to_user.eq.${currentUser.id})`).order('created_at',{ascending:true});
    const area=document.getElementById('chatArea'); if(!area)return;
    if(!messages||messages.length===0){area.innerHTML=`<div style="text-align:center;color:#999;padding:40px">开始聊天吧~</div>`;return;}
    area.innerHTML=messages.map((m,i)=>{
      const isMine=m.from_user===currentUser.id,
            prev=i>0?messages[i-1]:null,
            isLastMine=i===messages.length-1||(i+1<messages.length&&messages[i+1].from_user!==currentUser.id),
            showDate=!prev||(new Date(m.created_at)-new Date(prev.created_at))>1800000,
            dateHtml=showDate?`<div class="chat-date"><span>${this.formatTime(m.created_at)}</span></div>`:'';
      var lastSent = isMine && i===messages.length-1;
      for (var j=i+1; j<messages.length; j++) { if (messages[j].from_user===currentUser.id) { lastSent=false; break; } }
      var statusHTML = (isMine && lastSent) ?
        `<div class="chat-status">${m.is_read?'✓ 已读':'✓ 已发送'}</div>` : '';
      return dateHtml+`<div class="chat-row ${isMine?'mine':''}"><div class="chat-avatar-sm" style="background:${isMine?'#d4e4ff':AVATAR_COLORS[Math.abs(this.currentChatUser.charCodeAt(0)||0)%5]}">${isMine?'👤':'🙋'}</div><div class="chat-bubble-wrap"><div class="chat-bubble ${isMine?'mine':'other'}">${this.escapeHtml(m.content)}</div>${statusHTML}</div></div>`;
    }).join('');
    setTimeout(()=>{area.scrollTop=area.scrollHeight;},50);
  },

  async sendChat() {
    if(!currentUser){this.toast('请先登录');return;} const input=document.getElementById('chatInputField'),text=input.value.trim(); if(!text)return;
    const bannedInMsg = hasSensitiveWord(text);
    if(bannedInMsg){this.toast(`消息包含敏感词，请修改`);return;}
    const{error}=await sb.from('messages').insert({from_user:currentUser.id,to_user:this.currentChatUser,content:text,is_read:false});
    if(error){this.toast('发送失败: '+error.message);return;} input.value=''; await this.renderChatMessages();
    setTimeout(()=>{const a=document.getElementById('chatArea');if(a)a.scrollTop=a.scrollHeight;},50);
  },

  // ==================== SEARCH ====================
  renderSearchHistory(){const h=LocalStore.get('searchHistory',[]);document.getElementById('historyTags').innerHTML=h.map(x=>`<div class="history-tag" onclick="App.searchThis('${x}')">${x}</div>`).join('');},
  searchThis(kw){document.getElementById('searchInput').value=kw;this.doSearch(kw);},
  clearHistory(){LocalStore.set('searchHistory',[]);this.renderSearchHistory();},
  async doSearch(kw){if(!kw||kw.length<1){document.getElementById('searchResults').innerHTML='';return;}let h=LocalStore.get('searchHistory',[]).filter(x=>x!==kw);h.unshift(kw);if(h.length>10)h=h.slice(0,10);LocalStore.set('searchHistory',h);const{data:products}=await sb.from('products').select('*').eq('status','selling').ilike('title',`%${kw}%`).order('created_at',{ascending:false}).limit(PAGE_SIZE);document.getElementById('searchResults').innerHTML=(products||[]).map((p,i)=>this.productCard(p,i)).join('');if(!products||products.length===0){document.getElementById('searchResults').innerHTML=`<div class="empty"><div class="empty-icon">🔍</div><div class="empty-desc">没有找到"${kw}"相关商品</div></div>`;}this.renderSearchHistory();},

  // ==================== FAVORITES ====================
  async renderFavorites() {
    if(!currentUser){document.getElementById('favList').innerHTML='';document.getElementById('favEmpty').style.display='flex';return;}
    const{data:favs}=await sb.from('favorites').select('product_id').eq('user_id',currentUser.id);
    if(!favs||favs.length===0){document.getElementById('favList').innerHTML='';document.getElementById('favEmpty').style.display='flex';return;}
    const pids=favs.map(f=>f.product_id);const{data:products}=await sb.from('products').select('*').in('id',pids);
    document.getElementById('favList').innerHTML=(products||[]).map((p,i)=>this.productCard(p,i)).join('');
    document.getElementById('favEmpty').style.display=products?.length===0?'flex':'none';
  },

  // ==================== MY PUBLISH ====================
  switchMyTab(tab){this.myPubTab=tab;document.querySelectorAll('#page-mypublish .pub-tab').forEach((t,i)=>{t.classList.toggle('active',(i===0&&tab==='selling')||(i===1&&tab==='sold')||(i===2&&tab==='all'));});this.renderMyPublish();},
  async renderMyPublish() {
    if(!currentUser){document.getElementById('myPubList').innerHTML='';document.getElementById('myPubEmpty').style.display='flex';return;}
    let q=sb.from('products').select('*').eq('user_id',currentUser.id);
    if(this.myPubTab==='selling')q=q.eq('status','selling');else if(this.myPubTab==='sold')q=q.eq('status','sold');
    q=q.order('created_at',{ascending:false});const{data:products}=await q;
    document.getElementById('myPubList').innerHTML=(products||[]).map((p,i)=>this.productCard(p,i)).join('');
    document.getElementById('myPubEmpty').style.display=!products||products.length===0?'flex':'none';
  },

  // ==================== AUTH ====================
  showAuth(mode){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById('page-auth').classList.add('active');document.querySelectorAll('.tab-bar').forEach(t=>t.style.display='none');document.getElementById('authTitle').textContent=mode==='login'?'登录':'注册';document.getElementById('authFormLogin').style.display=mode==='login'?'block':'none';document.getElementById('authFormRegister').style.display=mode==='register'?'block':'none';},
  closeAuth(){document.getElementById('page-auth').classList.remove('active');this.navTo('user');},

  async doLogin() {
    const email=document.getElementById('loginEmail')?.value.trim(),pass=document.getElementById('loginPass')?.value;
    if(!email||!pass)return this.toast('请输入邮箱和密码');
    const{data,error}=await sb.auth.signInWithPassword({email,password:pass});
    if(error){this.toast(error.message==='Invalid login credentials'?'邮箱或密码错误':error.message);return;}
    currentUser=data.user; await loadProfile(); subscribeMessages(); this.toast('登录成功！'); this.closeAuth();
  },

  async doRegister() {
    const email=document.getElementById('regEmail')?.value.trim(),pass=document.getElementById('regPass')?.value,nickname=document.getElementById('regNickname')?.value.trim(),schoolId=document.getElementById('regSchoolId')?.value.trim();
    if(!email||!pass)return this.toast('请输入邮箱和密码'); if(pass.length<6)return this.toast('密码至少6位'); if(!nickname)return this.toast('请输入昵称');
    if(!this.validateNickname(nickname))return;
    const domain='@'+(email.split('@')[1]||'');
    if(domain.toLowerCase()!==SCHOOL_DOMAIN.toLowerCase())return this.toast('请使用学校邮箱注册 ('+SCHOOL_DOMAIN+')');
    const btn=document.getElementById('regBtn'); btn.disabled=true; btn.textContent='注册中...';
    const{data,error}=await sb.auth.signUp({email,password:pass,options:{data:{nickname}}});
    if(error){btn.disabled=false;btn.textContent='注册';this.toast(error.message);return;}
    if(data.user&&schoolId){await sb.from('profiles').upsert({id:data.user.id,school_id:schoolId,nickname},{onConflict:'id'});}
    btn.disabled=false; btn.textContent='注册';
    if(data.user&&!data.session){this.toast('注册成功！请查收邮箱验证邮件后登录。');this.showAuth('login');}
    else{this.toast('注册成功！');currentUser=data.user;await loadProfile();subscribeMessages();this.closeAuth();}
  },

  async logout() {
    if(msgChannel){sb.removeChannel(msgChannel);msgChannel=null;}
    await sb.auth.signOut(); currentUser=null; currentProfile=null; this.updateUserUI(); this.toast('已退出登录');
  },

  async updateUserUI() {
    if(currentUser&&currentProfile){
      document.getElementById('userName').textContent=currentProfile.nickname||'用户';
      document.getElementById('userSubInfo').textContent=currentProfile.school_id?'学号: '+currentProfile.school_id:currentUser.email;
      document.getElementById('userAvatar').textContent='👤';document.getElementById('logoutSection').style.display='block';document.getElementById('userActionArea').innerHTML='';
      document.getElementById('adminMenuRow').style.display=currentProfile.is_admin?'flex':'none';
      try{const{count:sc}=await sb.from('products').select('*',{count:'exact',head:true}).eq('user_id',currentUser.id).eq('status','selling');const{count:soc}=await sb.from('products').select('*',{count:'exact',head:true}).eq('user_id',currentUser.id).eq('status','sold');const{count:fc}=await sb.from('favorites').select('*',{count:'exact',head:true}).eq('user_id',currentUser.id);document.getElementById('statSell').textContent=sc||0;document.getElementById('statSold').textContent=soc||0;document.getElementById('statFav').textContent=fc||0;}catch(e){console.warn('统计失败:',e.message);}
    }else{
      document.getElementById('userName').textContent='未登录';document.getElementById('userSubInfo').textContent='注册/登录后使用完整功能';document.getElementById('userAvatar').textContent='👤';document.getElementById('logoutSection').style.display='none';document.getElementById('statSell').textContent='0';document.getElementById('statSold').textContent='0';document.getElementById('statFav').textContent='0';document.getElementById('adminMenuRow').style.display='none';document.getElementById('userActionArea').innerHTML=`<button class="btn-primary" style="width:auto;padding:10px 40px;margin:0" onclick="App.showAuth('login')">📧 邮箱登录 / 注册</button>`;
    }
  },

  buildTabBars(){const t=a=>[{page:'home',icon:'🏠',label:'逛一逛'},{page:'publish',icon:'',label:'',center:true},{page:'messages',icon:'💬',label:'消息'},{page:'user',icon:'👤',label:'我的'}].map(x=>{if(x.center)return`<div class="tab-publish" onclick="App.navTo('publish')">＋</div>`;return`<div class="tab-item ${x.page===a?'active':''}" onclick="App.navTo('${x.page}')"><span class="icon">${x.icon}</span><span>${x.label}</span></div>`;}).join('');document.getElementById('tabHome').innerHTML=t('home');document.getElementById('tabPublish').innerHTML=t('publish');document.getElementById('tabMessages').innerHTML=t('messages');document.getElementById('tabUser').innerHTML=t('user');},

  timeAgo(ts){const d=Date.now()-new Date(ts).getTime();if(d<6e4)return'刚刚';if(d<36e5)return Math.floor(d/6e4)+'分钟前';if(d<864e5)return Math.floor(d/36e5)+'小时前';if(d<6048e5)return Math.floor(d/864e5)+'天前';return this.formatTime(ts);},
  formatTime(ts){const d=new Date(ts);return`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;},
  escapeHtml(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;},
  escapeAttr(s){return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');},
  validateNickname(nickname){
    const bannedWord = hasSensitiveWord(nickname);
    if(bannedWord){ this.toast(`昵称包含敏感词"${bannedWord}"，请修改`); return false; }
    if(nickname.length<2) { this.toast('昵称至少2个字符'); return false; }
    if(nickname.length>12) { this.toast('昵称最多12个字符'); return false; }
    if(!/^[一-龥a-zA-Z0-9_\-·]+$/.test(nickname)) { this.toast('昵称只能包含中文、英文、数字、下划线、连字符'); return false; }
    return true;
  },
  toast(m){const e=document.getElementById('toast');e.textContent=m;e.classList.add('show');clearTimeout(this._tt);this._tt=setTimeout(()=>e.classList.remove('show'),1800);},

  _assistantOpen:false,
  toggleAssistant(){this._assistantOpen=!this._assistantOpen;const p=document.getElementById('assistantPanel');if(p)p.classList.toggle('open',this._assistantOpen);},
  assistantReply(q){const b=document.getElementById('assistantBody'),um=document.createElement('div');um.className='assistant-msg user';um.textContent=q;b.appendChild(um);const bm=document.createElement('div');bm.className='assistant-msg bot';const a={'如何发布商品？':'点击底部中间的 <b>＋</b> 进入发布页，填写信息后发布即可。现在支持上传真实图片啦~','怎么联系卖家？':'在商品详情页点击 <b>"💬 我想要"</b> 即可和卖家实时聊天，消息即时推送！','如何注册账号？':'点击 <b>"我的"</b> → <b>"邮箱登录/注册"</b>，使用学校邮箱（@sxast.edu.cn）注册，填写学号完成认证。','交易安全吗？':'建议：<br>1️⃣ <b>校内当面交易</b><br>2️⃣ 仔细检查成色<br>3️⃣ 贵重物品保留凭证<br>4️⃣ 遇到问题使用<b>"举报"</b>功能','发布有什么规则？':'📋 规则：<br>• 禁止虚假信息<br>• 禁止违禁品/食品/药品<br>• 如实描述成色<br>• 已售及时标记','学校地址在哪？':'📍 山西应用科技学院<br>太原市小店区北格镇<br>建议在图书馆/食堂等公共区域交易~'};bm.innerHTML=a[q]||('收到你的问题："'+q+'"<br>点击下方快捷按钮或联系管理员获取帮助~');b.appendChild(bm);b.scrollTop=b.scrollHeight;},
  sendAssistant(){const i=document.getElementById('assistantInput'),t=i.value.trim();if(!t)return;i.value='';this.assistantReply(t);},

  // ==================== ADMIN ====================
  _adminTab:'reports',
  switchAdminTab(tab){this._adminTab=tab;document.querySelectorAll('#page-admin .pub-tab').forEach((t,i)=>{t.classList.toggle('active',(i===0&&tab==='reports')||(i===1&&tab==='products'));});this.renderAdmin();},
  async renderAdmin(){
    if(this._adminTab==='reports') await this.renderAdminReports();
    else await this.renderAdminProducts();
  },
  async renderAdminReports(){
    const container=document.getElementById('adminContent');
    const{data:reports,error}=await sb.from('reports').select('*').order('created_at',{ascending:false});
    if(error){container.innerHTML=`<div class="empty"><div class="empty-icon">🚩</div><div class="empty-desc">加载失败: ${error.message}</div></div>`;return;}
    if(!reports||reports.length===0){container.innerHTML=`<div class="empty"><div class="empty-icon">✅</div><div class="empty-title">暂无举报</div><div class="empty-desc">社区很和谐~</div></div>`;return;}
    const pids=[...new Set(reports.map(r=>r.product_id))];
    const{data:products}=await sb.from('products').select('id,title,status,user_id').in('id',pids);
    const pm={};if(products)products.forEach(p=>{pm[p.id]=p;});
    const uids=[...new Set([...reports.map(r=>r.reporter_id),...Object.values(pm).map(p=>p.user_id)])];
    const{data:profiles}=await sb.from('profiles').select('id,nickname').in('id',uids);
    const um={};if(profiles)profiles.forEach(p=>{um[p.id]=p;});
    container.innerHTML=reports.map(r=>{const p=pm[r.product_id]||{};return`
      <div class="admin-card fade-in">
        <div class="admin-card-header">
          <span class="admin-badge ${r.status==='pending'?'badge-pending':'badge-resolved'}">${r.status==='pending'?'待处理':'已处理'}</span>
          <span style="font-size:12px;color:#999">${this.timeAgo(r.created_at)}</span>
        </div>
        <div style="font-size:14px;margin:6px 0"><b>举报原因：</b>${this.escapeHtml(r.reason)}</div>
        <div style="font-size:13px;color:#666">商品：${this.escapeHtml(p.title||'已删除')} <span class="admin-tag">${p.status||'未知'}</span></div>
        <div style="font-size:12px;color:#999;margin-top:2px">举报人：${(um[r.reporter_id]||{}).nickname||'用户'} | 卖家：${(um[p.user_id]||{}).nickname||'用户'}</div>
        <div class="admin-actions">
          ${p.id?`<button class="admin-btn-sm danger" onclick="App.adminDeleteProduct('${p.id}')">🗑 删除商品</button>`:''}
          ${r.status==='pending'?`<button class="admin-btn-sm" onclick="App.resolveReport('${r.id}')">✓ 标记已处理</button>`:''}
        </div>
      </div>`;}).join('');
  },
  async resolveReport(id){
    const{error}=await sb.from('reports').update({status:'resolved'}).eq('id',id);
    if(error){this.toast('操作失败: '+error.message);return;}
    this.toast('已标记为已处理');this.renderAdminReports();
  },
  async adminDeleteProduct(id){
    if(!confirm('确定要删除这个商品吗？此操作不可撤销。'))return;
    const{error}=await sb.from('products').delete().eq('id',id);
    if(error){this.toast('删除失败: '+error.message);return;}
    this.toast('商品已删除');this.renderAdminReports();
  },
  async renderAdminProducts(){
    const container=document.getElementById('adminContent');
    container.innerHTML=`
      <div class="search-header">
        <input class="search-field" placeholder="搜索所有商品..." id="adminSearchInput" oninput="App.adminSearchProducts(this.value)">
      </div>
      <div class="feed" style="padding-top:12px"><div class="waterfall" id="adminProductList"></div></div>
      <div class="empty" id="adminProdEmpty" style="display:none"><div class="empty-icon">📦</div><div class="empty-desc">未找到商品</div></div>`;
    const{data:products}=await sb.from('products').select('*').order('created_at',{ascending:false}).limit(50);
    this._adminProducts=products||[];
    this.renderAdminProductCards(this._adminProducts);
  },
  renderAdminProductCards(products){
    const list=document.getElementById('adminProductList'),empty=document.getElementById('adminProdEmpty');
    if(!list)return;
    if(!products||products.length===0){list.innerHTML='';if(empty)empty.style.display='flex';return;}
    if(empty)empty.style.display='none';
    list.innerHTML=products.map(p=>{
      const cat=CATEGORY_MAP[p.category]||{};
      return`<div class="product-card" style="position:relative">
        <div class="product-img" onclick="App.navTo('detail','${p.id}')">${p.images&&p.images.length>0?`<img src="${p.images[0]}" class="product-img-real" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="product-img-emoji" style="font-size:50px;display:none">${cat.emoji||'📦'}</div>`:`<div class="product-img-emoji" style="font-size:50px">${cat.emoji||'📦'}</div>`}</div>
        <div class="product-body" onclick="App.navTo('detail','${p.id}')"><div class="product-title">${this.escapeHtml(p.title)}</div><div class="product-price"><span class="yen">¥</span>${p.price}</div><div class="product-footer"><span class="product-tag">${cat.label||''}</span><span class="product-meta">${p.status}</span></div></div>
        <button class="admin-del-fab" onclick="event.stopPropagation();App.adminDeleteProduct('${p.id}')" title="删除">🗑</button>
      </div>`;
    }).join('');
  },
  adminSearchProducts(kw){
    if(!this._adminProducts)return;
    if(!kw||kw.trim().length===0){this.renderAdminProductCards(this._adminProducts);return;}
    const q=kw.toLowerCase();
    this.renderAdminProductCards(this._adminProducts.filter(p=>p.title.toLowerCase().includes(q)));
  },
};

document.addEventListener('DOMContentLoaded',()=>App.init());
window.addEventListener('popstate',()=>{if(App.currentPage!=='home')App.navBack();});
window.App = App;

} catch (initErr) { dbg('❌ 错误: '+initErr.message); console.error(initErr); }
})();
