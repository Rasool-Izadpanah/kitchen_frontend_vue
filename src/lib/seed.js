import { jalaliOffsetString, jalaliTodayString } from './utils.js';

export const INITIAL_USERS = [
  { id: 'usr_1', username: '100', password: '100', fullName: 'کاربر معمولی نسیم', personnelCode: '100', mobile: '09120000001', roles: ['user'] },
  { id: 'usr_2', username: '101', password: '100', personnelCode: '101', mobile: '09120000002', fullName: 'کاربر معمولی ۲', roles: ['user'] },
  { id: 'usr_3', username: 'admin', password: 'admin123', fullName: 'مدیر سیستم', personnelCode: '200', mobile: '09120000003', roles: ['admin'] },
  { id: 'usr_4', username: 'chef', password: 'chef123', fullName: 'سرآشپز نسیم', personnelCode: '300', mobile: '09120000004', roles: ['chef'] },
  { id: 'usr_5', username: 'store', password: 'store123', fullName: 'انباردار نسیم', personnelCode: '400', mobile: '09120000005', roles: ['storekeeper'] },
  { id: 'usr_6', username: 'multi', password: 'multi123', fullName: 'کاربر چندنقشی', personnelCode: '500', mobile: '09120000006', roles: ['chef', 'storekeeper'] },
];

export const INITIAL_UNITS = [
  { id: 'u1', name: 'کیلوگرم' },
  { id: 'u2', name: 'گرم' },
  { id: 'u3', name: 'لیتر' },
  { id: 'u4', name: 'عدد' },
  { id: 'u5', name: 'بسته' },
];

export const INITIAL_CUSTOMERS = [
  { id: 'c1', firstName: 'علی', lastName: 'کرمی', mobile: '09123456789', address: 'تهران، خیابان شریعتی، پلاک ۴', discountPercent: 0, isTaxable: false },
  { id: 'c2', firstName: 'محمد', lastName: 'حسینی', mobile: '09198765432', address: 'تهران، میدان ونک، برج نگین', discountPercent: 5, isTaxable: true },
  { id: 'c3', firstName: 'زهرا', lastName: 'عباسی', mobile: '09351234567', address: 'شهر ری، فلکه اول، کوچه همت', discountPercent: 0, isTaxable: false },
  { id: 'c4', firstName: 'شرکت', lastName: 'پویا صنعت', mobile: '02188776655', address: 'شهرک صنعتی شمس‌آباد', discountPercent: 10, isTaxable: true },
];

export const INITIAL_DISHES = [
  { id: 'd1', name: 'چلو کباب کوبیده', price: 195000 },
  { id: 'd2', name: 'زرشک پلو با مرغ', price: 155000 },
  { id: 'd3', name: 'قورمه سبزی', price: 135000 },
  { id: 'd4', name: 'عدس پلو نذری', price: 110000 },
  { id: 'd5', name: 'آش رشته مخصوص', price: 65000 },
];

