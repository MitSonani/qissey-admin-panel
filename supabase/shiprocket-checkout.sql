-- Add shiprocket_order_id column to track Shiprocket Checkout transactions
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS shiprocket_order_id TEXT UNIQUE;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS shiprocket_label_url TEXT;

-- Add shipping tracking columns for customer self-service
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS courier_name TEXT,
ADD COLUMN IF NOT EXISTS tracking_url TEXT;

-- Add index on shiprocket_order_id for fast status lookups and webhook handling
CREATE INDEX IF NOT EXISTS idx_orders_shiprocket_order_id 
ON public.orders(shiprocket_order_id);
