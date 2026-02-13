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
import { Plus, Pencil, Trash2, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { uploadProductImage } from "@/lib/storage";
import Image from "next/image";

type Collection = {
    id: string;
    name: string;
    image_url: string;
    description: string | null;
    created_at: string;
};

export default function CollectionManagement() {
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
    const [formData, setFormData] = useState({ name: "", description: "", image_url: "" });
    const [pendingFile, setPendingFile] = useState<{ file: File; preview: string } | null>(null);

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

    const resetForm = () => {
        setEditingCollection(null);
        setFormData({ name: "", description: "", image_url: "" });
        if (pendingFile) {
            URL.revokeObjectURL(pendingFile.preview);
            setPendingFile(null);
        }
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
        } catch (error) {
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
            cell: ({ row }: { row: { getValue: (key: string) => string } }) => format(new Date(row.getValue("created_at")), "MMM dd, yyyy"),
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

    return (
        <div className="space-y-6">
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
        </div>
    );
}
