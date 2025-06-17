"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthService } from "@/lib/services/authService";
import PasswordForm from "@/components/auth/PasswordForm";

export default function PasswordEntryPage() {
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const success = await AuthService.authenticate(password);
            if (success) {
                // Redirect to home page upon successful authentication
                router.push("/");
                router.refresh(); // Ensure middleware reevaluates the request
            }
        } catch (err: any) {
            setError(err.message || "An error occurred while authenticating");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-base-200">
            <div className="card w-full max-w-md bg-base-100 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title text-center text-2xl font-bold mb-6">
                        Site Access
                    </h2>

                    {error && (
                        <div className="alert alert-error mb-4">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="stroke-current shrink-0 h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                                        <PasswordForm
                        password={password}
                        onPasswordChange={setPassword}
                        loading={loading}
                        onSubmit={handleSubmit}
                    />

                </div>
            </div>
        </div>
    );
}
