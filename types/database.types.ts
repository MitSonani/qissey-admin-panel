export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            categories: {
                Row: {
                    id: string
                    name: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    created_at?: string
                }
            }
            products: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    price: number
                    discount_price: number | null
                    category_id: string | null
                    sizes: string[]
                    colors: string[]
                    stock_quantity: number
                    image_urls: string[]
                    status: 'active' | 'inactive'
                    new_arrival: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    description?: string | null
                    price: number
                    discount_price?: number | null
                    category_id?: string | null
                    sizes?: string[]
                    colors?: string[]
                    stock_quantity: number
                    image_urls?: string[]
                    status?: 'active' | 'inactive'
                    new_arrival?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    description?: string | null
                    price?: number
                    discount_price?: number | null
                    category_id?: string | null
                    sizes?: string[]
                    colors?: string[]
                    stock_quantity?: number
                    image_urls?: string[]
                    status?: 'active' | 'inactive'
                    new_arrival?: boolean
                    created_at?: string
                }
            }
            customers: { // Note: 'customers' seems to be what 'profiles' is mapped to in some contexts, but let's check the file content again. The file shows 'customers' table in the previous `view_file`.
                // Wait, I need to check if 'profiles' table is in `database.types.ts`.
                // The previous `view_file` of `database.types.ts` showed `customers` table but NOT `profiles`.
                // However, `supabase_schema.sql` has `profiles`.
                // Accessing `database.types.ts` again to be sure.

                Row: {
                    id: string
                    name: string
                    email: string
                    phone: string | null
                    total_orders: number
                    total_spent: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    email: string
                    phone?: string | null
                    total_orders?: number
                    total_spent?: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    email?: string
                    phone?: string | null
                    total_orders?: number
                    total_spent?: number
                    created_at?: string
                }
            }
            profiles: {
                Row: {
                    id: string
                    name: string | null
                    email: string
                    phone: string | null
                    role: 'user' | 'admin'
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    name?: string | null
                    email: string
                    phone?: string | null
                    role?: 'user' | 'admin'
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    name?: string | null
                    email?: string
                    phone?: string | null
                    role?: 'user' | 'admin'
                    created_at?: string
                    updated_at?: string
                }
            }
            orders: {
                Row: {
                    id: string
                    customer_id: string | null
                    customer_name: string
                    customer_email: string
                    customer_phone: string | null
                    total_amount: number
                    currency: string
                    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned'
                    payment_status: 'paid' | 'unpaid' | 'failed' | 'refunded'
                    payment_method: string | null
                    shipping_address: Json | null
                    billing_address: Json | null
                    razorpay_order_id: string | null
                    shiprocket_order_id: string | null
                    shiprocket_shipment_id: string | null
                    shiprocket_awb: string | null
                    shiprocket_label_url: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    customer_id?: string | null
                    customer_name: string
                    customer_email: string
                    customer_phone?: string | null
                    total_amount: number
                    currency?: string
                    status?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned'
                    payment_status?: 'paid' | 'unpaid' | 'failed' | 'refunded'
                    payment_method?: string | null
                    shipping_address?: Json | null
                    billing_address?: Json | null
                    razorpay_order_id?: string | null
                    shiprocket_order_id?: string | null
                    shiprocket_shipment_id?: string | null
                    shiprocket_awb?: string | null
                    shiprocket_label_url?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    customer_id?: string | null
                    customer_name?: string
                    customer_email?: string
                    customer_phone?: string | null
                    total_amount?: number
                    currency?: string
                    status?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned'
                    payment_status?: 'paid' | 'unpaid' | 'failed' | 'refunded'
                    payment_method?: string | null
                    shipping_address?: Json | null
                    billing_address?: Json | null
                    razorpay_order_id?: string | null
                    shiprocket_order_id?: string | null
                    shiprocket_shipment_id?: string | null
                    shiprocket_awb?: string | null
                    shiprocket_label_url?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            order_items: {
                Row: {
                    id: string
                    order_id: string
                    product_id: string | null
                    variant_id: string | null
                    product_name: string
                    size: string | null
                    custom_measurements: Json | null
                    sku: string | null
                    quantity: number
                    price: number
                }
                Insert: {
                    id?: string
                    order_id: string
                    product_id?: string | null
                    variant_id?: string | null
                    product_name: string
                    size?: string | null
                    custom_measurements?: Json | null
                    sku?: string | null
                    quantity: number
                    price: number
                }
                Update: {
                    id?: string
                    order_id?: string
                    product_id?: string | null
                    variant_id?: string | null
                    product_name?: string
                    size?: string | null
                    custom_measurements?: Json | null
                    sku?: string | null
                    quantity?: number
                    price?: number
                }
            }
            coupons: {
                Row: {
                    id: string
                    code: string
                    discount_type: 'percentage' | 'fixed'
                    discount_value: number
                    expiry_date: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    code: string
                    discount_type: 'percentage' | 'fixed'
                    discount_value: number
                    expiry_date?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    code?: string
                    discount_type?: 'percentage' | 'fixed'
                    discount_value?: number
                    expiry_date?: string | null
                    created_at?: string
                }
            }
            product_measurements: {
                Row: {
                    id: string
                    product_id: string
                    size_chart: Json | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    product_id: string
                    size_chart?: Json | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    product_id?: string
                    size_chart?: Json | null
                    created_at?: string
                }
            }
        }
    }
}
