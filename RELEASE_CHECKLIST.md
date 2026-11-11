# Venue — devam ve teslim kontrolü (10 Kasım 2026)

## Kullanıcının son talebi

Öğretmen gözüyle önerilen altı başlığı sırayla iyileştirmemizi istedi. Öncelik iPhone. En son açıkça: “bu kısmı bitir sonra yeni sohbetten devam et yapmaya”. Bu yüzden bu sohbet yalnızca üzerinde çalışılan giriş/kayıt/oturum bölümünü bitiriyor; kalan işler yeni sohbette sürdürülmeli. Gerçek Kötekli mekanlarını kullanıcı daha sonra ekleyecek; şimdi otomatik gerçek mekan/veri ekleme.

## Kaynak ve Git

Asıl çalışan uygulama/repo C:\venue-app. Bu sohbetin çalışma dizini C:\Users\Yeşim\OneDrive\Belgeler\ChatGPT\venue yalnızca çalışma/yardımcı dosyalar içerir, Git reposu değildir. venue-readiness bu son değişikliklerin hazırlık klonudur; asıl uygulama yerine bunu çalıştırma. Esas notlar FEATURE_NOTES.md ve bu dosyadır.

Remote origin: https://github.com/Yesamer0/venue-navigation-version.git, main varsayılan daldır. Kullanıcı tamamlanan ilgili işleri mantıklı commitlerle push etmemizi istiyor. Etkin yazar e-postasını her commit öncesi doğrula: yesim.altundag04@gmail.com, GitHub Yesamer0. Yayımlanmış geçmişi değiştirme; boş/geri tarihli commit yok. Secrets, cache, generated export ve model dosyaları commit edilmez. Windows sandbox sahiplik farkında git -c safe.directory=C:/venue-app kullan. C:\venue-app yazmaları için sandbox escalation gerekebilir; kullanıcı bu proje düzenlemelerini zaten yetkilendirdi.

## Bu bölümde tamamlananlar

- Supabase istemcisi AsyncStorage (Expo SDK ile uyumlu 2.2.0) ile oturumu saklıyor; processLock ve react-native-url-polyfill kullanıyor.
- AuthProvider kayıtlı oturumu yükleyip doğrulanmış kendi profilini alıyor. React Navigation auth durumuna göre ekranları seçiyor; çıkış/hesap değişimi eski gezinme geçmişini temizliyor. TOKEN_REFRESHED aynı kullanıcının profilini silmiyor veya yükleme ekranında takmıyor.
- onAuthStateChange callback'i yalnızca senkron state günceller; Supabase çağrıları ayrı effect'te yapılır (deadlock önlenir). iOS AppState foreground/background için token auto-refresh başlatılır/durdurulur.
- Kayıt ve profil oluşturma auth.users INSERT trigger'ında atomiktir. Kullanıcı adı büyük/küçük harfe duyarsız benzersizdir; anon için yalnızca boolean kullanıcı adı müsaitlik RPC'si var. Profil onarım RPC'si sadece auth.uid() profilini oluşturabilir, mevcut rolü değiştirmez; yalnızca id/username/is_venue döndürür.
- AuthScreen e-posta ve kullanıcı adını temizler, şifreyi trim etmez. Kayıtta 8–128 karakter, mevcut hesap girişinde eski şifre uzunluğuna ek kısıt yok. Kayıt çift basmayı engeller; ağ ve yanlış giriş hataları Türkçe gösterilir. Profil için istemci INSERT'i kaldırıldı.
- Çıkış önce kişinin kendi venue_presence kayıtlarını temizler, sonra o cihazın oturumunu kapatır. Fotoğraflara dokunmaz. Başka cihazların push token'larını topluca silmez.
- iPhone klavyesi için giriş ekranı kaydırılabilir/KeyboardAvoidingView'dır; e-posta ve şifre otomatik doldurma ipuçları eklidir.
- Başlangıçta bağımsız bildirim izni isteme kaldırıldı. Bildirim kaydı giriş sonrası, giriş akışını bekletmeden çağrılır. Expo Go helper hâlâ skip eder; native bildirim konusu aşama 5'tir.
- Migration 20261110160000_atomic_auth_profiles.sql canlı rkqsobflqmkqzuzmiagn projesine uygulanıp migration history'ye kaydedildi. Mevcut kullanıcı profilleri/rolleri değiştirilmedi.

