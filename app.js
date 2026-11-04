// API server = YOUR DEVICE running api.py on port 441 (HTTP).
// The website (443 HTTPS) proxies /api/* to it, so the browser only talks
// same-origin HTTPS and there is no mixed-content block.
// Default device URL below; override with ?api=https://... or localStorage.
const API_BASE = (
  new URLSearchParams(location.search).get('api')
  || localStorage.getItem('qureoApiBase')
  || ''
).trim().replace(/\/+$/, '');

// admin mode: open the site once with ?admin=<ADMIN_KEY> and it sticks
// (no 50-limit). ADMIN_KEY must match the server's ADMIN_KEY env.
const adminParams = new URLSearchParams(location.search);
if (adminParams.get('admin')) {
  localStorage.setItem('qureoAdmin', adminParams.get('admin'));
}
const ADMIN_KEY = localStorage.getItem('qureoAdmin') || '';

// device fingerprint: stable per browser, used by the server to allow only
// ONE running solve per device (multi-click = NO until it finishes)
let deviceFp = localStorage.getItem('qureoFp');
if (!deviceFp) {
  deviceFp = 'fp-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
  localStorage.setItem('qureoFp', deviceFp);
}

const form = document.querySelector('#solve-form');
const button = document.querySelector('#start-button');
const statusBox = document.querySelector('#status');
const chaptersBox = document.querySelector('#chapters');
const activityBox = document.querySelector('#activity');
const activityCount = document.querySelector('#activity-count');
const runningBadge = document.querySelector('#running-badge');
const courseCards = document.querySelector('#course-cards');
const stepIndicator = document.querySelector('#step-indicator');
const btnNext = document.querySelector('#btn-next');
const btnBack = document.querySelector('#btn-back');
const joinModal = document.querySelector('#join-modal');
const yearModal = document.querySelector('#year-modal');
const joinedButton = document.querySelector('#joined-button');

let currentUser = localStorage.getItem('qureoUserKey') || '';
let refreshing = false;
let progressFailures = 0;
let activitySignature = '';
let chaptersSignature = '';
let selectedYear = sessionStorage.getItem('qureoYear') || '';
let selectedCourse = '';
let step = 1;
let solveJustStarted = false;
let solveStartedAt = 0;

const COURSES_BY_YEAR = {
  one: [
    { key: 'js_fast_42', label: 'Javascript اولي بكالوريا', desc: 'حل أول 42 فصل بسرعة ودقة كاملة.' },
    { key: 'jslangs_fast_42', label: 'جافا سكربت مدارس لغات (اولي بكالوريا)', desc: 'حل أول 42 فصل لطلبة مدارس اللغات.' },
    { key: 'fin', label: 'ثقافة مالية', desc: 'حل دروس الثقافة المالية بسرعة ودقة كاملة.' },
  ],
  two: [
    { key: 'pylangs_fast', label: 'بايثون تانية بكالوريا', desc: 'حل كل فصول بايثون تانية بكالوريا بسرعة ودقة كاملة.' },
    { key: 'pylangs', label: 'بايثون مدارس لغات تانية بكالوريا', desc: 'حل جميع فصول بايثون لطلبة مدارس اللغات.' },
    { key: 'js_fast', label: 'Javascript تانية بكالوريا', desc: 'حل جميع فصول Javascript الـ54 بسرعة ودقة كاملة.' },
    { key: 'jslangs_fast', label: 'جافا سكربت مدارس لغات (تانية بكالوريا)', desc: 'حل جميع فصول جافا سكربت مدارس اللغات الـ54.' },
    { key: 'fin', label: 'ثقافة مالية', desc: 'حل دروس الثقافة المالية بسرعة ودقة كاملة.' },
  ],
};

if (!/^[a-f0-9]{16}$/.test(currentUser)) {
  currentUser = '';
  localStorage.removeItem('qureoUserKey');
}

function setStatus(message, type = '') {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
}

function requestSignal(timeoutMs) {
  if (typeof AbortSignal?.timeout === 'function') return AbortSignal.timeout(timeoutMs);
  const controller = new AbortController();
  window.setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

async function readJsonResponse(response) {
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: `رد غير صالح من الخادم (${response.status}).` };
  }
  if (!response.ok) throw new Error(data.error || `تعذر الاتصال بالخادم (${response.status}).`);
  return data;
}

