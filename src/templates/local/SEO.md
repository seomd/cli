# SEO.md

## {{brand}}

### spec v1.0 | <https://seomd.dev>

## Site

site:
  type: local
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
  schema_org_type: LocalBusiness

## Keywords

keywords:

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

## Intent

intent:

  informational:
    priority: medium
    queries:
      - "what is {{primary_keyword}}"
      - "how does {{primary_keyword}} work"

  comparison:
    priority: medium
    queries:
{{competitors_comparison_queries}}
      - "best {{primary_keyword}} for startups"

  transactional:
    priority: critical
    queries:
      - "is {{brand_lower}} worth it"
      - "should I use {{brand_lower}}"
      - "{{brand_lower}} pricing"

  reputational:
    priority: critical
    queries:
      - "{{brand_lower}} reviews"
      - "is {{brand_lower}} legit"
      - "{{brand_lower}} problems"

  category:
    priority: high
    queries:
      - "best {{primary_keyword}}"
      - "top {{primary_keyword}} 2026"

## Pages

pages:
  site_type: local

  required:
    - id: homepage
      url: /
      primary_keyword: null
      status: planned
      priority: 1

    - id: services
      url: /services
      primary_keyword: null
      status: planned
      priority: 2

    - id: location
      url: /[city]
      primary_keyword: null
      status: planned
      priority: 3

    - id: about
      url: /about
      primary_keyword: null
      status: planned
      priority: 4

    - id: reviews
      url: /reviews
      primary_keyword: null
      status: planned
      priority: 5

    - id: faq
      url: /faq
      primary_keyword: null
      status: planned
      priority: 6

    - id: contact
      url: /contact
      primary_keyword: null
      status: planned
      priority: 7

    - id: service-area
      url: /service-area
      primary_keyword: null
      status: planned
      priority: 8

## Copy

copy:

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

  answer_first: true           # direct answer in first 50 words
  faq_section_required: true   # on all key pages
  faq_minimum_questions: 6
  statistics_per_page: 2       # minimum data points with sources
  citations_required: true     # link to primary sources
  short_paragraphs: true       # max 3 sentences
  heading_hierarchy: strict    # H1 > H2 > H3, no skipping

## Authority

authority:

  cite_sources: true
  expert_quotes: false         # set true when you have quotes
  eeat_signals:
    experience: null           # describe your experience signal
    expertise: null            # describe your expertise signal
    authority: null            # describe your authority signal
    trust: null                # describe your trust signal

## Schema

schema:

  types:
    - LocalBusiness
    - FAQPage
    - Review
    - GeoCoordinates
  faq_schema: true
  breadcrumb_schema: true
  organization_schema: true

## Crawl

crawl:

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

  lcp: 2.5s
  cls: 0.1
  fid: 100ms
  page_size: 500kb
  ttfb: 800ms

## AEO

aeo:

  answer_first_format: true
  faq_on_all_key_pages: true
  structured_data_priority: high
  content_freshness_target: 30d  # update key pages within 30 days
  competitors_to_monitor:
{{competitors_to_monitor}}

## Monitoring

monitoring:

  sync_schedule: monthly       # monthly | weekly | on_demand
  auto_commit: false           # platform commits directly to repo
  pr_mode: true                # open PR instead of direct commit
  branch: main
  alert_on_gap_score_above: 80 # alert when gap score exceeds threshold
  alert_on_citation_drop: true # alert if citation rate drops

## Platform Connection

platform:
  provider: null               # foxcite | manual | ahrefs | semrush
  project_id: null

