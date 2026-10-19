---
name: tipmood-website-builder
description: Build and update TipMood, a responsive Instagram-inspired nail design website for global consumers, nail artists, and brands. Use for nail inspiration feeds, style and color filters, mood-word-to-design generation, account onboarding, Google/Apple/email login flows, preference selection, and user nail-image uploads.
---

# TipMood Website Builder

Create a polished, mobile-first nail design experience named **TipMood**.

## Product requirements

- Use an Instagram-inspired visual feed for browsing nail inspiration.
- Use a high-end editorial visual system: black and white foundation, restrained metallic accents, generous whitespace, and strong nail photography.
- Support three onboarding roles: consumer, nail artist, and nail brand.
- Let users save preferred styles, colors, lengths, finishes, and occasions during onboarding.
- Provide filters for color, style, occasion, length, finish, and trend.
- Accept abstract prompts such as “soft mysterious summer” and turn them into a concrete nail concept.
- Show each generated concept as both an image/effect preview and a design card containing palette, shape, finish, pattern, occasion, and a concise rationale.
- Include email/password, Google, Apple, and demo login states. Keep authentication clearly separated from presentation-only mock data.
- Let consumer users upload their own nail images, preview them in the feed, and save them to a personal collection.
- Make layouts responsive for desktop Chrome/Edge and mobile browsers. Prefer accessible controls, keyboard navigation, readable contrast, and touch-friendly targets.

## Build workflow

1. Define the page map: landing, onboarding/login, inspiration feed, mood generator, design detail, upload flow, profile/collection, and role-specific views.
2. Establish the editorial design tokens before implementing components. Keep typography, spacing, radii, borders, and metallic accent usage consistent.
3. Build the feed and filter interaction first, then onboarding preferences, then mood generation, then upload and profile flows.
4. For mood generation, preserve the user’s words in the result and derive explicit visual attributes. If image generation is unavailable, use a clearly labeled preview placeholder or deterministic mock image rather than claiming a real generated image.
5. Validate at narrow mobile width and desktop width. Check empty, loading, error, and upload states.
6. Keep sample content globally inclusive and avoid assuming a single beauty standard.

## Output expectations

Deliver a runnable responsive site or project files, with concise setup instructions only when needed. Keep the core interface in English unless the user requests localization. Use realistic sample nail designs and clear labels for demo-only authentication or generation.
