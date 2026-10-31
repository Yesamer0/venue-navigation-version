# Venue photo and menu work — 2026-10-31

## Implemented

- Swipe between Menu and Photos on the public venue page; visitors remain separate.
- Gemini-backed menu image import with structured product names, prices, categories and food/drink groups; same-image retries do not duplicate items.
- Venue photo uploads with author usernames, at most three pinned photos and newest-first ordering for remaining photos.
- Venue accounts cannot post as visitors. Per-venue closing time in Europe/Istanbul controls visitor-post expiry.
- Authenticated scheduled cleanup removes expired visitor records and retries Storage file deletion every minute.
- Venue management panel has no photo feed; it links to the public venue page. Home and owner venue lists reload on focus.
- Fixed realtime channel reuse and a Storage RLS column-shadowing bug.

## Next task — not resolved

The user reports that taking a menu photo with the camera and submitting it still does not work. Reproduce on their iPhone through Menu → Take photo. Capture the actual error and determine whether failure occurs in camera permissions, image conversion/type/size, Edge Function authentication, Gemini quota/response, or database commit. Do not describe this path as working until a real device upload succeeds. Gallery and camera paths share the importer but need separate device checks.

## Runtime configuration

- `GEMINI_API_KEY`: Supabase Edge Function secret. Never commit its value.
- `GEMINI_MENU_MODEL`: optional; default `gemini-flash-latest` (alias, not a pinned model revision).
- `PHOTO_CLEANUP_TOKEN`: shared random secret in Edge Function secrets and Supabase Vault (`venue_photo_cleanup_token`).
- `cleanup-visitor-photos` uses its own token check; its gateway JWT verification is disabled in config.toml.
- For a new environment, apply migrations up to photo_lifecycle, provision the cleanup token, deploy the cleanup function and apply schedule_visitor_cleanup. The current linked project already has these applied.
- The owner must configure the venue closing time before visitors can publish.

## Validation and limits

PostgreSQL-engine tests covered ownership, idempotency, Storage RLS, maximum three pins, asymmetric profile hiding, timezone/midnight expiry and cleanup retry behavior. iOS Metro bundles were compiled and downloaded through the tunnel. The scheduled cleanup returned HTTP 200. These checks do not replace real-device camera testing.

The latest UI decision removes the duplicate photo feed from personal/management screens; venue photos are displayed on the public venue page. The earlier profile-hidden database support remains but is not exposed through that removed feed.

Legacy gallery entries are preserved. Pinning applies to the new venue-account photo records. Photo feeds currently load at most 300 venue photos. Public Storage image links remain readable until their files are removed.
