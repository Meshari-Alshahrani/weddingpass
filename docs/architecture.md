# 🏛️ المعمارية التقنية وهندسة النظم (System Architecture)
### منظومة WeddingPass v5.9.4 (Production Architecture)

---

## 🗺️ 1. المخطط المعماري العام (C4 Architecture Diagram)

```mermaid
graph TD
    subgraph Clients[طبقة المتصفحات والأجهزة]
        G1[📱 هاتف الضيف: الدعوة وبطاقة الدخول الملكية]
        G2[📲 هاتف موظف البوابة: ماسح QR + كوكيز __Host- HttpOnly]
        G3[💻 حاسوب العريس والمنظم: لوحة التحكم المتقدمة /admin]
        G4[📺 شاشة القاعة الكبرى: البث المباشر للتهاني /admin/live]
    end

    subgraph Edge[طبقة الحافة و Vercel Edge CDN]
        E1[🛡️ Next.js 16 Security Headers & WAF]
        E2[⚡ Distributed Sliding-Window Rate Limiter REST]
        E3[🛑 Zero-Cache Dynamic Enforcer & No-Store]
    end

    subgraph AppRouter[طبقة تطبيق Next.js App Router]
        R1[/i/token: معالج الدعوات الفردية]
        R2[/join/slug: معالج قروبات الواتساب والتسجيل]
        R3[/checkin: محطة البوابات الذكية]
        R4[/admin: لوحة التحكم المحمية برمز PIN]
        R5[/api/gate/auth: توثيق جلسات HMAC والكوكي الآمن]
        R6[/api/checkin: التحضير الإلزامي الذري المحصن]
        R7[/api/gate/cache: كاش البوابات المشفر والمحمي]
        R8[/api/public/moment: رفع الصور مع فحص Magic Bytes]
        R9[/api/public/wish: إرسال التهاني وتطهير XSS]
    end

    subgraph Repositories[طبقة المستودعات - Repository Pattern]
        P1[lib/repositories/types.ts: الواجهات الموحدة]
        P2[SupabaseRepository: الإنتاج و Fail-Closed الصارم]
        P3[MockRepository: الاختبارات السريعة المعزولة]
    end

    subgraph Database[طبقة البيانات والتخزين - Supabase PostgreSQL]
        D1[(Events, Parties, Moments, Wishes Tables - Zero-Trust RLS)]
        D2[(Atomic RPC Functions SET search_path = '')]
        D3[🪣 Moments Storage Bucket + RLS + Quarantine]
    end

    Clients --> Edge
    Edge --> AppRouter
    AppRouter --> Repositories
    Repositories --> Database
```

---

## 🗂️ 2. خريطة المسارات الـ 18 في Next.js App Router

| المسار (Route) | النوع | الوظيفة ومستوى الأمان |
| :--- | :--- | :--- |
| **`/`** | Static | الصفحة الرئيسية وبوابة الدخول السريع الفاخرة |
| **`/i/[token]`** | Dynamic SSR | بطاقة الدعوة الفاخرة للضيف الفردي مع توليد QR آمن |
| **`/join/[slug]`** | Dynamic SSR | صفحة التسجيل الذاتي لقروبات الواتساب مع فحص الكوتا الذري |
| **`/checkin`** | Dynamic SSR | ماسح البوابات المحمي بـ PIN، الفلاش، وقفل الشاشة |
| **`/admin`** | Dynamic SSR | لوحة تحكم المنظم والداعين المحمية بشاشة قفل PIN |
| **`/admin/live`** | Dynamic SSR | شاشة العرض الحية لتبريكات القاعة بملء الشاشة |
| **`/admin/manifest`** | Dynamic SSR | كشف الطوارئ A4 الطباعي المحصن |
| **`/admin/stress-test`** | Static | شاشة محاكاة اختبارات الضغط الميداني |
| **`/moments`** | Dynamic SSR | ألبوم ومكتبة لقطات الحفل المعتمدة فقط (`is_approved=true`) |
| **`/api/checkin`** | API Handler | مسار التحقق من الباركود وتوجيه الطاولات وتنبيهات VIP |
| **`/api/gate/auth`** | API Handler | مسار توثيق جلسات البوابة بـ HMAC وضبط كوكي `HttpOnly` |
| **`/api/gate/cache`** | API Handler | مسار كاش الأوفلاين المشفر المحمي بجلسة البوابة حصرياً |
| **`/api/health`** | API Handler | مسار فحص البنية التحتية العام الخالي من تسريب البيانات |
| **`/api/admin/system-health`**| API Handler | مسار فحص صحة النظام الإداري المحمي بالمصادقة |
| **`/api/public/wish`** | API Handler | مسار إرسال تهاني الضيوف مع تطهير XSS و Rate Limit |
| **`/api/public/moment`** | API Handler | مسار رفع صور الضيوف مع فحص Magic Bytes والحجر الصحي |
| **`/api/join`** | API Handler | مسار تسجيل أعضاء المجموعات وحجز المقاعد الذري |
| **`/api/rsvp`** | API Handler | مسار تأكيد واعتذار الضيوف وتوليد البطاقات الفورية |
| **`/api/admin`** | API Handler | مسار إدارة الفعالية واعتماد وحذف الصور والتهاني |
| **`/api/calendar`** | API Handler | مولد ملفات التقويم RFC 5545 لأجهزة Apple و Google |
| **`/_not-found`** | Static | صفحة الخطأ الأنيقة المخصصة |

---

## 🔒 3. المبادئ الهندسية والأمان المؤسساتي (Core Principles)

1. **مبدأ انعدام الثقة (Zero-Trust Model):**
   - حظر أي استعلام أو إدخال مباشر عبر مفتاح Anon في جداول الضيوف والبطاقات والتهاني والصور.
   - كافة العمليات تمر عبر خوادم Next.js باستخدام `service_role` المحمي.

2. **الاعتماد الحصري على الكوكيز المحمية (`HttpOnly; Secure; SameSite=Strict`):**
   - جلسات البوابات والمشرفين مشفرة بـ HMAC-SHA256 ومخزنة في كوكي `__Host-gate_session` الذي لا يمكن لأي كود JavaScript قراءته أو تسريبه.

3. **التحكم بالتزامن ومنع هجمات السباق (Atomic Race Condition Defense):**
   - حجز مقاعد المجموعات وتسجيل الحضور بالبوابات يتم عبر دوال PostgreSQL RPC ذرية تمنع تجاوز الكوتا وتمنع تكرار مسح الكرت تحت أقصى ضغط متزامن.

4. **نظام الترحيل وقاعدة البيانات المعتمد:**
   - ملفات `supabase/migrations/` من `001` إلى `006` هي الدليل التشغيلي الوحيد لنشر وتحديث قاعدة البيانات.
