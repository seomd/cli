import dotenv from 'dotenv';
import { getProviderConfig } from '../utils/parser.js';
import { createHttpClient } from './http.js';

export const KNOWN_PROVIDERS = {
    foxcite: {
        name: 'foxcite',
        displayName: 'Foxcite',
        defaultEndpoint: 'https://api.foxcite.com',
        dashboardUrl: 'https://app.foxcite.com',
        nativeProtocol: true,
        capabilities: { analyze: true, sync: true, playbooks: true, x402: true },
    },
    semrush: {
        name: 'semrush',
        displayName: 'SEMrush',
        defaultEndpoint: null,
        dashboardUrl: 'https://www.semrush.com',
        nativeProtocol: false,
        capabilities: { analyze: false, sync: false, playbooks: false, x402: false },
    },
    ahrefs: {
        name: 'ahrefs',
        displayName: 'Ahrefs',
        defaultEndpoint: null,
        dashboardUrl: 'https://ahrefs.com',
        nativeProtocol: false,
        capabilities: { analyze: false, sync: false, playbooks: false, x402: false },
    },
    profound: {
        name: 'profound',
        displayName: 'Profound',
        defaultEndpoint: null,
        dashboardUrl: 'https://www.tryprofound.com',
        nativeProtocol: false,
        capabilities: { analyze: false, sync: false, playbooks: false, x402: false },
    },
    peec: {
        name: 'peec',
        displayName: 'Peec AI',
        defaultEndpoint: null,
        dashboardUrl: 'https://peec.ai',
        nativeProtocol: false,
        capabilities: { analyze: false, sync: false, playbooks: false, x402: false },
    },
    custom: {
        name: 'custom',
        displayName: 'Custom Provider',
        defaultEndpoint: null,
        dashboardUrl: null,
        nativeProtocol: true,
        capabilities: { analyze: true, sync: true, playbooks: true, x402: false },
    },
};

const MAX_SYNC_QUERY_BYTES = 4000;

/**
 * Resolves the active SEO.md intelligence provider from env vars + SEO.md config.
 * Never freezes credentials at import time and never silently hardcodes a vendor
 * when no provider or credentials are configured.
 *
 * @param {any} [seoData] - Parsed SEO.md data
 * @returns {object|null} Provider adapter or null if unconfigured
 */
export function resolveProvider(seoData = null) {
    dotenv.config();

    const cfg = getProviderConfig(seoData);
    const envProvider = process.env.SEOMD_PROVIDER?.trim().toLowerCase() || null;
    const envUrl = process.env.SEOMD_API_URL?.trim() || null;
    const apiKey = process.env.SEOMD_API_KEY?.trim() || null;
    const paymentToken = process.env.SEOMD_PAYMENT_TOKEN?.trim() || null;
    const domainHeader = process.env.SEOMD_DOMAIN?.trim() || null;

    const declaredName = (envProvider || cfg.name || '').trim().toLowerCase() || null;
    const explicitEndpoint = envUrl || cfg.endpoint || null;

    let providerName = declaredName;
    if (!providerName && explicitEndpoint) {
        providerName = explicitEndpoint.includes('foxcite.com') ? 'foxcite' : 'custom';
    } else if (!providerName && (apiKey || paymentToken)) {
        // Backward compatibility for users who only configured SEOMD_API_KEY
        providerName = 'foxcite';
    }

    if (!providerName) {
        return null;
    }

    const meta = KNOWN_PROVIDERS[providerName] || {
        name: providerName,
        displayName: providerName,
        defaultEndpoint: null,
        dashboardUrl: null,
        nativeProtocol: Boolean(explicitEndpoint),
        capabilities: {
            analyze: Boolean(explicitEndpoint),
            sync: Boolean(explicitEndpoint),
            playbooks: Boolean(explicitEndpoint),
            x402: false,
        },
    };

    const endpoint = explicitEndpoint || meta.defaultEndpoint || null;
    const hasEndpoint = Boolean(endpoint);
    const hasAuth = Boolean(apiKey || paymentToken);

    const capabilities = hasEndpoint
        ? { ...meta.capabilities, analyze: true, sync: true }
        : { ...meta.capabilities };

    const assertSupported = (capability) => {
        if (!endpoint) {
            throw new Error(
                `Provider '${meta.displayName}' does not have a native SEO.md '${capability}' endpoint configured yet.\n\n` +
                `Options:\n` +
                `  1. Point SEOMD_API_URL (or provider.endpoint in SEO.md) to a compatible bridge/adapter implementing PROVIDER_SPEC.md.\n` +
                `  2. Ask ${meta.displayName} to add native SEO.md Provider Protocol support (https://seomd.dev/providers).\n` +
                `  3. Use a natively supported provider (e.g. set provider.name: foxcite or SEOMD_PROVIDER=foxcite).`
            );
        }
        if (!hasAuth) {
            throw new Error(
                `No credentials found for provider '${meta.displayName}'.\n` +
                `Set SEOMD_API_KEY (or SEOMD_PAYMENT_TOKEN for x402) in your environment or .env file.`
            );
        }
    };

    const getClient = () =>
        createHttpClient({
            baseURL: endpoint,
            apiKey,
            paymentToken,
            domain: domainHeader,
            dashboardUrl: meta.dashboardUrl,
        });

    return {
        name: meta.name,
        displayName: meta.displayName,
        endpoint,
        hasAuth,
        capabilities,

        async analyze(payload) {
            assertSupported('analyze');
            const http = getClient();
            const response = await http.post('/cli/analyze', payload);
            return response.data;
        },

        async sync({ domain, pages = [] }) {
            assertSupported('sync');
            const http = getClient();

            const compactPages = pages.map((p) => ({
                id: p.id,
                url: p.url,
                primary_keyword: p.primary_keyword || p.keyword || null,
            }));

            // Trim pages payload if serialized JSON exceeds safe GET query length
            let pagesForQuery = compactPages;
            let pagesParam = JSON.stringify(pagesForQuery);
            while (pagesParam.length > MAX_SYNC_QUERY_BYTES && pagesForQuery.length > 1) {
                pagesForQuery = pagesForQuery.slice(0, Math.floor(pagesForQuery.length / 2));
                pagesParam = JSON.stringify(pagesForQuery);
            }

            if (meta.name === 'foxcite') {
                const response = await http.get('/cli/sync', {
                    params: { domain, pages: pagesParam },
                });
                return response.data;
            }

            // Standard v2 providers prefer POST /cli/sync (no URL length limits), falling back to GET on 405
            try {
                const response = await http.post('/cli/sync', { domain, pages: compactPages });
                return response.data;
            } catch (err) {
                if (String(err.message).includes('(405)')) {
                    const response = await http.get('/cli/sync', {
                        params: { domain, pages: pagesParam },
                    });
                    return response.data;
                }
                throw err;
            }
        },
    };
}
