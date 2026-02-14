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
import { Plus, Pencil, Trash2, Loader2, Upload, X, Palette, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { uploadProductImage } from "@/lib/storage";
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Collection = {
    id: string;
    name: string;
    image_url: string;
    description: string | null;
    created_at: string;
};

type Color = {
    id: string;
    name: string;
    hex: string;
    created_at: string;
};

export default function CollectionManagement() {
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isColorDialogOpen, setIsColorDialogOpen] = useState(false);
    const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
    const [editingColor, setEditingColor] = useState<Color | null>(null);
    const [formData, setFormData] = useState({ name: "", description: "", image_url: "" });
    const [colorFormData, setColorFormData] = useState({ name: "", hex: "#000000" });
    const [pendingFile, setPendingFile] = useState<{ file: File; preview: string } | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 0);
        return () => clearTimeout(timer);
    }, []);

    // Fetch Collections
    const { data: collections = [] } = useQuery({
        queryKey: ["collections"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("collections")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data as Collection[];
        },
    });

    // Create Collection
    const createMutation = useMutation({
        mutationFn: async (newCollection: { name: string; description: string; image_url: string }) => {
            const { data, error } = await supabase
                .from("collections")
                .insert(newCollection)
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["collections"] });
            toast.success("Collection created successfully");
            setIsDialogOpen(false);
            resetForm();
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to create collection");
        },
    });

    // Update Collection
    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<Collection> }) => {
            const { data, error } = await supabase
                .from("collections")
                .update(updates)
                .eq("id", id)
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["collections"] });
            toast.success("Collection updated successfully");
            setIsDialogOpen(false);
            resetForm();
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to update collection");
        },
    });

    // Fetch Colors
    const { data: colors = [], isLoading: isColorsLoading } = useQuery({
        queryKey: ["colors"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("colors")
                .select("*")
                .order("name", { ascending: true });
            if (error) throw error;
            return data as Color[];
        },
    });

    // Create Color
    const createColorMutation = useMutation({
        mutationFn: async (newColor: { name: string; hex: string }) => {
            const { data, error } = await supabase
                .from("colors")
                .insert(newColor)
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["colors"] });
            toast.success("Color added to library");
            setIsColorDialogOpen(false);
            resetColorForm();
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to add color");
        },
    });

    // Update Color
    const updateColorMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<Color> }) => {
            const { data, error } = await supabase
                .from("colors")
                .update(updates)
                .eq("id", id)
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["colors"] });
            toast.success("Color updated successfully");
            setIsColorDialogOpen(false);
            resetColorForm();
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to update color");
        },
    });

    // Delete Color
    const deleteColorMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("colors").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["colors"] });
            toast.success("Color deleted from library");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to delete color");
        },
    });

    const resetForm = () => {
        setEditingCollection(null);
        setFormData({ name: "", description: "", image_url: "" });
        if (pendingFile) {
            URL.revokeObjectURL(pendingFile.preview);
            setPendingFile(null);
        }
    };

    const resetColorForm = () => {
        setEditingColor(null);
        setColorFormData({ name: "", hex: "#000000" });
    };

    // Delete Collection
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("collections").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["collections"] });
            toast.success("Collection deleted successfully");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to delete collection");
        },
    });

    const handleOpenEdit = (collection: Collection) => {
        resetForm();
        setEditingCollection(collection);
        setFormData({
            name: collection.name,
            description: collection.description || "",
            image_url: collection.image_url || "",
        });
        setIsDialogOpen(true);
    };

    const handleOpenColorEdit = (color: Color) => {
        resetColorForm();
        setEditingColor(color);
        setColorFormData({
            name: color.name,
            hex: color.hex,
        });
        setIsColorDialogOpen(true);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        if (pendingFile) {
            URL.revokeObjectURL(pendingFile.preview);
        }
        setPendingFile({
            file,
            preview: URL.createObjectURL(file)
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let finalImageUrl = formData.image_url;

        try {
            if (pendingFile) {
                toast.loading("Uploading image...", { id: "upload" });
                finalImageUrl = await uploadProductImage(pendingFile.file);
                toast.success("Image uploaded", { id: "upload" });
            }

            const payload = { ...formData, image_url: finalImageUrl };

            if (editingCollection) {
                updateMutation.mutate({ id: editingCollection.id, updates: payload });
            } else {
                createMutation.mutate(payload);
            }
        } catch {
            toast.error("Upload failed", { id: "upload" });
        }
    };

    const columns: ColumnDef<Collection>[] = [
        {
            accessorKey: "image_url",
            header: "Image",
            cell: ({ row }: { row: { original: Collection } }) => (
                <div className="h-10 w-10 rounded-md bg-muted overflow-hidden relative">
                    {row.original.image_url && <Image src={row.original.image_url} alt="" fill className="object-cover" />}
                </div>
            )
        },
        {
            accessorKey: "name",
            header: "Collection Name",
            cell: ({ row }: { row: { getValue: (key: string) => string } }) => <span className="font-medium">{row.getValue("name")}</span>,
        },
        {
            accessorKey: "created_at",
            header: "Created At",
            cell: ({ row }: { row: { getValue: (key: string) => string } }) => {
                const dateValue = row.getValue("created_at");
                if (!dateValue) return "N/A";
                try {
                    return format(new Date(dateValue), "MMM dd, yyyy");
                } catch {
                    return "Invalid date";
                }
            },
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }: { row: { original: Collection } }) => (
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
                            if (confirm("Are you sure? This will delete the collection.")) {
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

    const colorColumns: ColumnDef<Color>[] = [
        {
            id: "color-preview",
            accessorKey: "hex",
            header: "Preview",
            cell: ({ row }: { row: { original: Color } }) => (
                <div
                    className="h-8 w-8 rounded-full border shadow-sm"
                    style={{ backgroundColor: row.original.hex }}
                />
            )
        },
        {
            accessorKey: "name",
            header: "Color Name",
            cell: ({ row }: { row: { original: Color } }) => <span className="font-medium uppercase">{row.original.name}</span>,
        },
        {
            id: "color-hex",
            accessorKey: "hex",
            header: "Hex Code",
            cell: ({ row }: { row: { original: Color } }) => <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{row.original.hex}</code>,
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }: { row: { original: Color } }) => (
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenColorEdit(row.original)}
                        className="hover:text-primary"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            if (confirm("Are you sure? This will delete the color from the global library.")) {
                                deleteColorMutation.mutate(row.original.id);
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

    if (!isMounted) return <div className="min-h-[400px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

    return (
        <div className="space-y-6">
            <Tabs defaultValue="collections" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-8 bg-muted/50 p-1">
                    <TabsTrigger value="collections" className="flex items-center gap-2">
                        <LayoutGrid size={14} />
                        Collections
                    </TabsTrigger>
                    <TabsTrigger value="colors" className="flex items-center gap-2">
                        <Palette size={14} />
                        Color Library
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="collections" className="space-y-6 outline-none">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Collections</h1>
                            <p className="text-muted-foreground">Manage your product collections</p>
                        </div>
                        <Button onClick={() => {
                            resetForm();
                            setIsDialogOpen(true);
                        }} className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            New Collection
                        </Button>
                    </div>

                    <DataTable columns={columns} data={collections} />
                </TabsContent>

                <TabsContent value="colors" className="space-y-6 outline-none">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-foreground/90">Color Library</h2>
                            <p className="text-sm text-muted-foreground">Standardized colors for product variants</p>
                        </div>
                        <Button onClick={() => {
                            resetColorForm();
                            setIsColorDialogOpen(true);
                        }} variant="outline" className="flex items-center gap-2 border-primary/20 hover:bg-primary/5">
                            <Plus className="h-4 w-4 text-primary" />
                            Add Color
                        </Button>
                    </div>
                    <DataTable columns={colorColumns} data={colors} loading={isColorsLoading} />
                </TabsContent>
            </Tabs>

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
                if (!open) resetForm();
                setIsDialogOpen(open);
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingCollection ? "Edit Collection" : "Add New Collection"}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Name</label>
                            <Input
                                required
                                placeholder="e.g. Summer Specials"
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
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Collection Image</label>
                            <div className="flex gap-4 items-center">
                                <div className="h-20 w-20 rounded-md border bg-muted flex items-center justify-center overflow-hidden relative">
                                    {(pendingFile || formData.image_url) ? (
                                        <>
                                            <Image src={pendingFile?.preview || formData.image_url} alt="" fill className="object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (pendingFile) {
                                                        URL.revokeObjectURL(pendingFile.preview);
                                                        setPendingFile(null);
                                                    } else {
                                                        setFormData({ ...formData, image_url: "" });
                                                    }
                                                }}
                                                className="absolute top-1 right-1 p-0.5 bg-destructive text-white rounded-full z-10"
                                            >
                                                <X size={12} />
                                            </button>
                                        </>
                                    ) : (
                                        <Upload size={20} className="text-muted-foreground" />
                                    )}
                                </div>
                                <label className="cursor-pointer">
                                    <Button type="button" variant="outline" size="sm" asChild>
                                        <span>Select Image</span>
                                    </Button>
                                    <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                                </label>
                            </div>
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
                                {editingCollection ? "Update" : "Create"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isColorDialogOpen} onOpenChange={(open) => {
                if (!open) resetColorForm();
                setIsColorDialogOpen(open);
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingColor ? "Edit Color" : "Add New Color"}
                        </DialogTitle>
                    </DialogHeader>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (editingColor) {
                                updateColorMutation.mutate({ id: editingColor.id, updates: colorFormData });
                            } else {
                                createColorMutation.mutate(colorFormData);
                            }
                        }}
                        className="space-y-4 py-4"
                    >
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground/80">Color Name</label>
                            <Input
                                required
                                placeholder="e.g. Midnight Black"
                                value={colorFormData.name}
                                onChange={(e) => setColorFormData({ ...colorFormData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground/80">Color value</label>
                            <div className="flex gap-4 items-center">

                                <Input
                                    type="color"
                                    className="w-12 h-10 p-0 overflow-hidden cursor-pointer border-none bg-transparent"
                                    value={colorFormData.hex}
                                    onChange={(e) => setColorFormData({ ...colorFormData, hex: e.target.value })}
                                />
                                <Input
                                    placeholder="#000000"
                                    value={colorFormData.hex}
                                    onChange={(e) => setColorFormData({ ...colorFormData, hex: e.target.value })}
                                    className="font-mono"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsColorDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={createColorMutation.isPending || updateColorMutation.isPending}
                            >
                                {(createColorMutation.isPending || updateColorMutation.isPending) && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                {editingColor ? "Update Color" : "Add to Library"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
