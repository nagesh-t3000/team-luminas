[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/leRj77Jm)

# Luminas

Luminas is a professional social network built with React, Vite, and Supabase. It combines an Instagram-like feed experience with professional identity, trust verification, opportunity discovery, AI-assisted creation, and a specialized hiring surface called Prolink.

This README is concept-first. It explains what the app is, how the major features work together, which parts are truly core to the product, and how the codebase is organized behind those ideas.

## What The Application Is

Luminas is designed around one main belief: professional discovery works better when identity, expertise, and trust are visible early.

Instead of being only:

- a social app,
- a job board,
- an event board,
- a profile directory, or
- an ads tool,

Luminas combines all of them into one system:

1. Users create a professional identity.
2. They publish skill-driven content and experiences.
3. They discover jobs, events, and other people.
4. They improve trust through verification.
5. Professional accounts unlock higher-trust actions like job posting and ads.
6. Prolink ranks more business-relevant opportunities and introductions.

The result is a hybrid product with three major product layers:

- **Social layer**: home feed, profiles, saved content, suggestions, messaging.
- **Professional layer**: skill posts, experience history, jobs, events, discovery.
- **Trust and growth layer**: human verification, company verification, ads, Prolink ranking.

## Core Product Mental Model

The easiest way to understand Luminas is as a pipeline:

**identity -> trust -> publishing -> discovery -> growth**

### 1. Identity

Every user has a base account and a public profile. A profile contains:

- username
- full name
- bio
- professional role
- profile photo
- skilled domains
- preferred suggestion audiences

This identity is what powers feed ranking, discoverability, and profile credibility.

### 2. Trust

Luminas does not treat all accounts equally. Certain actions are gated behind trust signals:

- professional account status
- human verification status
- company verification status

These status values decide whether a user can create events, post jobs, or run ads.

### 3. Publishing

Users can publish different kinds of professional content:

- skill posts
- events
- jobs
- experience entries
- ad campaigns that boost existing content

Each content type has different rules and different storage behavior.

### 4. Discovery

Published content appears across different surfaces:

- the home feed
- profile pages
- the Explore page
- the Prolink feed

Not every content type appears everywhere. Each surface has a different purpose and ranking model.

### 5. Growth

Once a user has trust and content, Luminas supports growth through:

- suggestions
- connections
- saved content
- Prolink targeting
- ad campaigns

This makes the app more than a passive profile system. It is meant to help users get discovered and act on opportunities.

## Deep Dive: Core Functionalities

### 1. Authentication And Onboarding

Authentication is handled through Supabase-backed flows. The app supports sign-in and sign-up, then checks whether the account has completed enough profile information to enter the main product.

The onboarding flow is:

1. User lands on auth.
2. User signs in or creates an account.
3. If the profile is incomplete, the user is sent to profile setup.
4. Once basics are complete, the user enters the main app shell.

### Why this matters

Luminas wants every account to have a minimum amount of identity before the rest of the product becomes useful. This is why profile completion is treated as a mandatory gate rather than an optional enhancement.

### 2. Home Feed And Skill Posts

The home feed is the app's social core. It is built around **skill posts**, plus a story-like rail for people and events.

Skill posts are short professional posts tied to a user's declared skill domain. A post may include:

- one selected skilled domain
- text content
- up to four media items
- likes
- comments
- save state

### What makes skill posts special

A skill post is not just a generic post. It is intentionally linked to the profile's saved skill domains. That means the user cannot publish content completely disconnected from their declared expertise. Conceptually, this makes the feed more structured and expertise-led than a general social timeline.

### Engagement model

Users can:

- like posts
- comment on posts
- save posts

This makes skill posts the main reusable content object in the app. They show up in the home feed, on profile pages, and can even become the target of ad campaigns.

### Why the home feed matters

The home feed is where Luminas creates ongoing professional presence. Profiles show who a person is, but skill posts show what they know, what they are doing, and what value they can offer.

### 3. Explore: Jobs, Events, And Hackathons