## Kanıt ve doğrulama

node scripts/verify-auth-profiles.cjs: atomik kayıt, case-insensitive kullanıcı adı çakışmasında auth kaydının rollback'i, yalnızca kendi profilini onarma, mevcut rolü koruma ve hassas alan döndürmeme geçti.
node scripts/verify-auth-service.cjs: girdi doğrulama, şifreyi aynen koruma, güvenli Türkçe hatalar, kendi check-in'ini temizleme ve hatalı çıkışı başarılı göstermeme geçti.
node scripts/verify-auth-state.cjs: saklanan oturumun yüklenmesi, token yenileme, hesap rolü değişimi, yeniden deneme ve çıkış state temizliği geçti.
Canlı geçici gezgin ve mekan hesabıyla atomik profil, gerçek giriş, kendi rolünü alma, refresh_token ile yenileme ve local logout geçti. Test hesapları temizlendi; e-posta gönderilmedi.
iOS export başarılı (1271 modül). Son eklenen otomatik doldurma props'ları JSX kontrolünden de geçti. Gerçek iPhone'da kapat/aç testi HENÜZ kullanıcı tarafından doğrulanmadı; yapılmış gibi söyleme.

## Değiştirilmeyecek ürün kuralları

- Gezgin menü ekleyemez/düzenleyemez/silemez. Mekan rolü + o mekanın sahipliği zorunlu; sadece UI gizlemek yetmez.
- Gezgin fotoğrafı profilde ve kafenin Fotoğraflar bölümünde aynı kalıcı kayıttır. Kapanışta silinmez. Sadece paylaşan gezgin sildiğinde iki yerden de kalkar; mekan sahibi silemez. Beğeni ve yorum aynı fotoğraf ID'sindedir; yorumunu yalnızca yazarı siler. Son canlı testlerde tümü geçti.
- Dosya cleanup cron'u sadece paylaşan tarafından silinmiş kayıtların dosyalarını temizler. queue_expired_visitor_photos bilinçli no-op; eski kapanış temizliğini geri getirme. Worker hayatta olan fotoğrafın dosyasını korur.
- Menüde yeni ürün eklenir, mevcut okunabilen fiyat güncellenir; okunamayan fiyat eski fiyatı silmez. Kullanıcı S/Y'yi boyut/çeşit olarak açıkladı. Yeni fotoğrafta bir ürün tek seçeneğe düşmüşse eski küçük/büyük seçenekleri kalkar; yeni sayfadaki çoklu çeşitler ayrı kalır. Sayfada hiç olmayan diğer ürün aileleri silinmez.
- Menü kimliği Türkçe karakter, harf durumu, noktalama, kelime sırası ve S/Küçük gibi bilinen boyut farklarını normalize eder. Tekillik index'i var. Eski/superseded satırlar private menu_merge_archive tablosunda arşivlenir. Daha önce işlenen eski fotoğraf yeni fiyatı geri alamaz.
- SICAK İÇECEKLER/Sıcak İçecekler artık tek kategori. Türkçe büyük İ lower öncesi normalize edilir; DB collation combining-dot farkına dikkat. Canlı deneme: 18 ürün; Sıcak İçecekler 8, Soğuk İçecekler 7, Sandviç & Tost 3. Başlıkları ürün/fiyatı değiştirmeden birleştirdik.
- import-menu verify_jwt=false değişikliği kullanıcı tarafından AÇIKÇA onaylandı ve canlıda. Handler auth.getUser, business rolü ve owner RPC kontrolleri korunur. Bu onayı tekrar sorma. Gemini Flash Lite varsayılan; bounded retry/fallback var. Gizli anahtarlar uygulamaya/çıktıya yazılmaz.

