# AzaBot Production Frontend

واجهة React/Vite النهائية لمشروع `alazab-rasa`.

هذه الواجهة لا تتصل بـ Supabase. مسار التشغيل الحالي:

```text
Browser -> FastAPI webhook server -> Rasa -> Actions
```

## التشغيل

```powershell
pnpm install
pnpm build
```

بعد البناء يخدم السيرفر الرئيسي الملفات من:

```text
azabot-prod/dist
```

والروابط تكون:

```text
http://127.0.0.1:8000/
http://127.0.0.1:8000/brand-identity
http://127.0.0.1:8000/luxury-finishing
http://127.0.0.1:8000/uberfix
http://127.0.0.1:8000/laban-alasfour
```

## الربط مع الباك إند

افتراضياً تستخدم الواجهة نفس أصل الموقع الحالي:

```text
/chat
/chat/audio
/chat/upload
```

للتطوير فقط يمكن ضبط:

```env
VITE_CHAT_API_URL=http://127.0.0.1:8000
VITE_SITE_ID=
```

في الإنتاج اترك `VITE_CHAT_API_URL` فارغاً حتى تستخدم الواجهة نفس الدومين.

## الملفات المهمة

- `src/components/AzaBot.tsx`: مكوّن البوت الرئيسي.
- `src/hooks/useChat.ts`: منطق المحادثة.
- `src/lib/chat-service.ts`: الاتصال بـ FastAPI/Rasa.
- `src/lib/config.ts`: إعدادات endpoint.
- `dist/`: build الإنتاج الذي يخدمه FastAPI.
- `embed/azabot-embed.js`: سكربت تضمين اختياري للمواقع الخارجية.

## أوامر الفحص

```powershell
pnpm build
pnpm test
```

فحص الأمان الخاص بالواجهة:

```powershell
snyk test --file=azabot-prod/package.json --package-manager=pnpm --org=0e5901a4-9487-4488-a23d-8849b619354b
```
