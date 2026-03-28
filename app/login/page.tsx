"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Check if the user is an admin BEFORE sending OTP
            const response = await fetch("/api/auth/verify-admin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const result = await response.json();

            if (!response.ok || !result.isAdmin) {
                toast.error(result.message || result.error || "Access denied. Admin only.");
                return;
            }

            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: false, 
                },
            });

            if (error) {
                toast.error(error.message);
                return;
            }

            toast.success("OTP sent to your email");
            setShowOtpInput(true);
        } catch (error: any) {
            toast.error("An unexpected error occurred");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user }, error } = await supabase.auth.verifyOtp({
                email,
                token: otp,
                type: 'email',
            });

            if (error) {
                toast.error(error.message);
                return;
            }

            // Check if the user has the admin role
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user?.id)
                .single();

            if (profileError || profile?.role !== 'admin') {
                await supabase.auth.signOut();
                toast.error("Access denied. Admin only.");
                return;
            }

            toast.success("Logged in successfully");
            router.push("/");
            router.refresh();
        } catch (error: any) {
            toast.error("An unexpected error occurred");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
            <div className="w-full max-w-md space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                <div className="text-center">
                    <h2 className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">
                        Admin Login
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Secure OTP Login Only
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={showOtpInput ? handleVerifyOtp : handleSendOtp}>
                    <div className="space-y-4 rounded-md shadow-sm">
                        <div>
                            <label htmlFor="email-address" className="sr-only">
                                Email address
                            </label>
                            <Input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="h-12"
                                disabled={showOtpInput}
                            />
                        </div>
                        {showOtpInput && (
                            <div>
                                <label htmlFor="otp" className="sr-only">
                                    OTP Code
                                </label>
                                <Input
                                    id="otp"
                                    name="otp"
                                    type="text"
                                    required
                                    placeholder="Enter 6-digit OTP"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    className="h-12"
                                    maxLength={6}
                                />
                                <div className="mt-2 text-right">
                                    <button
                                        type="button"
                                        onClick={handleSendOtp}
                                        className="text-sm font-medium text-primary hover:text-primary/80 disabled:opacity-50"
                                        disabled={loading}
                                    >
                                        Resend OTP
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <Button
                            type="submit"
                            className="w-full h-12 text-base"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {showOtpInput ? "Verifying..." : "Sending OTP..."}
                                </>
                            ) : (
                                showOtpInput ? "Verify OTP" : "Send OTP"
                            )}
                        </Button>
                        {showOtpInput && (
                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full mt-2"
                                onClick={() => {
                                    setShowOtpInput(false);
                                    setOtp("");
                                }}
                                disabled={loading}
                            >
                                Change Email
                            </Button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
