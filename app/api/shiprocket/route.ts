import { NextResponse } from 'next/server';
import { createShiprocketOrder } from '@/lib/shiprocket';
import { Order, OrderItem } from '@/types/orders';

export async function POST(request: Request) {
    try {
        const { order, orderItems } = await request.json() as { order: Order; orderItems: OrderItem[] };

        if (!order || !orderItems) {
            return NextResponse.json({ error: 'Missing order or items' }, { status: 400 });
        }

        const result = await createShiprocketOrder(order, orderItems);

        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Fulfillment failed';
        console.error('Shiprocket API Error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
