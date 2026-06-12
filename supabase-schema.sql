-- ============================================
-- 校园跳蚤市场 - Supabase 数据库 Schema
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================

-- 1. 商品表
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC NOT NULL CHECK (price > 0),
  original_price NUMERIC,
  images TEXT[] DEFAULT '{}',
  category TEXT DEFAULT 'other',
  condition INT DEFAULT 0,
  status TEXT DEFAULT 'selling' CHECK (status IN ('selling', 'sold', 'off')),
  view_count INT DEFAULT 0,
  fav_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 用户资料表
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  nickname TEXT,
  avatar_url TEXT,
  phone TEXT,
  school_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 收藏表
CREATE TABLE favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- 4. 消息表
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user UUID REFERENCES auth.users(id) NOT NULL,
  to_user UUID REFERENCES auth.users(id) NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 求购表
CREATE TABLE want_buys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  budget NUMERIC,
  category TEXT DEFAULT 'other',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'done')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ RLS 安全策略 ============
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE want_buys ENABLE ROW LEVEL SECURITY;

-- products: 所有人可读，仅本人可写
CREATE POLICY "products_read_all" ON products FOR SELECT USING (true);
CREATE POLICY "products_insert_own" ON products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "products_update_own" ON products FOR UPDATE USING (auth.uid() = user_id);

-- profiles: 所有人可读，仅本人可写
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- favorites: 仅本人可读写
CREATE POLICY "favorites_read_own" ON favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "favorites_insert_own" ON favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "favorites_delete_own" ON favorites FOR DELETE USING (auth.uid() = user_id);

-- messages: 收发双方可读，仅发送方可写
CREATE POLICY "messages_read_mine" ON messages FOR SELECT USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "messages_insert_own" ON messages FOR INSERT WITH CHECK (auth.uid() = from_user);
CREATE POLICY "messages_update_own" ON messages FOR UPDATE USING (auth.uid() = to_user);

-- want_buys: 所有人可读，仅本人可写
CREATE POLICY "want_buys_read_all" ON want_buys FOR SELECT USING (true);
CREATE POLICY "want_buys_insert_own" ON want_buys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "want_buys_update_own" ON want_buys FOR UPDATE USING (auth.uid() = user_id);

-- ============ 索引 ============
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_created ON products(created_at DESC);
CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_messages_users ON messages(from_user, to_user);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- 6. 举报表
CREATE TABLE reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES auth.users(id) NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ RLS 安全策略 ============
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
-- 登录用户可举报
CREATE POLICY "reports_insert_auth" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
-- 管理员可读所有举报（简化处理：本人可读自己的举报）
CREATE POLICY "reports_read_own" ON reports FOR SELECT USING (auth.uid() = reporter_id);

-- ============ Storage 存储桶 ============
-- 在 Supabase Dashboard → Storage 中手动创建 product-images 存储桶
-- 或者执行：
-- INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);
-- CREATE POLICY "storage_read_public" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
-- CREATE POLICY "storage_insert_auth" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.uid() = owner);

-- ============ 自动创建用户资料 ============
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nickname, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'nickname', NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
