# 🧪 مصفوفة اختبارات الجودة والأمان (Testing & QA Master Plan)
### منظومة WeddingPass v5.8 - حزمة الاختبارات الشاملة (48/48 نجاح تام)

---

## 🏛️ 1. فلسفة ومعمارية تنظيم الاختبارات (Test Strategy Best Practice)

لضمان أعلى معايير الجودة والاستقرار، يعتمد المشروع **النموذج الثلاثي الشامل (Triple-Engine QA Architecture)** المتبع في كبرى الأنظمة العالمية:

1. **مشغل الاختبارات الموحد (`tests/qa_runner.mjs`):** 40 فحصاً حياً يستورد الدوال مباشرة من طبقة التشفير والأمان والمنطق وقاعدة البيانات.
2. **محرك اختبارات السباق التزامني (`tests/concurrency_test.mjs`):** 5 فحوصات سباق تحاكي 100 طلب متزامن لاختبار القفل السحابي وموثوقية الكوتا.
3. **محرك اختبارات البروتوكول والـ HTTP (`tests/http_concurrency_test.mjs`):** 3 فحوصات بروتوكول تختبر صحة توقيع HMAC، كوكيز `__Host-`، وعزل التحضير.

---

## 📋 2. قطاعات الاختبار المفحوصة مؤتمتاً

| القطاع | النطاق المختبر | السلوك المتوقع والمعالجة |
| :--- | :--- | :--- |
| **[1] التشفير والرموز** | `generateInvitationToken` & `hashToken` | توليد رموز 128 بت عشوائية وتجزئة SHA-256 مشفرة |
| **[2] هجمات التوقيت** | `constantTimeCompare` | منع هجمات قياس التوقيت عبر `crypto.timingSafeEqual` |
| **[3] معالجة الجوالات** | `normalizeSaudiPhone` | تحويل الأرقام المشرقية (٠-٩) وتحديد الطول (<30) لمنع ReDoS |
| **[4] جلسات HMAC** | `createGateSessionToken` & `verifyGateSessionToken` | التحقق من صحة التوقيع المشفر ورفض التوكنات المعدلة والمنتهية |
| **[5] توثيق المشرف** | `verifyAdminSessionToken` | التحقق من صلاحيات المشرف وعزلها عن مفاتيح Supabase |
| **[6] رحلة الـ RSVP** | `submitPartyRSVP` | تأكيد الحضور وإصدار بطاقة الدخول الذكية وتحديث الحالة |
| **[7] كوتا المجموعات** | `registerGroupGuest` | حجز المقاعد ذرياً ورفض التجاوز مع دعم استعادة الحجز بالرقم |
| **[8] التحضير بالبوابات** | `executeCheckIn` | قبول البطاقة الصالحة وتفعيل تنبيهات VIP وكرسي متحرك |
| **[9] صد التكرار** | `Anti-Replay QR Scan` | رفض مسح البطاقة للمرة الثانية وإرجاع `ALREADY_CHECKED_IN` |
| **[10] توجيه الأقسام** | `Cross-Section Gate Alert` | إطلاق التنبيه التبادلي الأصفر عند مسح كرت نسائي عند الرجال |
| **[11] حجر الصور والتهاني** | `addMoment` & `addWish` | عزل الصور المرفوعة بحالة `is_approved=false` حتى اعتماد المشرف |
| **[12] حقن الإكسل والـ XSS** | `sanitizeExcelCell` & `sanitizeHtml` | تحييد الرموز الرياضية (`=`, `+`, `-`, `@`) ووسوم السكربتات |
| **[13] ترويسة الصور** | `validateImageMagicBytes` | فحص البايتات السحرية (RIFF/JPEG/PNG) لمنع الملفات الملغمة |
| **[14] هجمات السباق العالي** | `50 Concurrent Scans` | قبول طلب واحد فقط ورفض 49 طلباً متزامناً كـ `ALREADY_CHECKED_IN` |
| **[15] سباق كوتا المجموعات** | `50 Concurrent Registrations` | حجز 5 مقاعد بدقة ورفض 45 طلباً بـ `QUOTA_EXCEEDED` |

---

## ⚡ 3. تشغيل حزمة الاختبارات المؤتمتة

```bash
# تنفيذ حزمة الاختبارات الشاملة (QA + Concurrency + HTTP)
npm test
```

