import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel cron job — kiểm tra công việc quá hạn, sắp đến hạn, auto-complete lịch.
// Must be configured in vercel.json: { "crons": [{ "path": "/api/cron/notifications", "schedule": "0 8 * * *" }] }

export async function GET(request: Request) {
  try {
    // Validate cron secret if deployed
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Thiếu biến môi trường: cần NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const notifications: any[] = [];
    const now = new Date();

    // 0. AUTO-ARCHIVE & CLEANUP định kỳ
    try {
      await supabase.rpc('auto_archive_and_cleanup');
    } catch (cleanupErr) {
      console.error('Auto-archive error:', cleanupErr);
    }

    // 0.5. Fallback recurring fire (nếu pg_cron chưa enable)
    try {
      await supabase.rpc('recurring_fire_due');
    } catch (recurringErr) {
      console.error('Recurring fire error:', recurringErr);
    }

    // 0.6. Auto-complete lịch họp / sự kiện / nghỉ phép không dùng xe đã quá end_time 15 phút.
    // Lịch công tác / lịch xe để lái xe hoặc điều phối xác nhận thực tế.
    let completedSchedules = 0;
    try {
      const { data, error } = await supabase.rpc('complete_finished_schedules');
      if (error) throw error;
      completedSchedules = data ?? 0;
    } catch (scheduleCompleteErr) {
      console.error('Schedule auto-complete error:', scheduleCompleteErr);
    }

    // 0.7. Reminder lịch trình & công việc sắp diễn ra (fallback khi pg_cron chưa enable)
    let remindersSent = 0;
    try {
      const { data, error } = await supabase.rpc('check_reminders');
      if (error) throw error;
      remindersSent = data ?? 0;
    } catch (reminderErr) {
      console.error('Check reminders error:', reminderErr);
    }

    // 1. CHECK OVERDUE TASKS — chỉ notify, KHÔNG mark status='late' (late là derived)
    const { data: overdueTasks } = await supabase
      .from('tasks')
      .select('id, title, assignee_id, created_by, due_date, status')
      .lt('due_date', now.toISOString())
      .not('status', 'in', '(done,canceled,submitted)')
      .eq('is_archived', false);

    if (overdueTasks && overdueTasks.length > 0) {
      overdueTasks.forEach(task => {
        if (task.assignee_id) {
          notifications.push({
            user_id: task.assignee_id,
            title: 'Công việc quá hạn',
            content: `Công việc "${task.title}" của bạn đã quá hạn. Vui lòng cập nhật tiến độ ngay!`,
            link: `/dashboard/tasks/${task.id}`
          });
        }
        if (task.created_by && task.created_by !== task.assignee_id) {
          notifications.push({
            user_id: task.created_by,
            title: 'Cảnh báo quá hạn',
            content: `Công việc "${task.title}" mà bạn giao đã bị quá hạn.`,
            link: `/dashboard/tasks/${task.id}`
          });
        }
      });
    }

    // 2. CHECK APPROACHING DEADLINES (Due in next 24 hours)
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: upcomingTasks } = await supabase
      .from('tasks')
      .select('id, title, assignee_id')
      .gte('due_date', now.toISOString())
      .lte('due_date', tomorrow.toISOString())
      .not('status', 'in', '(done,canceled,submitted)')
      .eq('is_archived', false);

    if (upcomingTasks && upcomingTasks.length > 0) {
      upcomingTasks.forEach(task => {
        if (task.assignee_id) {
          notifications.push({
            user_id: task.assignee_id,
            title: 'Sắp đến hạn',
            content: `Công việc "${task.title}" sẽ đến hạn vào ngày mai. Hãy đảm bảo hoàn thành nhé!`,
            link: `/dashboard/tasks/${task.id}`
          });
        }
      });
    }

    // 3. CHECK BIRTHDAYS + ANNIVERSARIES — TOÀN CHI NHÁNH
    // Bỏ filter department; driver không nhận; opt-out không bị thông báo ra ngoài; chính chủ thể bỏ qua noti người khác.
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, birthday, branch_join_date, role, birthday_notify_optout, is_active')
      .eq('is_active', true);

    if (profiles && profiles.length > 0) {
      const audience = profiles.filter(p => p.role !== 'driver');

      // ⛔ TẠM ẨN: Sinh nhật & Kỷ niệm — chưa cần thiết
      /*
      // 3.A. BIRTHDAY — toàn chi nhánh
      ...
      */
    }

    // 4. CLEANUP EXPIRED OUT_OF_OFFICE
    try {
      await supabase.rpc('cleanup_expired_ooo');
    } catch (oooErr) {
      console.error('Cleanup OOO error:', oooErr);
    }

    // Insert all notifications
    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }

    return NextResponse.json({
      success: true,
      processed_overdue: overdueTasks?.length || 0,
      processed_upcoming: upcomingTasks?.length || 0,
      completed_schedules: completedSchedules,
      reminders_sent: remindersSent,
      notifications_sent: notifications.length
    });

  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
