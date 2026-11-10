# Venue photo and menu work — 2026-10-31

## Implemented

- Swipe between Menu and Photos on the public venue page; visitors remain separate.
- Gemini-backed menu image import with structured product names, prices, categories and food/drink groups; same-image retries do not duplicate items.
- Venue photo uploads with author usernames, at most three pinned photos and newest-first ordering for remaining photos.
- Venue accounts cannot post as visitors. Per-venue closing time in Europe/Istanbul controls visitor-post expiry.
- Authenticated scheduled cleanup removes expired visitor records and retries Storage file deletion every minute.
- Venue management panel has no photo feed; it links to the public venue page. Home and owner venue lists reload on focus.
- Fixed realtime channel reuse and a Storage RLS column-shadowing bug.

## Menu import status — 2026-11-10

Live three-product image test passed: Cay 40 TL, Latte 120 TL, Cheesecake 180 TL were read and persisted with correct food/drink groups in 4.3 seconds. Repeating the same image returned the existing import without duplicating products. A temporary traveler account was rejected before AI. Temporary accounts and the test cafe were removed. The user's own phone photo still needs verification in the updated UI; this fixture test is not a claim that every photo is readable.

## Runtime configuration

- `GEMINI_API_KEY`: Supabase Edge Function secret. Never commit its value.
- `GEMINI_MENU_MODEL`: optional; default `gemini-flash-lite-latest` (alias, not a pinned model revision).
- `PHOTO_CLEANUP_TOKEN`: shared random secret in Edge Function secrets and Supabase Vault (`venue_photo_cleanup_token`).
- `cleanup-visitor-photos` uses its own token check; its gateway JWT verification is disabled in config.toml.
- For a new environment, apply all checked-in migrations, provision the cleanup token, deploy the cleanup function and apply schedule_visitor_cleanup. The current linked project already has these applied.
- The owner must configure the venue closing time before visitors can publish.

## Validation and limits

PostgreSQL-engine tests covered ownership, idempotency, Storage RLS, maximum three pins, asymmetric profile hiding, timezone/midnight expiry and cleanup retry behavior. iOS Metro bundles were compiled and downloaded through the tunnel. The scheduled cleanup returned HTTP 200. These checks do not replace real-device camera testing.

The latest UI decision removes the duplicate photo feed from personal/management screens; venue photos are displayed on the public venue page. The earlier profile-hidden database support remains but is not exposed through that removed feed.

Legacy gallery entries are preserved. Pinning applies to the new venue-account photo records. Photo feeds currently load at most 300 venue photos. Public Storage image links remain readable until their files are removed.


## Menu permissions and photo flow — 2026-11-10

- Menu tools require BOTH `users.is_venue=true` and venue ownership. Travelers see menu/read-only sections and never see menu upload/add/edit/delete controls, even if an old test cafe has their owner_id. Direct writes and both import RPCs enforce the same rule. Read access to menus is preserved.
- The demo button opens the business account's existing `deneme` cafe for travelers without creating a cafe or changing their role. A business account creates/reuses its own `deneme` cafe at a fresh, accurate phone GPS fix. Check-in still uses the normal distance rule. Other cafes are untouched.
- Camera/gallery selection now prepares a JPEG (maximum 2400px edge), shows a preview, then requires `Menüyü oku ve ekle`. The image is converted into products; it is not a gallery photo upload. Failed imports retain the preview for retry; success reports the product count and refreshes the menu. A refresh failure is distinguished from a save failure.
- Live logs identified 75-second AI timeouts and Google 503 capacity errors. The reader uses Flash Lite by default, with at most two bounded generation attempts and an available stable Flash model selected from Google's catalog on transient failure. Errors distinguish quota, unavailable model, timeout, and database save. Failed attempts release the in-progress cooldown; hourly and attempt caps remain.
- The legacy gateway check is disabled with explicit user approval; handler JWT verification and server role/ownership authorization are enforced. Migration `20261110093000_menu_business_permissions.sql` is applied to the linked project and recorded in migration history.
- Run `node scripts/verify-menu-demo.cjs`, `node scripts/verify-menu-edge.cjs`, and `node scripts/verify-menu-permissions.cjs` after `npm ci`. They test UI preview/retry and traveler hiding, server fallback/failure behavior, and actual PostgreSQL RLS/role/idempotency rules. Live fixture validation supplements these tests.

Validation completed: iOS export passed (1256 modules); all three verification scripts passed. The earlier traveler-owned duplicate `deneme` cafe contained no menu, photos, reviews, favorites, messages, campaigns or collections. It was removed together with its temporary presence/failed imports under a transaction that aborts if real content exists. Exactly one `deneme` cafe remains, owned by the business account. No other cafes were changed.
