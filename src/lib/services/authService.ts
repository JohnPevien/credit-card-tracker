"use client";

export class AuthService {
    static async authenticate(password: string): Promise<boolean> {
        try {
            const response = await fetch("/api/site-auth", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ password }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Authentication failed");
            }

            // Assuming successful authentication means the API returned ok
            // and the API itself handles any token generation/validation if needed internally.
            // For this client-side service, we just confirm the API call was successful.
            localStorage.setItem("site_has_authed", "true");
            return true;
        } catch (error) {
            console.error("Authentication error:", error);
            // Propagate the error message or a generic one
            if (error instanceof Error) {
                throw error;
            }
            throw new Error("An unknown authentication error occurred.");
        }
    }

    static isAuthenticated(): boolean {
        if (typeof window !== "undefined") {
            return localStorage.getItem("site_has_authed") === "true";
        }
        return false;
    }

    static logout(): void {
        if (typeof window !== "undefined") {
            localStorage.removeItem("site_has_authed");
        }
    }
}