Explore is the broad discovery layer. It aggregates structured updates across three categories:

- jobs
- events
- hackathons

Users can:

- search by keyword
- filter by category
- open event and job cards
- browse a mixed stream of opportunities

### The key concept behind Explore

Explore is not a social feed. It is a professional opportunity index.

The content here is more structured than skill posts:

- title
- summary
- location
- source name
- tags
- optional external link
- category
- publish timestamp

### Hybrid data model

Explore currently mixes two data sources:

- **Supabase-backed explore updates**
- **locally created jobs/events stored in the browser**

That means the product concept is clear, but the implementation is hybrid: some discovery items are persisted in the backend and some are demo/local-only.

### 4. Prolink

Prolink is the app's most specialized concept. It is a business-focused discovery and hiring surface.

Instead of showing a generic stream, Prolink tries to show more relevant professional opportunities based on:

- audience type
- profile role
- saved preference signals
- AI metadata on feed items
- freshness
- quality score
- sponsored targeting signals

### Prolink has two modes

#### Professional account mode

If a user is in professional account mode, Prolink behaves like a higher-trust hiring ecosystem. The messaging in the UI emphasizes:

- verified companies
- experienced professionals
- structured hiring workflows
- role-lane segmentation

This mode positions Prolink as a serious hiring surface for experienced talent, not a mass job board.

#### Non-professional mode

If a user is not in professional mode, Prolink becomes more of a personalized discovery stream. Users can tune which lanes they want to see:

- founders
- investors
- job seekers
- recruiters
- advisors

The app then ranks and filters Prolink content using those lane selections and profile signals.

### Why Prolink matters

Prolink is where Luminas moves beyond "professional Instagram" and toward a relevance engine. It is the clearest expression of the product's matchmaking ambition.

### 5. Profiles, Experience, Connections, And Saved Content

Profiles are the user's public professional identity page.

A profile can show:

- basic identity
- professional role
- skill domains
- verification badge
- skill posts
- experience entries
- authored events
- saved items (private to the owner)
- connection count

### Experience

Experience entries are resume-like records. They help visitors understand the person's background beyond feed activity.

### Connections

Connections are the social graph layer. They represent professional relationships between users and power profile context.

### Saved content

Users can save skill posts and events, then revisit them from their profile. Conceptually, saved content turns Luminas into a working tool, not just a browsing interface.

### 6. Creation Flows

The Create area is a capability hub. It exposes multiple publishing workflows, but each has different eligibility rules.

### Skill post creation

Anyone with saved skill domains can create a skill post.

This flow supports:

- skill selection
- text authoring
- media uploads
- AI-generated or AI-enhanced copy

### Experience creation

Users can add structured work history to strengthen their profile.

### Event creation

Only verified profiles can create events. In practice, this means the user must be both:

- in professional account mode
- human verified

Events are intended to feed into discovery, though the current implementation still includes local-only persistence paths.

### Job creation

Only professional accounts can create jobs. This aligns with the idea that jobs should come from business-facing or organization-linked accounts.

### Ad campaign creation

Ad creation is the strictest flow. To run ads, the user must satisfy all of the following:

- professional account enabled
- at least one company domain
- human verification completed
- company verification approved

This is one of the strongest product rules in the app and reflects a trust-first monetization model.

### 7. Trust, Human Verification, And Company Verification

Trust is not cosmetic in Luminas. It changes which features a user can access.

### Human verification

Human verification is a live face-check flow. The app uses camera analysis to look for signals such as:

- single face presence
- stable framing
- natural blink
- slight head turn
- liveness score
- anti-spoof score
- face identity samples for duplicate screening

Conceptually, this does three jobs:

1. confirms there is a live human,
2. reduces spoofing risk,
3. helps prevent duplicate identities.

This verification status is central because it also feeds the "verified profile" concept used elsewhere in the app.

### Verified profile

In Luminas, the verified-style trust badge is not just "human verified." It is effectively:

- **professional account = true**
- **human verification status = verified**

So the badge means "trusted professional profile," not just "email account exists."

