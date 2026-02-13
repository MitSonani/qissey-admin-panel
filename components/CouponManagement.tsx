"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

type Coupon = {
    id: string;
    code: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    expiry_date: string | null;
    created_at: string;
};

export default function CouponManagement() {
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [formData, setFormData] = useState({
        code: "",
        discount_type: "percentage" as "percentage" | "fixed",
        discount_value: "",
        expiry_date: "",
    });

    // Fetch Coupons
    const { data: coupons = [] } = useQuery({
        queryKey: ["coupons"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("coupons")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data as Coupon[];
        },
    });

    // Create Coupon
    const createMutation = useMutation({
        mutationFn: async (newCoupon: Partial<Coupon>) => {
            const { data, error } = await supabase
                .from("coupons")
                .insert([newCoupon])
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["coupons"] });
            toast.success("Coupon created successfully");
            setIsDialogOpen(false);
            setFormData({ code: "", discount_type: "percentage", discount_value: "", expiry_date: "" });
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to create coupon");
        },
    });

    // Delete Coupon
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("coupons").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["coupons"] });
            toast.success("Coupon deleted successfully");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to delete coupon");
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate({
            code: formData.code,
            discount_type: formData.discount_type,
            discount_value: parseFloat(formData.discount_value),
            expiry_date: formData.expiry_date || null,
        });
    };

    const columns: ColumnDef<Coupon>[] = [
        {
            accessorKey: "code",
            header: "Coupon Code",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-primary" />
                    <span className="font-mono font-bold uppercase">{row.original.code}</span>
                </div>
            ),
        },
        {
            accessorKey: "discount_value",
            header: "Discount",
            cell: ({ row }) => (
                <span>
                    {row.original.discount_type === "percentage"
                        ? `${row.original.discount_value}% OFF`
                        : `$${row.original.discount_value.toFixed(2)} OFF`}
                </span>
            ),
        },
        {
            accessorKey: "expiry_date",
            header: "Expiry",
            cell: ({ row }) => row.original.expiry_date
                ? format(new Date(row.original.expiry_date), "MMM dd, yyyy")
                : "Never",
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                        if (confirm("Delete this coupon?")) {
                            deleteMutation.mutate(row.original.id);
                        }
                    }}
                    className="hover:text-destructive"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Coupons</h1>
                    <p className="text-muted-foreground">Manage discount codes for customers</p>
                </div>
                <Button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Coupon
                </Button>
            </div>

            <DataTable columns={columns} data={coupons} />

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Coupon</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Coupon Code</label>
                            <Input
                                required
                                className="font-mono uppercase"
                                placeholder="SUMMER2026"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Discount Type</label>
                                <Select
                                    value={formData.discount_type}
                                    onValueChange={(v: "percentage" | "fixed") => setFormData({ ...formData, discount_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                                        <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Discount Value</label>
                                <Input
                                    type="number"
                                    required
                                    placeholder={formData.discount_type === "percentage" ? "10" : "5.00"}
                                    value={formData.discount_value}
                                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Expiry Date (Optional)</label>
                            <Input
                                type="date"
                                value={formData.expiry_date}
                                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={createMutation.isPending}>
                                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Coupon
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
