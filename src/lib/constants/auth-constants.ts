// Cookie configuration
export const SITE_ACCESS_COOKIE_NAME = "site_access_token";
export const SITE_ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds
export const PAYER_PORTAL_COOKIE_NAME = "payer_portal_session";
export const PAYER_PORTAL_COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours in seconds

// Public paths that don't require authentication
export const PUBLIC_PATHS = [
    "/enter-password",
    "/api/site-auth",
    "/api/keep-alive",
] as const;

// Cookie security settings
export const isCookieSecure = () => process.env.NODE_ENV === "production";
