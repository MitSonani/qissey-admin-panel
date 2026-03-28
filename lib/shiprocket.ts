import { Order, OrderItem, Address } from "@/types/orders";

const SHIPROCKET_BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;

async function getShiprocketToken() {
    if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
        return cachedToken;
    }

    const email = process.env.SHIPROCKET_EMAIL;
    const password = process.env.SHIPROCKET_PASSWORD;

    if (!email || !password) {
        console.error('Shiprocket credentials missing');
        return null;
    }

    try {
        const response = await fetch(`${SHIPROCKET_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Shiprocket login failed:', error);
            return null;
        }

        const data = await response.json() as { token: string };
        cachedToken = data.token;
        const now = new Date();
        now.setHours(now.getHours() + 24);
        tokenExpiry = now;

        return cachedToken;
    } catch (error) {
        console.error('Error getting Shiprocket token:', error);
        return null;
    }
}

export async function createShiprocketOrder(order: Order, orderItems: OrderItem[]) {
    const token = await getShiprocketToken();
    if (!token) {
        throw new Error('Failed to authenticate with Shiprocket');
    }

    const address = order.shipping_address as Address || {} as Address;
    const billingName = address.name || order.customer_name || 'Customer';
    const splitName = billingName.split(' ');
    const firstName = splitName[0];
    const lastName = splitName.slice(1).join(' ') || '';

    const billingPhoneRaw = (address.phone || "0000000000").toString();
    const billingPhone = parseInt(billingPhoneRaw.replace(/\D/g, '').slice(-10)) || 0;
    const billingPincode = address.postal_code ? parseInt(address.postal_code.toString().replace(/\D/g, '')) : 0;

    const shiprocketItems = orderItems.map((item) => ({
        name: item.product_name || 'Product',
        sku: item.sku || `ITEM-${item.id}`,
        units: parseInt(item.quantity.toString()) || 1,
        selling_price: parseFloat(item.price.toString()),
        discount: "",
        tax: "",
        hsn: 441122
    }));

    const subTotal = orderItems.reduce((total, item) => total + (parseFloat(item.price.toString()) * parseInt(item.quantity.toString())), 0);
    const totalWeight = orderItems.length * 0.5;

    const d = new Date(order.created_at || new Date());
    const formattedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    const isPaid = order.payment_status === 'paid';

    let srOrderId = order.shiprocket_order_id || null;
    let srShipmentId = order.shiprocket_shipment_id || null;

    // STEP 1 — Create Shipment ONLY if missing
    if (!srShipmentId) {
        console.log("No existing shipment ID found. Creating new Shiprocket order...");
        const payload = {
            order_id: order.id,
            order_date: formattedDate,
            pickup_location: 'QISSEY_Surat',
            comment: "Order from Website",
            billing_customer_name: firstName,
            billing_last_name: lastName,
            billing_address: address.line1 || "Not Provided",
            billing_address_2: address.line2 || "",
            billing_city: address.city || "Unknown",
            billing_pincode: billingPincode,
            billing_state: address.state || "Unknown",
            billing_country: address.country || "India",
            billing_email: address.email || order.customer_email || "noemail@example.com",
            billing_phone: billingPhone,
            shipping_is_billing: true,
            order_items: shiprocketItems,
            payment_method: isPaid ? "Prepaid" : "COD",
            shipping_charges: 0,
            giftwrap_charges: 0,
            transaction_charges: 0,
            total_discount: 0,
            sub_total: subTotal,
            length: 15,
            breadth: 15,
            height: 7,
            weight: Math.max(totalWeight, 0.5)
        };

        console.log('Shiprocket payload:', JSON.stringify(payload, null, 2));

        const createRes = await fetch(`${SHIPROCKET_BASE_URL}/orders/create/adhoc`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const createData = await createRes.json() as { order_id: string; shipment_id: string };
        console.log('Shiprocket Create Response:', createData);

        if (!createRes.ok || !createData.shipment_id) {
            throw new Error(`Shiprocket Order Creation Failed: ${JSON.stringify(createData)}`);
        }

        srOrderId = createData.order_id.toString();
        srShipmentId = createData.shipment_id.toString();
    } else {
        console.log(`Using existing shipment ID: ${srShipmentId}`);
    }

    let awbCode: string | null = order.shiprocket_awb || null;
    let courierName: string | null = null;
    let labelUrl: string | null = null;
    let pickupScheduled = false;

    // STEP 2 — Check Serviceability (Skip if AWB exists?)
    let recommendedCourier: { courier_company_id: string; courier_name: string } | null = null;
    if (!awbCode && srShipmentId) {
        try {
            console.log("Checking serviceability...");
            const params = new URLSearchParams({
                pickup_postcode: billingPincode.toString(),
                delivery_postcode: billingPincode.toString(),
                weight: Math.max(totalWeight, 0.5).toString(),
                cod: isPaid ? '0' : '1'
            });

            const serviceRes = await fetch(`${SHIPROCKET_BASE_URL}/courier/serviceability/?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (serviceRes.ok) {
                const serviceData = await serviceRes.json() as { data: { available_courier_companies: Array<{ courier_company_id: string; courier_name: string }> } };
                if (serviceData.data?.available_courier_companies?.length > 0) {
                    recommendedCourier = serviceData.data.available_courier_companies[0];
                }
            }
        } catch (serviceError) {
            console.error("Serviceability check error:", serviceError);
        }
    }

    // STEP 3 — Assign AWB ONLY if missing
    if (!awbCode && srShipmentId) {
        try {
            if (recommendedCourier?.courier_company_id) {
                const assignRes = await fetch(`${SHIPROCKET_BASE_URL}/courier/assign/awb`, {
                    method: "POST",
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        shipment_id: srShipmentId,
                        courier_id: recommendedCourier.courier_company_id
                    })
                });
                const assignData = await assignRes.json() as { awb_assign_status: number; response: { data: { awb_code: string; courier_name: string } } };
                if (assignData.awb_assign_status === 1) {
                    awbCode = assignData.response.data.awb_code;
                    courierName = assignData.response.data.courier_name;
                }
            } else {
                const assignRes = await fetch(`${SHIPROCKET_BASE_URL}/courier/assign/auto`, {
                    method: "POST",
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ shipment_id: srShipmentId })
                });
                const assignData = await assignRes.json() as { awb_assign_status: number; response: { data: { awb_code: string; courier_name: string } } };
                if (assignData.awb_assign_status === 1) {
                    awbCode = assignData.response.data.awb_code;
                    courierName = assignData.response.data.courier_name;
                }
            }
        } catch (assignError) {
            console.error("Error defining AWB:", assignError);
        }
    }

    // STEP 4 — Generate Shipping Label
    if (awbCode && srShipmentId) {
        try {
            const labelRes = await fetch(`${SHIPROCKET_BASE_URL}/courier/generate/label`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ shipment_id: [srShipmentId] })
            });
            const labelData = await labelRes.json() as { label_url?: string; label_created?: string };
            labelUrl = labelData.label_url || labelData.label_created || null;
        } catch (labelError) {
            console.error("Error generating label:", labelError);
        }
    }

    // STEP 5 — Schedule Pickup
    if (awbCode && srShipmentId) {
        try {
            const pickupRes = await fetch(`${SHIPROCKET_BASE_URL}/courier/generate/pickup`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ shipment_id: [srShipmentId] })
            });
            const pickupData = await pickupRes.json() as { pickup_status: number };
            if (pickupData.pickup_status === 1) {
                pickupScheduled = true;
            }
        } catch (pickupError) {
            console.error("Error scheduling pickup:", pickupError);
        }
    }

    return {
        shiprocket_order_id: srOrderId,
        shiprocket_shipment_id: srShipmentId,
        awb_code: awbCode,
        courier_name: courierName,
        label_url: labelUrl,
        pickup_scheduled: pickupScheduled
    };
}
