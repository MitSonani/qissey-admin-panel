-- Add status column to product_reviews table
ALTER TABLE public.product_reviews 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));

-- Update existing reviews to be approved if you want them visible by default
-- UPDATE public.product_reviews SET status = 'approved';

-- Policy 3: Allow admins to update product reviews
DROP POLICY IF EXISTS "Admins can update product reviews" ON public.product_reviews;
CREATE POLICY "Admins can update product reviews" ON public.product_reviews
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy 4: Allow admins to delete product reviews
DROP POLICY IF EXISTS "Admins can delete product reviews" ON public.product_reviews;
CREATE POLICY "Admins can delete product reviews" ON public.product_reviews
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );
