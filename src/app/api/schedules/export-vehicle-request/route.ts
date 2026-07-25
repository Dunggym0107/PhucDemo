import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, TableLayoutType,
} from 'docx';
import * as nodemailer from 'nodemailer';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const SCHEDULE_SELECT = `*, metadata, creator:profiles!schedules_created_by_fkey(full_name, title, avatar_url, department_id, role, is_department_head, phone), department:departments!schedules_department_id_fkey(name), vehicle:vehicles(name, plate_number, type), driver:profiles!schedules_driver_id_fkey(id, full_name, title, phone), participants:schedule_participants(profile:profiles(id, full_name, title, avatar_url, role, is_department_head, phone))`;

function formatDateTime(iso: string): { time: string; date: string; full: string } {
  const d = new Date(iso);
  const vn = toVietnamTime(d);
  const h = vn.h.toString().padStart(2, '0');
  const m = vn.m.toString().padStart(2, '0');
  const day = vn.d;
  const month = vn.M;
  const year = vn.y;
  return {
    time: `${h} giờ ${m}`,
    date: `ngày ${day} tháng ${month} năm ${year}`,
    full: `${h} giờ ${m} ngày ${day} tháng ${month} năm ${year}`,
  };
}

/** Chuyển Date về múi giờ Việt Nam (UTC+7) */
function toVietnamTime(date: Date): { h: number; m: number; d: number; M: number; y: number } {
  const vietnamOffset = 7 * 60 * 60 * 1000;
  const vn = new Date(date.getTime() + vietnamOffset);
  return {
    h: vn.getUTCHours(),
    m: vn.getUTCMinutes(),
    d: vn.getUTCDate(),
    M: vn.getUTCMonth() + 1,
    y: vn.getUTCFullYear(),
  };
}

