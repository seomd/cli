import axios from 'axios';
import dotenv from 'dotenv';

// Load .env configuration
dotenv.config();

const API_URL = process.env.SEOMD_API_URL || 'https://api.foxcite.com';
const API_KEY = process.env.SEOMD_API_KEY;
const PAYMENT_TOKEN = process.env.SEOMD_PAYMENT_TOKEN;
const SEOMD_DOMAIN = process.env.SEOMD_DOMAIN;

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
                return Promise.reject(new Error(`Payment Required: Insufficient scan credits. ${detail}`));
            }
            return Promise.reject(new Error(`API Error (${status}): ${detail}`));
        }
        return Promise.reject(new Error(`Network Error: ${error.message}`));
    }
);
