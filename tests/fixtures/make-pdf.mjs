// テスト用PDFを作る：node tests/fixtures/make-pdf.mjs <出力> <ページサイズ...>（例 595x842 612x792）
import { writeFileSync } from 'node:fs';
const [out, ...sizes] = process.argv.slice(2);
const pages = sizes.map(s => s.split('x').map(Number));
const objs = [];
const n = pages.length;
objs.push('<< /Type /Catalog /Pages 2 0 R >>');
objs.push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${n} >>`);
pages.forEach(([w, h], i) => {
  const content = `BT /F1 24 Tf 72 ${h - 72} Td (Page ${i + 1}) Tj ET`;
  objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 ${3 + n * 2} 0 R >> >> >>`);
  objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
});
objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
let pdf = '%PDF-1.4\n';
const offsets = [];
objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
const xref = pdf.length;
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync(out, pdf, 'latin1');