// مواد غذایی انبار (اقلام اصلی + محل نگهداری + درصد پرتی + آستانه هشدار + آخرین قیمت خرید)
export const INITIAL_INGREDIENTS = [
  { id: 'i1', name: 'برنج ایرانی طارم', unit: 'کیلوگرم', qty: 42, wastePercent: 2, minThreshold: 60, storage: 'انبار خشک', price: 150000 },
  { id: 'i2', name: 'گوشت گوسفندی', unit: 'کیلوگرم', qty: 12, wastePercent: 10, minThreshold: 20, storage: 'فریزر', price: 900000 },
  { id: 'i3', name: 'مرغ تازه', unit: 'کیلوگرم', qty: 55, wastePercent: 5, minThreshold: 30, storage: 'فریزر', price: 120000 },
  { id: 'i4', name: 'روغن سرخ‌کردنی', unit: 'لیتر', qty: 35, wastePercent: 1, minThreshold: 40, storage: 'انبار خشک', price: 180000 },
  { id: 'i5', name: 'عدس سبز', unit: 'کیلوگرم', qty: 18, wastePercent: 4, minThreshold: 25, storage: 'انبار خشک', price: 120000 },
  { id: 'i6', name: 'لوبیا قرمز', unit: 'کیلوگرم', qty: 44, wastePercent: 3, minThreshold: 25, storage: 'انبار خشک', price: 100000 },
  { id: 'i7', name: 'زعفران قائنات', unit: 'گرم', qty: 480, wastePercent: 1, minThreshold: 150, storage: 'محفظه درب‌بسته', price: 250000 },
  { id: 'i8', name: 'کشمش تیزابی', unit: 'کیلوگرم', qty: 26, wastePercent: 2, minThreshold: 15, storage: 'انبار خشک', price: 90000 },
  { id: 'i9', name: 'پیاز', unit: 'کیلوگرم', qty: 90, wastePercent: 8, minThreshold: 50, storage: 'انبار خشک', price: 25000 },
];

// اقلام جانبی قابل فروش (ظرف، قاشق و چنگال و ...) — qty: موجودی انبار
export const INITIAL_SUPPLIES = [
  { id: 's1', name: 'ظرف یکبار مصرف', price: 12000, qty: 0 },
  { id: 's2', name: 'قاشق و چنگال یکبار مصرف', price: 5000, qty: 0 },
  { id: 's3', name: 'دستمال کاغذی بسته‌ای', price: 3000, qty: 0 },
  { id: 's4', name: 'سلفون بسته‌بندی', price: 4000, qty: 0 },
];

// هزینه‌های سربار ماهانه (برای محاسبه هزینه تمام شده غذا)
export const INITIAL_OVERHEADS = [
  { id: 'oh1', name: 'حقوق پرسنلی', amount: 80000000 },
  { id: 'oh2', name: 'بیمه پرسنل', amount: 15000000 },
  { id: 'oh3', name: 'آب، برق و گاز', amount: 5000000 },
  { id: 'oh4', name: 'اجاره محل', amount: 20000000 },
];

export const STORAGE_PLACES = ['انبار خشک', 'محفظه درب‌بسته', 'یخچال', 'فریزر', 'سردخانه', 'انبار سبزیجات'];

export const INITIAL_RECIPES = [
  {
    id: 'r1', dishId: 'd1', dishName: 'چلو کباب کوبیده',
    items: [
      { ingredientId: 'i1', name: 'برنج ایرانی طارم', qty: 0.15, unit: 'کیلوگرم' },
      { ingredientId: 'i2', name: 'گوشت گوسفندی', qty: 0.18, unit: 'کیلوگرم' },
      { ingredientId: 'i4', name: 'روغن سرخ‌کردنی', qty: 0.03, unit: 'لیتر' },
    ],
  },
  {
    id: 'r2', dishId: 'd5', dishName: 'آش رشته مخصوص',
    items: [
      { ingredientId: 'i5', name: 'عدس سبز', qty: 0.05, unit: 'کیلوگرم' },
      { ingredientId: 'i6', name: 'لوبیا قرمز', qty: 0.04, unit: 'کیلوگرم' },
      { ingredientId: 'i9', name: 'پیاز', qty: 0.06, unit: 'کیلوگرم' },
    ],
  },
];

