<script setup>
// نوار سه دکمه خروجی (اکسل/CSV/PDF) — منطق یکسان با نسخه React
import { FileSpreadsheet, FileText, FileDown } from 'lucide-vue-next';

const props = defineProps({
  filename: { type: String, required: true },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  headers: { type: Array, required: true },
  rows: { type: Array, required: true },
  fontFamily: { type: String, default: 'Vazirmatn' },
});

const BOM = '\uFEFF';

// اعداد فارسی رشته‌ها را به لاتین برمی‌گرداند تا در اکسل عدد شناخته شود
const deFa = (v) =>
  v === null || v === undefined ? '' :
  String(v).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

// سلول عددی: اگر عدد بود، سه‌رقم جدا و فارسی نمایش داده می‌شود
const fmtCell = (v) => {
  const s = deFa(v);
  const t = String(s).trim();
  if (t !== '' && /^-?\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    const formatted = n % 1 === 0
      ? n.toLocaleString('en-US')
      : n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return toFaStr(formatted).replace('.', '٫');
  }
  return String(v ?? '');
};

const toFaStr = (v) =>
  v === null || v === undefined ? '' : String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

const downloadBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
};

const exportCSV = () => {
  const esc = (v) => {
    const s = deFa(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
    return `"${String(s).replace(/"/g, '""')}"`;
  };
  const lines = [props.headers.map(esc).join(','), ...props.rows.map((r) => r.map(esc).join(','))];
  const blob = new Blob([BOM + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${props.filename}.csv`);
};

const exportExcel = () => {
  const escXml = (v) =>
    deFa(String(v ?? ''))
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const cell = (v) => {
    const num = Number(deFa(v));
    if (v !== '' && v !== null && v !== undefined && !isNaN(num) && String(deFa(v)).trim() !== '') {
      return `<Cell><Data ss:Type="Number">${num}</Data></Cell>`;
    }
    return `<Cell><Data ss:Type="String">${escXml(v)}</Data></Cell>`;
  };

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="head"><Font ss:Bold="1"/></Style>
  <Style ss:ID="title"><Font ss:Bold="1" ss:Size="14"/></Style>
</Styles>
<Worksheet ss:Name="${(props.title || 'گزارش').slice(0, 28)}">
<Table>
  ${props.title ? `<Row><Cell ss:StyleID="title"><Data ss:Type="String">${escXml(props.title)}</Data></Cell></Row><Row></Row>` : ''}
  <Row>${props.headers.map((h) => `<Cell ss:StyleID="head"><Data ss:Type="String">${escXml(h)}</Data></Cell>`).join('')}</Row>
  ${props.rows.map((r) => `<Row>${r.map(cell).join('')}</Row>`).join('\n')}
</Table>
</Worksheet>
</Workbook>`;
  downloadBlob(new Blob([BOM + xml], { type: 'application/vnd.ms-excel;charset=utf-8;' }), `${props.filename}.xls`);
};

const exportPDF = () => {
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const w = window.open('', '_blank', 'width=1000,height=700');
  if (!w) { alert('اجازه باز شدن پنجره چاپ را بدهید تا خروجی PDF ساخته شود.'); return; }
  const doc = w.document;
  doc.open();
  doc.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${esc(props.title)}</title>
  <link href="https://cdn.rastikerdar.ir/vazirmatn/v33.003/Vazirmatn-font-face.css" rel="stylesheet">
  <link href="https://cdn.rastikerdar.ir/sahel/font/font-face.css" rel="stylesheet">
  <link href="https://cdn.rastikerdar.ir/samim/font/font-face.css" rel="stylesheet">
  <link href="https://cdn.rastikerdar.ir/shabnam-font/dist/font-face.css" rel="stylesheet">
  <link href="https://cdn.rastikerdar.ir/gandom/font-face.css" rel="stylesheet">
  <link href="https://cdn.rastikerdar.ir/parastoo/font/font-face.css" rel="stylesheet">
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: '${props.fontFamily}', Vazirmatn, Tahoma, sans-serif; padding: 12px; text-align: center; }
    h2 { text-align: center; margin: 0 0 4px; }
    p.sub { text-align: center; color: #475569; font-size: 11px; margin: 0 0 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 0 auto; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; }
    th { background: #f1f5f9; }
    tfoot td { font-weight: 900; background: #f8fafc; }
    @media print { .no-print { display: none; } }
  </style></head><body>
  <h2>${esc(props.title)}</h2>
  <p class="sub">${esc(props.subtitle || '')}</p>
  <table><thead><tr>${props.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
  <tbody>${props.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(fmtCell(c))}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 400); };<\/script>
  </body></html>`);
  doc.close();
};
</script>

<template>
  <div class="flex items-center gap-1.5">
    <button
      title="خروجی اکسل"
      class="px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition"
      @click="exportExcel"
    >
      <FileSpreadsheet class="w-4 h-4" /> اکسل
    </button>
    <button
      title="خروجی CSV"
      class="px-3 py-2 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-100 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition"
      @click="exportCSV"
    >
      <FileText class="w-4 h-4" /> CSV
    </button>
    <button
      title="خروجی PDF (از پنجره چاپ، Save as PDF)"
      class="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-100 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition"
      @click="exportPDF"
    >
      <FileDown class="w-4 h-4" /> PDF
    </button>
  </div>
</template>
