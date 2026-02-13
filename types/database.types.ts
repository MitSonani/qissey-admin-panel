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
                    created_at?: string
                }
            }
            customers: {
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
            orders: {
                Row: {
                    id: string
                    customer_id: string | null
                    customer_name: string
                    customer_email: string
                    total_amount: number
                    status: 'pending' | 'shipped' | 'delivered' | 'cancelled'
                    payment_status: 'paid' | 'unpaid'
                    created_at: string
                }
                Insert: {
                    id?: string
                    customer_id?: string | null
                    customer_name: string
                    customer_email: string
                    total_amount: number
                    status?: 'pending' | 'shipped' | 'delivered' | 'cancelled'
                    payment_status?: 'paid' | 'unpaid'
                    created_at?: string
                }
                Update: {
                    id?: string
                    customer_id?: string | null
                    customer_name?: string
                    customer_email?: string
                    total_amount?: number
                    status?: 'pending' | 'shipped' | 'delivered' | 'cancelled'
                    payment_status?: 'paid' | 'unpaid'
                    created_at?: string
                }
            }
            order_items: {
                Row: {
                    id: string
                    order_id: string
                    product_id: string | null
                    product_name: string
                    quantity: number
                    price: number
                }
                Insert: {
                    id?: string
                    order_id: string
                    product_id?: string | null
                    product_name: string
                    quantity: number
                    price: number
                }
                Update: {
                    id?: string
                    order_id?: string
                    product_id?: string | null
                    product_name?: string
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
        }
    }
}
