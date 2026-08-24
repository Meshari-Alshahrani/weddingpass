# 🛡️ تقرير الأمان والتحصين السيبراني الشامل (Master Security & Threat Audit)
### منظومة WeddingPass v5.9.4 - المعايير الأمنية للأعوام 2024 - 2026

---

## 🔒 1. مصفوفة التهديدات السيبرانية الشاملة (Master Threat Matrix & Defense)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                         مصفوفة الأمان السيبراني المنفذة v5.9.4                            │
├───────────────────────────┬──────────────────────────────────┬───────────────────────────┤
│ نوع الهجوم (Threat Vector)│ الخطر الأمني المحتمل             │ آلية التحصين المطبقة      │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 1. استعلام Data API العام │ قراءة بيانات الضيوف وأرقامهم     │ • إلغاء Public SELECT في  │
│ (RLS Data Leakage)        │ بـ anon key عبر USING (true)     │   RLS وحصرها بـ service_role│
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 2. كشف مفاتيح الفعالية    │ استخراج gate_pin و iban من جدول  │ • إنشاء public_events_view│
│ (Sensitive Event Fields)  │ events العام                     │   الآمن الخالي من الأسرار │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 3. استدعاء RPC المباشر    │ استدعاء التحضير وتجاوز البوابات  │ • سحب الصلاحية وحصر الدالة│
│ (Direct RPC Invocation)   │ مباشرة من authenticated          │   على service_role فقط    │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 4. هجمات المسار المشترك   │ استغلال تلوث مسار search_path    │ • تثبيت search_path = ''  │
│ (search_path Hijacking)   │ في دوال SECURITY DEFINER         │   مع أسماء الجداول الكاملة│
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 5. تزوير توكنات الجلسات   │ استغلال مفاتيح افتراضية أو هجوم  │ • تطبيق True HMAC-SHA256  │
│ (HMAC Length Extension)   │ Length-Extension على التجزئة     │ • حظر الأسرار الافتراضية  │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 6. سرقة الجلسات عبر XSS   │ قراءة توكن الجلسة من التخزين     │ • كوكيز __Host-gate_session│
│ (Session Token Theft)     │ المحلي (sessionStorage)          │   HttpOnly; Secure; Strict│
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 7. هجمات سباق التزامن     │ إرسال 50 طلباً متزامناً لنفس     │ • معاملات SQL الذرية مع   │
│ (Race Condition Burst)    │ البطاقة أو كوتا القروب المغلق    │   قفل السجلات FOR UPDATE  │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 8. الوصول غير المصرح للوحة│ استدعاء /api/admin لتعديل        │ • حماية مسار الإدارة بـ   │
│ (Unprotected Admin API)   │ الفعاليات أو إلغاء التذاكر       │   Supabase Auth Session   │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 9. تسريب إحصائيات الفعالية│ تسريب عدد الحضور في فحص الصحة    │ • عزل /api/health وقصر    │
│ (Metrics Info Leakage)    │ العام                            │   التفاصيل لـ system-health│
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 10. هجمات استنزاف الخوادم │ إرسال آلاف الطلبات لاستهلاك      │ • محرك Sliding-Window     │
│ (Denial of Wallet - DoW)  │ فواتير Serverless على Vercel     │   Rate Limiter في السيرفر │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 11. حقن صيغ الإكسل        │ تسجيل الاسم بصيغة `=CMD('calc')` │ • تحييد الصيغ ببادئة      │
│ (CSV Formula Injection)   │ لاختراق حاسوب العريس عند التصدير │   علامة الاقتباس `'`      │
└───────────────────────────┴──────────────────────────────────┴───────────────────────────┘
```

---

## 💻 2. الكود الفعلي للتحصينات المطبقة (Source Implementations)

### 1. إغلاق RLS وحصر الوصول لـ Service Role (`supabase/migrations/002_rls_and_security.sql`)
```sql
CREATE POLICY "Service role full access parties" ON public.parties
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
```

### 2. قفل دالة التحضير الذرية وتثبيت المسار الفارغ (`supabase/migrations/003_atomic_checkin_rpc.sql`)
```sql
CREATE OR REPLACE FUNCTION public.process_secure_checkin(...)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$ ... $$;

