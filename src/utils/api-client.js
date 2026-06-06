import axios from 'axios';
import dotenv from 'dotenv';

// Load .env configuration
dotenv.config();

const API_URL = process.env.SEOMD_API_URL || 'https://api.foxcite.com';
const API_KEY = process.env.SEOMD_API_KEY;
const PAYMENT_TOKEN = process.env.SEOMD_PAYMENT_TOKEN;
const SEOMD_DOMAIN = process.env.SEOMD_DOMAIN;

const getDashboardUrlFromApi = (apiUrl) => {
    if (apiUrl.includes('127.0.0.1') || apiUrl.includes('localhost')) {
        return 'http://localhost:3000';
    }
    if (apiUrl.includes('api.foxcite.com')) {
        return 'https://app.foxcite.com';
    }
    return 'https://seomd.dev';
};

export const client = axios.create({
    baseURL: API_URL,
    timeout: 300000, // 5 minutes timeout for LLM audits
    headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {}),
        ...(PAYMENT_TOKEN ? { 'x-payment-token': PAYMENT_TOKEN } : {}),
        ...(SEOMD_DOMAIN ? { 'x-seomd-domain': SEOMD_DOMAIN } : {})
    }
});

// Interceptor for cleaner error feedback
client.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            const status = error.response.status;
            const detail = error.response.data?.detail || error.response.data?.message || error.message;

            if (status === 401) {
                return Promise.reject(new Error('Authentication failed: Invalid or missing API key (SEOMD_API_KEY).'));
            }
            if (status === 402) {
                const dashUrl = getDashboardUrlFromApi(API_URL);
                return Promise.reject(new Error(
                    `Insufficient scan credits.\n\n` +
                    `👉 For Humans: Recharge credits or upgrade your plan in the dashboard:\n` +
                    `   ${dashUrl}/billing\n\n` +
                    `🤖 For Programmatic Agents:\n` +
                    `   Set SEOMD_PAYMENT_TOKEN in your environment or headers to pay-per-scan inline using USDC via the agent-native x402 protocol.`
                ));
            }
            return Promise.reject(new Error(`API Error (${status}): ${detail}`));
        }
        return Promise.reject(new Error(`Network Error: ${error.message}`));
    }
);
