"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save, Pencil, Search } from "lucide-react";
import Image from "next/image";

type ProductWithMeasurement = {
    id: string;
    name: string;
    sku: string | null;
    variants: any[]; // for image
    measurement_id?: string;
    size_chart?: any;
};

type SizeRow = { size: string; [key: string]: string };
type SizeChart = {
    columns?: string[];
    inches: SizeRow[];
    cm: SizeRow[];
};

const defaultColumns = ["chest", "waist", "hips"];

const defaultInches: SizeRow[] = [
    { size: 'XS', chest: '32', waist: '24', hips: '34' },
    { size: 'S', chest: '34', waist: '26', hips: '36' },
    { size: 'M', chest: '36', waist: '28', hips: '38' },
    { size: 'L', chest: '38', waist: '30', hips: '40' },
    { size: 'XL', chest: '40', waist: '32', hips: '42' },
    { size: 'XXL', chest: '42', waist: '34', hips: '44' }
];

const defaultCm: SizeRow[] = [
    { size: 'XS', chest: '81', waist: '61', hips: '86' },
    { size: 'S', chest: '86', waist: '66', hips: '91' },
    { size: 'M', chest: '91', waist: '71', hips: '97' },
    { size: 'L', chest: '97', waist: '76', hips: '102' },
    { size: 'XL', chest: '102', waist: '81', hips: '107' },
    { size: 'XXL', chest: '107', waist: '86', hips: '112' }
];

