# 📜 سجل التغييرات وقرارات المعمارية (Changelog & ADRs)
### منظومة WeddingPass - سجل التطوير الزمني والقرارات المعمارية الموثقة

---

## 🏷️ سجل الإصدارات التاريخي

---

### 🔹 [v5.8.0] - 2026-08-22 21:24 (Enterprise Production Architecture & OWASP/Supabase Standards)
* **المعمارية المؤسساتية والأمان الصارم (OWASP & Supabase 2026):**
  - **حظر الوصول العام لبيانات الضيوف في RLS (P0 Fix):** إلغاء كافة سياسات `Public read` على `parties` و `events`، وحصر الوصول المباشر لقاعدة البيانات عبر خادم Next.js بواسطة `service_role`.
  - **إنشاء العرض الآمن للفعالية (`public_events_view`):** عزل `gate_pin` و `iban` و `bank_name` عن العامة وإتاحة الحقول التجميلية فقط.
  - **قفل صلاحيات الـ RPC على `service_role` فقط (P0 Fix):** سحب صلاحية استدعاء `process_secure_checkin` من `anon` و `authenticated`، وتثبيت `SET search_path = ''` مع أسماء الجداول الكاملة.
  - **بناء معمارية الـ Repository Pattern الحقيقية (`lib/repositories/`):** عزل منطق الأعمال تماماً عن طبقة التخزين عبر واجهات `types.ts`، وتنفيذ `SupabaseRepository` بأسلوب **Fail-Closed** الصارم، مع حصر `MockRepository` على بيئة الاختبارات السريعة.
  - **المعاملات الذرية السحابية لـ RSVP والكوتا (`005_atomic_rsvp_and_group_rpc.sql`):** إنشاء دوال SQL ذرية `submit_party_rsvp_atomic` و `register_group_guest_atomic` بقفل السجلات `FOR UPDATE` لضمان تكامل المقاعد والتذاكر في معاملة ACID واحدة.
  - **اعتماد كوكيز OWASP `__Host-`:** استخدام بادئة `__Host-gate_session` مع `Secure; HttpOnly; SameSite=Strict; Path=/`.
  - **فصل الـ Health Check العام عن الإداري:** جعل `/api/health` مقتصراً على البنية التحتية، ونقل الإحصائيات وفحص الـ RPC والـ Latency إلى مسار محمي جديد `/api/admin/system-health`.
  - **دعم معايير مفاتيح Supabase لعام 2026:** دعم `SUPABASE_PUBLISHABLE_KEY` و `SUPABASE_SECRET_KEY`.

---

### 🔹 [v5.7.0] - 2026-08-22 21:14 (Real Production Data Layer & Fail-Closed Architecture)
* **الطبقة الإنتاجية الصارمة والأمان النهائي:**
  - تطبيق معمارية Fail-Closed الصارمة بالإنتاج.
  - تصحيح صلاحيات Supabase JWT في `adminAuth.ts`.
  - تحصين المسارات العامة وسد ثغرات انتحال الشخصية.
  - إنشاء نقطة الفحص الميداني المسبق (`/api/health`).
  - تنظيم ملفات الترحيل السحابي في `supabase/migrations/`.

---

### 🔹 [v1.0.0 - v5.6.0] - التفاصيل السابقة موثقة في الإصدارات التاريخية.

---

## 🏛️ سجل القرارات المعمارية الجديدة (Architecture Decision Records)

### ADR-019: حظر استعلامات Data API المباشرة لجدول parties
* **القرار:** حذف سياسات القراءة العامة لجدول `parties` وحصر الوصول عبر خادم Next.js بواسطة `service_role`.
* **السبب:** حماية خصوصية الضيوف (الأسماء، الهواتف، الطاولات، الملاحظات) من الاستعلام المباشر عبر مفتاح anon.

### ADR-020: حصر تنفيذ RPC التحضير على service_role
* **القرار:** سحب صلاحية استدعاء `process_secure_checkin` من `authenticated` وقصرها على `service_role`.
* **السبب:** فرض التحقق الإلزامي من جلسة البوابة ورتبة المشرف عبر Next.js ومنع أي مستخدم مسجل من التلاعب بمعاملات الدخول.

### ADR-021: معمارية المستودعات المنفصلة (Repository Pattern Architecture)
* **القرار:** نقل كافة استعلامات قاعدة البيانات إلى `lib/repositories/supabase/SupabaseRepository.ts` واستخدام `MockRepository` في الاختبارات فقط.
* **السبب:** ضمان وجود مصدر وحيد للحقيقة في الإنتاج دون أي شروط fallback هجينة تضعف موثوقية النظام.

### ADR-022: تأمين مسار الفحص الميداني وحجب المقاييس التشغيلية
* **القرار:** حجب إحصائيات الحضور والضيوف عن `/api/health` العام ونقلها إلى `/api/admin/system-health` المحمي بجلسة المشرف.
* **السبب:** الالتزام بمبدأ Least Privilege ومنع تسريب بيانات الفعالية للعامة.
