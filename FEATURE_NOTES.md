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
`nMigration 20261110143500 additionally folds Turkish capital İ before lowercasing to avoid collation-specific combining dots. Live headings are exactly Sıcak İçecekler (8), Soğuk İçecekler (7), Sandviç & Tost (3); product IDs/names/prices are unchanged.

Auth readiness: persistent native AsyncStorage sessions, central AuthProvider routing, atomic signup/profile trigger, case-insensitive usernames, self-only profile repair, safe localized auth errors, and check-in cleanup on local sign-out are installed. Migration 20261110160000 applied. Three auth test groups, live traveler/business sign-in/refresh/logout, and iOS export (1271 modules) passed. Actual phone relaunch remains a manual check. The user explicitly requested continuing the remaining six readiness areas in a new chat; read RELEASE_CHECKLIST.md before proceeding.


Foreground presence readiness: user confirmed automatic checkout on leaving with permanent photos retained. Root-level per-account tracking survives navigation, pauses in background and rechecks on foreground. Fresh accurate fixes only; 100m entry / 150m exit with uncertainty, 5min renewal, 30min TTL retained. Tracker only reads venues and writes own presence rows; no photo writes. Home differentiates failed fetch from an empty result, supports retry and preserves previous results. GPS acquisition times out after 20 seconds. New verification scripts cover location boundaries, fetch races/offline recovery and presence lifecycle. Physical iPhone checks remain pending.


11 Kasım iPhone testi: kullanıcı giriş ve uygulamayı tamamen kapatıp açınca oturumun korunduğunu doğruladı (1–2 geçti). Çıkışta canlı venue_presence tablosunda authenticated DELETE grant eksikliği bulundu; self-only DELETE RLS zaten mevcuttu. Migration 20261111090000 yalnızca eksik DELETE yetkisini ekler; canlıya uygulandı ve migration geçmişinde. verify-presence-permissions testi eksik grant hatasını yeniden üretir ve başka kullanıcının kaydının korunmasını doğrular. Geçici iki hesapla gerçek JWT testi: kendi check-in silme, başkasını silememe ve local logout geçti. Test verileri temizlendi. Kullanıcının iPhone çıkış tekrarı henüz bekliyor.


11 Kasım iPhone test 4: kullanıcı hesap/rol geçişinin çalıştığını doğruladı. Test 5 yanlış harita konumu bildirdi. HomeScreen FlatList başlığı her renderda yeni component function olarak verildiği için MapView yeniden mount olup sabit Muğla initialRegion değerine dönebiliyordu. Başlık artık React element olarak verilir; harita state değişimlerinde korunur. Yeniden açıldığında son GPS konumu initialRegion olarak kullanılır. Telefon konumu ayrı mavi marker ve GPS doğruluk çemberiyle gösterilir; Konumum düğmesi yükleme/çift basma korumalıdır. Gerçek iPhone konum tekrarı bekliyor.


11 Kasım konum tekrarında kullanıcı Konum alınıyor yazdığını fakat mavi işaretin çıkmadığını bildirdi. Önceki Expo sürecinin DNS ENOTFOUND ile kapandığı doğrulandı; önceki düzeltmenin telefona ulaştığı varsayılamaz. Yeni temiz önbellekli tünel başlatıldı. Home haritası artık region state ile doğrudan kontrol edilir; GPS alınamadığında açıklama harita üstünde görünür. GPS 20sn sınırı permission/services dahil tüm isteği kapsar; permission/services takılma testleri de geçti. iOS export 1272 modül başarılı. Fiziksel iPhone konum kontrolü hâlâ BEKLİYOR.


11 Kasım: kullanıcı gerçek iPhone konum ve check-in testlerini geçtiğini doğruladı. Bowling konumsuz test kaydı için kullanıcı kendi gezgin hesabıyla 1 saatlik mesafesiz check-in/fotoğraf testini açıkça onayladı. Genel/kalıcı istisna uygulanmadı. Migration 20261111110000 scoped_photo_test_access: private RLS table, en fazla 1 saat, yalnızca sunucu tarafından açılır; has_photo_test_access yalnızca mevcut auth.uid ve mekân için boolean döndürür. Normal mekân mesafesi, ziyaretçi rolü, check-in, storage sahipliği ve fotoğraf kalıcılığı korunur. İstemci süre sonunda normal GPS kurallarına döner. Hesap bazlı aktivasyon migration dışındadır, repo kişisel hesap kimliği içermez. SQL sınır/expiry/istemci yetkisiz erişim testleri ve iOS export (1273 modül) geçti. Kullanıcının gerçek fotoğraf/yorum/beğeni testi bekliyor.


11 Kasım fotoğraf arayüzü: kullanıcının son tercihi Ziyaretçiler sekmesinden fotoğraf PAYLAŞILMAMASI. Tek gezgin paylaşım alanı Fotoğraflar sekmesinde; Ziyaretçiler aynı kalıcı kayıtları 3 sütunlu kare ızgarada gösterir. Kareye dokununca aynı fotoğraf ID’sinin yorum/beğeni/sahip-silme detayları modalda açılır. Fotoğraflar sekmesinde gezgin ve resmi mekan galerileri yatay sayfalı kaydırılır; iç galeriyle çakışmaması için Fotoğraflar açıkken dış menü/fotoğraf pager swipe kapalı, sekme düğmeleri aktiftir. Profilin mevcut akışı korunur. UI testi ızgara/doğru fotoğraf/ortak beğeni ve yorum/yatay galeri kontrollerini kapsar. iOS export geçti. Kullanıcı uzaklaşma ve yeniden check-in testini şu an yapamadığını, diğer denemelerin çalıştığını bildirdi; uzaklaşma/yeniden check-in hâlâ fiziksel cihazda BEKLİYOR. Yeni galeri düzeninin gerçek iPhone görünümü de tekrar kontrol edilmeli.


11 Kasım owner pins: Ziyaretçiler ızgarası resmi mekan paylaşımlarını da gösterir. Resmi paylaşımlar mavi, gezgin kareleri pembe çerçevelidir; sabit resmi fotoğraflar en üsttedir. Sadece mekan sahibi, kendi resmi paylaşımlarından en fazla 3 tanesini sabitleyebilir; server ownership+business role+author kontrolü ve venue lock ile sınır uygular. Gezgin paylaşımına owner pin/silme hakkı eklenmedi. DemoCafeButton aynı bileşenleri kullandığı için bu davranış deneme kafesinde de geçerlidir; sahte paylaşım/gerçek mekan eklenmedi. Migration 20261111120000 canlı ve history’de; verify-owner-pins ve genişletilen photo-ui geçti.


11 Kasım menu stage 2: MenuPhotoImport now reads the photo into an exact add/update/remove preview and only writes products after a separate confirmation. The SQL preview runs the same reconciliation engine inside a rolled-back subtransaction; no menu/archive/import-count writes survive preview. Private per-user tokens expire after 15 minutes, snapshot changes invalidate confirmation, confirmation retries are idempotent. Manual menu writes also acquire the venue lock. Unreadable prices preserve existing values, unrelated product families remain, old variants are explicitly listed. import-menu action=preview deployed with existing explicit JWT/role/owner guards and existing verify_jwt=false authorization retained. Migration 20261111130000 applied/history recorded. Local SQL/UI/edge tests and iOS export (1273 modules) passed. Live temporary JWT/AI fixture: 2 adds, 1 update, 2 old variants removed, zero writes before confirmation, foreign user rejected, owner confirmation saved expected prices, absent dessert retained, repeated confirm and cached photo safe; temporary data cleaned. Existing real demo menu was not changed. Physical iPhone preview/cancel/confirm test remains pending.
