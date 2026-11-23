# SEO.md Provider Protocol (v2.0.0)

`SEO.md` is a vendor-agnostic open standard. Local workflows (`init`, `validate`, `check`, `generate`, `doctor`) work offline with zero API keys.

Any SEO/AEO intelligence platform — **Foxcite** (reference implementation), **SEMrush**, **Ahrefs**, **Profound**, **Peec AI**, or a custom internal service — can plug into `seomd analyze` and `seomd sync` by exposing the HTTP contract below.

---

## Configuration

Users select a provider in `SEO.md` frontmatter or via environment variables:

```yaml
provider:
  name: custom # foxcite | semrush | ahrefs | profound | peec | custom
  endpoint: https://api.your-provider.com
```

Environment variables (override `SEO.md`):

```bash
SEOMD_PROVIDER=custom
SEOMD_API_URL=https://api.your-provider.com
SEOMD_API_KEY=your_api_key
SEOMD_PAYMENT_TOKEN= # optional x402 pay-per-scan token
SEOMD_DOMAIN=        # optional domain header override
```

Authentication headers sent by `seomd-cli`:
- `Authorization: Bearer <SEOMD_API_KEY>` (when `SEOMD_API_KEY` is set)
- `x-payment-token: <SEOMD_PAYMENT_TOKEN>` (when `SEOMD_PAYMENT_TOKEN` is set)
- `x-seomd-domain: <SEOMD_DOMAIN>` (when `SEOMD_DOMAIN` is set)

---

## Endpoints

### 1. `POST /cli/analyze`

Runs a live AI citation & gap analysis and returns structured metrics + optional per-page playbooks.

**Request Body:**
```json
{
  "domain": "acme.com",
  "niche": "saas",
  "brand": "Acme",
  "queries": {
    "category": ["best billing automation"],
    "comparison": ["chargebee vs acme"]
  },
  "engines": ["ChatGPT", "Perplexity", "Claude"],
  "pages": [
    {
      "id": "pricing",
      "url": "/pricing",
      "primary_keyword": "acme pricing",
      "status": "live"
    }
  ]
}
```

**Response Body:**
```json
{
  "provider": "your-provider",
  "domain": "acme.com",
  "brand_name": "Acme",
  "credits_remaining": 42,
  "aeo_analysis": {
    "overall_citation_rate": 0.35,
    "overall_gap_score": 48,
    "engines_tracked": ["ChatGPT", "Perplexity", "Claude"],
    "last_analyzed": "2026-11-22T00:00:00Z",
    "next_analysis": "2026-11-29T00:00:00Z"
  },
  "intent_analysis": {
    "category": {
      "citation_rate": 0.2,
      "gap_score": 65,
      "top_cited_competitor": "chargebee.com",
      "trend": "up"
    }
  },
  "page_analysis": [
    {
      "id": "pricing",
      "url": "/pricing",
      "status": "live",
      "citation_rate": 0.4,
      "gap_score": 38,
      "top_cited_competitor": "chargebee.com",
      "why_page_won": ["Transparent tier comparison table"],
      "citation_hooks": ["FAQPage JSON-LD with pricing Q&As"],
      "gaps_for_brand": ["Missing enterprise SLA summary"],
      "remediation_playbook": [],
      "fastest_win": {
        "action": "Add 50-word pricing summary above the fold",
        "estimated_gap_score_improvement": 12,
        "effort": "low"
      },
      "suggested_content_outline": [],
      "markdown_content": "# pricing\n\n..."
    }
  ]
}
```

### 2. `POST /cli/sync` (or `GET /cli/sync`)

Returns the latest cached analysis payload in the exact same response shape as `POST /cli/analyze` without triggering a new paid scan.

- Standard v2 providers should accept `POST /cli/sync` with `{ "domain": "...", "pages": [...] }`.
- `seomd-cli` automatically falls back to `GET /cli/sync?domain=...&pages=...` for compatibility with providers that only implement `GET`.

---

## Error Codes

| Status | Meaning |
|---|---|
| `401` | Invalid or missing `SEOMD_API_KEY` |
| `402` | Insufficient credits (supports `x402` payment retry via `SEOMD_PAYMENT_TOKEN`) |
| `4xx` / `5xx` | JSON body with `detail` or `message` string |
