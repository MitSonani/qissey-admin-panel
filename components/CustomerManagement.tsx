"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { User } from "lucide-react";

type Customer = {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    total_orders: number;
    total_spent: number;
    created_at: string;
};

export default function CustomerManagement() {
    // Fetch Customers
    const { data: customers = [] } = useQuery({
        queryKey: ["customers"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("*, orders(total_amount)")
                .order("created_at", { ascending: false });
            if (error) throw error;
            
            return data.map(profile => {
                const total_orders = profile.orders?.length || 0;
                const total_spent = profile.orders?.reduce((acc: number, order: any) => acc + (Number(order.total_amount) || 0), 0) || 0;
                
                return {
                    id: profile.id,
                    name: profile.name || "Unknown",
                    email: profile.email,
                    phone: profile.phone,
                    total_orders,
                    total_spent,
                    created_at: profile.created_at,
                };
            }) as Customer[];
        },
    });

    const columns: ColumnDef<Customer>[] = [
        {
            accessorKey: "name",
            header: "Customer",
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <User size={16} className="text-muted-foreground" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-medium">{row.original.name}</span>
                        <span className="text-xs text-muted-foreground">{row.original.email}</span>
                    </div>
                </div>
            ),
        },
        {
            accessorKey: "phone",
            header: "Phone",
            cell: ({ row }) => row.original.phone || "-",
        },
        {
            accessorKey: "total_orders",
            header: "Orders",
            cell: ({ row }) => (
                <Badge variant="secondary">{row.original.total_orders} orders</Badge>
            ),
        },
        {
            accessorKey: "total_spent",
            header: "Total Spent",
            cell: ({ row }) => (
                <span className="font-semibold text-emerald-600">
                    INR {row.original.total_spent.toFixed(2)}
                </span>
            ),
        },
        {
            accessorKey: "created_at",
            header: "Joined",
            cell: ({ row }) => format(new Date(row.original.created_at), "MMM yyyy"),
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
                <p className="text-muted-foreground">Monitor customer activity and loyalty</p>
            </div>

            <DataTable columns={columns} data={customers} />
        </div>
    );
}
