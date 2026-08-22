# 🛡️ تقرير الأمان والتحصين السيبراني الشامل (Master Security & Threat Audit)
### منظومة WeddingPass v5.6 - المعايير الأمنية للأعوام 2024 - 2026

---

## 🔒 1. مصفوفة التهديدات السيبرانية (Master Threat Matrix & Defense)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                          مصفوفة الأمان السيبراني المنفذة v5.6                            │
├───────────────────────────┬──────────────────────────────────┬───────────────────────────┤
│ نوع الهجوم (Threat Vector)│ الخطر الأمني المحتمل             │ آلية التحصين المطبقة      │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 1. تجاوز قفل البوابات     │ إرسال طلب checkin مباشر بأداة    │ • فرض الرفض 401 عند غياب  │
│ (Gate PIN Bypass)         │ Postman لتسجيل دخول وهمي         │   جلسة موثقة (Mandatory)  │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 2. تزوير توكنات الجلسات   │ استغلال مفاتيح افتراضية أو هجوم  │ • تطبيق True HMAC-SHA256  │
│ (HMAC Length Extension)   │ Length-Extension على التجزئة     │ • حظر الأسرار الافتراضية  │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 3. سرقة الجلسات عبر XSS   │ قراءة توكن الجلسة من التخزين     │ • اعتماد HttpOnly Secure  │
│ (Session Token Theft)     │ المحلي (sessionStorage)          │   SameSite=Strict Cookies │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 4. هجمات سباق التزامن     │ إرسال 50 طلباً متزامناً لنفس     │ • القفل الذري بالسيرفر    │
│ (Race Condition Burst)    │ البطاقة أو كوتا القروب المغلق    │   (Postgres Lock & Atom)  │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 5. الوصول غير المصرح للوحة│ استدعاء /api/admin لتعديل        │ • حماية مسار الإدارة بـ   │
│ (Unprotected Admin API)   │ الفعاليات أو إلغاء التذاكر       │   Supabase Auth Session   │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 6. تسريب بيانات الضيوف    │ تسريب الرموز الصريحة في كاش      │ • عزل كاش الأوفلاين في    │
│ (Offline Cache Leakage)   │ الأوفلاين للجميع                 │   مسار محمي /api/gate/cache│
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 7. هجمات استنزاف الخوادم  │ إرسال آلاف الطلبات لاستهلاك      │ • محرك Sliding-Window     │
│ (Denial of Wallet - DoW)  │ فواتير Serverless على Vercel     │   Rate Limiter في السيرفر │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 8. حقن صيغ الإكسل         │ تسجيل الاسم بصيغة `=CMD('calc')` │ • تحييد الصيغ ببادئة      │
│ (CSV Formula Injection)   │ لاختراق حاسوب العريس عند التصدير │   علامة الاقتباس `'`      │
└───────────────────────────┴──────────────────────────────────┴───────────────────────────┘
```

---

## 💻 2. الكود الفعلي للتحصينات المطبقة (Source Implementations)

### 1. التوقيع المشفر بـ True HMAC-SHA256 (`lib/security/gateAuth.ts`)
```typescript
export function createGateSessionToken(payload: GateSessionPayload): string {
  const secret = getSessionSecret();
  const data = JSON.stringify(payload);
  const base64Data = Buffer.from(data, 'utf-8').toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(base64Data).digest('base64url');
  return `${base64Data}.${hmac}`;
}
```

### 2. فرض التحقق الإلزامي من جلسة البوابة (`app/api/checkin/route.ts`)
```typescript
const session = await getVerifiedGateSession(req);
if (!session) {
  return NextResponse.json(
    { success: false, code: 'UNAUTHORIZED', message: 'جلسة البوابة غير مصرحة أو منتهية' },
    { status: 401 }
  );
}
```

### 3. حوكمة التجاوز الاستثنائي للقسم (`app/api/checkin/route.ts`)
```typescript
const isOverrideRequested = Boolean(forceCrossSection);
if (isOverrideRequested && session.role !== 'supervisor') {
  return NextResponse.json(
    { success: false, code: 'SUPERVISOR_REQUIRED', message: 'تجاوز تحذير القسم يتطلب موافقة المشرف' },
    { status: 403 }
  );
}
```

### 4. حماية مسار الإدارة (`app/api/admin/route.ts`)
```typescript
const adminSession = await getVerifiedAdminSession(req);
if (!adminSession) {
  return NextResponse.json(
    { success: false, code: 'UNAUTHORIZED', message: 'تنفيذ هذا الإجراء يتطلب جلسة مشرف موثقة' },
    { status: 401 }
  );
}
```

---

## 🧪 3. نتائج التحقق والاختبارات الميدانية

1. **حزمة اختبارات الوحدة والجودة (`tests/qa_runner.mjs`):** 40/40 فحصاً ناجحاً بنسبة 100%.
2. **حزمة اختبارات التزامن والسباق (`tests/concurrency_test.mjs`):** 5/5 اختبارات سباق ناجحة تحت ضغط 100 طلب متزامن.
3. **البناء السحابي للإنتاج (`next build`):** اجتياز كامل لكافة المسارات الـ 17.
