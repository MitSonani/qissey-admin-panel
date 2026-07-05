-- Create product_measurements table
CREATE TABLE IF NOT EXISTS public.product_measurements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    size_chart JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(product_id)
);

-- Enable RLS
ALTER TABLE public.product_measurements ENABLE ROW LEVEL SECURITY;

-- Allow public read access
DROP POLICY IF EXISTS "Public can view product measurements" ON public.product_measurements;
CREATE POLICY "Public can view product measurements" ON public.product_measurements
    FOR SELECT USING (true);

-- Allow admins to manage product measurements
DROP POLICY IF EXISTS "Admins can insert product measurements" ON public.product_measurements;
CREATE POLICY "Admins can insert product measurements" ON public.product_measurements
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Admins can update product measurements" ON public.product_measurements;
CREATE POLICY "Admins can update product measurements" ON public.product_measurements
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Admins can delete product measurements" ON public.product_measurements;
CREATE POLICY "Admins can delete product measurements" ON public.product_measurements
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
