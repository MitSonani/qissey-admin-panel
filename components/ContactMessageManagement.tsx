"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DataTable } from "@/components/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Mail, MessageSquare } from "lucide-react";

type ContactMessage = {
    id: string;
    name: string;
    email: string;
    phone?: string;
    subject?: string;
    message: string;
    created_at: string;
};

export default function ContactMessageManagement() {
    // Fetch Contact Messages
    const { data: messages = [], isLoading } = useQuery({
        queryKey: ["contact_messages"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("contact_messages")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data as ContactMessage[];
        },
    });

    const columns: ColumnDef<ContactMessage>[] = [
        {
            accessorKey: "name",
            header: "Sender",
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Mail size={16} className="text-muted-foreground" />
                    </div>
                    <div className="flex flex-col min-w-[120px]">
                        <span className="font-medium truncate">{row.original.name}</span>
                        <span className="text-xs text-muted-foreground truncate">{row.original.email}</span>
                    </div>
                </div>
            ),
        },
        {
            accessorKey: "phone",
            header: "Phone",
            cell: ({ row }) => row.original.phone || "-",
        },
        {
            accessorKey: "subject",
            header: "Subject",
            cell: ({ row }) => row.original.subject || "-",
        },
        {
            accessorKey: "message",
            header: "Message",
            cell: ({ row }) => (
                <div className="max-w-[400px] truncate" title={row.original.message}>
                    {row.original.message}
                </div>
            ),
        },
        {
            accessorKey: "created_at",
            header: "Date",
            cell: ({ row }) => format(new Date(row.original.created_at), "dd MMM yyyy, HH:mm"),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Contact Messages</h1>
                    <p className="text-muted-foreground">Review inquiries and messages from customers</p>
                </div>
            </div>

            <DataTable columns={columns} data={messages} loading={isLoading} />
        </div>
    );
}
