import dotenv from 'dotenv';
import { createHttpClient } from '../providers/http.js';

/**
 * Dynamically creates an HTTP client from current environment variables.
 * Kept for backwards compatibility; prefer `resolveProvider()` from `src/providers/index.js`.
 */
export function getApiClient() {
    dotenv.config();
    return createHttpClient({
        baseURL: process.env.SEOMD_API_URL || 'https://api.foxcite.com',
        apiKey: process.env.SEOMD_API_KEY || null,
        paymentToken: process.env.SEOMD_PAYMENT_TOKEN || null,
        domain: process.env.SEOMD_DOMAIN || null,
    });
}
