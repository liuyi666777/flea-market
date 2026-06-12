-- ============================================
-- 校园跳蚤市场 - 管理员功能 Migration
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================

-- 1. 给 profiles 表添加 is_admin 字段
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. 创建管理员检查函数 (SECURITY DEFINER 绕过 RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  _is_admin BOOLEAN;
BEGIN
  SELECT p.is_admin INTO _is_admin
  FROM profiles p
  WHERE p.id = auth.uid();
  RETURN COALESCE(_is_admin, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 管理员 RLS 策略 — products
-- 管理员可以更新任何商品
DROP POLICY IF EXISTS "admin_update_any" ON products;
CREATE POLICY "admin_update_any" ON products
  FOR UPDATE USING (is_admin());

-- 管理员可以删除任何商品
DROP POLICY IF EXISTS "admin_delete_any" ON products;
CREATE POLICY "admin_delete_any" ON products
  FOR DELETE USING (is_admin());

-- 4. 管理员 RLS 策略 — reports
-- 管理员可以查看所有举报
DROP POLICY IF EXISTS "reports_read_admin" ON reports;
CREATE POLICY "reports_read_admin" ON reports
  FOR SELECT USING (is_admin());

-- 管理员可以更新举报状态
DROP POLICY IF EXISTS "reports_update_admin" ON reports;
CREATE POLICY "reports_update_admin" ON reports
  FOR UPDATE USING (is_admin());

-- 5. 管理员 RLS 策略 — profiles (管理员可读取所有)
DROP POLICY IF EXISTS "profiles_read_admin" ON profiles;
-- profiles_read_all 已经存在，但确保管理员也能读
-- 无需额外策略

-- 6. 设置第一个管理员 (执行前替换为你的邮箱)
-- 先用邮箱注册一个账号，然后在 Supabase Dashboard → SQL Editor 中执行:
-- UPDATE profiles SET is_admin = TRUE
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'your_email@sxast.edu.cn');
