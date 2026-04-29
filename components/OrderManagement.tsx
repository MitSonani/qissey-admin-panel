"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Eye, Package } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { toast } from "sonner";
import { Order } from "@/types/orders";



export default function OrderManagement() {
    const queryClient = useQueryClient();
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);



    // Fetch User Role for Debugging
    useQuery({
        queryKey: ["userRole"],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return null;
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", user.id)
                .single();


            return profile;
        }
    });

    // Fetch Orders
    const { data: orders = [] } = useQuery({
        queryKey: ["orders"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("orders")
                .select("*, order_items(*, product:products(name))")
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching orders:", error);
                throw error;
            }
            return data as Order[];
        },
    });

    // Update Order Status
    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            const { error } = await supabase
                .from("orders")
                .update({ status })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            toast.success("Order status updated");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to update status");
        },
    });

    // Shiprocket Fulfillment
    const shiprocketMutation = useMutation({
        mutationFn: async (order: Order) => {
            const response = await fetch("/api/shiprocket", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    order,
                    orderItems: order.order_items
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Fulfillment failed");
            }

            return response.json();
        },
        onSuccess: async (data, variables) => {
            // Update the order in Supabase with the new details
            const { error } = await supabase
                .from("orders")
                .update({
                    shiprocket_order_id: data.shiprocket_order_id.toString(),
                    shiprocket_shipment_id: data.shiprocket_shipment_id.toString(),
                    shiprocket_awb: data.awb_code,
                    status: "processing"
                })
                .eq("id", variables.id);

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ["orders"] });

            if (data.label_url) {
                toast.success("Shiprocket fulfillment successful!", {
                    description: "Shipping label is ready.",
                    action: {
                        label: "Open Label",
                        onClick: () => window.open(data.label_url, "_blank")
                    },
                    duration: 10000
                });
            } else {
                toast.success("Shiprocket order created and AWB assigned!");
            }

            setIsDetailsOpen(false);
        },
        onError: (error: Error) => {
            toast.error(error.message || "Shiprocket fulfillment failed");
        },
    });

    const columns: ColumnDef<Order>[] = [
        {
            accessorKey: "id",
            header: "Order ID",
            cell: ({ row }) => <span className="font-mono text-xs">#{row.original.id.slice(0, 8)}</span>,
        },
        {
            accessorKey: "customer_name",
            header: "Customer",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.original.customer_name}</span>
                    <span className="text-xs text-muted-foreground">{row.original.customer_email}</span>
                </div>
            ),
        },
        {
            accessorKey: "total_amount",
            header: "Total",
            cell: ({ row }) => (
                <div className="font-medium">
                    {row.original.currency} {row.original.total_amount.toFixed(2)}
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const orderStatus = row.original.status;
                return (
                    <Select
                        defaultValue={orderStatus}
                        onValueChange={(value) => updateStatusMutation.mutate({ id: row.original.id, status: value })}
                    >
                        <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="processing">PROCESSING</SelectItem>
                            <SelectItem value="intransit">INTRANSIT</SelectItem>
                            <SelectItem value="delivered">DELIVERED</SelectItem>
                            <SelectItem value="cancelled">CANCELLED</SelectItem>
                            <SelectItem value="returned">RETURNED</SelectItem>
                        </SelectContent>
                    </Select>
                );
            },
        },
        {
            accessorKey: "payment_status",
            header: "Payment",
            cell: ({ row }) => (
                <Badge variant={row.original.payment_status === "paid" ? "default" : "outline"}>
                    {row.original.payment_status}
                </Badge>
            ),
        },
        {
            accessorKey: "payment_method",
            header: "Method",
            cell: ({ row }) => {
                const method = row.original.payment_method;
                if (!method) return <span className="text-xs text-muted-foreground italic">N/A</span>;
                return (
                    <Badge variant="secondary" className="text-[10px] capitalize">
                        {method.replace(/_/g, ' ')}
                    </Badge>
                );
            },
        },
        {
            accessorKey: "created_at",
            header: "Date",
            cell: ({ row }) => format(new Date(row.original.created_at), "MMM dd, yyyy"),
        },
        {
            id: "actions",
            header: "Details",
            cell: ({ row }) => (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                        setSelectedOrder(row.original);
                        setIsDetailsOpen(true);
                    }}
                >
                    <Eye className="h-4 w-4" />
                </Button>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
                <p className="text-muted-foreground">Monitor and manage customer transactions</p>

            </div>

            <DataTable columns={columns} data={orders} />

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Order Details #{selectedOrder?.id.slice(0, 8)}</DialogTitle>
                    </DialogHeader>
                    {selectedOrder && (
                        <div className="space-y-6 pt-4">
                            {/* Customer & Status Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b pb-6">
                                <div>
                                    <h4 className="text-sm font-semibold mb-2">Customer Information</h4>
                                    <div className="text-sm space-y-1">
                                        <p><span className="font-medium">Name:</span> {selectedOrder.customer_name}</p>
                                        <p><span className="font-medium">Email:</span> {selectedOrder.customer_email}</p>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold mb-2">Order Status</h4>
                                    <div className="text-sm space-y-1">
                                        <p><span className="font-medium">Placed on:</span> {format(new Date(selectedOrder.created_at), "PPP p")}</p>
                                        <p>
                                            <span className="font-medium">Status:</span>{" "}
                                            <Badge variant="outline" className="uppercase font-bold text-[10px]">
                                                {selectedOrder.status === 'pending' ? 'PROCESSING' :
                                                    selectedOrder.status === 'processing' ? 'INTRANSIT' :
                                                        selectedOrder.status.toUpperCase()}
                                            </Badge>
                                        </p>
                                        <p><span className="font-medium">Payment:</span> <span className="capitalize">{selectedOrder.payment_status}</span></p>
                                        {selectedOrder.payment_method && (
                                            <p><span className="font-medium">Method:</span> {selectedOrder.payment_method}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Addresses Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b pb-6">
                                <div>
                                    <h4 className="text-sm font-semibold mb-2">Shipping Address</h4>
                                    {selectedOrder.shipping_address ? (
                                        <div className="text-sm text-muted-foreground space-y-1 bg-muted/30 p-3 rounded-md border">
                                            <p>{selectedOrder.shipping_address.line1}</p>
                                            {selectedOrder.shipping_address.line2 && <p>{selectedOrder.shipping_address.line2}</p>}
                                            <p>{selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state} {selectedOrder.shipping_address.postal_code}</p>
                                            <p>{selectedOrder.shipping_address.country}</p>

                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No shipping address provided</p>
                                    )}
                                </div>

                            </div>

                            {/* Tracking & Integration IDs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b pb-6">

                                <div>
                                    <h4 className="text-sm font-semibold mb-2">Shipment Details</h4>
                                    <div className="text-sm space-y-1">
                                        {selectedOrder.shiprocket_awb ? (
                                            <>
                                                <p><span className="font-medium">Shiprocket Order ID:</span> {selectedOrder.shiprocket_order_id}</p>
                                                {selectedOrder.shiprocket_shipment_id && (
                                                    <p><span className="font-medium">Shipment ID:</span> {selectedOrder.shiprocket_shipment_id}</p>
                                                )}
                                                {selectedOrder.shiprocket_awb && (
                                                    <p><span className="font-medium">AWB:</span> {selectedOrder.shiprocket_awb}</p>
                                                )}
                                                <div className="pt-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="w-full justify-start gap-2 h-9 text-blue-600 hover:text-blue-700"
                                                        onClick={() => shiprocketMutation.mutate(selectedOrder)}
                                                        disabled={shiprocketMutation.isPending}
                                                    >
                                                        {shiprocketMutation.isPending ? (
                                                            <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                                        ) : (
                                                            <Package className="h-4 w-4" />
                                                        )}
                                                        Regenerate Label / Fetch Pickup
                                                    </Button>
                                                </div>
                                            </>
                                        ) : selectedOrder.shiprocket_shipment_id ? (
                                            <div className="pt-2 space-y-2">
                                                <p><span className="font-medium">Shiprocket Order ID:</span> {selectedOrder.shiprocket_order_id}</p>
                                                <p><span className="font-medium">Shipment ID:</span> {selectedOrder.shiprocket_shipment_id}</p>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full justify-start gap-2 h-9 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                                    onClick={() => shiprocketMutation.mutate(selectedOrder)}
                                                    disabled={shiprocketMutation.isPending}
                                                >
                                                    {shiprocketMutation.isPending ? (
                                                        <div className="h-4 w-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                                                    ) : (
                                                        <Package className="h-4 w-4" />
                                                    )}
                                                    Assign AWB & Label
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="pt-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full justify-start gap-2 h-9"
                                                    onClick={() => shiprocketMutation.mutate(selectedOrder)}
                                                    disabled={shiprocketMutation.isPending}
                                                >
                                                    {shiprocketMutation.isPending ? (
                                                        <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                                    ) : (
                                                        <Package className="h-4 w-4" />
                                                    )}
                                                    Create Shiprocket Order
                                                </Button>
                                                <p className="text-[10px] text-muted-foreground mt-2">
                                                    Manual fallback in case of automated fulfillment error.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Items Section */}
                            <div>
                                <h4 className="text-sm font-semibold mb-4">Items ({selectedOrder.order_items.length})</h4>
                                <div className="space-y-4">
                                    {selectedOrder.order_items.map((item) => (
                                        <div key={item.id} className="flex items-start justify-between py-2 border-b last:border-0">
                                            <div className="flex items-start gap-4">
                                                <div className="h-12 w-12 bg-muted rounded flex items-center justify-center shrink-0">
                                                    <Package size={20} className="text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{item.product?.name || item.product_name}</p>
                                                    <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                                                        <p>Qty: {item.quantity}</p>
                                                        {item.size && <p>Size: {item.size}</p>}
                                                        {item.sku && <p>SKU: {item.sku}</p>}
                                                        {item.custom_measurements && Object.keys(item.custom_measurements).length > 0 && (
                                                            <div className="mt-2">
                                                                <p className="font-medium text-[11px] text-foreground mb-1 uppercase tracking-wider">Custom Measurements:</p>
                                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-muted/40 p-2 rounded border text-[11px]">
                                                                    {Object.entries(item.custom_measurements).map(([key, value]) => (
                                                                        <div key={key} className="flex justify-between border-b border-muted-foreground/10 pb-0.5 last:border-0">
                                                                            <span className="capitalize opacity-70">{key.replace(/_/g, ' ')}:</span>
                                                                            <span className="font-medium">{value as string}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-semibold">
                                                    {selectedOrder.currency} {(item.price * item.quantity).toFixed(2)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {selectedOrder.currency} {item.price} each
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Total Section */}
                            <div className="flex justify-end pt-4">
                                <div className="text-right space-y-1">
                                    <div className="flex justify-between gap-8 text-lg font-bold">
                                        <span>Total Amount:</span>
                                        <span>{selectedOrder.currency} {selectedOrder.total_amount.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
