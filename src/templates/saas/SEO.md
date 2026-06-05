# SEO.md

## {{brand}}

### spec v1.0 | <https://seomd.dev>

#### generated: {{date}}

## FIELD OWNERSHIP

### no prefix     = founder declares (you own this)

### _analysis:    = platform writes back (do not edit manually)

## Site

site:
  type: saas
  domain: {{domain}}
  canonical: https://{{domain}}
  locale: en-US
  launched: null              # YYYY-MM-DD

## Identity

identity:
  brand: "{{brand}}"
  tagline: null
  social:
    twitter: null
    linkedin: null
    github: null
  schema_org_type: SoftwareApplication

## Keywords

keywords:

### FOUNDER DECLARES

  primary: "{{primary_keyword}}"
  secondary: []               # add your secondary keywords
  negative:                   # terms that dilute your intent signal
    - "free"
    - "tutorial"
    - "how to"
  competitor_terms:
{{competitor_terms}}
  category_terms:             # unbranded category queries
    - "best {{primary_keyword}}"
    - "top {{primary_keyword}} tools"
  long_tail: []               # add long-tail variations
  seasonal: null              # add seasonal terms if applicable

### PLATFORM WRITES BACK

  _analysis:
    source: null
    primary_search_volume: null
    primary_intent_type: null
    primary_trend: null
    recommended_secondary: []
    negative_additions_suggested: []
    last_analyzed: null
    next_analysis: null

## Intent

intent:

### FOUNDER DECLARES

#### Add queries your buyers actually type into AI engines

#### Tip: think about what someone asks ChatGPT or Perplexity

#### when they are looking for a solution like yours

  informational:
    priority: medium
    queries:
      - "what is {{primary_keyword}}"
      - "how does {{primary_keyword}} work"

  comparison:
    priority: high
    queries:
{{competitors_comparison_queries}}
      - "best {{primary_keyword}} for startups"

  transactional:
    priority: high
    queries:
      - "is {{brand_lower}} worth it"
      - "should I use {{brand_lower}}"
      - "{{brand_lower}} pricing"

  reputational:
    priority: medium
    queries:
      - "{{brand_lower}} reviews"
      - "is {{brand_lower}} legit"
      - "{{brand_lower}} problems"

  category:
    priority: critical
    queries:
      - "best {{primary_keyword}}"
      - "top {{primary_keyword}} 2026"

### PLATFORM WRITES BACK

  _analysis:
    source: null
    last_analyzed: null
    next_analysis: null
    informational:
      citation_rate: null
      top_cited_competitor: null
      gap_score: null
      trend: null
    comparison:
      citation_rate: null
      top_cited_competitor: null
      gap_score: null
      trend: null
    transactional:
      citation_rate: null
      top_cited_competitor: null
      gap_score: null
      trend: null
    reputational:
      citation_rate: null
      top_cited_competitor: null
      gap_score: null
      trend: null
    category:
      citation_rate: null
      top_cited_competitor: null
      gap_score: null
      trend: null

## Pages

pages:
  site_type: saas

### FOUNDER DECLARES

#### status: live | draft | planned

  required:
    - id: homepage
      url: /
      primary_keyword: null
      status: planned
      priority: 1

    - id: features
      url: /features
      primary_keyword: null
      status: planned
      priority: 2

    - id: pricing
      url: /pricing
      primary_keyword: null
      status: planned
      priority: 3

    - id: comparison
      url: /vs/[competitor]
      primary_keyword: null
      status: planned
      priority: 4

    - id: alternatives
      url: /alternatives/[competitor]
      primary_keyword: null
      status: planned
      priority: 5

    - id: use-cases
      url: /for/[segment]
      primary_keyword: null
      status: planned
      priority: 6

    - id: integrations
      url: /integrations
      primary_keyword: null
      status: planned
      priority: 7

    - id: changelog
      url: /changelog
      primary_keyword: null
      status: planned
      priority: 8

    - id: docs
      url: /docs
      primary_keyword: null
      status: planned
      priority: 9

    - id: blog
      url: /blog
      primary_keyword: null
      status: planned
      priority: 10

### PLATFORM WRITES BACK

  _analysis:
    source: null
    last_analyzed: null
    pages: []
    missing_pages: []
    build_order_recommendation: []

## Copy

copy:

### FOUNDER DECLARES

  h1_contains_primary_keyword: true
  meta_description_length: 150-160
  meta_description_includes_cta: true
  min_word_count:
    homepage: 800
    feature_page: 600
    blog_post: 1200
    comparison_page: 1500
  reading_level: 8             # grade level target

## Structure

structure:

### FOUNDER DECLARES

  answer_first: true           # direct answer in first 50 words
  faq_section_required: true   # on all key pages
  faq_minimum_questions: 6
  statistics_per_page: 2       # minimum data points with sources
  citations_required: true     # link to primary sources
  short_paragraphs: true       # max 3 sentences
  heading_hierarchy: strict    # H1 > H2 > H3, no skipping

## Authority

authority:

### FOUNDER DECLARES

  cite_sources: true
  expert_quotes: false         # set true when you have quotes
  eeat_signals:
    experience: null           # describe your experience signal
    expertise: null            # describe your expertise signal
    authority: null            # describe your authority signal
    trust: null                # describe your trust signal

## Schema

schema:

### FOUNDER DECLARES

  types:
    - SoftwareApplication
    - Organization
    - FAQPage
    - WebPage
  faq_schema: true
  breadcrumb_schema: true
  organization_schema: true

## Crawl

crawl:

### FOUNDER DECLARES

  sitemap: /sitemap.xml
  robots_txt: /robots.txt
  allow_ai_bots: true
  allowed_bots:
    - Googlebot
    - Bingbot
    - PerplexityBot
    - ChatGPT-User
    - GPTBot
    - ClaudeBot
    - anthropic-ai
    - cohere-ai
  disallow:
    - /admin
    - /checkout
    - /user/*
    - /api/*

## Performance

performance:

### FOUNDER DECLARES

  lcp: 2.5s
  cls: 0.1
  fid: 100ms
  page_size: 500kb
  ttfb: 800ms

## AEO

aeo:

### FOUNDER DECLARES

### AI Engine Optimization rules

  answer_first_format: true
  faq_on_all_key_pages: true
  structured_data_priority: high
  content_freshness_target: 30d  # update key pages within 30 days
  competitors_to_monitor:
{{competitors_to_monitor}}

### PLATFORM WRITES BACK

  _analysis:
    source: null
    overall_citation_rate: null
    overall_gap_score: null
    engines_tracked:
      - chatgpt
      - perplexity
      - claude
      - gemini
      - grok
    last_analyzed: null
    next_analysis: null

## Monitoring

monitoring:

### FOUNDER DECLARES

  sync_schedule: monthly       # monthly | weekly | on_demand
  auto_commit: false           # platform commits directly to repo
  pr_mode: true                # open PR instead of direct commit
  branch: main
  alert_on_gap_score_above: 80 # alert when gap score exceeds threshold
  alert_on_citation_drop: true # alert if citation rate drops

## Platform Connection

### Connect at <https://seomd.dev/connect>

### Add SEOMD_API_KEY to your .env file

### Never commit your API key to version control

platform:
  provider: null               # gapmeter | manual | ahrefs | semrush
  project_id: null

### api_key: loaded from SEOMD_API_KEY environment variable
