import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full bg-muted/30">
                <Sidebar />
                <main className="flex-1 flex flex-col">
                    <header className="h-16 border-b flex items-center px-6 sticky top-0 bg-background/95 backdrop-blur z-20">
                        <SidebarTrigger className="mr-4" />
                        <div className="flex-1" />
                        <div className="flex items-center gap-4">
                            {/* Profile/Notifications can go here */}
                        </div>
                    </header>
                    <div className="p-6 md:p-10 flex-1">
                        {children}
                    </div>
                </main>
            </div>
        </SidebarProvider>
    );
}
