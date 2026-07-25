const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, TableLayoutType,
} = require('docx');
const fs = require('fs');

const creator = { full_name: 'Lê Thị Minh Huyền', title: 'Cán bộ QHKHDN', role: 'staff', gender: 'female' };
const department = { name: 'Phòng KHDN' };
const participants = [
  { profile: { full_name: 'Lương Thị Như Quỳnh', title: 'Phó giám đốc', role: 'director', gender: 'female' } },
  { profile: { full_name: 'Nguyễn Thị Thu Hương', title: 'Trưởng Phòng KHDN', role: 'manager', gender: 'female' } },
  { profile: { full_name: 'Lê Thị Minh Huyền', title: 'Cán bộ QHKHDN', role: 'staff', gender: 'female' } },
];
const start_time = '2026-05-14T08:30:00';
const location = '21 Lê Đức Thọ';
const title = 'Chúc mừng sinh nhật Giám đốc công ty HTSC';
const description = '';

function honorific(gender) { if (gender === 'male') return 'Ông '; if (gender === 'female') return 'Bà '; return ''; }
function zeroPad(n, len = 2) { return n.toString().padStart(len, '0'); }

// prettier-ignore
const children = [];

const emptyP = () =>
  new Paragraph({
    spacing: { after: 0, before: 0 },
    children: [new TextRun({ text: '', size: 24 })],
  });

const p = (text, options = {}) =>
  new Paragraph({
    spacing: { after: options.after ?? 120, before: options.before ?? 0 },
    alignment: options.alignment ?? AlignmentType.LEFT,
    children: [
      new TextRun({
        text,
        font: { name: 'Times New Roman', hint: 'eastAsia' },
        size: options.size || 24,
        bold: options.bold ?? false,
        italics: options.italics ?? false,
      }),
    ],
  });

const cellP = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: 0, before: 0 },
    alignment: opts.alignment ?? AlignmentType.LEFT,
    children: [
      new TextRun({
        text,
        font: { name: 'Times New Roman', hint: 'eastAsia' },
        size: opts.size || 24,
        bold: opts.bold ?? false,
        italics: opts.italics ?? false,
      }),
    ],
  });

const labelOpts = { font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 22, bold: true };
const labelItalic = { font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 22, italics: true };

// ===== PAGE SETUP =====
const PAGE_W = 11906;       // A4 width
const STD_MARGIN = 1440;     // 1 inch — cho body text
const STD_AVAIL = PAGE_W - 2 * STD_MARGIN; // 9026 DXA

// Header table cần lề hẹp hơn để text ko wrap
const HEADER_MARGIN = 864;   // 0.6 inch
const HEADER_AVAIL = PAGE_W - 2 * HEADER_MARGIN; // 10178 DXA
const HEADER_HALF = Math.floor(HEADER_AVAIL / 2); // 5089 DXA/cột

const noBorder = { style: BorderStyle.NONE, size: 0 };
const FIXED = TableLayoutType.FIXED;
children.push(new Table({
  layout: FIXED,
  width: { size: HEADER_AVAIL, type: WidthType.DXA },
  borders: {
    top: noBorder, left: noBorder, bottom: noBorder, right: noBorder,
    insideHorizontal: noBorder, insideVertical: noBorder,
  },
  rows: [
    // Row 0: NGÂN HÀNG ... | CỘNG HOÀ ...
    new TableRow({
      children: [
        new TableCell({
          width: { size: HEADER_HALF, type: WidthType.DXA },
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 }, children: [new TextRun({ text: 'NGÂN HÀNG TMCP CÔNG THƯƠNG VIỆT NAM', ...labelOpts })] }),
            emptyP(),
          ],
        }),
        new TableCell({
          width: { size: HEADER_HALF, type: WidthType.DXA },
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 }, children: [new TextRun({ text: 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM', ...labelOpts })] }),
            emptyP(),
          ],
        }),
      ],
    }),
    // Row 1: CHI NHÁNH HOÀNG MAI | Độc lập - Tự do - Hạnh phúc
    new TableRow({
      children: [
        new TableCell({
          width: { size: HEADER_HALF, type: WidthType.DXA },
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 }, children: [new TextRun({ text: 'CHI NHÁNH HOÀNG MAI', ...labelOpts })] }),
            new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0, before: 0 }, children: [] }),
          ],
        }),
        new TableCell({
          width: { size: HEADER_HALF, type: WidthType.DXA },
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 }, children: [new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', ...labelItalic })] }),
          ],
        }),
      ],
    }),
  ],
}));

