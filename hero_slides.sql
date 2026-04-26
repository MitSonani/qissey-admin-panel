-- Hero Slides Table
CREATE TABLE IF NOT EXISTS hero_slides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  desktop_image_url TEXT NOT NULL,
  mobile_image_url TEXT,
  title TEXT,
  subtitle TEXT,
  link_url TEXT,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE hero_slides ENABLE ROW LEVEL SECURITY;

-- Allow public to read active slides
DROP POLICY IF EXISTS "Public can view active hero slides" ON hero_slides;
CREATE POLICY "Public can view active hero slides" ON hero_slides
  FOR SELECT USING (is_active = true);

-- Allow admins full access
DROP POLICY IF EXISTS "Admins can manage hero slides" ON hero_slides;
CREATE POLICY "Admins can manage hero slides" ON hero_slides
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );



-- Storage Policies for 'banners' bucket
-- Note: Re-run these if you manually created the bucket via the dashboard
INSERT INTO storage.buckets (id, name, public) 
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to view banners
CREATE POLICY "Public can view banners" ON storage.objects 
FOR SELECT USING (bucket_id = 'banners');

-- Allow admins to manage banners
CREATE POLICY "Admins can manage banners" ON storage.objects 
FOR ALL USING (
  bucket_id = 'banners' 
  AND (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  )
);
