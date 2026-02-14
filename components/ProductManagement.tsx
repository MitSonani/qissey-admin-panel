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
    Package,
    Image as ImageIcon,
    Copy,
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

type Variant = {
    id?: string;
    product_id?: string;
    color: string;
    size: string;
    sku: string;
    price: number | null;
    stock_quantity: number;
    image_urls: string[];
};

type Product = {
    id: string;
    sku: string | null;
    name: string;
    description: string;
    price: number;
    discount_price: number | null;
    collection_id: string | null;
    fabrics: string[];
    stock_quantity: number;
    status: "active" | "inactive";
    // Derived/Local only (not in DB)
    sizes?: string[];
    colors?: string[];
    created_at: string;
    collection?: Collection;
    variants?: Variant[];
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
        fabrics: [] as string[],
        variants: [] as Variant[],
        // Form session helpers (not saved to product table)
        colors: [] as string[],
        sizes: [] as string[],
    });
    const [pendingFiles, setPendingFiles] = useState<{ file: File; preview: string; color?: string }[]>([]);

    // Fetch Products
    const { data: products = [] } = useQuery({
        queryKey: ["products", searchQuery, collectionFilter],
        queryFn: async () => {
            let query = supabase
                .from("products")
                .select("*, collection:collections(id, name), variants:product_variants(*)")
                .order("created_at", { ascending: false });

            if (searchQuery) {
                query = query.ilike("name", `%${searchQuery}%`);
            }

            if (collectionFilter !== "all") {
                query = query.eq("collection_id", collectionFilter);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Map variants back to colors/sizes helpers for the form
            return (data as any[]).map(p => ({
                ...p,
                colors: Array.from(new Set(p.variants?.map((v: any) => v.color) || [])),
                sizes: Array.from(new Set(p.variants?.map((v: any) => v.size) || []))
            })) as Product[];
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
            fabrics: [],
            variants: [],
            colors: [],
            sizes: [],
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
            fabrics: product.fabrics || [],
            variants: product.variants || [],
            colors: product.colors || [],
            sizes: product.sizes || [],
        });
        setPendingFiles([]);
        setIsDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 1. Validation: If colors exist, ensure variants are added
        if (formData.colors.length > 0 && formData.variants.length === 0) {
            toast.error("Please add at least one variant for your chosen colors");
            return;
        }

        try {
            // Use a local copy of variants to avoid stale state issues with React's async setFormData
            let currentVariants = [...formData.variants];

            if (pendingFiles.length > 0) {
                toast.loading(`Uploading ${pendingFiles.length} images...`, { id: "upload" });
                const uploadPromises = pendingFiles.map(async (pf) => {
                    const url = await uploadProductImage(pf.file);
                    return { url, color: pf.color };
                });
                const uploadedResults = await Promise.all(uploadPromises);

                // Update our local variants copy with the new image URLs
                uploadedResults.forEach(result => {
                    if (result.color) {
                        currentVariants = currentVariants.map(v => {
                            if (v.color === result.color) {
                                return {
                                    ...v,
                                    image_urls: v.image_urls.includes(result.url)
                                        ? v.image_urls
                                        : [...v.image_urls, result.url]
                                };
                            }
                            return v;
                        });
                    }
                });

                // Also update the form state for UI consistency (though we'll reset it soon)
                setFormData(prev => ({ ...prev, variants: currentVariants }));
                toast.success("All images uploaded", { id: "upload" });
            }

            const productPayload = {
                sku: formData.sku,
                name: formData.name,
                description: formData.description,
                price: parseFloat(formData.price),
                discount_price: formData.discount_price ? parseFloat(formData.discount_price) : null,
                collection_id: formData.collection_id || null,
                fabrics: formData.fabrics,
                status: formData.status,
                stock_quantity: currentVariants.reduce((acc, v) => acc + v.stock_quantity, 0),
            };

            let productId = editingProduct?.id;

            if (editingProduct) {
                const { error } = await supabase
                    .from("products")
                    .update(productPayload)
                    .eq("id", editingProduct.id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from("products")
                    .insert([productPayload])
                    .select()
                    .single();
                if (error) throw error;
                productId = data.id;
            }

            if (productId) {
                // Handle Variants
                // 1. Clear existing variants for this product to avoid duplicates or conflicts
                const { error: deleteError } = await supabase
                    .from("product_variants")
                    .delete()
                    .eq("product_id", productId);
                if (deleteError) throw deleteError;

                // 2. Insert new/updated variants from our local currentVariants copy
                const variantsToInsert = currentVariants.map(v => ({
                    product_id: productId,
                    color: v.color,
                    size: v.size,
                    sku: v.sku,
                    price: v.price,
                    stock_quantity: v.stock_quantity,
                    image_urls: v.image_urls
                }));

                if (variantsToInsert.length > 0) {
                    const { error: variantError } = await supabase
                        .from("product_variants")
                        .insert(variantsToInsert);
                    if (variantError) throw variantError;
                }
            }

            queryClient.invalidateQueries({ queryKey: ["products"] });
            toast.success(editingProduct ? "Product updated" : "Product created");
            setIsDialogOpen(false);
            resetForm();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Submission failed";
            toast.error(message, { id: "upload" });
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, color?: string) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newPending = Array.from(files).map(file => ({
            file,
            preview: URL.createObjectURL(file),
            color: color // Associate with a color if provided
        }));

        setPendingFiles(prev => [...prev, ...newPending]);
    };

    const removeColorImage = (color: string, urlToRemove: string) => {
        setFormData(prev => ({
            ...prev,
            variants: prev.variants.map(v => {
                if (v.color === color) {
                    return {
                        ...v,
                        image_urls: v.image_urls.filter(url => url !== urlToRemove)
                    };
                }
                return v;
            })
        }));
    };

    const setSizes = (sizes: string[]) => {
        setFormData((prev) => {
            const newSizes = sizes;
            // 1. Filter out variants whose size is no longer present
            let newVariants = prev.variants.filter(v => newSizes.includes(v.size));

            // 2. For each size, ensure all defined colors have a variant
            newSizes.forEach(size => {
                prev.colors.forEach(color => {
                    const exists = newVariants.find(v => v.color === color && v.size === size);
                    if (!exists) {
                        newVariants.push({
                            color,
                            size,
                            sku: `${prev.sku ? prev.sku + "-" : ""}${color.substring(0, 3).toUpperCase()}-${size.substring(0, 3).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                            price: null,
                            stock_quantity: 0,
                            image_urls: []
                        });
                    }
                });
            });

            return { ...prev, sizes: newSizes, variants: newVariants };
        });
    };

    const setFabrics = (fabrics: string[]) => setFormData((prev) => ({ ...prev, fabrics }));

    const setColors = (colors: string[]) => {
        setFormData((prev) => {
            const newColors = colors;
            // 1. Filter out variants whose color is no longer present
            let newVariants = prev.variants.filter(v => newColors.includes(v.color));

            // 2. For each color, ensure all defined sizes have a variant
            newColors.forEach(color => {
                prev.sizes.forEach(size => {
                    const exists = newVariants.find(v => v.color === color && v.size === size);
                    if (!exists) {
                        newVariants.push({
                            color,
                            size,
                            sku: `${prev.sku ? prev.sku + "-" : ""}${color.substring(0, 3).toUpperCase()}-${size.substring(0, 3).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                            price: null,
                            stock_quantity: 0,
                            image_urls: []
                        });
                    }
                });
            });

            return { ...prev, colors: newColors, variants: newVariants };
        });
    };


    const updateVariant = (index: number, updates: Partial<Variant>) => {
        setFormData(prev => {
            const newVariants = [...prev.variants];
            newVariants[index] = { ...newVariants[index], ...updates };
            return { ...prev, variants: newVariants };
        });
    };

    const removeVariant = (index: number) => {
        setFormData(prev => ({
            ...prev,
            variants: prev.variants.filter((_, i) => i !== index)
        }));
    };

    const columns: ColumnDef<Product>[] = [
        {
            accessorKey: "variants",
            header: "Image",
            cell: ({ row }: { row: any }) => {
                const url = row.original.variants?.[0]?.image_urls?.[0];
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
                            if (window.confirm("Delete this product?")) {
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
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="inactive">Inactive</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground/80">Materials (Fabrics)</label>
                                        <TagInput
                                            placeholder="Add fabric (e.g. Cotton, Silk)"
                                            tags={formData.fabrics}
                                            setTags={setFabrics}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground/80">Description</label>
                                        <textarea
                                            placeholder="Write a compelling story about this product..."
                                            value={formData.description}
                                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full min-h-[120px] bg-muted/30 border border-muted-foreground/10 focus:bg-background rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
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
                                    <h3 className="text-lg font-semibold">Variants</h3>
                                    <p className="text-sm text-muted-foreground">Manage colors, sizes and images</p>
                                </div>

                                <div className="lg:col-span-8 space-y-12">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-muted/20 p-6 rounded-2xl border border-dashed">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                1. Define Available Colors
                                            </label>
                                            <TagInput
                                                placeholder="e.g. Red, Blue"
                                                tags={formData.colors}
                                                setTags={setColors}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                2. Define Available Sizes
                                            </label>
                                            <TagInput
                                                placeholder="e.g. S, M, L"
                                                tags={formData.sizes}
                                                setTags={setSizes}
                                            />
                                        </div>
                                    </div>

                                    {formData.colors.length === 0 ? (
                                        <div className="p-8 border rounded-xl border-dashed flex flex-col items-center justify-center text-center bg-muted/20">
                                            <Package className="h-8 w-8 text-muted-foreground mb-4 opacity-20" />
                                            <p className="text-sm font-medium">No colors added yet</p>
                                            <p className="text-xs text-muted-foreground">Add colors in the Specifications section above to start creating variants.</p>
                                        </div>
                                    ) : (
                                        formData.colors.map((color, colorIdx) => {
                                            const colorVariants = formData.variants.filter(v => v.color === color);
                                            return (
                                                <div key={colorIdx} className="space-y-6 p-6 rounded-2xl border bg-muted/10">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-4 h-4 rounded-full border shadow-sm" style={{ backgroundColor: color.toLowerCase() }} />
                                                            <h4 className="font-semibold text-base">{color}</h4>
                                                            <Badge variant="secondary" className="ml-2">{colorVariants.length} Variants</Badge>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        {colorVariants.length === 0 ? (
                                                            <p className="text-xs text-muted-foreground italic">No sizes added for this color yet.</p>
                                                        ) : (
                                                            <div className="grid grid-cols-1 gap-4">
                                                                {formData.variants.map((v, vIdx) => {
                                                                    if (v.color !== color) return null;
                                                                    return (
                                                                        <div key={vIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end bg-background p-4 rounded-xl border border-muted-foreground/10 shadow-sm relative group">
                                                                            <div className="sm:col-span-2 space-y-1.5">
                                                                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Size</label>
                                                                                <Select
                                                                                    value={v.size}
                                                                                    onValueChange={(val) => updateVariant(vIdx, { size: val })}
                                                                                >
                                                                                    <SelectTrigger className="h-9">
                                                                                        <SelectValue placeholder="Size" />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        {formData.sizes.map(size => (
                                                                                            <SelectItem key={size} value={size}>{size}</SelectItem>
                                                                                        ))}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>
                                                                            <div className="sm:col-span-4 space-y-1.5">
                                                                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">SKU (Optional)</label>
                                                                                <Input
                                                                                    placeholder="Variant SKU"
                                                                                    className="h-9"
                                                                                    value={v.sku}
                                                                                    onChange={(e) => updateVariant(vIdx, { sku: e.target.value })}
                                                                                />
                                                                            </div>
                                                                            <div className="sm:col-span-2 space-y-1.5">
                                                                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stock</label>
                                                                                <Input
                                                                                    type="number"
                                                                                    placeholder="0"
                                                                                    className="h-9"
                                                                                    value={v.stock_quantity}
                                                                                    onChange={(e) => updateVariant(vIdx, { stock_quantity: parseInt(e.target.value) || 0 })}
                                                                                />
                                                                            </div>
                                                                            <div className="sm:col-span-3 space-y-1.5">
                                                                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Price Override</label>
                                                                                <Input
                                                                                    type="number"
                                                                                    placeholder="Base price"
                                                                                    className="h-9"
                                                                                    value={v.price || ""}
                                                                                    onChange={(e) => updateVariant(vIdx, { price: e.target.value ? parseFloat(e.target.value) : null })}
                                                                                />
                                                                            </div>
                                                                            <div className="sm:col-span-1 flex justify-end">
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    onClick={() => removeVariant(vIdx)}
                                                                                    className="h-9 w-9 text-muted-foreground hover:text-destructive transition-colors"
                                                                                >
                                                                                    <X className="h-4 w-4" />
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-3 pt-2">
                                                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                            <ImageIcon className="h-3 w-3" />
                                                            {color} Images
                                                        </label>
                                                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                                                            <label className="aspect-[3/4] rounded-xl border-2 border-dashed border-muted-foreground/10 flex flex-col items-center justify-center cursor-pointer hover:bg-background hover:border-primary/30 transition-all group active:scale-[0.98]">
                                                                <Upload className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                                                <input type="file" hidden accept="image/*" multiple onChange={(e) => handleImageUpload(e, color)} />
                                                            </label>

                                                            {/* Existing Images for this color */}
                                                            {Array.from(new Set(formData.variants
                                                                .filter(v => v.color === color)
                                                                .flatMap(v => v.image_urls)
                                                            )).map((url, i) => (
                                                                <div key={`existing-${color}-${i}`} className="group relative aspect-[3/4] rounded-xl border-none overflow-hidden bg-muted/20 shadow-sm">
                                                                    <Image src={url} alt="" fill className="object-cover" />
                                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeColorImage(color, url)}
                                                                            className="h-7 w-7 rounded-full bg-destructive text-white flex items-center justify-center hover:scale-110 transition-transform"
                                                                        >
                                                                            <X size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            {/* Pending Images for this color */}
                                                            {pendingFiles.filter(pf => pf.color === color).map((pf, i) => (
                                                                <div key={`pending-${color}-${i}`} className="group relative aspect-[3/4] rounded-xl border-none overflow-hidden bg-muted/20 shadow-sm border-2 border-primary/20">
                                                                    <Image src={pf.preview} alt="" fill className="object-cover" />
                                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setPendingFiles(prev => prev.filter((_, idx) => {
                                                                                    const colorPending = prev.filter(p => p.color === color);
                                                                                    const absoluteIdx = prev.indexOf(colorPending[i]);
                                                                                    return idx !== absoluteIdx;
                                                                                }));
                                                                            }}
                                                                            className="h-7 w-7 rounded-full bg-destructive text-white flex items-center justify-center hover:scale-110 transition-transform"
                                                                        >
                                                                            <X size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }))}
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
