# QUREO SOLVER

واجهة ثابتة لموقع QUREO SOLVER.

## التشغيل

الموقع منشور عبر GitHub Pages. الواجهة تتوقع API متوافقًا مع المسارات التالية:

- `GET /api/progress?user=<user_key>`
- `POST /api/solve`

لتحديد عنوان خادم الـ API، افتح الموقع مع معامل `api`:

```text
https://<username>.github.io/qureo-solver-site/?api=https://your-api.example.com
```

أو خزّن العنوان في `localStorage` تحت المفتاح `qureoApiBase`.

> GitHub Pages يستضيف ملفات الواجهة فقط ولا يشغّل خادم Python أو API خلفي.
