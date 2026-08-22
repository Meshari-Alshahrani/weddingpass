# 🏛️ المعمارية التقنية وهندسة النظم (System Architecture)
### منظومة WeddingPass v5.8 (Enterprise Architecture)

---

## 🗺️ 1. المخطط المعماري العام (C4 Architecture Diagram)

```mermaid
graph TD
    subgraph Clients[طبقة المتصفحات والأجهزة]
        G1[📱 هاتف الضيف: الدعوة وبطاقة الدخول]
        G2[📲 هاتف موظف البوابة: ماسح QR + كوكيز __Host-]
        G3[💻 حاسوب العريس: لوحة التحكم المتقدمة]
        G4[📺 شاشة القاعة الكبرى: البث المباشر للتهاني]
    end

    subgraph Edge[طبقة الحافة و Vercel Edge CDN]
        E1[🛡️ Next.js 16 Security Headers & WAF]
        E2[⚡ In-Memory Sliding-Window Rate Limiter]
        E3[🛑 Zero-Cache Dynamic Enforcer]
    end

    subgraph AppRouter[طبقة تطبيق Next.js App Router - 18 مساراً]
        R1[/i/token: معالج الدعوات الفردية]
        R2[/join/slug: معالج قروبات الواتساب]
        R3[/checkin: محطة البوابات الذكية]
        R4[/admin: لوحة التحكم والداعين المتعددين]
        R5[/api/gate/auth: توثيق جلسات HMAC]
        R6[/api/checkin: التحضير الإلزامي المحصن]
        R7[/api/admin/system-health: فحص النظام المحمي]
    end

    subgraph Repositories[طبقة المستودعات - Repository Pattern]
        P1[lib/repositories/types.ts]
        P2[SupabaseRepository: الإنتاج و Fail-Closed الصارم]
        P3[MockRepository: الاختبارات السريعة المعزولة]
    end

    subgraph Database[طبقة البيانات والتخزين - Supabase PostgreSQL]
        D1[(Events & Parties Tables - Zero-Trust RLS)]
        D2[(Atomic RPC Functions SET search_path = '')]
        D3[🪣 Moments Storage Bucket + RLS]
    end

    Clients --> Edge
    Edge --> AppRouter
    AppRouter --> Repositories
    Repositories --> Database
```

---

## 🗂️ 2. خريطة المسارات الـ 18 في Next.js App Router

| المسار (Route) | النوع | الوظيفة |
| :--- | :--- | :--- |
| **`/`** | Static | الصفحة الرئيسية وبوابة الدخول السريع |
| **`/i/[token]`** | Dynamic SSR | بطاقة الدعوة الفاخرة للضيف الفردي |
| **`/join/[slug]`** | Dynamic SSR | صفحة التسجيل الذاتي لقروبات الواتساب مع فحص الكوتا |
| **`/checkin`** | Dynamic SSR | ماسح البوابات المحمي بـ PIN، الفلاش، وقفل الشاشة |
| **`/admin`** | Dynamic SSR | لوحة تحكم المنظم والداعين المتعددين |
| **`/admin/live`** | Dynamic SSR | شاشة العرض الحية لتبريكات القاعة |
| **`/admin/manifest`** | Dynamic SSR | كشف الطوارئ A4 الطباعي |
| **`/admin/stress-test`** | Static | شاشة محاكاة اختبارات الضغط الميداني |
| **`/moments`** | Dynamic SSR | ألبوم ومكتبة لقطات الحفل الحية |
| **`/api/checkin`** | API Handler | مسار التحقق من الباركود وتوجيه الطاولات وتنبيهات VIP |
| **`/api/gate/auth`** | API Handler | مسار توثيق جلسات البوابة بـ HMAC-SHA256 المشفر |
| **`/api/gate/cache`** | API Handler | مسار كاش الأوفلاين المشفر المحمي بجلسة البوابة |
| **`/api/health`** | API Handler | مسار فحص البنية التحتية العام |
| **`/api/admin/system-health`**| API Handler | مسار فحص صحة النظام الإداري المحمي |
| **`/api/public/wish`** | API Handler | مسار إرسال تهاني الضيوف العام المحصن |
| **`/api/public/moment`** | API Handler | مسار رفع صور الضيوف العام المحصن |
| **`/api/join`** | API Handler | مسار تسجيل أعضاء المجموعات وحجز المقاعد الذري |
| **`/api/rsvp`** | API Handler | مسار تأكيد واعتذار الضيوف وتوليد البطاقات |
| **`/api/admin`** | API Handler | مسار إدارة الفعالية واعتماد الصور والتهاني |
| **`/api/calendar`** | API Handler | مولد ملفات التقويم RFC 5545 لأجهزة Apple و Google |
| **`/_not-found`** | Static | صفحة الخطأ الأنيقة المخصصة |

---

## 🔑 3. مبدأ فصل الرموز (Token Decoupling Principle)

لضمان أعلى معايير الأمان، يعتمد النظام على فصل كامل بين نوعين من الرموز:

```
[ رابط الواتساب ] ──> wp_inv_... ──(تأكيد الحضور)──> wp_pass_... ──> [ باركود البوابة QR ]
                            │                               │
                            ▼                               ▼
                   SHA-256 Hash في DB              SHA-256 Hash في DB
```

1. **رمز الدعوة (`wp_inv_...`):** لفتح واستعراض بطاقة الدعوة وتأكيد الحضور.
2. **رمز بطاقة الدخول (`wp_pass_...`):** رمز منفصل تماماً لا يُولد إلا بعد تأكيد الحضور، وهو المشفر داخل الـ QR code الخاص بالدخول.
3. **التجزئة بالاتجاه الواحد:** لا تُخزن الرموز بصيغتها الصريحة في قاعدة البيانات إطلاقاً، بل تُخزن تجزئتها المشفرة **SHA-256** فقط.

---

## 📵 4. محرك المزامنة في وضع عدم الاتصال (Offline Mesh Engine)

عند انقطاع الاتصال عند البوابات:
1. يقوم ماسح البوابة بتحميل الـ Hashes الخاصة بكافة بطاقات الفعالية وتخزينها في ذاكرة المتصفح المحلية (`Offline Cache Dump`).
2. تتم مطابقة الباركود الممسوح محلياً في زمن `<5ms`.
3. يُسجل الدخول محلياً ويُضاف السجل إلى **Pending Queue** مع توثيق `device_scanned_at`.
4. فور عودة الشبكة، تُرسل حزمة العمليات المعلقة بنقرة واحدة إلى السيرفر، الذي يوثق `server_synced_at` لمنع التلاعب بسجلات التوقيت.
