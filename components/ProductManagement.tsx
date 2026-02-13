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
import { TagInput } from "@/components/ui/tag-input";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";

type Collection = {
    id: string;
    name: string;
};

type Product = {
    id: string;
    sku: string | null;
    name: string;
    description: string;
    price: number;
    discount_price: number | null;
    collection_id: string | null;
    sizes: string[];
    colors: string[];
    fabrics: string[];
    stock_quantity: number;
    image_urls: string[];
    status: "active" | "inactive";
    created_at: string;
    collection?: Collection;
};

export default function ProductManagement() {
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [collectionFilter, setCollectionFilter] = useState("all");

    // Form State
    const [formData, setFormData] = useState({
        sku: "",
        name: "",
        description: "",
        price: "",
        discount_price: "",
        collection_id: "",
        stock_quantity: "",
        status: "active" as "active" | "inactive",
        image_urls: [] as string[],
        sizes: [] as string[],
        fabrics: [] as string[],
        colors: [] as string[],
    });
    const [pendingFiles, setPendingFiles] = useState<{ file: File; preview: string }[]>([]);

    // Fetch Products
    const { data: products = [] } = useQuery({
        queryKey: ["products", searchQuery, collectionFilter],
        queryFn: async () => {
            let query = supabase
                .from("products")
                .select("*, collection:collections(id, name)")
                .order("created_at", { ascending: false });

            if (searchQuery) {
                query = query.ilike("name", `%${searchQuery}%`);
            }

            if (collectionFilter !== "all") {
                query = query.eq("collection_id", collectionFilter);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as Product[];
        },
    });

    // Fetch Collections for dropdown
    const { data: collections = [] } = useQuery({
        queryKey: ["collections"],
        queryFn: async () => {
            const { data, error } = await supabase.from("collections").select("id, name");
            if (error) throw error;
            return data as Collection[];
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
            sku: "",
            name: "",
            description: "",
            price: "",
            discount_price: "",
            collection_id: "",
            stock_quantity: "",
            status: "active",
            image_urls: [],
            sizes: [],
            fabrics: [],
            colors: [],
        });
        setPendingFiles([]);
        setEditingProduct(null);
    };

    const handleOpenCreate = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    const handleOpenEdit = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            sku: product.sku || "",
            name: product.name,
            description: product.description || "",
            price: product.price.toString(),
            discount_price: product.discount_price?.toString() || "",
            collection_id: product.collection_id || "",
            stock_quantity: product.stock_quantity.toString(),
            status: product.status,
            image_urls: product.image_urls || [],
            sizes: product.sizes || [],
            fabrics: product.fabrics || [],
            colors: product.colors || [],
        });
        setPendingFiles([]);
        setIsDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let finalImageUrls = [...formData.image_urls];

        try {
            if (pendingFiles.length > 0) {
                toast.loading(`Uploading ${pendingFiles.length} images...`, { id: "upload" });
                const uploadPromises = pendingFiles.map(pf => uploadProductImage(pf.file));
                const uploadedUrls = await Promise.all(uploadPromises);
                finalImageUrls = [...finalImageUrls, ...uploadedUrls];
                toast.success("All images uploaded", { id: "upload" });
            }

            const payload = {
                ...formData,
                image_urls: finalImageUrls,
                price: parseFloat(formData.price),
                discount_price: formData.discount_price ? parseFloat(formData.discount_price) : null,
                stock_quantity: parseInt(formData.stock_quantity),
            };

            if (editingProduct) {
                updateMutation.mutate({ id: editingProduct.id, updates: payload as Partial<Product> });
            } else {
                createMutation.mutate(payload as Partial<Product>);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Submission failed";
            toast.error(message, { id: "upload" });
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newPending = Array.from(files).map(file => ({
            file,
            preview: URL.createObjectURL(file)
        }));

        setPendingFiles(prev => [...prev, ...newPending]);
    };

    const removeImage = (index: number) => {
        const totalExisting = formData.image_urls.length;
        if (index < totalExisting) {
            setFormData(prev => ({
                ...prev,
                image_urls: prev.image_urls.filter((_, i) => i !== index),
            }));
        } else {
            const pendingIndex = index - totalExisting;
            setPendingFiles(prev => {
                const newPending = [...prev];
                URL.revokeObjectURL(newPending[pendingIndex].preview);
                newPending.splice(pendingIndex, 1);
                return newPending;
            });
        }
    };

    const setSizes = (sizes: string[]) => setFormData((prev) => ({ ...prev, sizes }));
    const setFabrics = (fabrics: string[]) => setFormData((prev) => ({ ...prev, fabrics }));
    const setColors = (colors: string[]) => setFormData((prev) => ({ ...prev, colors }));

    const columns: ColumnDef<Product>[] = [
        {
            accessorKey: "image_urls",
            header: "Image",
            cell: ({ row }: { row: any }) => {
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
            cell: ({ row }: { row: any }) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.original.name}</span>
                    <span className="text-xs text-muted-foreground">{row.original.collection?.name || "No Collection"}</span>
                </div>
            ),
        },
        {
            accessorKey: "price",
            header: "Price",
            cell: ({ row }: { row: any }) => (
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
            cell: ({ row }: { row: any }) => {
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
            cell: ({ row }: { row: any }) => (
                <Badge variant={row.original.status === "active" ? "default" : "outline"}>
                    {row.original.status}
                </Badge>
            ),
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }: { row: any }) => (
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
                <Select value={collectionFilter} onValueChange={setCollectionFilter}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="All Collections" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Collections</SelectItem>
                        {collections.map((col) => (
                            <SelectItem key={col.id} value={col.id}>
                                {col.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <DataTable columns={columns} data={products} />

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-[1600px] sm:max-w-none w-[98vw] h-[95vh] max-h-[95vh] p-0 border-none shadow-2xl flex flex-col bg-background overflow-hidden rounded-[1.5rem]">
                    <DialogHeader className="p-6 bg-background border-b shrink-0">
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-xl font-semibold text-primary">
                                {editingProduct ? "Edit Product" : "Add New Product"}
                            </DialogTitle>
                        </div>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto px-8 py-10 space-y-16 custom-scrollbar bg-slate-50/20">
                            {/* Section: Product Genesis */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                                <div className="lg:col-span-4 space-y-2">

                                    <h3 className="text-lg font-semibold">Basic Information</h3>
                                </div>

                                <div className="lg:col-span-8 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground/80">SKU</label>
                                            <Input
                                                placeholder="e.g. NH-001"
                                                value={formData.sku}
                                                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                                className="bg-muted/30 border border-muted-foreground/10 focus:bg-background transition-all h-10 rounded-md"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground/80">Product Name</label>
                                            <Input
                                                required
                                                placeholder="Product name"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="h-10 border border-muted-foreground/10 bg-muted/30 focus:bg-background rounded-md"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground/80">Collection</label>
                                            <Select
                                                value={formData.collection_id}
                                                onValueChange={(v) => setFormData({ ...formData, collection_id: v })}
                                            >
                                                <SelectTrigger className="h-10 bg-muted/30 border border-muted-foreground/10 rounded-md">
                                                    <SelectValue placeholder="Select collection" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {collections.map((col) => (
                                                        <SelectItem key={col.id} value={col.id}>
                                                            {col.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground/80">Status</label>
                                            <Select
                                                value={formData.status}
                                                onValueChange={(v: "active" | "inactive") => setFormData({ ...formData, status: v })}
                                            >
                                                <SelectTrigger className="h-10 bg-muted/30 border border-muted-foreground/10 rounded-md">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="inactive">Draft</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground/80">Description</label>
                                        <textarea
                                            placeholder="Product description..."
                                            className="w-full min-h-[100px] rounded-md border border-muted-foreground/10 bg-muted/30 px-3 py-2 text-sm focus:bg-background transition-all resize-none"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <Separator className="opacity-40" />

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                                <div className="lg:col-span-4 space-y-2">
                                    <h3 className="text-lg font-semibold">Pricing & Inventory</h3>
                                </div>

                                <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground/80">Price ($)</label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            required
                                            placeholder="0.00"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                            className="h-10 bg-muted/30 border border-muted-foreground/10 rounded-md"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground/80">Discount Price ($)</label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="Optional"
                                            value={formData.discount_price}
                                            onChange={(e) => setFormData({ ...formData, discount_price: e.target.value })}
                                            className="h-10 bg-muted/30 border border-muted-foreground/10 rounded-md"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground/80">Stock</label>
                                        <Input
                                            type="number"
                                            required
                                            placeholder="Quantity"
                                            value={formData.stock_quantity}
                                            onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                                            className="h-10 bg-muted/30 border border-muted-foreground/10 rounded-md"
                                        />
                                    </div>
                                </div>
                            </div>

                            <Separator className="opacity-40" />

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                                <div className="lg:col-span-4 space-y-2">

                                    <h3 className="text-lg font-semibold">Specifications</h3>
                                </div>

                                <div className="lg:col-span-8 space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground/80">Sizes</label>
                                            <TagInput
                                                placeholder="Add size"
                                                tags={formData.sizes}
                                                setTags={setSizes}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground/80">Materials</label>
                                            <TagInput
                                                placeholder="Add fabric"
                                                tags={formData.fabrics}
                                                setTags={setFabrics}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground/80">Colors</label>
                                        <TagInput
                                            placeholder="Add colors"
                                            tags={formData.colors}
                                            setTags={setColors}
                                        />
                                    </div>
                                </div>
                            </div>

                            <Separator className="opacity-40" />

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 pb-12">
                                <div className="lg:col-span-4 space-y-2">

                                    <h3 className="text-lg font-semibold">Product Images</h3>
                                </div>

                                <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
                                    {formData.image_urls.map((url, i) => (
                                        <div key={`existing-${i}`} className="group relative aspect-[3/4.5] rounded-2xl border-none overflow-hidden bg-muted/20 shadow-lg hover:shadow-2xl transition-all duration-700">
                                            <Image src={url} alt="" fill className="object-cover transition-transform duration-1000 group-hover:scale-110" />
                                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-sm">
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(i)}
                                                    className="h-10 w-10 rounded-full bg-destructive text-white flex items-center justify-center hover:scale-110 transition-transform"
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {pendingFiles.map((pf, i) => (
                                        <div key={`pending-${i}`} className="group relative aspect-[3/4.5] rounded-2xl border-none overflow-hidden bg-muted/20 shadow-lg hover:shadow-2xl transition-all duration-700">
                                            <Image src={pf.preview} alt="" fill className="object-cover transition-transform duration-1000 group-hover:scale-110" />
                                            <div className="absolute top-2 right-2 z-10">
                                                <Badge className="bg-primary/90 text-[10px] uppercase tracking-tighter">Pending</Badge>
                                            </div>
                                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-sm">
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(formData.image_urls.length + i)}
                                                    className="h-10 w-10 rounded-full bg-destructive text-white flex items-center justify-center hover:scale-110 transition-transform"
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <label className="aspect-[3/4.5] rounded-2xl border-4 border-dashed border-muted-foreground/10 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/40 hover:border-primary/30 transition-all group active:scale-[0.98] duration-300">
                                        <div className="p-6 rounded-xl bg-muted group-hover:bg-primary/5 transition-all duration-300">
                                            <Upload className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                        <span className="text-xs font-medium text-muted-foreground mt-4 group-hover:text-primary transition-colors">Upload Image</span>
                                        <input type="file" hidden accept="image/*" multiple onChange={handleImageUpload} />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="bg-background shrink-0 px-6 py-4 flex flex-col sm:flex-row gap-3 border-t items-center justify-end sticky bottom-0 z-[100]">
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-10 border-none hover:bg-destructive/10 hover:text-destructive flex items-center gap-2 font-medium transition-all rounded-md px-4">
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="sm:min-w-[160px] h-10 shadow-sm hover:bg-primary/90 transition-all font-medium rounded-md px-6"
                                >
                                    {(createMutation.isPending || updateMutation.isPending) && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    {editingProduct ? "Save Changes" : "Save Product"}
                                </Button>
                            </div>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
