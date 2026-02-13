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

type OrderItem = {
    id: string;
    product_id: string;
    quantity: number;
    price: number;
    product?: { name: string };
};

type Order = {
    id: string;
    customer_name: string;
    customer_email: string;
    total_amount: number;
    status: string;
    payment_status: string;
    created_at: string;
    order_items: OrderItem[];
};

export default function OrderManagement() {
    const queryClient = useQueryClient();
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // Fetch Orders
    const { data: orders = [] } = useQuery({
        queryKey: ["orders"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("orders")
                .select("*, order_items(*, product:products(name))")
                .order("created_at", { ascending: false });
            if (error) throw error;
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
            cell: ({ row }) => `$${row.original.total_amount.toFixed(2)}`,
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
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="processing">Processing</SelectItem>
                            <SelectItem value="shipped">Shipped</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
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
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Order Details #{selectedOrder?.id.slice(0, 8)}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 pt-4">
                        <div className="grid grid-cols-2 gap-8 border-b pb-6">
                            <div>
                                <h4 className="text-sm font-semibold mb-2">Customer Information</h4>
                                <p className="text-sm">{selectedOrder?.customer_name}</p>
                                <p className="text-sm text-muted-foreground">{selectedOrder?.customer_email}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold mb-2">Order Information</h4>
                                <p className="text-sm">Placed on: {selectedOrder ? format(new Date(selectedOrder.created_at), "PPP p") : ""}</p>
                                <p className="text-sm">Status: <span className="capitalize">{selectedOrder?.status}</span></p>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold mb-4">Items</h4>
                            <div className="space-y-3">
                                {selectedOrder?.order_items.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                                                <Package size={18} className="text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{item.product?.name || "Product Name"}</p>
                                                <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                                            </div>
                                        </div>
                                        <p className="text-sm font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 text-lg font-bold">
                            <span>Total:</span>
                            <span>${selectedOrder?.total_amount.toFixed(2)}</span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
