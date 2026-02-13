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
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

type Category = {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
};

export default function CategoryManagement() {
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [formData, setFormData] = useState({ name: "", description: "" });

    // Fetch Categories
    const { data: categories = [] } = useQuery({
        queryKey: ["categories"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("categories")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data as Category[];
        },
    });

    // Create Category
    const createMutation = useMutation({
        mutationFn: async (newCategory: { name: string; description: string }) => {
            const { data, error } = await supabase
                .from("categories")
                .insert([newCategory])
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["categories"] });
            toast.success("Category created successfully");
            setIsDialogOpen(false);
            setFormData({ name: "", description: "" });
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to create category");
        },
    });

    // Update Category
    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<Category> }) => {
            const { data, error } = await supabase
                .from("categories")
                .update(updates)
                .eq("id", id)
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["categories"] });
            toast.success("Category updated successfully");
            setIsDialogOpen(false);
            setEditingCategory(null);
            setFormData({ name: "", description: "" });
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to update category");
        },
    });

    // Delete Category
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("categories").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["categories"] });
            toast.success("Category deleted successfully");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to delete category");
        },
    });

    const handleOpenEdit = (category: Category) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            description: category.description || "",
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingCategory) {
            updateMutation.mutate({ id: editingCategory.id, updates: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const columns: ColumnDef<Category>[] = [
        {
            accessorKey: "name",
            header: "Category Name",
            cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
        },
        {
            accessorKey: "created_at",
            header: "Created At",
            cell: ({ row }) => format(new Date(row.getValue("created_at")), "MMM dd, yyyy"),
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(row.original)}
                        className="hover:text-primary"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            if (confirm("Are you sure? This will delete the category.")) {
                                deleteMutation.mutate(row.original.id);
                            }
                        }}
                        className="hover:text-destructive"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
                    <p className="text-muted-foreground">Manage your product categories</p>
                </div>
                <Button onClick={() => {
                    setEditingCategory(null);
                    setFormData({ name: "", description: "" });
                    setIsDialogOpen(true);
                }} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    New Category
                </Button>
            </div>

            <DataTable columns={columns} data={categories} />

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingCategory ? "Edit Category" : "Add New Category"}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Name</label>
                            <Input
                                required
                                placeholder="e.g. T-Shirts"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Description</label>
                            <Input
                                placeholder="Optional description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={createMutation.isPending || updateMutation.isPending}
                            >
                                {(createMutation.isPending || updateMutation.isPending) && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                {editingCategory ? "Update" : "Create"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
