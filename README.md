# QUREO SOLVER

واجهة عربية ثابتة لموقع QUREO SOLVER، مرتبة لتعمل مباشرة على GitHub Pages.

## ملفات المشروع

```text
index.html                 الصفحة الرئيسية
styles.css                 التنسيقات
app.js                     منطق الخطوات والاتصال بالـ API
.nojekyll                  منع معالجة Jekyll للملفات
.github/workflows/pages.yml نشر الموقع عبر GitHub Actions
```

## تشغيل GitHub Pages

1. افتح **Settings → Pages** في المستودع.
2. اختر **Source: GitHub Actions**.
3. ادفع أي تحديث إلى فرع `main` أو شغّل Workflow باسم **Deploy static site to GitHub Pages**.

## خادم API

GitHub Pages يستضيف الواجهة فقط ولا يشغّل خادم Python أو API. يجب توفير خادم يدعم:

- `GET /api/progress?user=<user_key>`
- `POST /api/solve`

بعد تشغيل خادم API، افتح الموقع مع عنوانه:

```text
https://mahamednagyteam-star.github.io/qureo-solver-site/?api=https://your-api.example.com
```

يجب أن يسمح خادم API بطلبات CORS من نطاق الموقع، وأن يعمل عبر HTTPS عند استخدام الموقع عبر HTTPS.

## التطوير المحلي

```bash
python3 -m http.server 8765
```

ثم افتح `http://localhost:8765/`.
