"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                // If on login page and authenticated, redirect to dashboard
                if (session && pathname === "/login") {
                    router.replace("/");
                    return;
                }

                // If not on login page and not authenticated, redirect to login
                if (!session && pathname !== "/login") {
                    router.replace("/login");
                    return;
                }

                setIsLoading(false);
            } catch (error) {
                console.error("Auth check failed:", error);
                setIsLoading(false);
            }
        };

        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_OUT") {
                router.replace("/login");
            } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
                if (pathname === "/login") {
                    router.replace("/");
                }
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [router, pathname]);

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return <>{children}</>;
}