async function generateVehicleRequestDocx(schedule: any): Promise<Buffer> {
  const creator = schedule.creator || {};
  const department = schedule.department || {};
  const participants = schedule.participants || [];
  const startFmt = formatDateTime(schedule.start_time);

  const participantList = participants
    .map((p: any) => p.profile)
    .filter(Boolean);

  const sortedParticipants = [...participantList].sort((a: any, b: any) => {
    const roleOrder: Record<string, number> = { director: 0, manager: 1, staff: 2, secretary: 3 };
    return (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
  });

  // prettier-ignore
  const children: any[] = [];

  // --- Helpers ---
  const emptyP = () =>
    new Paragraph({
      spacing: { after: 0, before: 0 },
      children: [new TextRun({ text: '', size: 24 })],
    });

  const BODY_LINE = 360; // 1.5 line spacing
  const labelOpts = { font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 22, bold: true };
  const labelItalic = { font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 22, italics: true };

  function honorific(gender?: string): string {
    if (gender === 'male') return 'Ông ';
    if (gender === 'female') return 'Bà ';
    return '';
  }

  function zeroPad(n: number, len = 2): string {
    return n.toString().padStart(len, '0');
  }

  // ===== PAGE SETUP =====
  const PAGE_W = 11906;
  const STD_MARGIN = 1440;           // 1 inch
  const STD_AVAIL = PAGE_W - 2 * STD_MARGIN;   // 9026 DXA
  const HEADER_MARGIN = 864;          // 0.6 inch
  const HEADER_AVAIL = PAGE_W - 2 * HEADER_MARGIN; // 10178 DXA
  const HEADER_HALF = Math.floor(HEADER_AVAIL / 2); // 5089 DXA
  const noBorder = { style: BorderStyle.NONE, size: 0 };
  const FIXED = TableLayoutType.FIXED;

  // ===== HEADER — bảng 2x2, fixed, tràn margin =====
  children.push(new Table({
    layout: FIXED,
    width: { size: HEADER_AVAIL, type: WidthType.DXA },
    borders: {
      top: noBorder, left: noBorder, bottom: noBorder, right: noBorder,
      insideHorizontal: noBorder, insideVertical: noBorder,
    },
    rows: [
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

  // ===== Body — giãn dòng 1.5 =====
  children.push(
    new Paragraph({
      spacing: { after: 0, before: 0, line: BODY_LINE },
      children: [
        new TextRun({ text: 'Họ tên: ', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24 }),
        new TextRun({ text: creator.full_name || '..............................................', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24, bold: true }),
      ],
    }),
    new Paragraph({
      spacing: { after: 0, before: 0, line: BODY_LINE },
      children: [
        new TextRun({ text: 'Đơn vị (phòng/ban): ', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24 }),
        new TextRun({ text: department.name || '..................................................', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24, bold: true }),
      ],
    }),
    new Paragraph({
      spacing: { after: 0, before: 0, line: BODY_LINE },
      children: [new TextRun({ text: 'Thực hiện kế hoạch công tác đã được Ban lãnh đạo phê duyệt.', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24 })],
    }),
    new Paragraph({
      spacing: { after: 0, before: 0, line: BODY_LINE },
      children: [new TextRun({ text: '- Số lượng xe ô tô: 01 chiếc', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24 })],
    }),
    new Paragraph({
      spacing: { after: 0, before: 0, line: BODY_LINE },
      children: [new TextRun({ text: `- Số người sử dụng xe: ${zeroPad(sortedParticipants.length)} người, gồm:`, font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24 })],
    }),
    emptyP(),
  );

  // ===== Participants — bảng 3 cột, fixed =====
  const nameCellW = Math.floor(STD_AVAIL * 0.50);
  const numCellW = Math.floor(STD_AVAIL * 0.03);
  const titleCellW = Math.floor(STD_AVAIL * 0.47);

  children.push(new Table({
    layout: FIXED,
    width: { size: STD_AVAIL, type: WidthType.DXA },
    borders: {
      top: noBorder, left: noBorder, bottom: noBorder, right: noBorder,
      insideHorizontal: noBorder, insideVertical: noBorder,
    },
    rows: sortedParticipants.map((profile: any, idx: number) => {
      const h = honorific(profile.gender);
      const displayTitle = profile.title || (profile.role === 'director' ? 'Lãnh đạo' : 'Cán bộ');
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
            children: [new Paragraph({ spacing: { after: 0, before: 0, line: BODY_LINE }, children: [new TextRun({ text: `Chức vụ: ${displayTitle}`, font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24 })] })],
          }),
        ],
      });
    }),
  }));

  // ===== Time / Location / Reason =====
  const d = new Date(schedule.start_time);
  const vn = toVietnamTime(d);
  const timeStr = `${zeroPad(vn.h)} giờ ${zeroPad(vn.m)} ngày ${zeroPad(vn.d)} tháng ${zeroPad(vn.M)} năm ${vn.y}`;
  const destinations = schedule.metadata?.destinations;
  const location = destinations
    ? destinations.map((dd: any) => dd.location).filter(Boolean).join(', ')
    : schedule.location || '';
  const reason = schedule.title || '';
  const desc = schedule.description ? ` - ${schedule.description}` : '';

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
      children: [new TextRun({ text: `- Lý do công tác: ${reason}${desc}`, font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24 })],
    }),
  );

  // ===== Date =====
  const signingDate = `ngày ${vn.d} tháng ${vn.M} năm ${vn.y}`;
  children.push(
    emptyP(),
    new Paragraph({
      spacing: { after: 60, before: 0 },
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `Hà Nội, ${signingDate}`, font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24, italics: true })],
    }),
  );

  // ===== Signature — bảng 2x2, fixed, row cao =====
  const sigHalf = Math.floor(STD_AVAIL / 2);
  children.push(new Table({
    layout: FIXED,
    width: { size: STD_AVAIL, type: WidthType.DXA },
    borders: {
      top: noBorder, left: noBorder, bottom: noBorder, right: noBorder,
      insideHorizontal: noBorder, insideVertical: noBorder,
    },
    rows: [
      new TableRow({
        height: { value: 2200, rule: 'atLeast' },
        children: [
          new TableCell({
            width: { size: sigHalf, type: WidthType.DXA },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 }, children: [new TextRun({ text: 'XÁC NHẬN TRƯỞNG PHÒNG/BAN', ...labelOpts })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 }, children: [new TextRun({ text: 'QUẢN LÝ CÁN BỘ', ...labelOpts })] }),
              new Paragraph({ spacing: { before: 600 }, children: [] }),
            ],
          }),
          new TableCell({
            width: { size: sigHalf, type: WidthType.DXA },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 }, children: [new TextRun({ text: 'NGƯỜI ĐỀ NGHỊ', ...labelOpts })] }),
              new Paragraph({ spacing: { before: 600 }, children: [] }),
            ],
          }),
        ],
      }),
      new TableRow({
        height: { value: 1800, rule: 'atLeast' },
        children: [
          new TableCell({
            width: { size: sigHalf, type: WidthType.DXA },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 }, children: [new TextRun({ text: 'PHÒNG TCTH', ...labelOpts })] }),
              new Paragraph({ spacing: { before: 500 }, children: [] }),
            ],
          }),
          new TableCell({
            width: { size: sigHalf, type: WidthType.DXA },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 }, children: [new TextRun({ text: 'GIÁM ĐỐC DUYỆT', ...labelOpts })] }),
              new Paragraph({ spacing: { before: 500 }, children: [] }),
            ],
          }),
        ],
      }),
    ],
  }));

  children.push(emptyP());

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: STD_MARGIN, right: STD_MARGIN, bottom: STD_MARGIN, left: STD_MARGIN },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

async function sendEmailWithAttachment(params: {
  to: string[];
  subject: string;
  text: string;
  attachmentBuffer: Buffer;
  filename: string;
}) {
  const { to, subject, text, attachmentBuffer, filename } = params;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error(
      'Thiếu cấu hình SMTP. Vui lòng đặt:\n'
      + 'SMTP_HOST (ví dụ: smtp.gmail.com)\\n'
      + 'SMTP_PORT (ví dụ: 587)\n'
      + 'SMTP_USER (email gửi)\n'
      + 'SMTP_PASS (SMTP key/password)'
    );
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: `"Workflow - Chi nhánh Hoàng Mai" <${smtpUser}>`,
    to: to.join(', '),
    subject,
    text,
    attachments: [{ filename, content: attachmentBuffer }],
  });
}

export async function POST(request: Request) {
  console.log('[VEHICLE-REQUEST] POST handler called, checking env:', {
    SMTP_HOST: process.env.SMTP_HOST ? 'set' : 'unset',
    SMTP_USER: process.env.SMTP_USER ? 'set' : 'unset',
    SMTP_PASS: process.env.SMTP_PASS ? 'set' : 'unset',
  });
  try {
    const { scheduleId, recipients, profileIds } = await request.json();

    if (!scheduleId) {
      return NextResponse.json({ success: false, error: 'Thiếu scheduleId' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: 'Thiếu cấu hình Supabase (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: schedule, error } = await supabase
      .from('schedules')
      .select(SCHEDULE_SELECT)
      .eq('id', scheduleId)
      .single();

    if (error || !schedule) {
      return NextResponse.json(
        { success: false, error: error?.message || 'Không tìm thấy lịch trình' },
        { status: 404 }
      );
    }

    if (schedule.type !== 'trip') {
      return NextResponse.json(
        { success: false, error: 'Chỉ hỗ trợ xuất giấy đề nghị xe cho lịch công tác' },
        { status: 400 }
      );
    }

    // Generate docx
    const docxBuffer = await generateVehicleRequestDocx(schedule);

    // Determine recipients: từ profileIds + recipients (manual email)
    let toList: string[] = [];

    // 1. Resolve emails from profileIds via auth.users (service_role key)
    if (profileIds && Array.isArray(profileIds) && profileIds.length > 0) {
      try {
        // Use Supabase Auth Admin API to get user emails
        const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) throw authError;

        if (authData?.users) {
          const emailMap = new Map<string, string>();
          for (const u of authData.users) {
            if (u.email) emailMap.set(u.id, u.email);
          }
          toList = profileIds.map((id: string) => emailMap.get(id)).filter((e): e is string => !!e);
        }
      } catch (err: any) {
        console.error('[VEHICLE-REQUEST] Error fetching user emails:', err);
        throw new Error('Không thể lấy email người nhận từ hệ thống.');
      }
    }

    // 2. Merge manually typed recipients
    if (recipients && Array.isArray(recipients) && recipients.length > 0) {
      const manualEmails = recipients.filter((e: string) => e.trim());
      toList = [...toList, ...manualEmails];
    }

    // 3. Deduplicate
    toList = Array.from(new Set(toList));

    // 4. Fallback: SMTP_RECIPIENT env var
    if (toList.length === 0 && process.env.SMTP_RECIPIENT) {
      toList = process.env.SMTP_RECIPIENT.split(',').map((s: string) => s.trim());
    }

    if (toList.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'Đã tạo file docx thành công. Không có người nhận email nào được cấu hình.',
          requiresRecipient: true,
        },
        { status: 200 }
      );
    }

    const creator = schedule.creator || {};
    const startFmt = formatDateTime(schedule.start_time);
    const subject = `Giấy đề nghị sử dụng xe - ${creator.full_name || ''} - ${startFmt.date}`;
    const text = `Kính gửi Ban Giám đốc,\n\nĐề nghị phê duyệt sử dụng xe cho chuyến công tác:\n`
      + `- Người đề nghị: ${creator.full_name || ''}\n`
      + `- Thời gian: ${startFmt.full}\n`
      + `- Địa điểm: ${schedule.location || ''}\n`
      + `- Lý do: ${schedule.title || ''}\n\nFile đính kèm: Giấy đề nghị sử dụng xe.`;

    await sendEmailWithAttachment({
      to: toList,
      subject,
      text,
      attachmentBuffer: docxBuffer,
      filename: `Giay_de_nghi_xe_${format(new Date(schedule.start_time), 'yyyyMMdd_HHmm')}.docx`,
    });

    return NextResponse.json({ success: true, message: 'Đã gửi email thành công' });
  } catch (error: any) {
    console.error('Export vehicle request error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi không xác định' },
      { status: 500 }
    );
  }
}