// ===== Spacer paragraphs after header table =====
children.push(
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0, before: 0 }, children: [] }),
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 0, before: 0 },
    children: [new TextRun({ text: '                                               ', size: 22 })],
  }),
  emptyP(),
);

// ===== Title =====
children.push(
  new Paragraph({
    spacing: { after: 120, before: 0 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'GIẤY ĐỀ NGHỊ SỬ DỤNG XE', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 28, bold: true })],
  }),
);

// ===== Kính gửi =====
children.push(
  new Paragraph({
    spacing: { after: 200, before: 0 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Kính gửi: Ban Giám đốc Chi nhánh Hoàng Mai', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24, bold: true })],
  }),
  new Paragraph({
    spacing: { after: 200, before: 0 },
    alignment: AlignmentType.CENTER,
    children: [],
  }),
);

// ===== Body — giãn dòng 1.5 lines =====
const BODY_LINE = 360;
children.push(
  new Paragraph({
    spacing: { after: 0, before: 0, line: BODY_LINE },
    children: [
      new TextRun({ text: 'Họ tên: ', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24 }),
      new TextRun({ text: 'Lê Thị Minh Huyền', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24, bold: true }),
    ],
  }),
  new Paragraph({
    spacing: { after: 0, before: 0, line: BODY_LINE },
    children: [
      new TextRun({ text: 'Đơn vị (phòng/ban): ', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24 }),
      new TextRun({ text: 'Phòng KHDN', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24, bold: true }),
    ],
  }),
  new Paragraph({
    spacing: { after: 0, before: 0, line: BODY_LINE },
    alignment: AlignmentType.LEFT,
    children: [new TextRun({ text: 'Thực hiện kế hoạch công tác đã được Ban lãnh đạo phê duyệt.', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24 })],
  }),
  new Paragraph({
    spacing: { after: 0, before: 0, line: BODY_LINE },
    alignment: AlignmentType.LEFT,
    children: [new TextRun({ text: '- Số lượng xe ô tô: 01 chiếc', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24 })],
  }),
  new Paragraph({
    spacing: { after: 0, before: 0, line: BODY_LINE },
    alignment: AlignmentType.LEFT,
    children: [new TextRun({ text: '- Số người sử dụng xe: 03 người, gồm:', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24 })],
  }),
  emptyP(),
);

// ===== Participants — bảng 3 cột, không viền =====
function makeParticipantTable(list) {
  const sorted = [...list].sort((a, b) => {
    const roleOrder = { director: 0, manager: 1, staff: 2, secretary: 3 };
    return (roleOrder[a.profile.role] ?? 99) - (roleOrder[b.profile.role] ?? 99);
  });
  const nameCellW = Math.floor(STD_AVAIL * 0.50);
  const numCellW = Math.floor(STD_AVAIL * 0.03);
  const titleCellW = Math.floor(STD_AVAIL * 0.47);

  return new Table({
    layout: FIXED,
    width: { size: STD_AVAIL, type: WidthType.DXA },
    borders: {
      top: noBorder, left: noBorder, bottom: noBorder, right: noBorder,
      insideHorizontal: noBorder, insideVertical: noBorder,
    },
    rows: sorted.map((entry, idx) => {
      const profile = entry.profile;
      const h = honorific(profile.gender);
      return new TableRow({
        children: [
          new TableCell({
            width: { size: numCellW, type: WidthType.DXA },
            children: [new Paragraph({ spacing: { after: 0, before: 0, line: BODY_LINE }, children: [new TextRun({ text: `${idx + 1}.`, font: { name: 'Times New Roman', hint: 'eastAsia' } })] })],
          }),
          new TableCell({
            width: { size: nameCellW, type: WidthType.DXA },
            children: [new Paragraph({ spacing: { after: 0, before: 0, line: BODY_LINE }, children: [new TextRun({ text: `${h}${profile.full_name}  `, font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24 })] })],
          }),
          new TableCell({
            width: { size: titleCellW, type: WidthType.DXA },
            children: [new Paragraph({ spacing: { after: 0, before: 0, line: BODY_LINE }, children: [new TextRun({ text: `Chức vụ: ${profile.title || (profile.role === 'director' ? 'Lãnh đạo' : 'Cán bộ')}`, font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24 })] })],
          }),
        ],
      });
    }),
  });
}

children.push(makeParticipantTable(participants));

// ===== Time / Location / Reason =====
const d = new Date(start_time);
const timeStr = `${zeroPad(d.getHours())} giờ ${zeroPad(d.getMinutes())} ngày ${zeroPad(d.getDate())} tháng ${zeroPad(d.getMonth() + 1)} năm ${d.getFullYear()}`;

children.push(
  emptyP(),
  new Paragraph({
    spacing: { after: 0, before: 0, line: BODY_LINE },
    children: [new TextRun({ text: `- Thời gian: Từ: ${timeStr}`, font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24 })],
  }),
  new Paragraph({
    spacing: { after: 0, before: 0, line: BODY_LINE },
    children: [new TextRun({ text: `- Nơi đến công tác: ${location}`, font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24 })],
  }),
  new Paragraph({
    spacing: { after: 0, before: 0, line: BODY_LINE },
    children: [new TextRun({ text: `- Lý do công tác: ${title}${description ? ` - ${description}` : ''}`, font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24 })],
  }),
);

// ===== Date =====
const signingDate = `ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
children.push(
  emptyP(),
  new Paragraph({
    spacing: { after: 60, before: 0 },
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: `Hà Nội, ${signingDate}`, font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24, italics: true })],
  }),
);

// ===== Signature — bảng 2x2, fixed layout 50/50, không viền, row cao =====
const sigNoBorder = { style: BorderStyle.NONE, size: 0 };
children.push(new Table({
  layout: FIXED,
  width: { size: STD_AVAIL, type: WidthType.DXA },
  borders: {
    top: sigNoBorder, left: sigNoBorder, bottom: sigNoBorder, right: sigNoBorder,
    insideHorizontal: sigNoBorder, insideVertical: sigNoBorder,
  },
  rows: [
    // Row 0: XÁC NHẬN TRƯỞNG PHÒNG/BAN | NGƯỜI ĐỀ NGHỊ
    new TableRow({
      height: { value: 2200, rule: "atLeast" },
      children: [
        new TableCell({
          width: { size: 4513, type: WidthType.DXA },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 }, children: [new TextRun({ text: 'XÁC NHẬN TRƯỞNG PHÒNG/BAN', ...labelOpts })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 }, children: [new TextRun({ text: 'QUẢN LÝ CÁN BỘ', ...labelOpts })] }),
            new Paragraph({ spacing: { before: 600 }, children: [] }),
          ],
        }),
        new TableCell({
          width: { size: 4513, type: WidthType.DXA },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 }, children: [new TextRun({ text: 'NGƯỜI ĐỀ NGHỊ', ...labelOpts })] }),
            new Paragraph({ spacing: { before: 600 }, children: [] }),
          ],
        }),
      ],
    }),
    // Row 1: PHÒNG TCTH | GIÁM ĐỐC DUYỆT
    new TableRow({
      height: { value: 1800, rule: "atLeast" },
      children: [
        new TableCell({
          width: { size: 4513, type: WidthType.DXA },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 }, children: [new TextRun({ text: 'PHÒNG TCTH', ...labelOpts })] }),
            new Paragraph({ spacing: { before: 500 }, children: [] }),
          ],
        }),
        new TableCell({
          width: { size: 4513, type: WidthType.DXA },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 }, children: [new TextRun({ text: 'GIÁM ĐỐC DUYỆT', ...labelOpts })] }),
            new Paragraph({ spacing: { before: 500 }, children: [] }),
          ],
        }),
      ],
    }),
  ],
}));

// ===== Final empty paragraph =====
children.push(emptyP());

// ===== Document =====
const doc = new Document({
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: STD_MARGIN, right: STD_MARGIN, bottom: STD_MARGIN, left: STD_MARGIN },
      },
    },
    children,
  }],
});

async function main() {
  const buf = await Packer.toBuffer(doc);
  const outPath = './_test-output.docx';
  fs.writeFileSync(outPath, buf);
  console.log('✅ Generated: ' + outPath);
}
main().catch(console.error);
