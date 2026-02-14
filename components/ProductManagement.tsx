"use client";

import { useState, useEffect } from "react";
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

type ColorItem = {
    id: string;
    name: string;
    hex: string;
};

type Variant = {
    id?: string;
    product_id?: string;
    color_id: string | null;
    size: string;
    sku: string;
    price: number | null;
    stock_quantity: number;
    image_urls: string[];
    is_primary: boolean;
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
    colors?: ColorItem[];
    created_at: string;
    collection?: Collection;
    variants?: Variant[];
};

export default function ProductManagement() {
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
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
        colors: [] as ColorItem[],
        sizes: [] as string[],
    });
    const [pendingFiles, setPendingFiles] = useState<{ file: File; preview: string; colorId?: string }[]>([]);

    // Fetch Products (Lightweight list version)
    const { data: products = [], isLoading: isListLoading } = useQuery({
        queryKey: ["products", searchQuery, collectionFilter],
        queryFn: async () => {
            let query = supabase
                .from("products")
                .select("id, sku, name, price, discount_price, stock_quantity, status, collection_id, created_at, fabrics, collection:collections(id, name), variants:product_variants(image_urls, is_primary)")
                .order("created_at", { ascending: false })
                .order("is_primary", { foreignTable: "product_variants", ascending: false })
                .limit(1, { foreignTable: 'product_variants' });

            if (searchQuery) {
                query = query.ilike("name", `%${searchQuery}%`);
            }

            if (collectionFilter !== "all") {
                query = query.eq("collection_id", collectionFilter);
            }

            const { data, error } = await query;
            if (error) throw error;

            return (data as unknown as Product[]).map(p => ({
                ...p,
                // Ensure variants have defaults for new fields
                variants: (p.variants?.slice(0, 1) || []).map((v: Variant) => ({
                    ...v,
                    is_primary: v.is_primary ?? false,
                }))
            })) as Product[];
        },
    });

    // Fetch Full Product Details (On demand for editing)
    const { data: productDetails, isFetching: isFetchingDetails } = useQuery({
        queryKey: ["product-details", selectedProductId],
        queryFn: async () => {
            if (!selectedProductId) return null;
            const { data, error } = await supabase
                .from("products")
                .select("*, collection:collections(id, name), variants:product_variants(*, color_obj:colors(*))")
                .eq("id", selectedProductId)
                .single();
            if (error) throw error;

            const variants = (data.variants || []).map((v: Variant & { color_obj: { name: string; hex: string } }) => ({
                ...v,
                is_primary: v.is_primary ?? false
            }));

            const colorsMap = new Map<string, ColorItem>();
            variants.forEach((v: Variant & { color_obj: { name: string; hex: string } }) => {
                if (v.color_id && !colorsMap.has(v.color_id)) {
                    // Try to get color details from the join
                    const colorDetails = v.color_id ? v.color_obj : null;
                    if (colorDetails && typeof colorDetails === 'object') {
                        colorsMap.set(v.color_id, {
                            id: v.color_id,
                            name: colorDetails.name,
                            hex: colorDetails.hex
                        });
                    }
                }
            });

            return {
                ...data,
                variants,
                colors: Array.from(colorsMap.values()),
                sizes: Array.from(new Set(variants.map((v: Variant) => v.size)))
            } as Product;
        },
        enabled: !!selectedProductId,
    });

    // Handle initial form population when editing
    useEffect(() => {
        if (productDetails && editingProduct && selectedProductId === editingProduct.id) {
            console.log("Populating form with product details:", productDetails.name, "Variants:", productDetails.variants?.length);
            setFormData({
                sku: productDetails.sku || "",
                name: productDetails.name,
                description: productDetails.description || "",
                price: productDetails.price.toString(),
                discount_price: productDetails.discount_price?.toString() || "",
                collection_id: productDetails.collection_id || "",
                stock_quantity: productDetails.stock_quantity.toString(),
                status: productDetails.status,
                fabrics: productDetails.fabrics || [],
                variants: productDetails.variants || [],
                colors: productDetails.colors || [],
                sizes: productDetails.sizes || [],
            });
        }
    }, [productDetails, editingProduct, selectedProductId]);

    // Fetch Collections for dropdown
    const { data: collections = [] } = useQuery({
        queryKey: ["collections"],
        queryFn: async () => {
            const { data, error } = await supabase.from("collections").select("id, name");
            if (error) throw error;
            return data as Collection[];
        },
    });

    // Fetch Global Standard Colors
    const { data: globalColors = [], isLoading: isGlobalColorsLoading } = useQuery({
        queryKey: ["global-colors"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("colors")
                .select("*")
                .order("name", { ascending: true });
            if (error) throw error;
            return data as ColorItem[];
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
        setSelectedProductId(null);
    };

    const handleOpenCreate = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    const handleOpenEdit = (product: Product) => {
        setEditingProduct(product);
        setSelectedProductId(product.id);
        // Clear old form data first
        setFormData({
            sku: product.sku || "",
            name: product.name,
            description: "",
            price: product.price.toString(),
            discount_price: product.discount_price?.toString() || "",
            collection_id: product.collection_id || "",
            stock_quantity: product.stock_quantity.toString(),
            status: product.status,
            fabrics: product.fabrics || [],
            variants: [],
            colors: [],
            sizes: [],
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
                const uploadPromises = pendingFiles.map(async (pf: { file: File; colorId?: string }) => {
                    const url = await uploadProductImage(pf.file);
                    return { url, colorId: pf.colorId };
                });
                const uploadedResults = await Promise.all(uploadPromises);

                // Update our local variants copy with the new image URLs
                uploadedResults.forEach(result => {
                    if (result.colorId) {
                        currentVariants = currentVariants.map(v => {
                            if (v.color_id === result.colorId) {
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

                // Ensure at least one variant is primary if any exist
                if (currentVariants.length > 0 && !currentVariants.some(v => v.is_primary)) {
                    currentVariants[0].is_primary = true;
                }

                // 2. Insert new/updated variants from our local currentVariants copy
                const variantsToInsert = currentVariants.map(v => ({
                    product_id: productId,
                    color_id: v.color_id,
                    size: v.size,
                    sku: v.sku,
                    price: v.price,
                    stock_quantity: v.stock_quantity,
                    image_urls: v.image_urls,
                    is_primary: v.is_primary
                }));
                console.log("Saving variants:", variantsToInsert.length);

                if (variantsToInsert.length > 0) {
                    const { error: variantError } = await supabase
                        .from("product_variants")
                        .insert(variantsToInsert);
                    if (variantError) throw variantError;
                }
            }

            queryClient.invalidateQueries({ queryKey: ["products"] });
            queryClient.invalidateQueries({ queryKey: ["product-details", productId] });
            toast.success(editingProduct ? "Product updated" : "Product created");
            setIsDialogOpen(false);
            resetForm();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Submission failed";
            toast.error(message, { id: "upload" });
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, colorId?: string) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newPending = Array.from(files).map(file => ({
            file,
            preview: URL.createObjectURL(file),
            colorId: colorId // Associate with a color ID if provided
        }));

        setPendingFiles(prev => [...prev, ...newPending]);
    };

    const removeColorImage = (colorId: string, urlToRemove: string) => {
        setFormData(prev => ({
            ...prev,
            variants: prev.variants.map(v => {
                if (v.color_id === colorId) {
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
            const newVariants = prev.variants.filter(v => newSizes.includes(v.size));

            // 2. For each size, ensure all defined colors have a variant
            newSizes.forEach(size => {
                prev.colors.forEach(colorObj => {
                    const exists = newVariants.find(v => v.color_id === colorObj.id && v.size === size);
                    if (!exists) {
                        newVariants.push({
                            color_id: colorObj.id,
                            size,
                            sku: `${prev.sku ? prev.sku + "-" : ""}${colorObj.name.substring(0, 3).toUpperCase()}-${size.substring(0, 3).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                            price: null,
                            stock_quantity: 0,
                            image_urls: [],
                            is_primary: false
                        });
                    }
                });
            });

            return { ...prev, sizes: newSizes, variants: newVariants };
        });
    };

    const setFabrics = (fabrics: string[]) => setFormData((prev) => ({ ...prev, fabrics }));

    const setColors = (colors: ColorItem[]) => {
        setFormData((prev) => {
            const newColors = colors;
            // 1. Filter out variants whose color is no longer present
            const colorIds = newColors.map(c => c.id);
            const newVariants = prev.variants.filter(v => v.color_id && colorIds.includes(v.color_id));

            // 2. For each color, ensure all defined sizes have a variant
            newColors.forEach(colorObj => {
                prev.sizes.forEach(size => {
                    const exists = newVariants.find(v => v.color_id === colorObj.id && v.size === size);
                    if (!exists) {
                        newVariants.push({
                            color_id: colorObj.id,
                            size,
                            sku: `${prev.sku ? prev.sku + "-" : ""}${colorObj.name.substring(0, 3).toUpperCase()}-${size.substring(0, 3).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                            price: null,
                            stock_quantity: 0,
                            image_urls: [],
                            is_primary: false
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

    const setPrimaryColor = (colorId: string) => {
        setFormData(prev => ({
            ...prev,
            variants: prev.variants.map((v, i) => {
                // Find the first variant of this color ID to be the primary flag bearer
                const isFirstOfColor = prev.variants.findIndex(varnt => varnt.color_id === colorId) === i;
                return { ...v, is_primary: colorId === v.color_id && isFirstOfColor };
            })
        }));
    };

    const columns: ColumnDef<Product>[] = [
        {
            accessorKey: "variants",
            header: "Image",
            cell: ({ row }: { row: { original: Product } }) => {
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
            cell: ({ row }: { row: { original: Product } }) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.original.name}</span>
                    <span className="text-xs text-muted-foreground">{row.original.collection?.name || "No Collection"}</span>
                </div>
            ),
        },
        {
            accessorKey: "price",
            header: "Price",
            cell: ({ row }: { row: { original: Product } }) => (
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
            cell: ({ row }: { row: { original: Product } }) => {
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
            cell: ({ row }: { row: { original: Product } }) => (
                <Badge variant={row.original.status === "active" ? "default" : "outline"}>
                    {row.original.status}
                </Badge>
            ),
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }: { row: { original: Product } }) => (
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

            <DataTable columns={columns} data={products} loading={isListLoading} />

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-[1600px] sm:max-w-none w-[98vw] h-[95vh] max-h-[95vh] p-0 border-none shadow-2xl flex flex-col bg-background overflow-hidden rounded-[1.5rem]">
                    <DialogHeader className="p-6 bg-background border-b shrink-0">
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-xl font-semibold text-primary">
                                {editingProduct ? "Edit Product" : "Add New Product"}
                            </DialogTitle>
                            {isFetchingDetails && (
                                <div className="flex items-center gap-2 text-sm text-primary animate-pulse">
                                    <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                    Loading details...
                                </div>
                            )}
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
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {formData.colors.map((c, i) => (
                                                    <Badge key={i} variant="secondary" className="pl-1 pr-1.5 py-1 gap-1.5 bg-background border-muted-foreground/20">
                                                        <div className="w-4 h-4 rounded-full border shadow-sm" style={{ backgroundColor: c.hex }} />
                                                        <span className="text-xs font-medium uppercase">{c.name}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setColors(formData.colors.filter((_, idx) => idx !== i))}
                                                            className="text-muted-foreground hover:text-destructive transition-colors"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </Badge>
                                                ))}
                                            </div>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Select
                                                        onValueChange={(val) => {
                                                            const color = globalColors.find(c => c.name === val);
                                                            if (color && !formData.colors.some(c => c.name === color.name)) {
                                                                setColors([...formData.colors, color]);
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-10 bg-background/50 border-muted-foreground/10 flex-1">
                                                            <SelectValue placeholder="Select from library..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {globalColors.map((c) => (
                                                                <SelectItem key={c.name} value={c.name}>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: c.hex }} />
                                                                        <span>{c.name}</span>
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                            {globalColors.length === 0 && (
                                                                <p className="p-2 text-xs text-muted-foreground italic">No colors in library yet</p>
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>


                                            </div>
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
                                        formData.colors.map((colorObj, colorIdx) => {
                                            const colorVariants = formData.variants.filter(v => v.color_id === colorObj.id);
                                            return (
                                                <div key={colorIdx} className={`space-y-6 p-6 rounded-2xl border bg-muted/10 relative ${colorVariants.some(v => v.is_primary) ? 'border-black border-2' : ''}`}>
                                                    {colorVariants.some(v => v.is_primary) && (
                                                        <div className="absolute top-[-12px] left-3 z-10">
                                                            <Badge className="text-[10px] h-5 bg-black text-white border-black font-bold uppercase tracking-wider shadow-md">PRIMARY</Badge>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="w-10 h-10 rounded-full border shadow-sm overflow-hidden relative"
                                                                style={{ backgroundColor: colorObj.hex }}
                                                            />
                                                            <div className="flex flex-col">
                                                                <h4 className="font-semibold text-base uppercase tracking-tight">{colorObj.name}</h4>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="outline" className="text-[10px] h-5">{colorVariants.length} Sizes</Badge>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setPrimaryColor(colorObj.id)}
                                                                className={`h-8 px-3 rounded-full text-xs font-medium transition-all ${colorVariants.some(v => v.is_primary) ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground hover:bg-muted'}`}
                                                            >
                                                                {colorVariants.some(v => v.is_primary) ? 'Primary Color' : 'Set as Primary'}
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        {colorVariants.length === 0 ? (
                                                            <p className="text-xs text-muted-foreground italic">No sizes added for this color yet.</p>
                                                        ) : (
                                                            <div className="grid grid-cols-1 gap-4">
                                                                {formData.variants.map((v, vIdx) => {
                                                                    if (v.color_id !== colorObj.id) return null;
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
                                                                            <div className="sm:col-span-2 space-y-1.5">
                                                                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Price Override</label>
                                                                                <Input
                                                                                    type="number"
                                                                                    placeholder="Base price"
                                                                                    className="h-9"
                                                                                    value={v.price || ""}
                                                                                    onChange={(e) => updateVariant(vIdx, { price: e.target.value ? parseFloat(e.target.value) : null })}
                                                                                />
                                                                            </div>
                                                                            <div className="sm:col-span-1 flex items-center justify-center">
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
                                                            {colorObj.name} Images
                                                        </label>
                                                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                                                            <label className="aspect-[3/4] rounded-xl border-2 border-dashed border-muted-foreground/10 flex flex-col items-center justify-center cursor-pointer hover:bg-background hover:border-primary/30 transition-all group active:scale-[0.98]">
                                                                <Upload className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                                                <input type="file" hidden accept="image/*" multiple onChange={(e) => handleImageUpload(e, colorObj.id)} />
                                                            </label>

                                                            {/* Existing Images for this color */}
                                                            {Array.from(new Set(formData.variants
                                                                .filter(v => v.color_id === colorObj.id)
                                                                .flatMap(v => v.image_urls)
                                                            )).map((url, i) => (
                                                                <div key={`existing-${colorObj.id}-${i}`} className="group relative aspect-[3/4] rounded-xl border-none overflow-hidden bg-muted/20 shadow-sm">
                                                                    <Image src={url} alt="" fill className="object-cover" />
                                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeColorImage(colorObj.id, url)}
                                                                            className="h-7 w-7 rounded-full bg-destructive text-white flex items-center justify-center hover:scale-110 transition-transform"
                                                                        >
                                                                            <X size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            {/* Pending Images for this color */}
                                                            {pendingFiles.filter(pf => pf.colorId === colorObj.id).map((pf, i) => (
                                                                <div key={`pending-${colorObj.id}-${i}`} className="group relative aspect-[3/4] rounded-xl border-none overflow-hidden bg-muted/20 shadow-sm border-2 border-primary/20">
                                                                    <Image src={pf.preview} alt="" fill className="object-cover" />
                                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setPendingFiles(prev => prev.filter((_, idx) => {
                                                                                    const colorPending = prev.filter(p => p.colorId === colorObj.id);
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
