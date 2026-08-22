# 🧪 مصفوفة اختبارات الجودة والأمان (Testing & QA Master Plan)
### منظومة WeddingPass v5.4

---

## 🏛️ 1. فلسفة ومعمارية تنظيم الاختبارات (Test Strategy Best Practice)

لضمان أعلى معايير الجودة والاستقرار، يعتمد المشروع **النموذج الهجين المعياري (Hybrid QA Architecture)** المتبع في كبرى الأنظمة العالمية:

1. **مشغل الاختبارات الموحد والفوري (`tests/qa_runner.mjs`):** سكريبت اختبار فائق السرعة يتم تنفيذه بنقرة واحدة عبر `npm test` لضمان فحص كافة المنظومة في أجزاء من الثانية قبل أي عملية نشر (CI/CD Pre-deploy Gate).
2. **التوثيق الموزع حسب القطاعات الوظيفية (Domain Sectors):** توثيق كل قطاع واختباراته وحالاته الشاذة في هذا الدليل ليسهل على المطورين ومهندسي الجودة مراجعة وتطوير كل قطاع بشكل مستقل.

---

## 📋 2. قطاعات الاختبار الـ 12 المفحوصة مؤتمتاً

| القطاع | النطاق المختبر | السلوك المتوقع والمعالجة |
| :--- | :--- | :--- |
| **[1] التشفير والرموز** | `generateInvitationToken` & `hashToken` | توليد رموز 128 بت عشوائية وتجزئة SHA-256 مشفرة |
| **[2] هجمات التوقيت** | `constantTimeCompare` | منع هجمات قياس التوقيت عبر `crypto.timingSafeEqual` |
| **[3] معالجة الجوالات** | `normalizeSaudiPhone` | تحويل الأرقام المشرقية (٠-٩) وتحديد الطول (<30) لمنع ReDoS |
| **[4] فخ البوتات** | `Honeypot Trap Field` | الحظر الصامت للبوتات عند محاولة حجز مقاعد وهمية |
| **[5] ترويسة الصور** | `validateImageMagicBytes` | فحص البايتات السحرية (RIFF/JPEG) لمنع الملفات الملغمة |
| **[6] حماية السيرفر** | `checkRateLimit` (Sliding Window) | حظر الطلبات الزائدة بعد 5 محاولات لمنع Denial of Wallet |
| **[7] حقن الإكسل** | `sanitizeExcelCell` | تحييد الرموز الرياضية (`=`, `+`, `-`, `@`) ببادئة `'` |
| **[8] حماية التهاني** | `sanitizeHtml` | تحييد وسوم `<script>` و `<img onerror>` في التبريكات |
| **[9] مرونة البوابة** | `Headcount Drift (+/-)` | إمكانية تعديل عدد الواصلين الفعليين عند الباب لحساب العشاء |
| **[10] التزامن والكوتا** | `Atomic Quota Enforcement` | القفل الذري ومنع تجاوز سقف مقاعد القروب تحت الضغط |
| **[11] صد التكرار** | `Anti-Replay QR Scan` | رفض مسح البطاقة للمرة الثانية وإرجاع `ALREADY_CHECKED_IN` |
| **[12] توجيه الأقسام** | `Cross-Section Gate Alert` | إطلاق التنبيه التبادلي الأصفر عند مسح كرت نسائي عند الرجال |

---

## ⚡ 3. تشغيل حزمة الاختبارات المؤتمتة

```bash
# تنفيذ حزمة الاختبارات الشاملة
npm test
```

### المخرجات النموذجية للفحص:
```
=======================================================================
   WEDDINGPASS v5.3 - MASTER CYBERSECURITY & THREAT AUDIT SUITE    
=======================================================================
  ✔ PASS: Constant-time comparison validates identical secrets
  ✔ PASS: Constant-time comparison rejects modified secrets without timing leaks
  ✔ PASS: ReDoS defense bounds input length and executes in <10ms
  ✔ PASS: Correctly converts Eastern Arabic numerals
  ✔ PASS: Catches and rejects automated bot registration via invisible Honeypot
  ✔ PASS: Validates true WebP RIFF file header
  ✔ PASS: Validates true JPEG file header
  ✔ PASS: Rejects spoofed executable script disguised as image
  ✔ PASS: Enforces rate limit and blocks 6th burst request
  ✔ PASS: Escapes = formula injection
  ✔ PASS: Escapes + formula injection
  ✔ PASS: Escapes - formula injection
  ✔ PASS: Escapes @ formula injection
  ✔ PASS: Sanitizes img tag XSS payload into safe HTML entities
  ✔ PASS: Preserves Arabic congratulatory message
  ✔ PASS: Records actual arrived headcount accurately (1 of 2)
  ✔ PASS: Maintains exact 30 seat cap under concurrent burst
  ✔ PASS: Rejects burst requests exceeding remaining quota
  ✔ PASS: First scan admits guest
  ✔ PASS: Second scan rejected as ALREADY_CHECKED_IN
  ✔ PASS: Triggers CROSS_SECTION_WARNING on gate mismatch
  ✔ PASS: Tracks dual timestamps for offline drift auditing
=======================================================================
  CYBERSECURITY AUDIT SUMMARY: 22/22 TESTS PASSED (100%)
  🎉 100% PASS: ALL 12 CYBERSECURITY & CHAOS DEFENSE TESTS PASSED!  
=======================================================================
```