## Yeni sohbette devam edilecek 6 başlık

1. Uçtan uca kullanıcı testi: giriş/oturum otomatik kısmı tamamlandı. Kullanıcıyla gerçek iPhone'da kapat/aç, çıkış/geri tuşu, gezgin/mekan değişimi kontrolü yapılmalı. HomeScreen bağlantı hatası/yeniden deneme ve son veriyi koruma tamamlandı; GPS isteğine 20 saniye sınırı ve ortak ölçüm doğrulaması eklendi. Gerçek iPhone izin/ağ/GPS denemeleri bekliyor.
   Kullanıcı bu sohbette açıkça onayladı: uzaklaşınca check-in kapansın, fotoğraf kalsın. RootNavigator artık hesap başına tek foreground tracker çalıştırır; detaydan ayrılınca takip sürer. Giriş 100m, çıkış 150m, hata payı korunur; 5dk yenileme ve 30dk TTL korunur. 30sn tarama mevcut check-in kayıtlarını keşfeder ve taze GPS alır; izin yokken otomatik izin istemez. Arka planda watcher durur; dönüşte yeniden kontrol edilir. Arka planda/uygulama kapalıyken anlık çıkış garantisi yoktur; TTL geçerlidir. Fotoğraflara dokunulmaz.
2. Menü güvenilirliği: mevcut eşleştirme ve canlı testler tamamlandı; kayıt öncesi yeni/yenilenecek/kaldırılacak seçenekler için açık bir değişiklik önizlemesi henüz yok. Gerçek fotoğraflarla zor durumlar ve onaylı önizleme geliştirmesi kalan iş.
3. Fotoğraf cihaz testi: backend/Storage/JWT, yorum/beğeni, author-only silme testleri geçti; iki gerçek cihazda görünümlerin yenilenmesi, klavye ve yorum etkileşimleri kullanıcıyla denenmeli.
4. Hesap/güvenlik: şifre sıfırlama ve hesap silme akışları henüz yapılmadı. Tüm tablo yetkileri baştan sona denetlenmedi. public.users tablosunda kullanılmayan password alanında 1 dolu eski kayıt olduğu SADECE SAYIYLA görüldü; değer ASLA okunmadı. Giriş Supabase Auth ile. Bu alanı kaldırmadan önce kod bağımlılığı ve ilgili Auth hesabını doğrula; hiçbir şifreyi/token'ı sohbete, dosyaya veya loga yazma. Auth profil self-SELECT dışında UPDATE politikası yok; tabloya email/password koymanın etkileri ayrıca gözden geçirilmeli. İşletme hesabı silinince gezgin fotoğrafları nasıl korunacak sorusu kullanıcıyla netleştirilmeli.
5. Bildirim/kurulabilir paket: Expo Go remote push skip ediyor. EAS projectId ve iOS bundle identifier app.json'da henüz ayarlı değil; eas.json yok. Expo/Apple geliştirici hesabı ve dağıtım seçimi netleştirilmeli. Ücretli işlem veya mağazaya yayın için ayrıca somut sonucu hazırlayıp kullanıcı onayı al; kendiliğinden ödeme yapma. Kullanıcı öncelikle iPhone dedi.
6. Arayüz: genel tasarım sistemi ve ortak loading/error/empty halleri henüz tüm ekranlarda birleştirilmedi. Uzun listeler, küçük iPhone, klavye, erişilebilirlik, bağlantı kesilmesi testleri kalan iş. Kategori normalizasyonu ve menü/fotoğraf önizlemeleri mevcut.

## Yardımcılar ve güvenlik

Çalışma dizinindeki venue_supabase_api.py mevcut Windows Supabase CLI credential'ını yalnızca bellekte kullanır; token yazdırmaz. github_api.py Git Credential Manager üzerinden GitHub doğrulaması yapar. verify_live_auth.py ve verify_live_* dosyaları geçici test hesapları kullanır ve temizler; mevcut kullanıcıları veya gerçek fotoğrafları test için silme. Supabase CLI C:\venue-app\node_modules\.bin\supabase.cmd. Ağ/DNS yüzünden Expo tüneli ara sıra kapanabilir; yeni QR verirken gerçek çalışan adresi logdan/manifestten doğrula.

