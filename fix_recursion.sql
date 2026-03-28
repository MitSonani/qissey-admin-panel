-- Fix Infinite Recursion in RLS Policies

-- 1. Create a secure function to check if the current user is an admin
-- SECURITY DEFINER means this function runs with the privileges of the creator (postgres/admin),
-- bypassing RLS on the profiles table for this specific check.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Profiles Policy
DROP POLICY IF EXISTS "Users can view own profile or admins view all" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR
    public.is_admin() -- Uses the secure function
  );

-- 3. Update Orders Policy
DROP POLICY IF EXISTS "Users can view own orders or admins view all" ON orders;
DROP POLICY IF EXISTS "Users can update own orders or admins update all" ON orders;

CREATE POLICY "Users can view own orders or admins view all" ON orders
  FOR SELECT USING (
    auth.uid() = customer_id
    OR
    public.is_admin()
  );

CREATE POLICY "Users can update own orders or admins update all" ON orders
  FOR UPDATE USING (
    auth.uid() = customer_id
    OR
    public.is_admin()
  );

-- 4. Update Order Items Policy
DROP POLICY IF EXISTS "Users can view own order items or admins view all" ON order_items;

CREATE POLICY "Users can view own order items or admins view all" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (
        orders.customer_id = auth.uid()
        OR
        public.is_admin()
      )
    )
  );