### Company verification

Company verification is separate from human verification.

Its purpose is to decide whether a professional account is allowed to use company-backed promotional tools like ads. The user submits:

- a company domain
- a public company website

The app then runs an automated website validation step and stores a company verification status:

- required
- pending
- approved
- rejected

### Why the trust model is important

Luminas ties higher-leverage actions to stronger proof:

- identity proof for profile trust
- organization proof for monetized promotion

That is one of the clearest product concepts in the whole app.

### 8. Ads And Promotions

Ads in Luminas are not standalone banner inventory. They are boosts on existing user content.

The current ad system can promote:

- an event
- a skill post

Each campaign includes:

- target type
- target content id
- objective
- budget
- duration
- audience summary
- audience labels
- status

### Important conceptual detail

This is a **campaign configuration system**, not a full delivery or billing platform. The current product model focuses on campaign setup, access rules, and management rather than impression accounting or payment settlement.

### Dashboard relationship

The dashboard is where users review campaigns, launch drafts, pause active boosts, and navigate back to the underlying content.

### 9. Messaging

Messaging exists as a direct communication surface between users, but in the current codebase it behaves more like a seeded client-side inbox than a full real-time backend chat system.

Conceptually, messages support:

- introductions
- follow-up on jobs and events
- recruiter or founder outreach
- keeping conversations close to discovery surfaces

Implementation-wise, this part of the app is currently more demo-oriented than the Supabase-backed feed and verification features.

### 10. AI Assistance

AI appears in several places:

- skill post copy generation and enhancement
- event summary generation
- company website verification via Edge Function workflow
- Prolink AI metadata and summaries

### What AI is doing in Luminas

AI is not acting as a general chatbot. It is used as a workflow accelerator:

- drafting content,
- enriching discovery items,
- improving ranking signals,
- helping automate trust review.

This is important because it means AI is embedded into specific product operations rather than treated as a standalone feature.

## Main Product Concepts

This section summarizes the app's key concepts in one place.

### User

A person with account credentials and profile identity.

### Professional account

A higher-trust account mode that unlocks business-facing actions.

### Verified profile

A professional account that has also passed human verification.

### Skill domain

A structured expertise label saved on the profile and used to constrain skill posts.

### Skill post

The main social content object, tied to a user's skill domain.

### Explore update

A structured opportunity item in the categories of job, event, or hackathon.

### Experience entry

A structured profile record describing past work.

### Connection

A social relationship edge between two users.

### Saved item

Bookmarked content for later retrieval.

### Prolink feed item

A ranked opportunity or networking card enriched with AI metadata and audience targeting.

### Ad campaign

A promotion record used to boost an existing event or skill post.

### Human verification

A liveness and face-identity workflow used to prove one real human account.

### Company verification

A website/domain review flow used to approve company-backed promotional access.

## Feature Access Rules

The product has strong capability gates. This table is one of the most important ways to understand the app.

| Capability | Minimum requirement |
| --- | --- |
| Sign in and basic app access | Valid account and completed profile basics |
| Create skill post | At least one saved skill domain |
| Create event | Verified profile |
| Create job | Professional account |
| Create ad campaign | Professional account + company domain + human verified + company approved |
| Show verified-style trust badge | Professional account + human verified |

## Data And Architecture Concepts

Luminas uses a hybrid model.

### Supabase-backed areas

These are the most backend-native parts of the app:

- authentication and profile state
- user settings
- public users
- skill posts and engagement
- experiences
- explore updates
- connections
- ad campaigns
- Prolink feed and AI metadata
- human verification status
- company verification status

### Local browser-backed areas

Some features still persist to `localStorage` and behave more like prototype or transitional layers:

- messages
- some saved content behavior
- user-created jobs
- user-created events

### Why this matters

When working on the codebase, it is important to distinguish between:

- **product truth**, meaning what Luminas wants the feature to be, and
- **storage reality**, meaning whether that feature is already fully backend-backed.

Several flows are conceptually first-class, but still partially local in implementation.

## Backend Design Philosophy