Verified auth implementation commit: 5cc2e69e40c49a4160e78de3fc1e25bb56c604db on origin/main. Later handoff-only formatting/documentation commits may follow; do not reset the working tree to the implementation commit.


10 Kasım devam doğrulaması: verify-device-location, verify-home-loading, verify-presence-tracking ve mevcut auth-state/menu-demo/photo-ui kontrolleri geçti. iPhone kapat/aç sorusuna kullanıcı “Henüz denemedim” yanıtını verdi; cihaz doğrulaması bekliyor. Menü değişiklik önizlemesi ve 2–6 başlıklarının kalan işleri henüz tamamlanmadı.


11 Kasım iPhone testi: kullanıcı giriş ve uygulamayı tamamen kapatıp açınca oturumun korunduğunu doğruladı (1–2 geçti). Çıkışta canlı venue_presence tablosunda authenticated DELETE grant eksikliği bulundu; self-only DELETE RLS zaten mevcuttu. Migration 20261111090000 yalnızca eksik DELETE yetkisini ekler; canlıya uygulandı ve migration geçmişinde. verify-presence-permissions testi eksik grant hatasını yeniden üretir ve başka kullanıcının kaydının korunmasını doğrular. Geçici iki hesapla gerçek JWT testi: kendi check-in silme, başkasını silememe ve local logout geçti. Test verileri temizlendi. Kullanıcının iPhone çıkış tekrarı henüz bekliyor.


11 Kasım iPhone test 4: kullanıcı hesap/rol geçişinin çalıştığını doğruladı. Test 5 yanlış harita konumu bildirdi. HomeScreen FlatList başlığı her renderda yeni component function olarak verildiği için MapView yeniden mount olup sabit Muğla initialRegion değerine dönebiliyordu. Başlık artık React element olarak verilir; harita state değişimlerinde korunur. Yeniden açıldığında son GPS konumu initialRegion olarak kullanılır. Telefon konumu ayrı mavi marker ve GPS doğruluk çemberiyle gösterilir; Konumum düğmesi yükleme/çift basma korumalıdır. Gerçek iPhone konum tekrarı bekliyor.


11 Kasım konum tekrarında kullanıcı Konum alınıyor yazdığını fakat mavi işaretin çıkmadığını bildirdi. Önceki Expo sürecinin DNS ENOTFOUND ile kapandığı doğrulandı; önceki düzeltmenin telefona ulaştığı varsayılamaz. Yeni temiz önbellekli tünel başlatıldı. Home haritası artık region state ile doğrudan kontrol edilir; GPS alınamadığında açıklama harita üstünde görünür. GPS 20sn sınırı permission/services dahil tüm isteği kapsar; permission/services takılma testleri de geçti. iOS export 1272 modül başarılı. Fiziksel iPhone konum kontrolü hâlâ BEKLİYOR.


11 Kasım: kullanıcı gerçek iPhone konum ve check-in testlerini geçtiğini doğruladı. Bowling konumsuz test kaydı için kullanıcı kendi gezgin hesabıyla 1 saatlik mesafesiz check-in/fotoğraf testini açıkça onayladı. Genel/kalıcı istisna uygulanmadı. Migration 20261111110000 scoped_photo_test_access: private RLS table, en fazla 1 saat, yalnızca sunucu tarafından açılır; has_photo_test_access yalnızca mevcut auth.uid ve mekân için boolean döndürür. Normal mekân mesafesi, ziyaretçi rolü, check-in, storage sahipliği ve fotoğraf kalıcılığı korunur. İstemci süre sonunda normal GPS kurallarına döner. Hesap bazlı aktivasyon migration dışındadır, repo kişisel hesap kimliği içermez. SQL sınır/expiry/istemci yetkisiz erişim testleri ve iOS export (1273 modül) geçti. Kullanıcının gerçek fotoğraf/yorum/beğeni testi bekliyor.