export default function MeasurementManagement() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");
    
    // Modal state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<ProductWithMeasurement | null>(null);

    // Form state
    const [columnsList, setColumnsList] = useState<string[]>([...defaultColumns]);
    const [inchesChart, setInchesChart] = useState<SizeRow[]>([...defaultInches]);
    const [cmChart, setCmChart] = useState<SizeRow[]>([...defaultCm]);
    const [unit, setUnit] = useState<"inches" | "cm">("inches");

    // Fetch Products with Measurements
    const { data: products = [], isLoading: isLoadingProducts } = useQuery({
        queryKey: ["products-with-measurements", searchQuery],
        queryFn: async () => {
            let query = supabase
                .from("products")
                .select(`
                    id, name, sku,
                    variants:product_variants(image_urls, is_primary),
                    measurements:product_measurements(id, size_chart)
                `)
                .order("created_at", { ascending: false });

            if (searchQuery) {
                query = query.ilike("name", `%${searchQuery}%`);
            }

            const { data, error } = await query;
            if (error) throw error;

            return (data as any[]).map(p => {
                const meas = Array.isArray(p.measurements) ? p.measurements[0] : p.measurements;
                return {
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    variants: p.variants || [],
                    measurement_id: meas?.id,
                    size_chart: meas?.size_chart
                };
            }) as ProductWithMeasurement[];
        },
    });

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState<string>("");

    const openEditModal = (product: ProductWithMeasurement) => {
        setEditingProduct(product);
        if (product.size_chart) {
            const chart = product.size_chart as SizeChart;
            setColumnsList(chart.columns || [...defaultColumns]);
            setInchesChart(chart.inches || [...defaultInches]);
            setCmChart(chart.cm || [...defaultCm]);
        } else {
            setColumnsList([...defaultColumns]);
            setInchesChart(JSON.parse(JSON.stringify(defaultInches)));
            setCmChart(JSON.parse(JSON.stringify(defaultCm)));
        }
        setUnit("inches");
        setIsAddDialogOpen(false);
        setIsDialogOpen(true);
    };

    const configuredProducts = products.filter(p => !!p.size_chart);
    const unconfiguredProducts = products.filter(p => !p.size_chart);

    const handleStartAdd = () => {
        setSelectedProductId("");
        setIsAddDialogOpen(true);
    };

    const handleConfirmAdd = () => {
        if (!selectedProductId) return;
        const prod = unconfiguredProducts.find(p => p.id === selectedProductId);
        if (prod) {
            openEditModal(prod);
        }
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!editingProduct) return;
            const size_chart: SizeChart = { columns: columnsList, inches: inchesChart, cm: cmChart };
            
            if (editingProduct.measurement_id) {
                // Update
                const { error } = await supabase
                    .from("product_measurements")
                    .update({ size_chart })
                    .eq("id", editingProduct.measurement_id);
                if (error) throw error;
            } else {
                // Insert
                const { error } = await supabase
                    .from("product_measurements")
                    .insert([{ product_id: editingProduct.id, size_chart }]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["products-with-measurements"] });
            toast.success("Measurements saved successfully");
            setIsDialogOpen(false);
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to save measurements");
        }
    });

    const updateRow = (index: number, field: string, value: string) => {
        const newInches = [...inchesChart];
        const newCm = [...cmChart];
        
        if (unit === "inches") {
            newInches[index] = { ...newInches[index], [field]: value };
            
            // Auto-calculate cm if it's a numeric measurement
            if (field !== 'size' && value && !isNaN(Number(value))) {
                const cmVal = (Number(value) * 2.54).toFixed(1).replace(/\.0$/, ''); // Round to 1 decimal, drop .0
                newCm[index] = { ...newCm[index], [field]: cmVal };
            } else if (field === 'size') {
                newCm[index] = { ...newCm[index], [field]: value };
            } else if (value === "") {
                newCm[index] = { ...newCm[index], [field]: "" };
            }
        } else {
            newCm[index] = { ...newCm[index], [field]: value };
            
            if (field === 'size') {
                newInches[index] = { ...newInches[index], [field]: value };
            }
        }
        
        setInchesChart(newInches);
        setCmChart(newCm);
    };

    const addRow = () => {
        const newRow: SizeRow = { size: "New Size" };
        columnsList.forEach(col => newRow[col] = "");
        setInchesChart([...inchesChart, { ...newRow }]);
        setCmChart([...cmChart, { ...newRow }]);
    };

    const removeRow = (index: number) => {
        setInchesChart(inchesChart.filter((_, i) => i !== index));
        setCmChart(cmChart.filter((_, i) => i !== index));
    };

    const addColumn = () => {
        const colName = window.prompt("Enter new measurement column name (e.g. Length, Shoulder):");
        if (!colName) return;
        
        const formattedCol = colName.trim().toLowerCase();
        if (columnsList.includes(formattedCol)) {
            toast.error("Column already exists");
            return;
        }

        setColumnsList([...columnsList, formattedCol]);
        
        // Add this column to all existing rows with empty values
        setInchesChart(inchesChart.map(row => ({ ...row, [formattedCol]: "" })));
        setCmChart(cmChart.map(row => ({ ...row, [formattedCol]: "" })));
    };

    const removeColumn = (colToRemove: string) => {
        if (columnsList.length <= 1) {
            toast.error("You must have at least one measurement column.");
            return;
        }

        if (window.confirm(`Are you sure you want to remove the '${colToRemove}' column?`)) {
            setColumnsList(columnsList.filter(c => c !== colToRemove));
        }
    };

    const renameColumn = (oldCol: string) => {
        const newColName = window.prompt(`Rename column '${oldCol}' to:`, oldCol);
        if (!newColName) return;
        
        const formattedNewCol = newColName.trim().toLowerCase();
        if (formattedNewCol === oldCol) return;
        
        if (columnsList.includes(formattedNewCol)) {
            toast.error("Column already exists");
            return;
        }

        setColumnsList(columnsList.map(c => c === oldCol ? formattedNewCol : c));
        
        const updateChartKeys = (chart: SizeRow[]) => {
            return chart.map(row => {
                const newRow = { ...row };
                newRow[formattedNewCol] = newRow[oldCol] || "";
                delete newRow[oldCol];
                return newRow;
            });
        };

        setInchesChart(updateChartKeys(inchesChart));
        setCmChart(updateChartKeys(cmChart));
    };

    const columns: ColumnDef<ProductWithMeasurement>[] = [
        {
            accessorKey: "image",
            header: "Image",
            cell: ({ row }) => {
                const url = row.original.variants?.find((v: any) => v.is_primary)?.image_urls?.[0] || row.original.variants?.[0]?.image_urls?.[0];
                return (
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden relative">
                        {url ? (
                            <Image src={url} alt="" fill className="object-cover" />
                        ) : (
                            <div className="text-muted-foreground text-xs">No img</div>
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
                    <span className="text-xs text-muted-foreground">{row.original.sku || "No SKU"}</span>
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: "Measurements Status",
            cell: ({ row }) => {
                const hasChart = !!row.original.size_chart;
                return (
                    <Badge variant={hasChart ? "default" : "outline"}>
                        {hasChart ? "Configured" : "Not Set"}
                    </Badge>
                );
            },
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => {
                const hasChart = !!row.original.size_chart;
                return (
                    <Button
                        variant={hasChart ? "outline" : "default"}
                        size="sm"
                        onClick={() => openEditModal(row.original)}
                    >
                        {hasChart ? (
                            <>
                                <Pencil className="mr-2 h-4 w-4" /> Edit Measurements
                            </>
                        ) : (
                            <>
                                <Plus className="mr-2 h-4 w-4" /> Add Measurements
                            </>
                        )}
                    </Button>
                );
            },
        },
    ];

    const currentChart = unit === "inches" ? inchesChart : cmChart;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Product Measurements</h1>
                    <p className="text-muted-foreground">Manage size charts for your products</p>
                </div>
                <Button onClick={handleStartAdd} className="gap-2">
                    <Plus className="h-4 w-4" /> Add Measurements
                </Button>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search products..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <DataTable columns={columns} data={configuredProducts} loading={isLoadingProducts} />

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select Product</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <select 
                            className="w-full flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                        >
                            <option value="">Select a product...</option>
                            {unconfiguredProducts.map(p => (
                                <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>
                            ))}
                        </select>
                        {unconfiguredProducts.length === 0 && (
                            <p className="text-sm text-muted-foreground mt-2">All products currently have measurements configured.</p>
                        )}
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleConfirmAdd} disabled={!selectedProductId}>Proceed</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-5xl p-0 border-none shadow-2xl flex flex-col bg-background overflow-hidden rounded-[1.5rem]">
                    <DialogHeader className="p-6 bg-background border-b shrink-0">
                        <DialogTitle className="text-xl font-semibold text-primary">
                            {editingProduct?.size_chart ? "Edit Measurements" : "Add Measurements"} - {editingProduct?.name}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-6 overflow-y-auto max-h-[80vh]">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex gap-2">
                                    <Button 
                                        variant={unit === "inches" ? "default" : "outline"} 
                                        onClick={() => setUnit("inches")}
                                    >
                                        Inches
                                    </Button>
                                    <Button 
                                        variant={unit === "cm" ? "default" : "outline"} 
                                        onClick={() => setUnit("cm")}
                                    >
                                        Centimeters
                                    </Button>
                                </div>
                                <Button variant="outline" onClick={addColumn} className="gap-2">
                                    <Plus className="h-4 w-4" /> Add Column
                                </Button>
                            </div>

                            <div className="border rounded-md overflow-hidden overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium min-w-[100px]">Size</th>
                                            {columnsList.map(col => (
                                                <th key={col} className="px-4 py-3 text-left font-medium min-w-[120px]">
                                                    <div className="flex items-center justify-between group">
                                                        <span className="capitalize">{col}</span>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={() => renameColumn(col)}
                                                                className="text-muted-foreground hover:text-foreground"
                                                                title="Rename column"
                                                            >
                                                                <Pencil className="h-3 w-3" />
                                                            </button>
                                                            <button 
                                                                onClick={() => removeColumn(col)}
                                                                className="text-destructive"
                                                                title="Remove column"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="px-4 py-3 text-right font-medium w-[80px]">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentChart.map((row, index) => (
                                            <tr key={index} className="border-t">
                                                <td className="p-2">
                                                    <Input 
                                                        value={row.size} 
                                                        onChange={(e) => updateRow(index, 'size', e.target.value)} 
                                                        placeholder="Size (e.g. S)"
                                                    />
                                                </td>
                                                {columnsList.map(col => (
                                                    <td key={col} className="p-2">
                                                        <Input 
                                                            value={row[col] || ""} 
                                                            onChange={(e) => updateRow(index, col, e.target.value)} 
                                                            placeholder={col}
                                                        />
                                                    </td>
                                                ))}
                                                <td className="p-2 text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => removeRow(index)} className="text-destructive hover:bg-destructive/10">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="p-2 border-t bg-muted/30">
                                    <Button variant="outline" size="sm" onClick={addRow} className="w-full border-dashed">
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Size Row
                                    </Button>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                                    {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Save Measurements
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
