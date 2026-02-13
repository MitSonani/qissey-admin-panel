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
import { Badge } from "@/components/ui/badge";
import {
    Plus,
    Pencil,
    Trash2,
    Loader2,
    Upload,
    X,
    Search,
    Package
} from "lucide-react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { uploadProductImage } from "@/lib/storage";
import Image from "next/image";

type Category = {
    id: string;
    name: string;
};

type Product = {
    id: string;
    name: string;
    description: string;
    price: number;
    discount_price: number | null;
    category_id: string | null;
    sizes: string[];
    colors: string[];
    stock_quantity: number;
    image_urls: string[];
    status: "active" | "inactive";
    created_at: string;
    category?: Category;
};

export default function ProductManagement() {
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        price: "",
        discount_price: "",
        category_id: "",
        stock_quantity: "",
        status: "active" as "active" | "inactive",
        image_urls: [] as string[],
        sizes: [] as string[],
    });

    // Fetch Products
    const { data: products = [] } = useQuery({
        queryKey: ["products", searchQuery, categoryFilter],
        queryFn: async () => {
            let query = supabase
                .from("products")
                .select("*, category:categories(id, name)")
                .order("created_at", { ascending: false });

            if (searchQuery) {
                query = query.ilike("name", `%${searchQuery}%`);
            }

            if (categoryFilter !== "all") {
                query = query.eq("category_id", categoryFilter);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as Product[];
        },
    });

    // Fetch Categories for dropdown
    const { data: categories = [] } = useQuery({
        queryKey: ["categories"],
        queryFn: async () => {
            const { data, error } = await supabase.from("categories").select("id, name");
            if (error) throw error;
            return data as Category[];
        },
    });

    // Create Product
    const createMutation = useMutation({
        mutationFn: async (newProduct: Partial<Product>) => {
            const { data, error } = await supabase
                .from("products")
                .insert([newProduct])
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["products"] });
            toast.success("Product created successfully");
            setIsDialogOpen(false);
            resetForm();
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to create product");
        },
    });

    // Update Product
    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<Product> }) => {
            const { data, error } = await supabase
                .from("products")
                .update(updates)
                .eq("id", id)
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["products"] });
            toast.success("Product updated successfully");
            setIsDialogOpen(false);
            resetForm();
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to update product");
        },
    });

    // Delete Product
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("products").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["products"] });
            toast.success("Product deleted successfully");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to delete product");
        },
    });

    const resetForm = () => {
        setFormData({
            name: "",
            description: "",
            price: "",
            discount_price: "",
            category_id: "",
            stock_quantity: "",
            status: "active",
            image_urls: [],
            sizes: [],
        });
        setEditingProduct(null);
    };

    const handleOpenCreate = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    const handleOpenEdit = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            description: product.description || "",
            price: product.price.toString(),
            discount_price: product.discount_price?.toString() || "",
            category_id: product.category_id || "",
            stock_quantity: product.stock_quantity.toString(),
            status: product.status,
            image_urls: product.image_urls || [],
            sizes: product.sizes || [],
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            ...formData,
            price: parseFloat(formData.price),
            discount_price: formData.discount_price ? parseFloat(formData.discount_price) : null,
            stock_quantity: parseInt(formData.stock_quantity),
        };

        if (editingProduct) {
            updateMutation.mutate({ id: editingProduct.id, updates: payload as Partial<Product> });
        } else {
            createMutation.mutate(payload as Partial<Product>);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        try {
            toast.loading("Uploading image...", { id: "upload" });
            const url = await uploadProductImage(file);
            setFormData((prev) => ({
                ...prev,
                image_urls: [...prev.image_urls, url],
            }));
            toast.success("Image uploaded", { id: "upload" });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Upload failed";
            toast.error(message, { id: "upload" });
        }
    };

    const removeImage = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            image_urls: prev.image_urls.filter((_, i) => i !== index),
        }));
    };

    const toggleSize = (size: string) => {
        setFormData((prev) => ({
            ...prev,
            sizes: prev.sizes.includes(size)
                ? prev.sizes.filter((s) => s !== size)
                : [...prev.sizes, size],
        }));
    };

    const columns: ColumnDef<Product>[] = [
        {
            accessorKey: "image_urls",
            header: "Image",
            cell: ({ row }) => {
                const url = row.original.image_urls?.[0];
                return (
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden relative">
                        {url ? (
                            <Image src={url} alt="" fill className="object-cover" />
                        ) : (
                            <Package size={20} className="text-muted-foreground" />
                        )}
                    </div>
                );
            },
        },
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
            accessorKey: "price",
            header: "Price",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span>${row.original.price.toFixed(2)}</span>
                    {row.original.discount_price && (
                        <span className="text-xs text-destructive line-through">${row.original.discount_price.toFixed(2)}</span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "stock_quantity",
            header: "Stock",
            cell: ({ row }) => {
                const stock = row.original.stock_quantity;
                return (
                    <Badge variant={stock < 10 ? "destructive" : "secondary"}>
                        {stock} available
                    </Badge>
                );
            },
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => (
                <Badge variant={row.original.status === "active" ? "default" : "outline"}>
                    {row.original.status}
                </Badge>
            ),
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
                            if (confirm("Delete this product?")) {
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

    const availableSizes = ["S", "M", "L", "XL", "XXL"];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Products</h1>
                    <p className="text-muted-foreground">Manage your clothing inventory</p>
                </div>
                <Button onClick={handleOpenCreate} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    New Product
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search products..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <DataTable columns={columns} data={products} />

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingProduct ? "Edit Product" : "Add New Product"}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Name</label>
                                <Input
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Category</label>
                                <Select
                                    value={formData.category_id}
                                    onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.id}>
                                                {cat.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Description</label>
                            <textarea
                                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Price ($)</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Discount Price ($)</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.discount_price}
                                    onChange={(e) => setFormData({ ...formData, discount_price: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Stock</label>
                                <Input
                                    type="number"
                                    required
                                    value={formData.stock_quantity}
                                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Sizes</label>
                            <div className="flex flex-wrap gap-2">
                                {availableSizes.map((size) => (
                                    <Button
                                        key={size}
                                        type="button"
                                        variant={formData.sizes.includes(size) ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => toggleSize(size)}
                                    >
                                        {size}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Images</label>
                            <div className="grid grid-cols-4 gap-4">
                                {formData.image_urls.map((url, i) => (
                                    <div key={i} className="group relative aspect-square rounded-md border overflow-hidden">
                                        <Image src={url} alt="" fill className="object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(i)}
                                            className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                                <label className="aspect-square rounded-md border border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                                    <Upload className="h-6 w-6 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground mt-2">Upload</span>
                                    <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                                </label>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Status</label>
                            <Select
                                value={formData.status}
                                onValueChange={(v: "active" | "inactive") => setFormData({ ...formData, status: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
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
                                {editingProduct ? "Update Product" : "Create Product"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