The backend relies heavily on Supabase RPC functions rather than direct client table writes.

This has a few consequences:

- business rules live close to the database
- client code stays thinner
- role checks and validation can be centralized
- RLS can stay strict while RPCs expose safe actions

In practice, this means many frontend modules call functions such as:

- list data
- create records
- toggle likes
- toggle connections
- start or complete verification
- create or update ad campaigns

## Database Concepts By Migration

The SQL folder shows the app's conceptual growth over time.

| Migration | Concept introduced |
| --- | --- |
| `001_users_table.sql` | base user identity |
| `002_human_verification.sql` | human verification and duplicate prevention |
| `003_user_settings.sql` | profile settings |
| `004_skill_posts.sql` | core skill post publishing |
| `006_user_experiences.sql` | profile experience history |
| `007_explore_updates.sql` | jobs, events, hackathons discovery |
| `009_connections.sql` | user connection graph |
| `010_authored_events.sql` | authored explore items and profile event support |
| `011_professional_account_settings.sql` | professional account settings and role signals |
| `012_ad_campaigns.sql` | ad campaign model |
| `013_saved_content_and_demo_network_seed.sql` | saved content and seed data |
| `014_skill_post_engagement.sql` | likes and comments |
| `015_company_verification_for_ads.sql` | company verification fields and rules |
| `016_auto_company_website_validation.sql` | automated company website decision flow |
| `017_prolink_feed.sql` | Prolink feed and AI metadata |
| `018_seed_prolink_feed.sql` | Prolink seed content |
| `019_seed_prolink_promotional_ads.sql` | sponsored Prolink seed content |

## Frontend Structure

At a high level:

- `src/App.tsx` defines the routing model.
- `src/pages/` contains feature pages.
- `src/components/` contains reusable UI pieces like cards, navigation, badges, and rails.
- `src/lib/` contains most data access, normalization, ranking, and feature logic.
- `src/layouts/` contains the authenticated app shell.
- `supabase/sql/` contains the database schema and RPC logic.

### Important frontend patterns

- route-driven feature pages
- data helpers in `src/lib`
- heavy use of normalized response shaping
- business gating performed in both UI and backend layers
- fallback behavior when required Supabase functions are missing

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file from `.env.example` and provide valid values for:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_HUMAN_VERIFICATION_MODE=backend
VITE_HUMAN_VERIFICATION_PROVIDER=supabase-edge-face-id
```

For the company website verification Edge Function, the backend also expects:

```env
OPENAI_API_KEY=your-openai-key
```

Do not expose the OpenAI key in browser code. It belongs in Supabase secrets for Edge Functions.

### 3. Apply Supabase SQL

Run the SQL files in order, starting from `001_users_table.sql` through `019_seed_prolink_promotional_ads.sql`.

This is important because many frontend features assume the presence of specific RPCs and will degrade or show empty states if the migrations are missing.

### 4. Run the app

```bash
npm run dev
```

## Runtime Notes

- If Supabase is not configured, many pages intentionally fall back to empty states or local demo behavior.
- Some features are fully backend-backed, while others still behave like prototype flows using browser storage.
- Prolink, ad creation, and verification depend on later SQL migrations and supporting backend services.
- Company website verification also depends on a deployed Supabase Edge Function.

## What Is Most Important To Understand Before Editing This App

If you are new to the codebase, these are the five highest-value ideas:

1. **Luminas is not just a feed app.** It is a trust-gated professional network.
2. **Professional account status changes the whole product.** It affects badges, jobs, events, and ads.
3. **Verification is functional, not decorative.** It unlocks capabilities.
4. **Prolink is the ranking/matchmaking engine.** It is the most product-specific part of the app.
5. **The data layer is hybrid.** Some features are production-shaped but still partially local in implementation.

## Short Summary

Luminas is a professional discovery platform where users build trusted profiles, publish expertise, discover people and opportunities, and unlock higher-value capabilities through verification. Its core ideas are professional identity, trust gating, structured content, relevance ranking, and company-backed growth.
