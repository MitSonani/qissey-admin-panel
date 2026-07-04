export interface Address {
    name: string;
    email: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    paymentMethod?: string;
}

export interface CustomMeasurements {
    [key: string]: string | number;
}

export interface OrderItem {
    id: string;
    product_id: string;
    product_name: string;
    variant_id?: string;
    size?: string;
    custom_measurements?: CustomMeasurements | null;
    sku?: string;
    quantity: number;
    price: number;
    product?: { name: string };
}

export interface Order {
    id: string;
    customer_name: string;
    customer_email: string;
    customer_phone?: string;
    total_amount: number;
    currency: string;
    status: string;
    payment_status: string;
    payment_method?: string;
    shipping_address?: Address | null;
    billing_address?: Address | null;
    razorpay_order_id?: string;
    shiprocket_order_id?: string;
    shiprocket_shipment_id?: string;
    shiprocket_awb?: string;
    shiprocket_label_url?: string;
    created_at: string;
    order_items: OrderItem[];
}