// ---- step wizard ----
function showStep(n) {
  step = Math.min(Math.max(n, 1), 4);
  document.querySelectorAll('.wizard-step').forEach((el) => {
    el.classList.toggle('active', Number(el.dataset.step) === step);
  });
  stepIndicator.textContent = `الخطوة ${step} من 4`;
  btnBack.style.display = step === 1 ? 'none' : '';
  btnNext.style.display = step === 4 ? 'none' : '';
  button.style.display = step === 4 ? '' : 'none';
}

function renderCourses() {
  const list = COURSES_BY_YEAR[selectedYear] || [];
  courseCards.replaceChildren();
  selectedCourse = '';
  for (const course of list) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'course-card';
    card.dataset.course = course.key;
    const title = document.createElement('strong');
    title.textContent = course.label;
    const desc = document.createElement('small');
    desc.textContent = course.desc;
    card.append(title, desc);
    card.addEventListener('click', () => {
      courseCards.querySelectorAll('.course-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedCourse = course.key;
      setStatus(`اخترت: ${course.label}. دوس "التالي".`, 'success');
    });
    courseCards.appendChild(card);
  }
}

function chooseYear(year) {
  selectedYear = year;
  sessionStorage.setItem('qureoYear', year);
  yearModal.classList.add('hidden');
  renderCourses();
  showStep(1);
}

document.querySelector('#year-one').addEventListener('click', () => chooseYear('one'));
document.querySelector('#year-two').addEventListener('click', () => chooseYear('two'));
document.querySelector('#change-year').addEventListener('click', () => {
  yearModal.classList.remove('hidden');
});

if (!selectedYear) {
  yearModal.classList.remove('hidden');
} else {
  renderCourses();
}

btnNext.addEventListener('click', () => {
  if (step === 1) {
    if (!selectedCourse) return setStatus('اختار الدورة الأول عشان نكمل.', 'error');
  } else if (step === 2) {
    if (!document.querySelector('#phone').value.trim()) return setStatus('اكتب رقم الموبايل الأول.', 'error');
  } else if (step === 3) {
    if (!document.querySelector('#code').value.trim()) return setStatus('اكتب كود الطالب الأول.', 'error');
  }
  setStatus('');
  showStep(step + 1);
});

btnBack.addEventListener('click', () => showStep(step - 1));

// ---- join gate (telegram) ----
if (sessionStorage.getItem('qureoJoined') === 'true') {
  joinModal.classList.add('hidden');
  button.disabled = false;
}
joinedButton.addEventListener('click', () => {
  sessionStorage.setItem('qureoJoined', 'true');
  joinModal.classList.add('hidden');
  button.disabled = false;
  setStatus('تم التفعيل. اكمل الخطوات.', 'success');
});

// ---- live progress ----
function renderActivity(lines) {
  const signature = JSON.stringify(lines);
  activityCount.textContent = `${lines.length} أحداث`;
  if (signature === activitySignature) return;

  const stickToBottom = !activitySignature || activityBox.scrollHeight - activityBox.scrollTop - activityBox.clientHeight < 45;
  activitySignature = signature;
  activityBox.replaceChildren();

  if (!lines.length) {
    const empty = document.createElement('div');
    empty.className = 'empty compact';
    empty.textContent = 'سيظهر نشاط حسابك هنا عند بدء الحل.';
    activityBox.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const rawText of lines) {
    const text = String(rawText ?? '');
    const row = document.createElement('div');
    const lower = text.toLowerCase();
    row.className = 'activity-line';
    if (/done|answered|completed|clear|perfect/.test(lower)) row.classList.add('success');
    if (/error|failed|skipped|exception|traceback|خطأ|خاطئة/.test(lower)) row.classList.add('error');
    if (/^(lesson|chapter|course|review)/.test(lower)) row.classList.add('current');
    row.textContent = text;
    fragment.appendChild(row);
  }
  activityBox.appendChild(fragment);
  if (stickToBottom) activityBox.scrollTop = activityBox.scrollHeight;
}

function renderChapters(chapters) {
  const signature = JSON.stringify(chapters);
  if (signature === chaptersSignature) return;
  chaptersSignature = signature;
  chaptersBox.replaceChildren();

  if (!chapters.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'لا يوجد تقدم لهذا الحساب بعد.';
    chaptersBox.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of chapters) {
    const lessons = Array.isArray(item?.lessons) ? item.lessons.map((lesson) => String(lesson)) : [];
    const card = document.createElement('div');
    card.className = 'chapter';
    const text = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `Chapter ${item.chapter}`;
    const detail = document.createElement('small');
    detail.textContent = lessons.join(' · ');
    detail.title = lessons.join(' · ');
    text.append(title, detail);
    const count = document.createElement('span');
    count.textContent = `${lessons.length} solved`;
    card.append(text, count);
    fragment.appendChild(card);
  }
  chaptersBox.appendChild(fragment);
}

