# Venue implementation notes — 2026-11-10

## Current product rules

- Travelers can read menus but cannot add, edit, delete or import products. All menu writes require both users.is_venue=true and ownership of that cafe; RLS and import RPCs enforce this.
- Visitor photos are PERMANENT. A single venue_moments row appears on the author's profile, public profile and the cafe's Photos tab (also accessible from Visitors). Only the author can delete it, removing it from every view with its likes/comments. The venue owner cannot delete a visitor's post or someone else's comment. Closing times never expire visitor posts. There is no profile-only hide for visitor photos anymore; the old hide RPC now performs the same author-only deletion for compatibility.
- Existing surviving photos are preserved. Previously profile-hidden visitor posts honor the author's removal by deleting from both views. Business accounts keep their separate official photo gallery; they cannot publish as visitors. Owners can pin up to three of their official photos.
- Photo likes are one per signed-in user and idempotent. Visitor photo comments support 1–500 characters, pagination, retry-safe posting, and author-only deletion. The same photo ID means the same comments/likes in profile and cafe views.
- Photo publication still requires check-in and a fresh accurate GPS position. Closing time is no longer a prerequisite. Gallery/camera images are normalized to JPEG up to 2400px before upload.
- The demo button creates/reuses the business account's single deneme cafe at a fresh phone GPS fix. Travelers visit that shared cafe without being converted into owners. Normal distance checks apply to check-in.

## Menu reconciliation

- Incoming photos insert new products and update readable prices on existing products; unreadable prices never erase a known price. Entire product families absent from a page remain.
- Identity tolerates case, Turkish diacritics, punctuation, spaces and word order. Standard S/small, M/medium and L/large spellings match Küçük/Orta/Büyük. Known serving/descriptive differences such as Çay (demlik)/Demlik Çay and Limonata (ev yapımı)/Limonata share a family.
- The user confirmed S/Y annotations are sizes/variants, and explicitly requested that a new single-option product replace older small/large options. For each family represented in a new photo, only that photo's variants remain. Multiple variants on the same new page remain distinct. Never apply this as a deletion of unrelated absent product families.
- A unique expression index prevents duplicate product identities even through direct inserts. Legacy duplicates and superseded variants are stored in the private menu_merge_archive before removal; newest recorded batches are retained. menu_updated_at tracks future updates. Venue row locking serializes imports. Conflicting prices for the same identity on one page reject the page atomically.
- Cached older photos cannot roll back later price updates. The UI previews the photo before Menüyü oku ve ekle, retains it on failure, and refreshes the menu on success.
- On the live deneme menu, nine superseded rows were archived, leaving 18 products and zero duplicate identities. Small/large Cappuccino and Latte variants were superseded by the newer S variants at 155 TL.

## Runtime and cleanup

- GEMINI_API_KEY stays in Supabase secrets, never in the app. Optional GEMINI_MENU_MODEL defaults to gemini-flash-lite-latest. At most two bounded generation attempts are made; transient failures can use an available stable Flash model from Google's catalog.
- import-menu has gateway verify_jwt=false with explicit user authorization. Its handler still verifies auth.getUser and business role; owner-scoped SQL RPCs enforce authorization. Error messages distinguish provider quota, model availability, timeouts and saves.
- PHOTO_CLEANUP_TOKEN stays in Edge secrets and Vault. The existing minute-based cleanup job now ONLY cleans files after author deletion. queue_expired_visitor_photos is intentionally a no-op; do not restore the old expiry behavior. An after-delete trigger queues files. The worker additionally protects any path with a surviving post, and retries failed deletions. File cleanup never drives post deletion.
- All checked-in migrations, including 20261110130000 and 20261110131000, are applied and recorded on the linked project. Never reapply old standalone lifecycle SQL on top of these migrations.
- Menus/official gallery/visitor photos are separate records. Menu photo import produces products and does not publish the source image as a social post.

## Validation

- node scripts/verify-menu-demo.cjs: gallery/camera preview, JPEG conversion, traveler hiding, shared demo routing, failure retry and refresh.
- node scripts/verify-menu-edge.cjs: role gate, owner commit, provider fallback, timeout/quota/truncation and cached import.
- node scripts/verify-menu-permissions.cjs: PostgreSQL role/RLS rules, identity normalization, legacy deduplication, variant replacement, current prices, null-price protection, archive, idempotency and ambiguity rollback.
- node scripts/verify-photo-social.cjs: actual PostgreSQL publication without closing time, permanent profile/cafe visibility, owner deletion denial, comment/like idempotency and authorization, cascading author deletion and cleanup queue.
- node scripts/verify-photo-ui.cjs: profile/cafe use the same deletion API and comment thread; foreign posts have no delete control.
- node scripts/verify-photo-cleanup.cjs: token auth, live-file protection and retry on failed file removal.
- Live two-photo AI validation passed (Cay 40→55, Latte 120→140, Espresso 90 inserted, absent Cheesecake 180 retained); test accounts/cafe removed.
- Live Storage/JWT social validation passed: visitor publication with no closing time, same photo in cafe/profile, venue owner cannot delete photo/comment, likes and comments persist without retry duplicates, author deletion removes both views and cascades social records. Temporary test users/cafe/image were removed.
- These automated/live API tests do not replace checking final layout and interactions on the user's physical phone. Remote push registration is skipped in Expo Go; app build/project configuration remains a separate release task.

Final verification: all six local verification scripts and iOS export (1257 modules) passed. Live checks found zero temporary test users/cafes, one surviving original visitor photo, no expiring posts and zero duplicate menu identities. The Expo tunnel was restarted after a DNS failure.

Category normalization: case, Turkish accents and whitespace no longer split category headings. Existing hot drink variants are stored as Sıcak İçecekler; inserts and manual edits use the same canonical label through a DB trigger. The UI also merges equivalent headings defensively. Live verification found one hot-drink category containing eight products; every product ID/name/price remained unchanged. Test: node scripts/verify-menu-categories.cjs. Migration 20261110143000 is applied.
