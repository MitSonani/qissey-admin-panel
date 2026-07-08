"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DataTable } from "@/components/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Star, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type ProductReview = {
    id: string;
    product_id: string;
    user_id: string;
    rating: number;
    comment: string;
    user_name: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    products?: {
        name: string;
    };
};

export default function ReviewManagement() {
    const queryClient = useQueryClient();

    // Fetch Reviews
    const { data: reviews = [], isLoading } = useQuery({
        queryKey: ["product_reviews"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("product_reviews")
                .select(`
                    *,
                    products ( name )
                `)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data as ProductReview[];
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string, status: 'approved' | 'rejected' }) => {
            const { error } = await supabase
                .from("product_reviews")
                .update({ status })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["product_reviews"] });
            toast.success("Review status updated successfully");
        },
        onError: (error) => {
            toast.error("Failed to update review status");
            console.error(error);
        }
    });

    const deleteReviewMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("product_reviews")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["product_reviews"] });
            toast.success("Review deleted successfully");
        },
        onError: (error) => {
            toast.error("Failed to delete review");
            console.error(error);
        }
    });

    const columns: ColumnDef<ProductReview>[] = [
        {
            accessorKey: "user_name",
            header: "Reviewer",
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Star size={16} className="text-muted-foreground" />
                    </div>
                    <div className="flex flex-col min-w-[120px]">
                        <span className="font-medium truncate">{row.original.user_name}</span>
                        <span className="text-xs text-muted-foreground truncate">
                            Rating: {row.original.rating}/5
                        </span>
                    </div>
                </div>
            ),
        },
        {
            accessorKey: "products.name",
            header: "Product",
            cell: ({ row }) => (
                <div className="max-w-[200px] truncate" title={row.original.products?.name}>
                    {row.original.products?.name || "Unknown Product"}
                </div>
            ),
        },
        {
            accessorKey: "comment",
            header: "Comment",
            cell: ({ row }) => (
                <div className="min-w-[200px] max-w-[500px] whitespace-pre-wrap break-words">
                    {row.original.comment}
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.original.status || 'pending';
                const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
                    pending: "secondary",
                    approved: "default",
                    rejected: "destructive",
                };

                return (
                    <Badge variant={variants[status] || "secondary"} className="capitalize">
                        {status}
                    </Badge>
                );
            }
        },
        {
            accessorKey: "created_at",
            header: "Date",
            cell: ({ row }) => format(new Date(row.original.created_at), "dd MMM yyyy"),
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => {
                const isPending = !row.original.status || row.original.status === 'pending';

                return (
                    <div className="flex gap-2">
                        {row.original.status !== 'approved' && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                                onClick={() => updateStatusMutation.mutate({ id: row.original.id, status: 'approved' })}
                                disabled={updateStatusMutation.isPending}
                            >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve
                            </Button>
                        )}
                        {row.original.status !== 'rejected' && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                                onClick={() => updateStatusMutation.mutate({ id: row.original.id, status: 'rejected' })}
                                disabled={updateStatusMutation.isPending}
                            >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                            onClick={() => {
                                if (confirm("Are you sure you want to delete this review?")) {
                                    deleteReviewMutation.mutate(row.original.id);
                                }
                            }}
                            disabled={deleteReviewMutation.isPending}
                        >
                            <Trash2 className="w-4 h-4 mr-1" />
                        </Button>
                    </div>
                );
            }
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Product Reviews</h1>
                    <p className="text-muted-foreground">Manage and moderate customer reviews</p>
                </div>
            </div>

            <DataTable columns={columns} data={reviews} loading={isLoading} />
        </div>
    );
}
