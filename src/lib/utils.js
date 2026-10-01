// ============ ارقام فارسی و قالب‌بندی ============
export const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export const toFa = (v) =>
  v === null || v === undefined ? '' : String(v).replace(/\d/g, (d) => FA_DIGITS[+d]);

// جداکننده سه‌رقمی اعداد (خروجی با ارقام فارسی)
export const formatNumber = (n) => toFa(Number(n || 0).toLocaleString('en-US'));

// فرمت مبلغ: جداکننده سه‌رقمی + واحد پول اختیاری
export const formatMoney = (n, currency) => {
  const s = Number(n || 0).toLocaleString('en-US');
  return currency ? `${toFa(s)} ${currency}` : toFa(s);
};

export const pad2 = (n) => String(n).padStart(2, '0');

export const nowTime = () => {
  const t = new Date();
  return `${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
};

// ============ تقویم هجری شمسی (الگوریتم jalaali-js) ============
const div = (a, b) => ~~(a / b);
const mod = (a, b) => a - ~~(a / b) * b;

function jalCal(jy, withoutLeap) {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060,
    2097, 2192, 2262, 2324, 2394, 2456, 3178,
  ];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm, jump = 0, leap, leapG, march, n, i;

  if (jy < jp || jy >= breaks[bl - 1]) throw new Error('سال نامعتبر: ' + jy);

  for (i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  march = 20 + leapJ - leapG;

  if (!withoutLeap) {
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
  }
  return { leap, gy, march };
}

function g2d(gy, gm, gd) {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy, jm, jd) {
  const r = jalCal(jy, true);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy0 = gy - 621;
  const r = jalCal(jy0, false);
  const jdn1f = g2d(gy, 3, r.march);
  let jd, jm, k;

  k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy: jy0, jm, jd };
    }
    k -= 186;
  } else {
    jy0 -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy: jy0, jm, jd };
}

export function gregToJalali(gy, gm, gd) {
  return d2j(g2d(gy, gm, gd));
}

export function jalaliToGregorian(jy, jm, jd) {
  return d2g(j2d(jy, jm, jd));
}

const isJalaliLeap = (jy) => jalCal(jy, false).leap === 0;

export function jalaaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}

// شماره ستون هفته (شنبه = 0 ... جمعه = 6)
export function jalaliWeekdayCol(jy, jm, jd) {
  const g = jalaliToGregorian(jy, jm, jd);
  const day = new Date(g.gy, g.gm - 1, g.gd).getDay(); // یکشنبه=0 ... جمعه=6... شنبه=6
  return (day + 1) % 7;
}

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];
export const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

// امروز شمسی به شکل {jy, jm, jd}
export function todayJalali() {
  const d = new Date();
  return gregToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

// رشته تاریخ استاندارد «YYYY/MM/DD» با ارقام لاتین (برای ذخیره‌سازی و مقایسه)
export const js = (jy, jm, jd) => `${jy}/${pad2(jm)}/${pad2(jd)}`;
export const jalaliTodayString = () => {
  const t = todayJalali();
  return js(t.jy, t.jm, t.jd);
};

// تاریخ امروز به تعداد روز جابجا شده (منفی = گذشته)
export function jalaliOffsetString(days) {
  const t = todayJalali();
  const j = d2j(j2d(t.jy, t.jm, t.jd) + days);
  return js(j.jy, j.jm, j.jd);
}

export function jalaliToJdn(s) {
  const [y, m, d] = String(s).split('/').map(Number);
  return j2d(y, m, d);
}

// «1404/06/15» → «۱۵ شهریور ۱۴۰۴»
export function faDatePretty(s) {
  if (!s) return '—';
  const [y, m, d] = String(s).split('/').map(Number);
  return `${toFa(d)} ${JALALI_MONTHS[m - 1]} ${toFa(y)}`;
}

export const faDate = (s) => (s ? toFa(s) : '—');

// ============ ذخیره‌سازی امن localStorage ============
export const safeStorage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* بی‌اهمیت */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* بی‌اهمیت */
    }
  },
};

export const uid = (prefix) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* ===== شناسنامه کاربر برای ثبت در تراکنش‌ها ===== */
// displayName: ادمین فقط «ادمین»، بقیه نام و نام خانوادگی
export const userDisplay = (user) => {
  if (!user) return '—';
  const isAdmin = user.roles?.includes('admin') || user.role === 'admin';
  if (isAdmin) return 'ادمین';
  return user.firstName ? `${user.firstName} ${user.lastName}`.trim() : (user.fullName || user.username || '—');
};

// رکورد استاندارد ثبت اقدام کاربر (ثبت/ویرایش/ابطال/تایید/رد/تبدیل)
export const auditEntry = (user, action, note = '') => ({
  by: userDisplay(user),
  byId: user?.id || '',
  byUsername: user?.username || '',
  at: `${jalaliTodayString()} ${toFa(nowTime())}`,
  action,
  ...(note ? { note } : {}),
});
