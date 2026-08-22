# 🛡️ تقرير الأمان والتحصين السيبراني الشامل (Master Security & Threat Audit)
### منظومة WeddingPass v5.4 - المعايير الأمنية للأعوام 2024 - 2026

---

## 🔒 1. مصفوفة التهديدات السيبرانية (Threat Matrix & OWASP Top 10)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                             مصفوفة الأمان السيبراني المنفذة                              │
├───────────────────────────┬──────────────────────────────────┬───────────────────────────┤
│ نوع الهجوم (Threat Vector)│ الخطر الأمني المحتمل             │ آلية التحصين المطبقة      │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 1. استنزاف موارد السيرفر  │ إرسال آلاف الطلبات لاستهلاك      │ • محرك Sliding-Window     │
│ (Denial of Wallet - DoW)  │ فواتير Serverless على Vercel     │   Rate Limiter في السيرفر │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 2. هجمات التوقيت الجانبية │ قياس الفارق الزمني بالميلي ثانية │ • تطبيق Constant-Time     │
│ (Side-Channel Timing)     │ لتخمين الرموز والـ Hashes        │   crypto.timingSafeEqual  │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 3. هجمات إغراق المعالجات  │ إرسال نصوص ضخمة لتعطيل معالج     │ • تقييد أطوال المدخلات    │
│ (ReDoS Attacks)           │ Node.js وحجب الخدمة              │   (Bounded Strings <30)   │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 4. حجز المقاعد بالبوتات   │ سكريبتات تملأ كوتا القروب في     │ • فخ البوتات غير المرئي   │
│ (Bot Seat Scalping)       │ ثانية واحدة بأسماء وهمية         │   Honeypot Trap Field     │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 5. تزييف ترويسات الصور    │ رفع ملف ملغم بامتداد .jpg        │ • فحص البايتات السحرية    │
│ (MIME / Polyglot Spoofing)│ لتجاوز فحص الامتدادات الخارجية   │   Magic Bytes (RIFF/JPEG) │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 6. حقن صيغ الإكسل         │ تسجيل الاسم بصيغة `=CMD('calc')` │ • تحييد الصيغ ببادئة      │
│ (CSV Formula Injection)   │ لاختراق حاسوب العريس عند التصدير │   علامة الاقتباس `'`      │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 7. تسمم الكاش السحابي     │ تسريب بطاقات الضيوف عبر الكاش    │ • فرض `force-dynamic`     │
│ (Edge Cache Poisoning)    │ المشترك لصفحات `/i/[token]`      │ • ترويسة `no-store` صريحة │
├───────────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ 8. اختطاف مسار البحث في DB│ اختطاف دوال الـ RPC في Postgres  │ • تثبيت `SET search_path  │
│ (Postgres search_path)    │ (CVE-2018-1058 Hijacking)        │   = public, pg_temp;`     │
└───────────────────────────┴──────────────────────────────────┴───────────────────────────┘
```

---

## 💻 2. التفصيل البرمجي للتحصينات المطبقة

### 1. محرك تحديد معدل الطلبات (`lib/security/rateLimiter.ts`)
يقوم على خوارزمية **Sliding-Window In-Memory**:
* مسار البوابات `/api/checkin`: سقف 120 طلباً/دقيقة لكل IP.
* مسار تسجيل القروبات `/api/join`: سقف 20 طلباً/دقيقة لكل IP.
* مسار تأكيد الحضور `/api/rsvp`: سقف 30 طلباً/دقيقة لكل IP.
* مسار استرجاع البطاقة بالجوال: سقف 15 طلباً/دقيقة لكل IP.

### 2. المقارنة الثابتة زمنياً (`lib/crypto/tokens.ts`)
```typescript
export function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  const cryptoModule = require('crypto');
  return cryptoModule.timingSafeEqual(bufA, bufB);
}
```

### 3. تحصين تصدير الإكسل ضد حقن الصيغ (`components/AdminDashboard.tsx`)
```typescript
const sanitizeExcelCell = (val: any) => {
  if (typeof val === 'string' && /^[=+@-]/i.test(val.trim())) {
    return `'${val}`;
  }
  return val;
};
```

### 4. حقل الفخ لمكافحة البوتات (`components/GroupInviteView.tsx`)
```tsx
<div className="hidden opacity-0 pointer-events-none absolute -left-[9999px]" aria-hidden="true">
  <input
    type="text"
    name="user_website_trap"
    tabIndex={-1}
    autoComplete="off"
    value={honeypot}
    onChange={(e) => setHoneypot(e.target.value)}
  />
</div>
```

---

## 🌐 3. إعدادات ترويسات الأمان السحابية (`next.config.ts`)

```typescript
{
  key: 'X-Frame-Options',
  value: 'DENY', // منع التضمين في iframe للحماية من Clickjacking
},
{
  key: 'X-Content-Type-Options',
  value: 'nosniff', // منع تخمين نوع المحتوى
},
{
  key: 'Permissions-Policy',
  value: 'camera=(self), microphone=(), geolocation=()', // حصر الكاميرا للبوابات فقط
},
{
  key: 'Strict-Transport-Security',
  value: 'max-age=63072000; includeSubDomains; preload', // فرض تشفير HTTPS
}
```
