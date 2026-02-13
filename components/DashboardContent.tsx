"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell as RechartsCell
} from "recharts";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import {
    TrendingUp,
    ShoppingBag,
    Users,
    Package,
    AlertTriangle
} from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ColumnDef } from "@tanstack/react-table";

type Metric = {
    title: string;
    value: string | number;
    icon: React.ElementType;
    description: string;
    trend?: string;
};

type Order = {
    id: string;
    customer_name: string;
    total_amount: number;
    status: string;
    created_at: string;
};

export default function DashboardContent() {
    // Fetch Metrics
    const { data: metricsData } = useQuery({
        queryKey: ["dashboard-metrics"],
        queryFn: async () => {
            const [
                { count: productCount },
                { count: customerCount },
                { data: orders }
            ] = await Promise.all([
                supabase.from("products").select("*", { count: "exact", head: true }),
                supabase.from("customers").select("*", { count: "exact", head: true }),
                supabase.from("orders").select("total_amount")
            ]);

            const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
            const totalOrders = orders?.length || 0;

            return [
                {
                    title: "Total Revenue",
                    value: `$${totalRevenue.toLocaleString()}`,
                    icon: TrendingUp,
                    description: "Total gross sales",
                    trend: "+12% from last month"
                },
                {
                    title: "Total Orders",
                    value: totalOrders,
                    icon: ShoppingBag,
                    description: "Successful transactions",
                    trend: "+5% from yesterday"
                },
                {
                    title: "Total Products",
                    value: productCount || 0,
                    icon: Package,
                    description: "Active listings",
                },
                {
                    title: "Total Customers",
                    value: customerCount || 0,
                    icon: Users,
                    description: "Registered accounts",
                }
            ] as Metric[];
        }
    });

    // Fetch Sales Data for Chart
    const { data: salesData } = useQuery({
        queryKey: ["sales-overview"],
        queryFn: async () => {
            return [
                { name: "Mon", revenue: 4000 },
                { name: "Tue", revenue: 3000 },
                { name: "Wed", revenue: 2000 },
                { name: "Thu", revenue: 2780 },
                { name: "Fri", revenue: 1890 },
                { name: "Sat", revenue: 2390 },
                { name: "Sun", revenue: 3490 },
            ];
        }
    });

    // Fetch Recent Orders
    const { data: recentOrders = [] } = useQuery({
        queryKey: ["recent-orders"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("orders")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(5);
            if (error) throw error;
            return data as Order[];
        }
    });

    const orderColumns: ColumnDef<Order>[] = [
        {
            accessorKey: "customer_name",
            header: "Customer",
        },
        {
            accessorKey: "total_amount",
            header: "Amount",
            cell: ({ row }: { row: any }) => `$${row.original.total_amount.toFixed(2)}`,
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }: { row: any }) => (
                <Badge variant="outline">{row.original.status}</Badge>
            ),
        },
        {
            accessorKey: "created_at",
            header: "Date",
            cell: ({ row }: { row: any }) => format(new Date(row.original.created_at), "MMM dd, hh:mm a"),
        },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
                <p className="text-muted-foreground">Welcome back, here&apos;s what&apos;s happening today.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {metricsData?.map((metric, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                            <metric.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{metric.value}</div>
                            <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
                            {metric.trend && (
                                <p className="text-xs text-emerald-600 font-medium mt-1">{metric.trend}</p>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="lg:col-span-4">
                    <CardHeader>
                        <CardTitle>Sales Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={salesData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                    <XAxis
                                        dataKey="name"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `$${value}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                                        formatter={(value: string | number | any) => [`$${parseFloat(value?.toString() || "0").toFixed(2)}`, "Revenue"]}
                                    />
                                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                                        {salesData?.map((_entry, index) => (
                                            <RechartsCell key={`cell-${index}`} fill={index === 6 ? "#0ea5e9" : "#e2e8f0"} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Recent Orders</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DataTable columns={orderColumns} data={recentOrders} />
                    </CardContent>
                </Card>
            </div>

            {/* Low Stock Alert Section */}
            <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader className="flex flex-row items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <CardTitle className="text-destructive">Inventory Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-destructive/80">
                        There are current items with stock levels below 10 units. Check Inventory for details.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
