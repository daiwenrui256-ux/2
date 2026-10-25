---
name: tipmood-website-builder
description: Build and update TipMood, a responsive Instagram-inspired nail design website for global consumers, nail artists, and brands. Use for nail inspiration feeds, style and color filters, mood-word-to-design generation, safe AI image effect previews from user keywords, account onboarding, Google/Apple/email login flows, preference selection, and user nail-image uploads.
---

# TipMood Website Builder

Create a polished, mobile-first nail design experience named TipMood.

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
- Keep sample content globally inclusive and avoid assuming a single beauty standard.

## Safe AI effect-image generation

When a user asks to generate an effect image from keywords, implement the following flow:

1. Preserve the user’s words in the design card, then derive explicit visual attributes: palette, nail shape, finish, pattern, occasion, and mood.
2. Run input moderation before sending the request to an image model. Reject or ask the user to revise requests involving sexual content, graphic violence, illegal activity, non-consensual intimate imagery, or sensitive personal information.
3. Reject or rewrite requests that ask for a celebrity/person’s likeness, a brand logo or trademark, a copyrighted character, or imitation of a living artist. Ask for an original description based on colors, materials, geometry, era, and mood instead.
4. Send image-generation requests from a server-side endpoint only. Keep API keys in deployment secrets or environment variables; never expose them in browser JavaScript, HTML, Git history, or client logs.
5. Add a prompt suffix requiring an original nail concept with no logos, trademarks, recognizable characters, celebrity likenesses, or living-artist imitation. Do not use reference images unless the user confirms they own or have permission to use them.
6. Label the result as AI-generated and show a short notice that generation does not automatically grant commercial, trademark, portrait, or copyright rights. Provide a report/remove route for user complaints.
7. Handle empty, loading, refusal, timeout, rate-limit, and provider-error states. If image generation is unavailable, show a clearly labeled deterministic mock preview instead of implying that a real AI image was created.
8. Before commercial publication, require human review of the prompt, source materials, and output. Avoid promising that any result is legally cleared.

A typical request contract is:

- POST /api/generate
- body: { prompt, size, use }
- response: { image, generated: true } or a user-readable refusal/error
- server flow: validate length and size -> moderate input -> apply original-design constraints -> call the image provider -> return the image or a refusal

## Build workflow

1. Define the page map: landing, onboarding/login, inspiration feed, mood generator, design detail, upload flow, profile/collection, and role-specific views.
2. Establish the editorial design tokens before implementing components. Keep typography, spacing, radii, borders, and metallic accent usage consistent.
3. Build the feed and filter interaction first, then onboarding preferences, then mood generation, then upload and profile flows.
4. For mood generation, use the safe AI flow above. If image generation is unavailable, use a clearly labeled preview placeholder or deterministic mock image rather than claiming a real generated image.
5. Validate at narrow mobile width and desktop width. Check empty, loading, error, refusal, rate-limit, and upload states.
6. Keep authentication, provider calls, moderation, and storage on the server side. Never commit secrets.
7. Deliver a runnable responsive site or project files, with concise setup instructions only when needed. Keep the core interface in English unless the user requests localization. Use realistic sample nail designs and clear labels for demo-only authentication or generation.
