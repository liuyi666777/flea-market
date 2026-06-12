-- ============================================
-- 信誉评分系统 + profiles 扩展
-- 在 Supabase SQL Editor 中执行
-- ============================================

-- 1. 评分表
CREATE TABLE IF NOT EXISTS ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user UUID REFERENCES auth.users(id) NOT NULL,
  to_user UUID REFERENCES auth.users(id) NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  score INT CHECK (score >= 1 AND score <= 5) NOT NULL,
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_user, to_user, product_id)
);

-- 2. profiles 添加评分字段
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rating_count INT DEFAULT 0;

-- 3. RLS for ratings
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings_read_all" ON ratings FOR SELECT USING (true);
CREATE POLICY "ratings_insert_own" ON ratings FOR INSERT WITH CHECK (auth.uid() = from_user);

-- 4. 自动更新用户平均评分函数
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_r NUMERIC;
  cnt INT;
BEGIN
  SELECT AVG(score), COUNT(*) INTO avg_r, cnt
  FROM ratings WHERE to_user = NEW.to_user;
  UPDATE profiles SET rating = COALESCE(avg_r, 0), rating_count = cnt
  WHERE id = NEW.to_user;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_rating_inserted ON ratings;
CREATE TRIGGER on_rating_inserted
  AFTER INSERT ON ratings
  FOR EACH ROW EXECUTE FUNCTION update_user_rating();