async function refreshProgress() {
  if (refreshing) return;
  if (!currentUser) {
    document.querySelector('#completed-count').textContent = '0';
    document.querySelector('#last-chapter').textContent = '—';
    document.querySelector('#running').textContent = 'متوقف';
    runningBadge.textContent = 'متوقف';
    runningBadge.classList.remove('active');
    renderActivity([]);
    renderChapters([]);
    return;
  }
  if (!API_BASE) {
    setStatus('أضف رابط خادم API في الرابط باستخدام ?api=https://…', 'error');
    return;
  }

  refreshing = true;
  try {
    const response = await fetch(`${API_BASE}/api/progress?user=${encodeURIComponent(currentUser)}`, {
      cache: 'no-store',
      signal: requestSignal(15000),
    });
    const data = await readJsonResponse(response);
    if (progressFailures >= 10) setStatus('');
    progressFailures = 0;
    document.querySelector('#completed-count').textContent = data.completed_count;
    document.querySelector('#last-chapter').textContent = data.last_chapter || '—';
    const queued = Boolean(data.queued);
    const queuePosition = data.queue_position || 0;
    document.querySelector('#running').textContent = queued ? `دورك رقم ${queuePosition}` : data.running ? 'يعمل الآن' : 'متوقف';
    runningBadge.textContent = queued ? `● في الانتظار #${queuePosition}` : data.running ? '● مباشر' : 'متوقف';
    runningBadge.classList.toggle('active', data.running || queued);
    const activity = Array.isArray(data.activity) ? data.activity : [];
    renderActivity(activity);
    const latestActivity = activity[activity.length - 1] || '';
    if (solveJustStarted && latestActivity.includes('المعلومات خاطئة')) {
      setStatus('المعلومات خاطئة', 'error');
      solveJustStarted = false;
    }
    if (solveJustStarted && Date.now() - solveStartedAt > 120000) {
      solveJustStarted = false;
    }
    renderChapters(Array.isArray(data.chapters) ? data.chapters : []);
  } catch (error) {
    progressFailures += 1;
    if (progressFailures >= 3) {
      setStatus('تعذر الاتصال بخادم API — بنعيد المحاولة تلقائياً.', 'error');
    }
  } finally {
    refreshing = false;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedCourse) return setStatus('ارجع للخطوة الأولى واختار الدورة.', 'error');
  if (!document.querySelector('#password').value) return setStatus('اكتب كلمة السر الأول.', 'error');
  if (!API_BASE) return setStatus('لا يمكن البدء قبل إضافة رابط خادم API باستخدام ?api=https://…', 'error');
  button.disabled = true;
  setStatus('جارٍ بدء الحل…');
  const payload = {
    phone: document.querySelector('#phone').value.trim(),
    code: document.querySelector('#code').value.trim(),
    password: document.querySelector('#password').value,
    course: selectedCourse,
    chapter: null,
    admin_key: ADMIN_KEY,
    fingerprint: deviceFp,
  };
  try {
    const response = await fetch(`${API_BASE}/api/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: requestSignal(30000),
    });
    const data = await readJsonResponse(response);
    currentUser = data.user_key;
    localStorage.setItem('qureoUserKey', currentUser);
    activitySignature = '';
    solveJustStarted = true;
    solveStartedAt = Date.now();
    if (data.queued) {
      const remaining = Math.max((data.queue_position || 1) - 1, 0);
      setStatus(remaining
        ? `انت دورك رقم: ${data.queue_position} — هيبدأ الحل بعد ${remaining} طلبات قبلك`
        : 'انت دورك رقم: 1 — هيبدأ الحل أول ما أي طلب يخلص', 'success');
    } else {
      setStatus('بدأ الحل. تابع نشاطك المباشر هنا.', 'success');
    }
    refreshProgress();
  } catch (error) {
    const timedOut = error?.name === 'AbortError' || error?.name === 'TimeoutError';
    setStatus(timedOut ? 'السيرفر مشغول — حاول تاني بعد ثواني.' : (error.message || 'تعذر بدء الحل.'), 'error');
  } finally {
    button.disabled = false;
  }
});

showStep(1);
refreshProgress();
setInterval(refreshProgress, 5000);