REVOKE EXECUTE ON FUNCTION public.process_secure_checkin(...) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_secure_checkin(...) TO service_role;
```

### 3. التوقيع المشفر بـ True HMAC-SHA256 (`lib/security/gateAuth.ts`)
```typescript
export function createGateSessionToken(payload: GateSessionPayload): string {
  const secret = getSessionSecret();
  const data = JSON.stringify(payload);
  const base64Data = Buffer.from(data, 'utf-8').toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(base64Data).digest('base64url');
  return `${base64Data}.${hmac}`;
}
```

### 4. فرض التحقق الإلزامي من جلسة البوابة (`app/api/checkin/route.ts`)
```typescript
const session = await getVerifiedGateSession(req);
if (!session) {
  return NextResponse.json(
    { success: false, code: 'UNAUTHORIZED', message: 'جلسة البوابة غير مصرحة أو منتهية' },
    { status: 401 }
  );
}
```

### 5. حوكمة التجاوز الاستثنائي للقسم بالسيرفر (`app/api/checkin/route.ts`)
```typescript
const isOverrideRequested = Boolean(forceCrossSection);
if (isOverrideRequested && session.role !== 'supervisor') {
  return NextResponse.json(
    { success: false, code: 'SUPERVISOR_REQUIRED', message: 'تجاوز تحذير القسم يتطلب موافقة المشرف' },
    { status: 403 }
  );
}
```

### 6. حماية لوحة التحكم الإدارية بجلسة موقعة على الخادم (`app/api/admin/auth/route.ts`) — v6.0.0
```typescript
// Real authorization: DAL guard runs BEFORE any data access, and every
// /api/admin handler re-verifies session + event binding independently.
const session = await requireAdminSession(); // redirects to /admin/login if absent
if (adminSession.eventId && adminSession.eventId !== event.id) {
  return NextResponse.json({ success: false, code: 'FORBIDDEN_EVENT' }, { status: 403 });
}
```
> ملاحظة تاريخية: قبل v6.0.0 كان «قفل PIN» في AdminDashboard قفل عميل فقط (sessionStorage) وكانت بيانات الضيوف تصل RSC payload لأي زائر، مع باكدور `'2026'`. أُلغي ذلك كلياً (ADR-029/032).

---

## 🧪 3. نتائج التحقق والاختبارات الميدانية

1. **حزمة اختبارات الوحدة والجودة (`tests/qa_runner.mjs`):** 40/40 فحصاً ناجحاً بنسبة 100%.
2. **حزمة اختبارات التزامن والسباق (`tests/concurrency_test.mjs`):** 5/5 اختبارات سباق ناجحة تحت ضغط 100 طلب متزامن.
3. **حزمة اختبارات البروتوكول والـ HTTP (`tests/http_concurrency_test.mjs`):** 3/3 اختبارات سلامة بروتوكول ناجحة.
4. **حزمة اختبارات عقود المسارات والسياسات (`tests/api_routes_integration_test.mjs`):** 12/12 اختبار تكامل، أمان كوكيز، وحراس عدم الانجراف (Drift Guards).
5. **فحص Supabase الحقيقي (`npm run test:supabase`):** فحص اختياري غير معدّل للبيانات للاتصال وRPC بعد ضبط أسرار المشروع.
6. **البناء السحابي للإنتاج (`npm run build`):** اجتياز كامل دون أخطاء أو تحذيرات.
7. **الاختبارات المؤتمتة:** تُشغّل عبر `npm test`، مع فصل اختبارات Supabase الحقيقية عن الاختبارات المحلية.

### 3.1 حدود البيانات العامة وReact Server Components (v5.9.5)

كل صفحة أو API عام يحوّل سجلات قاعدة البيانات إلى DTO بقائمة سماح صريحة قبل إرسالها إلى المتصفح. يحظر ذلك تسريب `gate_pin` و`owner_id` وأرقام الجوال وهاشات روابط الدعوة وبطاقات الدخول، حتى لو تغيّر الاستعلام الداخلي إلى `select('*')`. تغطي الحماية الدعوة الفردية، روابط المجموعات، معرض اللحظات، وواجهات RSVP/التسجيل والاسترجاع. رقم IBAN واسم البنك مستثنيان عمدًا لأنهما معروضان كبيانات تحويل هدية في واجهة الدعوة؛ إن لم يكونا مقصودين للنشر يجب حذف هذه الميزة من واجهة الدعوة، لا إضافتهما إلى قائمة الأسرار فقط.

---

## 🔐 4. إضافات الأمان والتحصين المؤسساتي (v6.0.0 Security & Integrity)

* **مصادقة الإدارة على الخادم (ADR-029/032):** ‏DAL قبل أي استعلام + تحقق مستقل في كل handler + مطابقة eventId من الجلسة؛ ‏`ADMIN_PIN` مستقل إلزامي مع guard ضد تطابق الأسرار الثلاثة، وإسقاط الباكدور `'2026'` والاعتماد العميلي كلياً.
* **الأوفلاين Provisional (ADR-030):** مطابقة هاش محلية صحيحة، ‏LOCAL_ADMISSION موسوم، طابور بـqueueId idempotency يعيد النتيجة الأصلية من `check_in_logs.metadata` (فهرس فريد حاجز سباق)، وحذف فقط عند حكم نهائي.
* **سلامة التسجيل (migration 007 / ADR-031):** رفض التكرار دون تدوير (منع DoS بإبطال QR ضيف)، ‏UNIQUE جزئي + CHECKs بنمط ABORT-أولاً بتقرير تشخيصي، ‏clamp مقاعد داخل الـRPC، وتهريب LIKE داخل `search_parties` المعاملاتية بدل `.or()` النصي.
* **حدود الاعتماد (ADR-034):** ‏`GuestEntryPassCredential` بقناتين موثقتين فقط؛ حظر QR fallback قابل للتخمين؛ DTO للّحظات العامة بلا هواتف.
* **Hardened CSP (ADR-033):** nonce+strict-dynamic عبر proxy مع CSP_MODE ثلاثي، وخطوط next/font مستضافة ذاتياً (لا أصول خارجية يوم الحفل).
* **تشفير بلا تدهور صامت:** رمي أخطاء عند غياب Web Crypto بدل fallbacks ضعيفة؛ تسمية صادقة للمقارنة ثابتة العمل بالمتصفح.

---

## 🛡️ 4bis. التحصينات الميدانية السابقة (v5.9.4 Production Security)

* **ملف تهجير محصن (Resilient Migration 006):** استخدام `to_regclass()` لحذف سياسات الإدخال العام المعروفة بأمان عندما تكون جداولها موجودة. قواعد البيانات التي أُنشئت بمخطط قديم مختلف تتطلب ترحيل بيانات مُراجعًا.
* **إلغاء الملفات المتضاربة واعتماد Migrations حصرياً:** إيقاف `FULL_SETUP.sql` واعتماد `supabase/migrations/` (001 إلى 006) مصدراً وحيداً للمخطط.
* **الـ Rate Limiter الموزع (Edge Multi-Instance Rate Limiting):** ربط كافة المسارات بـ `checkDistributedRateLimit` مع دعم Upstash Redis / Vercel KV REST وتقييد الذاكرة المحلية (Max 10k Keys).
* **سد ثغرة تسريب كاش البطاقات (Zero Cache Leak):** حذف معامل `offlineCache` من `/api/join` وقصر الوصول على `/api/gate/cache` المصرح بجلسة بوابة.
* **الحماية الصارمة بكوكيز HttpOnly (No JS Exfiltration):** حظر إعادة توكن الجلسة في JSON وحذف حفظه في `sessionStorage` بماسح البوابة.
* **إغلاق الإدخال العام في Supabase RLS (Server-Mediated Only):** حذف `WITH CHECK (true)` العام من `wishes` و `moments` وإلزام المرور عبر خوادم Next.js لتطبيق الـ Rate Limit والحجر الصحي.
* **الفحص الإلزامي الشامل للصور (URLs & Binary Magic Bytes):** فحص ترويسات البايتات الثنائية للـ Base64 وحظر الروابط غير الآمنة والسكربتات في `/api/public/moment`.
* **شاشة القفل الإداري (Admin PIN Gatekeeper):** حجب واجهة `/admin` بطلب رمز PIN المشفر قبل عرض أي تفاصيل للضيوف أو الإعدادات.
* **التهيئة المحددة للإنتاج:** لا يتم زرع بيانات افتراضية داخل طلبات الإنتاج؛ التهيئة تتم عبر migrations أو seed مستقل، وأي غياب للفعالية يفشل بوضوح.
