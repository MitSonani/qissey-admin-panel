"use client";

import {
    Box,
    Home,
    ShoppingCart,
    Users,
    Layers,
    Settings,
    LogOut,
    ChevronRight,
    ChevronDown,
    Tag,
    ClipboardList
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const menuItems = [
    { icon: Home, label: "Dashboard", href: "/" },
    { icon: Box, label: "Products", href: "/products" },
    { icon: ShoppingCart, label: "Orders", href: "/orders" },
    { icon: Users, label: "Customers", href: "/customers" },
    { icon: Layers, label: "Categories", href: "/categories" },
    { icon: Tag, label: "Coupons", href: "/coupons" },
    { icon: ClipboardList, label: "Inventory", href: "/inventory" },
];

export default function Sidebar() {
    const pathname = usePathname();
    const [isCollapsed] = useState(false);

    return (
        <aside className={cn(
            "h-screen bg-card border-r flex flex-col transition-all duration-300",
            isCollapsed ? "w-20" : "w-64"
        )}>
            <div className="p-6 border-b flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold">N</span>
                </div>
                {!isCollapsed && <span className="font-bold text-xl tracking-tighter">NIHAL ADMIN</span>}
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <item.icon size={20} />
                            {!isCollapsed && <span>{item.label}</span>}
                            {!isCollapsed && isActive && <ChevronRight size={14} className="ml-auto" />}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t space-y-1">
                <button className="flex items-center gap-3 px-3 py-2 w-full text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg text-sm font-medium transition-colors">
                    <Settings size={20} />
                    {!isCollapsed && <span>Settings</span>}
                </button>
                <button className="flex items-center gap-3 px-3 py-2 w-full text-destructive hover:bg-destructive/10 rounded-lg text-sm font-medium transition-colors">
                    <LogOut size={20} />
                    {!isCollapsed && <span>Log Out</span>}
                </button>
            </div>

            {!isCollapsed && (
                <div className="p-6 bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-primary font-bold">AD</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold truncate">Admin User</span>
                            <span className="text-xs text-muted-foreground truncate">admin@nihal.com</span>
                        </div>
                        <ChevronDown size={14} className="text-muted-foreground ml-auto" />
                    </div>
                </div>
            )}
        </aside>
    );
}
