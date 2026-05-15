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
    Plus,
    Pencil,
    Trash2,
    Loader2,
    Upload,
    X,
    LayoutTemplate,
    ExternalLink,
    CheckCircle2,
    XCircle
} from "lucide-react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { uploadImage } from "@/lib/storage";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";

type HeroSlide = {
    id: string;
    desktop_image_url: string;
    mobile_image_url: string | null;
    title: string | null;
    subtitle: string | null;
    link_url: string | null;
    order_index: number;
    is_active: boolean;
    created_at: string;
};

export default function HeroSlideManagement() {
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSlide, setEditingSlide] = useState<HeroSlide | null>(null);
    const [formData, setFormData] = useState({
        title: "",
        subtitle: "",
        link_url: "",
        desktop_image_url: "",
        mobile_image_url: "",
        order_index: 0,
        is_active: true
    });
    
    const [pendingDesktopFile, setPendingDesktopFile] = useState<{ file: File; preview: string } | null>(null);
    const [pendingMobileFile, setPendingMobileFile] = useState<{ file: File; preview: string } | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Fetch Slides
    const { data: slides = [], isLoading } = useQuery({
        queryKey: ["hero_slides"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("hero_slides")
                .select("*")
                .order("order_index", { ascending: true });
            if (error) throw error;
            return data as HeroSlide[];
        },
    });

    // Create/Update mutations
    const upsertMutation = useMutation({
        mutationFn: async (payload: any) => {
            if (editingSlide) {
                const { data, error } = await supabase
                    .from("hero_slides")
                    .update(payload)
                    .eq("id", editingSlide.id)
                    .select();
                if (error) throw error;
                return data;
            } else {
                const { data, error } = await supabase
                    .from("hero_slides")
                    .insert(payload)
                    .select();
                if (error) throw error;
                return data;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["hero_slides"] });
            toast.success(editingSlide ? "Slide updated" : "Slide created");
            setIsDialogOpen(false);
            resetForm();
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to save slide");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("hero_slides").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["hero_slides"] });
            toast.success("Slide deleted");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to delete slide");
        },
    });

    const resetForm = () => {
        setEditingSlide(null);
        setFormData({
            title: "",
            subtitle: "",
            link_url: "",
            desktop_image_url: "",
            mobile_image_url: "",
            order_index: slides.length > 0 ? Math.max(...slides.map(s => s.order_index)) + 1 : 0,
            is_active: true
        });
        if (pendingDesktopFile) {
            URL.revokeObjectURL(pendingDesktopFile.preview);
            setPendingDesktopFile(null);
        }
        if (pendingMobileFile) {
            URL.revokeObjectURL(pendingMobileFile.preview);
            setPendingMobileFile(null);
        }
    };

    const handleOpenEdit = (slide: HeroSlide) => {
        setEditingSlide(slide);
        setFormData({
            title: slide.title || "",
            subtitle: slide.subtitle || "",
            link_url: slide.link_url || "",
            desktop_image_url: slide.desktop_image_url || "",
            mobile_image_url: slide.mobile_image_url || "",
            order_index: slide.order_index,
            is_active: slide.is_active
        });
        setIsDialogOpen(true);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'desktop' | 'mobile') => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        const preview = URL.createObjectURL(file);
        
        if (type === 'desktop') {
            if (pendingDesktopFile) URL.revokeObjectURL(pendingDesktopFile.preview);
            setPendingDesktopFile({ file, preview });
        } else {
            if (pendingMobileFile) URL.revokeObjectURL(pendingMobileFile.preview);
            setPendingMobileFile({ file, preview });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let desktopUrl = formData.desktop_image_url;
        let mobileUrl = formData.mobile_image_url;

        try {
            if (pendingDesktopFile) {
                toast.loading("Uploading desktop image...", { id: "upload-desktop" });
                desktopUrl = await uploadImage(pendingDesktopFile.file, "", "banners");
                toast.success("Desktop image uploaded", { id: "upload-desktop" });
            }

            if (pendingMobileFile) {
                toast.loading("Uploading mobile image...", { id: "upload-mobile" });
                mobileUrl = await uploadImage(pendingMobileFile.file, "", "banners");
                toast.success("Mobile image uploaded", { id: "upload-mobile" });
            }

            const payload = {
                ...formData,
                desktop_image_url: desktopUrl,
                mobile_image_url: mobileUrl || null,
                title: formData.title || null,
                subtitle: formData.subtitle || null,
                link_url: formData.link_url || null,
            };

            if (!payload.desktop_image_url) {
                toast.error("Desktop image is required");
                return;
            }

            upsertMutation.mutate(payload);
        } catch (error) {
            console.error(error);
            toast.error("Upload failed");
        }
    };

    const columns: ColumnDef<HeroSlide>[] = [
        {
            accessorKey: "order_index",
            header: "Order",
            cell: ({ row }) => <span className="font-mono text-xs">{row.original.order_index}</span>,
        },
        {
            accessorKey: "desktop_image_url",
            header: "Desktop Preview",
            cell: ({ row }) => (
                <div className="h-12 w-24 rounded-md bg-muted overflow-hidden relative border shadow-sm">
                    {row.original.desktop_image_url && (
                        <Image src={row.original.desktop_image_url} alt="" fill className="object-cover" />
                    )}
                </div>
            )
        },
        {
            accessorKey: "mobile_image_url",
            header: "Mobile Preview",
            cell: ({ row }) => (
                <div className="h-12 w-10 rounded-md bg-muted overflow-hidden relative border shadow-sm">
                    {row.original.mobile_image_url ? (
                        <Image src={row.original.mobile_image_url} alt="" fill className="object-cover" />
                    ) : (
                        <div className="flex items-center justify-center h-full text-[8px] text-muted-foreground">N/A</div>
                    )}
                </div>
            )
        },
        {
            accessorKey: "title",
            header: "Title",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.original.title || "Untitled"}</span>
                    {row.original.subtitle && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{row.original.subtitle}</span>}
                </div>
            ),
        },
        {
            accessorKey: "is_active",
            header: "Status",
            cell: ({ row }) => (
                <Badge variant={row.original.is_active ? "default" : "secondary"} className="flex w-fit items-center gap-1">
                    {row.original.is_active ? (
                        <><CheckCircle2 size={12} /> Active</>
                    ) : (
                        <><XCircle size={12} /> Inactive</>
                    )}
                </Badge>
            ),
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    {row.original.link_url && (
                        <Button variant="ghost" size="icon" asChild>
                            <a href={row.original.link_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </Button>
                    )}
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
                            if (confirm("Are you sure? This will delete the hero slide.")) {
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

    if (!isMounted) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Hero Slides</h1>
                    <p className="text-muted-foreground">Manage homepage banner images and banners</p>
                </div>
                <Button onClick={() => {
                    resetForm();
                    setIsDialogOpen(true);
                }} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    New Slide
                </Button>
            </div>

            <DataTable columns={columns} data={slides} loading={isLoading} />

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
                if (!open) resetForm();
                setIsDialogOpen(open);
            }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingSlide ? "Edit Hero Slide" : "Add New Hero Slide"}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Title</label>
                                <Input
                                    placeholder="e.g. New Collection 2024"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Subtitle</label>
                                <Input
                                    placeholder="e.g. Up to 50% Off"
                                    value={formData.subtitle}
                                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Link URL</label>
                            <Input
                                placeholder="e.g. /collections/summer-sale"
                                value={formData.link_url}
                                onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Desktop Image (Required)</label>
                                <div className="flex flex-col gap-4">
                                    <div className="h-32 w-full rounded-md border bg-muted flex items-center justify-center overflow-hidden relative shadow-inner">
                                        {(pendingDesktopFile || formData.desktop_image_url) ? (
                                            <>
                                                <Image src={pendingDesktopFile?.preview || formData.desktop_image_url} alt="" fill className="object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (pendingDesktopFile) {
                                                            URL.revokeObjectURL(pendingDesktopFile.preview);
                                                            setPendingDesktopFile(null);
                                                        } else {
                                                            setFormData({ ...formData, desktop_image_url: "" });
                                                        }
                                                    }}
                                                    className="absolute top-2 right-2 p-1 bg-destructive/80 text-white rounded-full z-10 hover:bg-destructive"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center gap-1 text-muted-foreground text-xs">
                                                <Upload size={24} />
                                                <span>1920x600 recommended</span>
                                            </div>
                                        )}
                                    </div>
                                    <label className="cursor-pointer mx-auto">
                                        <Button type="button" variant="outline" size="sm" asChild>
                                            <span>Select Desktop Image</span>
                                        </Button>
                                        <input type="file" hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'desktop')} />
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Mobile Image (Optional)</label>
                                <div className="flex flex-col gap-4">
                                    <div className="h-32 w-full rounded-md border bg-muted flex items-center justify-center overflow-hidden relative shadow-inner">
                                        {(pendingMobileFile || formData.mobile_image_url) ? (
                                            <>
                                                <Image src={pendingMobileFile?.preview || formData.mobile_image_url} alt="" fill className="object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (pendingMobileFile) {
                                                            URL.revokeObjectURL(pendingMobileFile.preview);
                                                            setPendingMobileFile(null);
                                                        } else {
                                                            setFormData({ ...formData, mobile_image_url: "" });
                                                        }
                                                    }}
                                                    className="absolute top-2 right-2 p-1 bg-destructive/80 text-white rounded-full z-10 hover:bg-destructive"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center gap-1 text-muted-foreground text-xs">
                                                <Upload size={24} />
                                                <span>600x800 recommended</span>
                                            </div>
                                        )}
                                    </div>
                                    <label className="cursor-pointer mx-auto">
                                        <Button type="button" variant="outline" size="sm" asChild>
                                            <span>Select Mobile Image</span>
                                        </Button>
                                        <input type="file" hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'mobile')} />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Order Index</label>
                                <Input
                                    type="number"
                                    value={formData.order_index}
                                    onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="flex items-center gap-2 h-full pt-6">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    className="w-4 h-4 accent-primary"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                />
                                <label htmlFor="is_active" className="text-sm font-medium cursor-pointer">
                                    Display slide publicly
                                </label>
                            </div>
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={upsertMutation.isPending}
                            >
                                {upsertMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                {editingSlide ? "Update Slide" : "Create Slide"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
