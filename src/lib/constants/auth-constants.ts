// Cookie configuration
export const SITE_ACCESS_COOKIE_NAME = "site_access_token";
export const SITE_ACCESS_COOKIE_VALUE = "authenticated";
export const SITE_ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

// Public paths that don't require authentication
export const PUBLIC_PATHS = [
    "/enter-password",
    "/api/site-auth",
    "/api/keep-alive",
] as const;

// Cookie security settings
export const isCookieSecure = () => process.env.NODE_ENV === "production";