// تراکنش‌های اولیه انبار (کاردکس)
export const INITIAL_STOCK_MOVES = [
  { id: 'm1', date: jalaliOffsetString(-20), time: '09:15', ingredientId: 'i1', name: 'برنج ایرانی طارم', type: 'in', qty: 80, unit: 'کیلوگرم', desc: 'خرید از بازار', person: 'انباردار' },
  { id: 'm2', date: jalaliOffsetString(-18), time: '10:30', ingredientId: 'i2', name: 'گوشت گوسفندی', type: 'in', qty: 30, unit: 'کیلوگرم', desc: 'خرید گوشت روز', person: 'انباردار' },
  { id: 'm3', date: jalaliOffsetString(-10), time: '11:00', ingredientId: 'i1', name: 'برنج ایرانی طارم', type: 'out', qty: 38, unit: 'کیلوگرم', desc: 'پخت چلوکباب', person: 'سرآشپز' },
  { id: 'm4', date: jalaliOffsetString(-6), time: '12:40', ingredientId: 'i2', name: 'گوشت گوسفندی', type: 'out', qty: 18, unit: 'کیلوگرم', desc: 'پخت قورمه سبزی', person: 'سرآشپز' },
  { id: 'm5', date: jalaliOffsetString(-3), time: '08:50', ingredientId: 'i5', name: 'عدس سبز', type: 'in', qty: 20, unit: 'کیلوگرم', desc: 'خرید عدس', person: 'انباردار' },
  { id: 'm6', date: jalaliOffsetString(-2), time: '13:10', ingredientId: 'i5', name: 'عدس سبز', type: 'out', qty: 2, unit: 'کیلوگرم', desc: 'پخت آش رشته', person: 'سرآشپز' },
];

const d = jalaliOffsetString;
export const INITIAL_INVOICES = [
  {
    id: 'INV-1001',
    date: d(-9), time: '۱۱:۳۰',
    customer: INITIAL_CUSTOMERS[0],
    items: [
      { dishId: 'd2', dishName: 'زرشک پلو با مرغ', count: 120, unitPrice: 155000, totalRow: 18600000 },
      { dishId: 'd5', dishName: 'آش رشته مخصوص', count: 60, unitPrice: 65000, totalRow: 3900000 },
    ],
    subtotal: 22500000, discountPercent: 0, discountAmount: 0,
    taxRate: 10, taxAmount: 0, isTaxable: false,
    finalTotal: 22500000,
    receiver: 'حاج رضا محمدی',
    notes: 'توزیع در وعده ناهار',
  },
  {
    id: 'INV-1002',
    date: d(-5), time: '۱۲:۱۵',
    customer: INITIAL_CUSTOMERS[1],
    items: [
      { dishId: 'd1', dishName: 'چلو کباب کوبیده', count: 80, unitPrice: 195000, totalRow: 15600000 },
    ],
    subtotal: 15600000, discountPercent: 5, discountAmount: 780000,
    taxRate: 10, taxAmount: 1482000, isTaxable: true,
    finalTotal: 16302000,
    receiver: '',
    notes: 'نذر سلامت',
  },
  {
    id: 'INV-1003',
    date: d(0), time: '۱۰:۰۵',
    customer: INITIAL_CUSTOMERS[3],
    items: [
      { dishId: 'd3', dishName: 'قورمه سبزی', count: 200, unitPrice: 135000, totalRow: 27000000 },
      { dishId: 'd4', dishName: 'عدس پلو نذری', count: 150, unitPrice: 110000, totalRow: 16500000 },
    ],
    subtotal: 43500000, discountPercent: 10, discountAmount: 4350000,
    taxRate: 10, taxAmount: 3915000, isTaxable: true,
    finalTotal: 43065000,
    receiver: 'آقای کریمی (راننده)',
    notes: 'تحویل در محل شرکت',
  },
];

export const INITIAL_SETTINGS = {
  taxRate: 1,
  currency: 'تومان',
  charityName: 'بنیاد خیریه سیدالشهدا (ع)',
  kitchenName: 'آشپزخانه نسیم',
  appFont: 'Vazirmatn',
  reportFont: 'Vazirmatn',
  nationalId: '',
  economicCode: '',
  phone: '',
  address: '',
  // فاز ۲ — کلیدهای ماژول خرید
  enableOnOrderInShortage: false,
  enableQualityCheck: false,
  enableBatchTracking: false,
  enableExpiryTracking: false,
  enableFifoReport: false,
};

