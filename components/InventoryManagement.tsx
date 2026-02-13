"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
    Loader2,
    AlertTriangle,
    Save,
    RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";

type ProductStock = {
    id: string;
    name: string;
    stock_quantity: number;
    category: { name: string } | null;
};

export default function InventoryManagement() {
    const queryClient = useQueryClient();
    const [stockUpdates, setStockUpdates] = useState<Record<string, number>>({});

    // Fetch Products with categories
    const { data: products = [] } = useQuery({
        queryKey: ["inventory-stock"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("products")
                .select("id, name, stock_quantity, category:categories(name)")
                .order("stock_quantity", { ascending: true });
            if (error) throw error;

            // Explicitly handling the Supabase relationship response structure
            return (data as unknown as ProductStock[]).map(p => ({
                ...p,
                category: Array.isArray(p.category) ? (p.category as unknown as { name: string }[])[0] : p.category
            })) as ProductStock[];
        },
    });

    // Update Stock Mutation
    const updateStockMutation = useMutation({
        mutationFn: async ({ id, stock_quantity }: { id: string; stock_quantity: number }) => {
            const { error } = await supabase
                .from("products")
                .update({ stock_quantity })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["inventory-stock"] });
            setStockUpdates(prev => {
                const next = { ...prev };
                delete next[variables.id];
                return next;
            });
            toast.success("Inventory updated");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to update inventory");
        },
    });

    const handleStockChange = (id: string, value: string) => {
        const numValue = parseInt(value);
        if (!isNaN(numValue)) {
            setStockUpdates(prev => ({ ...prev, [id]: numValue }));
        }
    };

    const columns: ColumnDef<ProductStock>[] = [
        {
            accessorKey: "name",
            header: "Product",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.original.name}</span>
                    <span className="text-xs text-muted-foreground">{row.original.category?.name || "No Category"}</span>
                </div>
            ),
        },
        {
            accessorKey: "stock_quantity",
            header: "Current Stock",
            cell: ({ row }) => {
                const stock = row.original.stock_quantity;
                return (
                    <div className="flex items-center gap-2">
                        <span className={stock < 10 ? "text-destructive font-bold" : ""}>{stock}</span>
                        {stock < 10 && <AlertTriangle className="h-4 w-4 text-destructive" />}
                    </div>
                );
            },
        },
        {
            id: "update",
            header: "New Quantity",
            cell: ({ row }) => (
                <div className="flex items-center gap-2 max-w-[150px]">
                    <Input
                        type="number"
                        className="h-8"
                        value={stockUpdates[row.original.id] ?? row.original.stock_quantity}
                        onChange={(e) => handleStockChange(row.original.id, e.target.value)}
                    />
                </div>
            ),
        },
        {
            id: "actions",
            header: "Action",
            cell: ({ row }) => {
                const isModified = stockUpdates[row.original.id] !== undefined;
                return (
                    <Button
                        size="sm"
                        variant={isModified ? "default" : "ghost"}
                        disabled={!isModified || updateStockMutation.isPending}
                        onClick={() => updateStockMutation.mutate({
                            id: row.original.id,
                            stock_quantity: stockUpdates[row.original.id] ?? row.original.stock_quantity
                        })}
                    >
                        {updateStockMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="h-4 w-4 mr-2" />
                        Update
                    </Button>
                );
            },
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
                    <p className="text-muted-foreground">Monitor and update product stock levels</p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["inventory-stock"] })}
                    className="flex items-center gap-2"
                >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 bg-destructive/5 border-destructive/20">
                    <div className="flex items-center gap-2 text-destructive font-semibold">
                        <AlertTriangle size={18} />
                        Low Stock Alert
                    </div>
                    <p className="text-2xl font-bold mt-2">
                        {products.filter(p => p.stock_quantity < 10).length}
                    </p>
                    <p className="text-xs text-muted-foreground">Products under 10 units</p>
                </Card>
            </div>

            <DataTable columns={columns} data={products} />
        </div>
    );
}
