-- ============================================
-- 修复：Storage 公开访问 + Realtime 推送
-- 在 Supabase SQL Editor 中执行
-- ============================================

-- 1. 确保 product-images bucket 存在且公开
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 5242880, '{image/*}')
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage RLS: 允许所有人读取图片
DROP POLICY IF EXISTS "storage_read_public" ON storage.objects;
CREATE POLICY "storage_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

-- 3. Storage RLS: 允许登录用户上传 (如果已存在则跳过报错)
DROP POLICY IF EXISTS "storage_insert_auth" ON storage.objects;
CREATE POLICY "storage_insert_auth" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- 4. 启用 messages 表的 Realtime 推送 (关键修复)
BEGIN;
  -- 检查表中是否有缺失的 replica identity
  ALTER TABLE messages REPLICA IDENTITY FULL;

  -- 加入 supabase_realtime 发布
  DO $$
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'messages already in publication';
  END;
  $$;
COMMIT;