// ===== فاز ۲ — تأمین‌کنندگان =====
export const INITIAL_SUPPLIERS = [
  { id: 'sup_1', name: 'پخش عمده مواد غذایی باران', phone: '02155667788', address: 'تهران، بازار بزرگ', economicCode: '', nationalId: '', notes: 'تحویل صبح‌ها', active: true },
  { id: 'sup_2', name: 'گوشت و مرغ بهشتی', phone: '02188990011', address: 'تهران، خیابان بهارستان', economicCode: '', nationalId: '', notes: 'فقط مرغ تازه', active: true },
  { id: 'sup_3', name: 'سبزیجات مزارع البرز', phone: '02634445566', address: 'کرج، جاده کرج', economicCode: '', nationalId: '', notes: '', active: true },
];

// فونت‌های فارسی قابل انتخاب (نام = font-family در CDN رستیکردار)
export const FONT_OPTIONS = [
  { id: 'Vazirmatn', label: 'وزیرمتن (پیش‌فرض)' },
  { id: 'Sahel', label: 'ساحل' },
  { id: 'Samim', label: 'صمیم' },
  { id: 'Shabnam', label: 'شب‌نم' },
  { id: 'Gandom', label: 'گندم' },
  { id: 'Parastoo', label: 'پرستو' },
];

// دلایل رد آماده (قابل مدیریت در تنظیمات — فاز ۱)
export const INITIAL_REJECTION_REASONS = [
  { id: 'rr1', text: 'موجودی انبار کافی نیست', category: 'cookplan' },
  { id: 'rr2', text: 'تعداد پخت با ظرفیت آشپزخانه همخوانی ندارد', category: 'cookplan' },
  { id: 'rr3', text: 'مواد به‌موقع تأمین نشد', category: 'purchase' },
  { id: 'rr4', text: 'کیفیت کالای تحویلی نامناسب بود', category: 'grn' },
  { id: 'rr5', text: 'مغایرت مقدار با سفارش', category: 'grn' },
  { id: 'rr6', text: 'درخواست خارج از زمان مجاز', category: 'stockout' },
  { id: 'rr7', text: 'سایر (توضیح در یادداشت)', category: 'cookplan' },
];

