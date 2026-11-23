import axios from 'axios';

const getDashboardUrlFromApi = (apiUrl, explicitDashboardUrl = null) => {
    if (explicitDashboardUrl) return explicitDashboardUrl;
    if (apiUrl && (apiUrl.includes('127.0.0.1') || apiUrl.includes('localhost'))) {
        return 'http://localhost:3000';
    }
    if (apiUrl && apiUrl.includes('api.foxcite.com')) {
        return 'https://app.foxcite.com';
    }
    return 'https://seomd.dev';
};

/**
 * Creates a fresh axios client using runtime credentials (never frozen at import time).
 */
export function createHttpClient({
    baseURL,
    apiKey = null,
    paymentToken = null,
    domain = null,
    dashboardUrl = null,
    timeout = 300000,
}) {
    const client = axios.create({
        baseURL,
        timeout,
        headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            ...(paymentToken ? { 'x-payment-token': paymentToken } : {}),
            ...(domain ? { 'x-seomd-domain': domain } : {}),
        },
    });

    client.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error.response) {
                const status = error.response.status;
                const detail = error.response.data?.detail || error.response.data?.message || error.message;

                if (status === 401) {
                    return Promise.reject(
                        new Error('Authentication failed: Invalid or missing API key (SEOMD_API_KEY).')
                    );
                }
                if (status === 402) {
                    const dashUrl = getDashboardUrlFromApi(baseURL, dashboardUrl);
                    return Promise.reject(
                        new Error(
                            `Insufficient scan credits.\n\n` +
                            `For Humans: Recharge credits or upgrade your plan:\n` +
                            `  ${dashUrl}/billing\n\n` +
                            `For Programmatic Agents:\n` +
                            `  Set SEOMD_PAYMENT_TOKEN in your environment to pay-per-scan inline via x402.`
                        )
                    );
                }
                return Promise.reject(new Error(`API Error (${status}): ${detail}`));
            }
            return Promise.reject(new Error(`Network Error: ${error.message}`));
        }
    );

    return client;
}