### المخرجات الحية النموذجية للفحص (48/48):
```
=======================================================================
   WEDDINGPASS v5.6 - LIVE SOURCE CODE REGRESSION & SECURITY SUITE    
   (Importing Directly from lib/crypto, lib/security, lib/db, lib/utils)
=======================================================================
  ✔ PASS: generateInvitationToken produces secure opaque token
  ✔ PASS: generateEntryPassToken produces secure opaque pass
  ✔ PASS: hashToken produces deterministic SHA-256 hex string
  ✔ PASS: constantTimeCompare validates identical hashes
  ✔ PASS: constantTimeCompare rejects modified hash safely without timing leaks
  ✔ PASS: Normalizes standard local 05XXXXXXXX
  ✔ PASS: Normalizes international +966 format with spaces
  ✔ PASS: Converts Eastern Arabic numerals (٠-٩) to Latin
  ✔ PASS: ReDoS defense bounds input length and returns in <10ms
  ✔ PASS: Rejects oversized invalid phone without hanging CPU
  ✔ PASS: checkRateLimit blocks burst requests exceeding threshold
  ✔ PASS: createGateSessionToken outputs signed base64url HMAC token
  ✔ PASS: verifyGateSessionToken successfully validates authentic HMAC signature
  ✔ PASS: verifyGateSessionToken rejects tampered signature safely
  ✔ PASS: verifyGateSessionToken rejects expired session
  ✔ PASS: verifyAdminSessionToken validates authentic admin credentials
  ✔ PASS: getPartyByInvitationToken resolves party by raw invitation token
  ✔ PASS: Resolves correct party metadata
  ✔ PASS: Returns linked entry pass upon lookup
  ✔ PASS: submitPartyRSVP successfully confirms attendance
  ✔ PASS: Generates active entry pass upon confirmation
  ✔ PASS: Registers new guest in group link
  ✔ PASS: Attaches QR pass token to newly registered group guest
  ✔ PASS: Detects duplicate phone and recovers pass without overconsuming seats
  ✔ PASS: Enforces strict group quota limit and refuses overbooking
  ✔ PASS: First scan admits valid pass successfully
  ✔ PASS: Flags VIP status for royal welcome alert
  ✔ PASS: Identifies special assistance wheelchair flag
  ✔ PASS: Rejects duplicate scan with ALREADY_CHECKED_IN
  ✔ PASS: Triggers CROSS_SECTION_WARNING when women pass scanned at men gate
  ✔ PASS: addWish creates wish in guestbook
  ✔ PASS: Quarantines newly uploaded photo with is_approved=false
  ✔ PASS: Moment appears in public album after admin approval
  ✔ PASS: Escapes = formula injection in Excel cells
  ✔ PASS: Escapes + formula injection in Excel cells
  ✔ PASS: Preserves benign Arabic text
  ✔ PASS: Neutralizes HTML script tags into safe entities
  ✔ PASS: Identifies valid WebP image header
  ✔ PASS: Identifies valid JPEG image header
  ✔ PASS: Rejects script file disguised as image
=======================================================================
  LIVE SOURCE CODE QA SUMMARY: 40/40 TESTS PASSED (100%)
=======================================================================

=======================================================================
   WEDDINGPASS v5.6 - HIGH-CONCURRENCY ATOMIC RACE CONDITION SUITE     
=======================================================================
  ✔ PASS: Exactly 1 request succeeded and admitted the guest
  ✔ PASS: Exactly 49 requests were rejected as ALREADY_CHECKED_IN
  ✔ PASS: Zero unhandled errors or race anomalies occurred
  ✔ PASS: Exactly 5 seats were allocated under intense concurrent burst
  ✔ PASS: Exactly 45 burst requests were rejected with QUOTA_EXCEEDED
=======================================================================
  CONCURRENCY CHAOS SUMMARY: 5/5 TESTS PASSED (100%)
=======================================================================

=======================================================================
   WEDDINGPASS v5.7 - PROTOCOL & HTTP CONCURRENCY VERIFICATION         
=======================================================================
  ✔ PASS: HMAC Gate Session Token generated with strict structure
  ✔ PASS: Only 1 request was accepted (1 SUCCESS)
  ✔ PASS: 49 requests were rejected (49 ALREADY_CHECKED_IN)
=======================================================================
  HTTP/PROTOCOL SUITE SUMMARY: 3/3 TESTS PASSED (100%)
=======================================================================
```

---

## 🌐 4. مشغل الفحص السحابي الحي للإنتاج (Cloud Live E2E Suite)

للتأكد من صحة الربط السحابي الحقيقي بين خوادم Vercel وقاعدة بيانات Supabase، تم بناء مشغل فحص سحابي مباشر (`scratch/cloud_live_tester.mjs`) يقوم باختبار السيناريوهات الستة عبر الإنترنت:

1. **فحص الصحة والكمون (Cloud Health & Latency):** التحقق من استجابة خوادم Edge وسرعة المعالجة.
2. **مصادقة البوابات المشفرة (Gate PIN Auth):** اختبار إصدار توكن الجلسة HMAC.
3. **التسجيل الذاتي للمجموعات (Group Registration):** اختبار إضافة ضيف وتوليد بطاقة الدخول فورياً.
4. **التحضير السحابي وصد التكرار (Cloud Gate Check-in):** اختبار مسح الـ QR ومنع الدخول المكرر.
5. **دفتر التهاني والتبريكات (Guestbook Submission):** اختبار إرسال واسترجاع التهاني السحابية.
6. **سلامة المسارات العامة (HTTP 200 Route Scanner):** مسح كافة صفحات الموقع (`/`, `/admin`, `/checkin`, `/admin/live`, `/join/family`, `/moments`) للتأكد من خلوها من أي كراش أو خطأ 500.