// ===== سیستم نقش‌ها و مجوزها =====
// کاتالوگ مجوزهای قابل انتخاب هنگام تعریف نقش
export const PERMISSIONS = [
  { key: 'view_dashboard', label: 'مشاهده داشبورد', group: 'عمومی' },
  { key: 'edit_request_cookplan', label: 'ویرایش مقادیر درخواست در کارتابل — برنامه غذایی', group: 'کارتابل' },
  { key: 'edit_request_preinvoice', label: 'ویرایش مقادیر درخواست در کارتابل — پیش‌فاکتور', group: 'کارتابل' },
  { key: 'edit_request_purchase', label: 'ویرایش مقادیر درخواست در کارتابل — درخواست خرید کالا', group: 'کارتابل' },
  { key: 'edit_request_stockout', label: 'ویرایش مقادیر درخواست در کارتابل — درخواست کالا از انبار', group: 'کارتابل' },
  { key: 'approve_cookplan', label: 'تأیید برنامه پخت و رزرو مواد (سرآشپز)', group: 'کارتابل' },
  { key: 'final_approve_cookplan', label: 'تأیید نهایی برنامه پخت و مصرف مواد (مدیر)', group: 'کارتابل' },
  { key: 'reject_cookplan', label: 'رد برنامه پخت', group: 'کارتابل' },
  { key: 'create_purchase_order', label: 'صدور سفارش خرید (PO)', group: 'خرید' },
  { key: 'receive_goods', label: 'ثبت رسید انبار (GRN)', group: 'انبار' },
  { key: 'quality_check', label: 'کنترل کیفیت رسید', group: 'انبار' },
  { key: 'record_purchase_invoice', label: 'ورود قیمت خرید / ثبت فاکتور (حسابداری)', group: 'حسابداری' },
  { key: 'three_way_match', label: 'تطبیق سه‌طرفه', group: 'خرید' },
  { key: 'manage_suppliers', label: 'مدیریت تأمین‌کنندگان', group: 'تعاریف' },
  { key: 'dailycook', label: 'برنامه پخت روزانه', group: 'عملیات' },
  { key: 'create_invoice', label: 'صدور فاکتور فروش', group: 'عملیات' },
  { key: 'edit_preinvoice', label: 'ویرایش پیش‌فاکتور', group: 'عملیات' },
  { key: 'view_warehouse', label: 'ورود و خروج انبار', group: 'عملیات' },
  { key: 'view_reservations', label: 'مشاهده رزروهای انبار', group: 'انبار' },
  { key: 'view_reports', label: 'مشاهده گزارش‌ها', group: 'گزارش' },
  { key: 'print_reports', label: 'چاپ گزارش‌ها', group: 'گزارش' },
  { key: 'manage_customers', label: 'تعریف مشتری', group: 'تعاریف' },
  { key: 'manage_dishes', label: 'تعریف غذا', group: 'تعاریف' },
  { key: 'manage_ingredients', label: 'تعریف ماده غذایی', group: 'تعاریف' },
  { key: 'manage_recipes', label: 'تعریف رسپی', group: 'تعاریف' },
  { key: 'manage_supplies', label: 'تعریف اقلام جانبی', group: 'تعاریف' },
  { key: 'manage_rejection_reasons', label: 'مدیریت دلایل رد', group: 'تعاریف' },
  { key: 'manage_settings', label: 'تنظیمات پایه (واحد، مالیات، فونت و...)', group: 'سیستم' },
  { key: 'manage_reservation_timeout', label: 'تنظیم Timeout رزرو', group: 'سیستم' },
  { key: 'edit_users', label: 'تعریف و ویرایش کاربران', group: 'سیستم' },
  { key: 'manage_roles', label: 'تعریف نقش‌ها و مجوزها', group: 'سیستم' },
];

const allPerms = (v) => Object.fromEntries(PERMISSIONS.map((p) => [p.key, v]));

// نقش‌های اولیه — admin نقش سیستمی است و قابل حذف/ویرایش نیست
export const INITIAL_ROLES = [
  { id: 'admin', name: 'ادمین', system: true, permissions: allPerms(true) },
  { id: 'user', name: 'کاربر معمولی', system: true, permissions: { ...allPerms(false), view_dashboard: true, dailycook: true } },
  {
    id: 'manager', name: 'مدیر عملیات', system: false, permissions: {
      ...allPerms(false),
      view_dashboard: true, dailycook: true, create_invoice: true, edit_preinvoice: true,
      view_warehouse: true, view_reports: true, print_reports: true,
      manage_customers: true, manage_dishes: true, manage_ingredients: true,
      manage_recipes: true, manage_supplies: true,
      final_approve_cookplan: true, reject_cookplan: true, view_reservations: true,
      create_purchase_order: true, record_purchase_invoice: true, three_way_match: true, manage_suppliers: true,
    }
  },
  {
    id: 'chef', name: 'سرآشپز', system: false, permissions: {
      ...allPerms(false),
      view_dashboard: true, dailycook: true, view_reports: true,
      approve_cookplan: true,
    }
  },
  {
    id: 'storekeeper', name: 'انباردار', system: false, permissions: {
      ...allPerms(false),
      view_dashboard: true, view_warehouse: true, view_reports: true,
      view_reservations: true,
      receive_goods: true, quality_check: true,
    }
  },
  {
    id: 'accountant', name: 'حسابدار', system: false, permissions: {
      ...allPerms(false),
      view_dashboard: true, record_purchase_invoice: true,
      view_reports: true, print_reports: true,
    }
  },
];
