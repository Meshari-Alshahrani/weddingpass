# 🛡️ تقرير الأمان والتحصين السيبراني الشامل (Master Security & Threat Audit)
### منظومة WeddingPass v5.8 - المعايير الأمنية للأعوام 2024 - 2026

---

## 🔒 1. مصفوفة التهديدات السيبرانية الشاملة (Master Threat Matrix & Defense)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                          مصفوفة الأمان السيبراني المنفذة v5.8                            │
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

---

## 🧪 3. نتائج التحقق والاختبارات الميدانية

1. **حزمة اختبارات الوحدة والجودة (`tests/qa_runner.mjs`):** 40/40 فحصاً ناجحاً بنسبة 100%.
2. **حزمة اختبارات التزامن والسباق (`tests/concurrency_test.mjs`):** 5/5 اختبارات سباق ناجحة تحت ضغط 100 طلب متزامن.
3. **حزمة اختبارات البروتوكول والـ HTTP (`tests/http_concurrency_test.mjs`):** 3/3 اختبارات سلامة بروتوكول ناجحة.
4. **البناء السحابي للإنتاج (`npm run build`):** اجتياز كامل لكافة المسارات الـ 18 بدون أي أخطاء.
