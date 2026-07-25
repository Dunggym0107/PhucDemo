-- =====================================================================
-- BẢN CẬP NHẬT DATABASE CHO NGHIỆP VỤ TASKS
-- Hãy copy toàn bộ nội dung file này và chạy trong Supabase SQL Editor
-- =====================================================================

-- 1. Cập nhật trigger guard_task_status_transition để cho phép người giao đóng task chưa nhận (todo -> done)
CREATE OR REPLACE FUNCTION guard_task_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid                 UUID := auth.uid();
  v_role                TEXT;
  v_dept                UUID;
  v_creator_dept        UUID;
  v_is_creator          BOOLEAN;
  v_is_creator_manager  BOOLEAN;
  v_is_assignee_manager BOOLEAN;
  v_is_top_admin        BOOLEAN;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;

    IF OLD.status = 'todo' AND NEW.status = 'done' THEN
      SELECT department_id INTO v_creator_dept FROM profiles WHERE id = OLD.created_by;
      
      v_is_creator          := (OLD.created_by = v_uid);
      v_is_creator_manager  := (v_role = 'manager' AND v_dept = v_creator_dept);
      v_is_assignee_manager := (v_role = 'manager' AND v_dept = OLD.department_id);
      v_is_top_admin        := (v_role IN ('admin', 'director'));

      IF NOT (v_is_creator OR v_is_creator_manager OR v_is_assignee_manager OR v_is_top_admin) THEN
        RAISE EXCEPTION 'Công việc phải chuyển sang Đang làm trước khi hoàn thành';
      END IF;
    END IF;

    IF OLD.status = 'done' AND NEW.status = 'doing' THEN
      SELECT department_id INTO v_creator_dept FROM profiles WHERE id = OLD.created_by;
      
      v_is_creator          := (OLD.created_by = v_uid);
      v_is_creator_manager  := (v_role = 'manager' AND v_dept = v_creator_dept);
      v_is_assignee_manager := (v_role = 'manager' AND v_dept = OLD.department_id);
      v_is_top_admin        := (v_role IN ('admin', 'director'));

      IF NOT (v_is_creator OR v_is_creator_manager OR v_is_assignee_manager OR v_is_top_admin) THEN
        RAISE EXCEPTION 'Bạn không có quyền mở lại công việc';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;


-- 2. Cập nhật RPC task_update_status để tự động chèn cờ is_force_completed_todo vào metadata
CREATE OR REPLACE FUNCTION task_update_status(
  p_task_id    UUID,
  p_new_status task_status,
  p_comment    TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid            UUID := auth.uid();
  v_role           TEXT;
  v_dept           UUID;
  v_actor_name     TEXT;
  v_task           tasks%ROWTYPE;
  v_creator_dept   UUID;
  v_is_creator      BOOLEAN;
  v_is_assignee     BOOLEAN;
  v_is_head_manager BOOLEAN;
  v_is_creator_head BOOLEAN;
  v_is_top_admin    BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  
  SELECT role, department_id, full_name INTO v_role, v_dept, v_actor_name FROM profiles WHERE id = v_uid;
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  IF v_task.status = 'canceled' OR v_task.is_archived THEN RAISE EXCEPTION 'Công việc đã bị huỷ hoặc lưu trữ'; END IF;

  SELECT department_id INTO v_creator_dept FROM profiles WHERE id = v_task.created_by;

  v_is_creator      := (v_task.created_by = v_uid);
  v_is_assignee     := EXISTS (SELECT 1 FROM task_assignees WHERE task_id = p_task_id AND user_id = v_uid);
  v_is_head_manager := (v_role = 'manager' AND v_dept = v_task.department_id);
  v_is_creator_head := (v_role = 'manager' AND v_dept = v_creator_dept);
  v_is_top_admin    := (v_role IN ('admin', 'director'));

  IF p_new_status = 'doing' THEN
    IF NOT v_is_assignee THEN RAISE EXCEPTION 'Chỉ người được giao mới được nhận công việc'; END IF;
    IF v_task.status <> 'todo' THEN RAISE EXCEPTION 'Công việc đã được bắt đầu trước đó'; END IF;
    UPDATE tasks SET status = p_new_status WHERE id = p_task_id;
  ELSIF p_new_status = 'submitted' THEN
    IF NOT v_is_assignee THEN RAISE EXCEPTION 'Chỉ người được giao mới được gửi kết quả'; END IF;
    IF v_task.status <> 'doing' THEN RAISE EXCEPTION 'Công việc cần đang thực hiện trước khi gửi kết quả'; END IF;
    UPDATE tasks SET status = p_new_status WHERE id = p_task_id;
  ELSIF p_new_status = 'done' THEN
    IF v_task.requires_approval AND v_task.status = 'submitted' THEN
      IF NOT (v_is_head_manager OR v_is_creator OR v_is_creator_head) THEN RAISE EXCEPTION 'Bạn không có quyền duyệt kết quả'; END IF;
    ELSIF v_task.status IN ('todo','doing') THEN
      IF NOT (v_is_assignee OR v_is_creator OR v_is_creator_head OR v_is_top_admin) THEN RAISE EXCEPTION 'Bạn không có quyền hoàn thành công việc này'; END IF;
    ELSE
      RAISE EXCEPTION 'Không thể hoàn thành từ trạng thái hiện tại';
    END IF;

    IF v_task.status = 'todo' THEN
      UPDATE tasks 
      SET status = p_new_status,
          metadata = COALESCE(metadata, '{}'::jsonb) || '{"is_force_completed_todo": true}'::jsonb
      WHERE id = p_task_id;
    ELSE
      UPDATE tasks SET status = p_new_status WHERE id = p_task_id;
    END IF;
  ELSIF p_new_status = 'todo' THEN
    IF NOT v_is_head_manager THEN RAISE EXCEPTION 'Chỉ Trưởng phòng được đặt lại trạng thái Chưa làm'; END IF;
    UPDATE tasks SET status = p_new_status WHERE id = p_task_id;
  ELSE
    RAISE EXCEPTION 'Trạng thái không hợp lệ: %', p_new_status;
  END IF;

  IF p_new_status = 'done' THEN
    INSERT INTO task_comments (task_id, user_id, content) VALUES (p_task_id, v_uid, v_actor_name || ' đã hoàn thành.');
  ELSIF p_new_status = 'doing' AND p_comment IS NOT NULL AND length(trim(p_comment)) > 0 THEN
    INSERT INTO task_comments (task_id, user_id, content) VALUES (p_task_id, v_uid, v_actor_name || ' trả về công việc. Lý do: ' || p_comment);
  ELSIF p_comment IS NOT NULL AND length(trim(p_comment)) > 0 THEN
    INSERT INTO task_comments (task_id, user_id, content) VALUES (p_task_id, v_uid, p_comment);
  END IF;
END $$;


-- 3. Redefine RPC task_update để hỗ trợ chỉnh sửa đầy đủ thông tin của công việc
DROP FUNCTION IF EXISTS task_update(UUID, TEXT, TEXT, task_priority, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION task_update(
  p_task_id           UUID,
  p_title             TEXT,
  p_description       TEXT DEFAULT NULL,
  p_priority          task_priority DEFAULT 'medium',
  p_due_date          TIMESTAMPTZ DEFAULT NULL,
  p_dept_id           UUID DEFAULT NULL,
  p_assignee_ids      UUID[] DEFAULT NULL,
  p_requires_approval BOOLEAN DEFAULT FALSE
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_role          TEXT;
  v_dept          UUID;
  v_dept_code     TEXT;
  v_is_head       BOOLEAN;
  v_is_hub        BOOLEAN;
  v_task          tasks%ROWTYPE;
  v_creator_dept  UUID;
  v_dept_assignee UUID;
  v_creator_name  TEXT;
  v_a             UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  
  SELECT p.role, p.department_id, d.code, COALESCE(p.is_department_head, FALSE), p.full_name
    INTO v_role, v_dept, v_dept_code, v_is_head, v_creator_name
  FROM profiles p
  LEFT JOIN departments d ON d.id = p.department_id
  WHERE p.id = v_uid;

  v_is_hub := COALESCE(v_dept_code IN ('13618', '13601', '13602', '13605', '13609', '13603'), FALSE);

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  IF v_task.status = 'canceled' OR v_task.is_archived THEN RAISE EXCEPTION 'Không thể sửa công việc đã đóng hoặc đã lưu trữ'; END IF;
  
  SELECT department_id INTO v_creator_dept FROM profiles WHERE id = v_task.created_by;
  IF NOT (v_role IN ('admin','director') OR v_task.created_by = v_uid OR (v_role = 'manager' AND v_is_head AND v_dept = v_creator_dept)) THEN
    RAISE EXCEPTION 'Bạn không có quyền sửa công việc này';
  END IF;
  
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'Vui lòng nhập tiêu đề'; END IF;
  IF p_due_date IS NULL THEN RAISE EXCEPTION 'Vui lòng chọn hạn hoàn thành'; END IF;
  IF COALESCE(array_length(p_assignee_ids, 1), 0) = 0 AND p_dept_id IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận hoặc phòng ban';
  END IF;
  IF v_role = 'manager' AND NOT v_is_hub AND p_dept_id IS NOT NULL AND p_dept_id IS DISTINCT FROM v_dept THEN
    RAISE EXCEPTION 'Chỉ được giao công việc trong phòng mình';
  END IF;
  IF COALESCE(array_length(p_assignee_ids, 1), 0) > 0 AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = ANY(p_assignee_ids)
      AND (p.is_active IS DISTINCT FROM TRUE OR p.role IN ('admin', 'director', 'driver', 'secretary', 'hr_officer'))
  ) THEN
    RAISE EXCEPTION 'Người nhận không hợp lệ';
  END IF;
  IF COALESCE(array_length(p_assignee_ids, 1), 0) > 0
     AND v_role NOT IN ('admin', 'director')
     AND EXISTS (
       SELECT 1 FROM profiles p
       WHERE p.id = ANY(p_assignee_ids)
         AND p.department_id IS DISTINCT FROM v_dept
     ) THEN
    RAISE EXCEPTION 'Chỉ được chọn cán bộ trong phòng mình';
  END IF;

  IF COALESCE(array_length(p_assignee_ids, 1), 0) = 0 AND p_dept_id IS NOT NULL THEN
    v_dept_assignee := _resolve_default_assignee(p_dept_id);
    IF v_dept_assignee IS NULL THEN
      RAISE EXCEPTION 'Phòng nhận chưa có Trưởng phòng hoặc người nhận mặc định';
    END IF;
  END IF;

  UPDATE tasks
  SET title = trim(p_title), 
      description = NULLIF(trim(COALESCE(p_description, '')), ''),
      priority = COALESCE(p_priority, 'medium'), 
      due_date = p_due_date, 
      department_id = p_dept_id,
      assignee_id = CASE WHEN COALESCE(array_length(p_assignee_ids, 1), 0) > 0 THEN p_assignee_ids[1] ELSE v_dept_assignee END,
      requires_approval = COALESCE(p_requires_approval, FALSE),
      updated_at = NOW()
  WHERE id = p_task_id;

  -- Update task_assignees junction table (Insert new, then Delete old to prevent orphan cancel)
  IF COALESCE(array_length(p_assignee_ids, 1), 0) > 0 THEN
    FOREACH v_a IN ARRAY p_assignee_ids LOOP
      IF NOT EXISTS (SELECT 1 FROM task_assignees WHERE task_id = p_task_id AND user_id = v_a) THEN
        IF v_a <> v_uid THEN
          INSERT INTO notifications (user_id, title, content, type, link)
          VALUES (v_a, 'Bạn được giao công việc mới', v_creator_name || ' đã giao: ' || trim(p_title), 'task', '/dashboard/tasks?id=' || p_task_id::text);
        END IF;
      END IF;
      
      INSERT INTO task_assignees (task_id, user_id) VALUES (p_task_id, v_a)
      ON CONFLICT (task_id, user_id) DO NOTHING;
    END LOOP;

    DELETE FROM task_assignees 
    WHERE task_id = p_task_id 
      AND NOT (user_id = ANY(p_assignee_ids));
  ELSIF p_dept_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM task_assignees WHERE task_id = p_task_id AND user_id = v_dept_assignee) THEN
      IF v_dept_assignee <> v_uid THEN
        INSERT INTO notifications (user_id, title, content, type, link)
        VALUES (v_dept_assignee, 'Bạn có công việc mới', v_creator_name || ' đã giao: ' || trim(p_title), 'task', '/dashboard/tasks?id=' || p_task_id::text);
      END IF;
    END IF;
    
    INSERT INTO task_assignees (task_id, user_id) VALUES (p_task_id, v_dept_assignee)
    ON CONFLICT (task_id, user_id) DO NOTHING;

    DELETE FROM task_assignees 
    WHERE task_id = p_task_id 
      AND user_id <> v_dept_assignee;
  END IF;

END $$;

GRANT EXECUTE ON FUNCTION task_update(UUID, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], BOOLEAN) TO authenticated;


-- 4. Cập nhật RPC tasks_analytics để tính đúng số lượng trễ hạn (overdue)
CREATE OR REPLACE FUNCTION tasks_analytics(
  p_from DATE,
  p_to   DATE,
  p_dept_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_role          TEXT;
  v_dept          UUID;
  v_dept_code     TEXT;
  v_is_coordinator BOOLEAN;
  v_now           TIMESTAMPTZ := NOW();
  v_scope_dept    UUID;
  v_totals        JSONB;
  v_daily         JSONB;
  v_by_dept       JSONB;
  v_top           JSONB;
  v_top_overdue   JSONB;
  v_recur         INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;
  SELECT code INTO v_dept_code FROM departments WHERE id = v_dept;
  v_is_coordinator := v_dept_code = '13602';

  -- Permission gate
  IF NOT (
    v_role IN ('admin', 'director', 'manager')
    OR (v_role = 'staff' AND v_is_coordinator)
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền xem báo cáo';
  END IF;

  -- Scope:
  --   • admin/director/manager-điều-phối/staff-điều-phối → toàn nhánh (có thể filter dept)
  --   • manager ngoài phòng điều phối → chỉ dept mình (bỏ p_dept_id từ client)
  IF v_role = 'manager' AND NOT v_is_coordinator THEN
    v_scope_dept := v_dept;
  ELSE
    v_scope_dept := p_dept_id;
  END IF;

  WITH base AS (
    SELECT * FROM tasks
    WHERE created_at::date BETWEEN p_from AND p_to
      AND (v_scope_dept IS NULL OR department_id = v_scope_dept)
      AND is_archived = FALSE
  )
  SELECT jsonb_build_object(
    'completed',         COUNT(*) FILTER (WHERE status = 'done'),
    'overdue',           COUNT(*) FILTER (WHERE (due_date < v_now AND status NOT IN ('done','canceled')) OR (status = 'done' AND (updated_at > due_date OR COALESCE((metadata->>'is_force_completed_todo') = 'true', FALSE)))),
    'submitted_pending', COUNT(*) FILTER (WHERE status = 'submitted'),
    'extensions_pending', (
      SELECT COUNT(*) FROM task_extension_requests er
      JOIN tasks t ON t.id = er.task_id
      WHERE er.status = 'pending'
        AND t.created_at::date BETWEEN p_from AND p_to
        AND (v_scope_dept IS NULL OR t.department_id = v_scope_dept)
    ),
    'total',    COUNT(*),
    'canceled', COUNT(*) FILTER (WHERE status = 'canceled')
  )
  INTO v_totals FROM base;

  SELECT jsonb_agg(row_to_json(d.*) ORDER BY d.date)
  INTO v_daily
  FROM (
    SELECT d::date AS date,
           (SELECT COUNT(*) FROM tasks t
            WHERE t.created_at::date <= d
              AND t.status = 'done'
              AND t.updated_at::date = d
              AND (v_scope_dept IS NULL OR t.department_id = v_scope_dept)) AS count
    FROM generate_series(p_from, p_to, interval '1 day') AS d
  ) d;

  SELECT jsonb_agg(row_to_json(r.*) ORDER BY r.overdue DESC, r.active DESC)
  INTO v_by_dept
  FROM (
    SELECT dept.id AS dept_id, dept.name AS dept_name,
           COUNT(t.id) FILTER (WHERE t.status NOT IN ('done','canceled') AND t.is_archived = FALSE) AS active,
           COUNT(t.id) FILTER (WHERE ((t.due_date < v_now AND t.status NOT IN ('done','canceled')) OR (t.status = 'done' AND (t.updated_at > t.due_date OR COALESCE((t.metadata->>'is_force_completed_todo') = 'true', FALSE)))) AND t.is_archived = FALSE) AS overdue,
           COUNT(t.id) FILTER (WHERE t.status = 'done' AND t.updated_at::date BETWEEN p_from AND p_to) AS completed
    FROM departments dept
    LEFT JOIN tasks t ON t.department_id = dept.id
    WHERE (v_scope_dept IS NULL OR dept.id = v_scope_dept)
    GROUP BY dept.id, dept.name
    HAVING COUNT(t.id) > 0
  ) r;

  SELECT jsonb_agg(row_to_json(p.*) ORDER BY p.active DESC, p.overdue DESC)
  INTO v_top
  FROM (
    SELECT pr.id AS user_id, pr.full_name, pr.avatar_url,
           dpt.name AS department_name,
           COUNT(ta.task_id) FILTER (WHERE t.status NOT IN ('done','canceled') AND t.is_archived = FALSE) AS active,
           COUNT(ta.task_id) FILTER (WHERE ((t.due_date < v_now AND t.status NOT IN ('done','canceled')) OR (t.status = 'done' AND (t.updated_at > t.due_date OR COALESCE((t.metadata->>'is_force_completed_todo') = 'true', FALSE)))) AND t.is_archived = FALSE) AS overdue,
           COUNT(ta.task_id) FILTER (WHERE t.status = 'done' AND t.updated_at::date BETWEEN p_from AND p_to) AS completed
    FROM task_assignees ta
    JOIN tasks t ON t.id = ta.task_id
    JOIN profiles pr ON pr.id = ta.user_id
    LEFT JOIN departments dpt ON dpt.id = pr.department_id
    WHERE (v_scope_dept IS NULL OR t.department_id = v_scope_dept)
    GROUP BY pr.id, pr.full_name, pr.avatar_url, dpt.name
    HAVING COUNT(ta.task_id) FILTER (WHERE t.status NOT IN ('done','canceled') AND t.is_archived = FALSE) > 0
    ORDER BY active DESC
    LIMIT 10
  ) p;

  SELECT jsonb_agg(row_to_json(p.*) ORDER BY p.overdue DESC, p.active DESC)
  INTO v_top_overdue
  FROM (
    SELECT pr.id AS user_id, pr.full_name, pr.avatar_url,
           dpt.name AS department_name,
           COUNT(ta.task_id) FILTER (WHERE t.status NOT IN ('done','canceled') AND t.is_archived = FALSE) AS active,
           COUNT(ta.task_id) FILTER (WHERE ((t.due_date < v_now AND t.status NOT IN ('done','canceled')) OR (t.status = 'done' AND (t.updated_at > t.due_date OR COALESCE((t.metadata->>'is_force_completed_todo') = 'true', FALSE)))) AND t.is_archived = FALSE) AS overdue,
           COUNT(ta.task_id) FILTER (WHERE t.status = 'done' AND t.updated_at::date BETWEEN p_from AND p_to) AS completed
    FROM task_assignees ta
    JOIN tasks t ON t.id = ta.task_id
    JOIN profiles pr ON pr.id = ta.user_id
    LEFT JOIN departments dpt ON dpt.id = pr.department_id
    WHERE (v_scope_dept IS NULL OR t.department_id = v_scope_dept)
    GROUP BY pr.id, pr.full_name, pr.avatar_url, dpt.name
    HAVING COUNT(ta.task_id) FILTER (WHERE t.due_date < v_now AND t.status NOT IN ('done','canceled') AND t.is_archived = FALSE) > 0
    ORDER BY overdue DESC
    LIMIT 10
  ) p;

  SELECT COUNT(*) INTO v_recur
  FROM task_recurring_templates
  WHERE is_active = TRUE
    AND (v_scope_dept IS NULL
         OR v_scope_dept = ANY(target_department_ids)
         OR EXISTS (
           SELECT 1 FROM profiles p
           WHERE p.id = ANY(target_user_ids) AND p.department_id = v_scope_dept
         ));

  RETURN jsonb_build_object(
    'totals',          COALESCE(v_totals, '{}'::jsonb),
    'daily_completed', COALESCE(v_daily, '[]'::jsonb),
    'by_department',   COALESCE(v_by_dept, '[]'::jsonb),
    'top_people',      COALESCE(v_top, '[]'::jsonb),
    'top_overdue_people', COALESCE(v_top_overdue, '[]'::jsonb),
    'recurring_active', COALESCE(v_recur, 0),
    'role',            v_role,
    'scope_dept',      v_scope_dept,
    'from',            p_from,
    'to',              p_to
  );
END $$;

GRANT EXECUTE ON FUNCTION tasks_analytics(DATE, DATE, UUID) TO authenticated;


-- =====================================================
-- TASKS: bỏ người nhận mặc định trong mẫu định kỳ, chặn BGĐ làm phòng nhận
-- =====================================================

CREATE OR REPLACE FUNCTION _is_director_department(p_dept_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM departments d
    WHERE d.id = p_dept_id
      AND d.code = '13601'
  );
$$;

CREATE OR REPLACE FUNCTION guard_task_receiver_department()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.department_id IS NOT NULL AND _is_director_department(NEW.department_id) THEN
    RAISE EXCEPTION 'Ban Giám đốc không phải phòng nhận việc';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_task_receiver_department ON tasks;
CREATE TRIGGER trg_guard_task_receiver_department
  BEFORE INSERT OR UPDATE OF department_id ON tasks
  FOR EACH ROW EXECUTE FUNCTION guard_task_receiver_department();

CREATE OR REPLACE FUNCTION guard_recurring_template_receivers()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(NEW.target_department_ids, '{}'::uuid[])) AS dept_id
    WHERE _is_director_department(dept_id)
  ) THEN
    RAISE EXCEPTION 'Ban Giám đốc không phải phòng nhận việc định kỳ';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_recurring_template_receivers ON task_recurring_templates;
CREATE TRIGGER trg_guard_recurring_template_receivers
  BEFORE INSERT OR UPDATE OF target_department_ids ON task_recurring_templates
  FOR EACH ROW EXECUTE FUNCTION guard_recurring_template_receivers();

UPDATE task_recurring_templates t
SET target_department_ids = COALESCE((
  SELECT array_agg(dept_id)
  FROM unnest(t.target_department_ids) AS dept_id
  WHERE NOT _is_director_department(dept_id)
), '{}'::uuid[])
WHERE EXISTS (
  SELECT 1
  FROM unnest(COALESCE(t.target_department_ids, '{}'::uuid[])) AS dept_id
  WHERE _is_director_department(dept_id)
);

ALTER TABLE task_recurring_templates
  DROP COLUMN IF EXISTS default_assignee_id;

DROP FUNCTION IF EXISTS recurring_template_upsert(TEXT, TEXT, task_priority, UUID[], UUID[], TEXT, INT, TEXT, INT, TEXT, TEXT, INT, BOOLEAN, UUID, UUID);
DROP FUNCTION IF EXISTS recurring_template_upsert(TEXT, TEXT, task_priority, UUID[], UUID[], TEXT, INT, TEXT, INT, TEXT, TEXT, INT, BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION recurring_template_upsert(
  p_title                 TEXT,
  p_description           TEXT,
  p_priority              task_priority DEFAULT 'medium',
  p_target_department_ids UUID[] DEFAULT '{}',
  p_target_user_ids       UUID[] DEFAULT '{}',
  p_schedule_kind         TEXT DEFAULT 'weekly',
  p_weekly_dow            INT DEFAULT NULL,
  p_weekly_time           TEXT DEFAULT NULL,
  p_monthly_dom           INT DEFAULT NULL,
  p_monthly_time          TEXT DEFAULT NULL,
  p_timezone              TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  p_due_days_after_fire   INT DEFAULT 7,
  p_is_active             BOOLEAN DEFAULT TRUE,
  p_id                    UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_dept UUID;
  v_dept_code TEXT;
  v_is_hub BOOLEAN;
  v_id UUID;
  v_next TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT p.role, p.department_id, d.code INTO v_role, v_dept, v_dept_code
  FROM profiles p
  LEFT JOIN departments d ON d.id = p.department_id
  WHERE p.id = v_uid;

  v_is_hub := COALESCE(v_dept_code IN ('13618', '13601', '13602', '13605', '13609', '13603'), FALSE);

  IF v_role IN ('driver','secretary','hr_officer') OR (v_role = 'staff' AND NOT v_is_hub) THEN
    RAISE EXCEPTION 'Bạn không có quyền tạo công việc định kỳ';
  END IF;
  IF p_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM task_recurring_templates WHERE id = p_id AND created_by = v_uid) THEN
    RAISE EXCEPTION 'Bạn không có quyền sửa mẫu định kỳ này';
  END IF;
  IF COALESCE(array_length(p_target_department_ids,1),0) = 0 AND COALESCE(array_length(p_target_user_ids,1),0) = 0 THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận hoặc phòng ban';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_target_department_ids, '{}'::uuid[])) AS dept_id
    WHERE _is_director_department(dept_id)
  ) THEN
    RAISE EXCEPTION 'Ban Giám đốc không phải phòng nhận việc định kỳ';
  END IF;
  IF v_role = 'manager' AND NOT v_is_hub AND EXISTS (
    SELECT 1 FROM unnest(p_target_department_ids) AS target_dept_id
    WHERE target_dept_id IS DISTINCT FROM v_dept
  ) THEN
    RAISE EXCEPTION 'Chỉ được tạo công việc định kỳ trong phòng mình';
  END IF;
  IF COALESCE(array_length(p_target_user_ids,1),0) > 0 AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = ANY(p_target_user_ids)
      AND (p.is_active IS DISTINCT FROM TRUE OR p.role IN ('admin','director','driver','secretary','hr_officer'))
  ) THEN
    RAISE EXCEPTION 'Người nhận không hợp lệ';
  END IF;
  IF COALESCE(array_length(p_target_user_ids,1),0) > 0 AND v_role NOT IN ('admin','director') AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = ANY(p_target_user_ids)
      AND p.department_id IS DISTINCT FROM v_dept
  ) THEN
    RAISE EXCEPTION 'Chỉ được chọn cán bộ trong phòng mình';
  END IF;

  v_next := _recurring_next_run(p_schedule_kind, p_weekly_dow, p_weekly_time, p_monthly_dom, p_monthly_time, p_timezone, NOW());

  IF p_id IS NOT NULL THEN
    UPDATE task_recurring_templates SET
      title = trim(p_title),
      description = NULLIF(trim(COALESCE(p_description,'')), ''),
      priority = p_priority,
      target_department_ids = p_target_department_ids,
      target_user_ids = p_target_user_ids,
      schedule_kind = p_schedule_kind,
      weekly_dow = p_weekly_dow,
      weekly_time = p_weekly_time::TIME,
      monthly_dom = p_monthly_dom,
      monthly_time = p_monthly_time::TIME,
      timezone = p_timezone,
      due_days_after_fire = p_due_days_after_fire,
      is_active = p_is_active,
      next_run_at = v_next
    WHERE id = p_id AND created_by = v_uid
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO task_recurring_templates (
      title, description, priority, target_department_ids, target_user_ids,
      schedule_kind, weekly_dow, weekly_time, monthly_dom, monthly_time,
      timezone, due_days_after_fire, created_by, is_active, next_run_at
    ) VALUES (
      trim(p_title), NULLIF(trim(COALESCE(p_description,'')), ''), p_priority, p_target_department_ids, p_target_user_ids,
      p_schedule_kind, p_weekly_dow, p_weekly_time::TIME, p_monthly_dom, p_monthly_time::TIME,
      p_timezone, p_due_days_after_fire, v_uid, p_is_active, v_next
    ) RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_upsert(TEXT, TEXT, task_priority, UUID[], UUID[], TEXT, INT, TEXT, INT, TEXT, TEXT, INT, BOOLEAN, UUID) TO authenticated;

DROP FUNCTION IF EXISTS recurring_fire_due();
DROP FUNCTION IF EXISTS recurring_fire_due(UUID);

CREATE OR REPLACE FUNCTION recurring_fire_due(p_template_id UUID DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT := 0;
  v_t RECORD;
  v_uid UUID;
  v_task_id UUID;
  v_a UUID;
  v_dept_id UUID;
  v_target_id UUID;
  v_batch_id UUID;
  v_due_date TIMESTAMPTZ;
BEGIN
  FOR v_t IN
    SELECT * FROM task_recurring_templates
    WHERE (p_template_id IS NULL AND is_active = TRUE AND next_run_at <= NOW())
       OR (p_template_id IS NOT NULL AND id = p_template_id)
    ORDER BY next_run_at ASC
    LIMIT 20
  LOOP
    v_uid := COALESCE(v_t.created_by, (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1));
    IF v_uid IS NULL THEN CONTINUE; END IF;

    UPDATE task_recurring_templates
    SET last_fired_at = NOW(),
        next_run_at = _recurring_next_run(v_t.schedule_kind, v_t.weekly_dow, v_t.weekly_time, v_t.monthly_dom, v_t.monthly_time, v_t.timezone, NOW())
    WHERE id = v_t.id;

    v_batch_id := gen_random_uuid();

    -- Tính due_date, kết hợp due_time, skip cuối tuần
    v_due_date := (NOW()::DATE + v_t.due_days_after_fire + v_t.due_time)::TIMESTAMPTZ;
    IF EXTRACT(DOW FROM v_due_date) = 6 THEN      -- Thứ 7 → nhảy sang Thứ 2
      v_due_date := v_due_date + INTERVAL '2 days';
    ELSIF EXTRACT(DOW FROM v_due_date) = 0 THEN   -- Chủ nhật → nhảy sang Thứ 2
      v_due_date := v_due_date + INTERVAL '1 day';
    END IF;

    IF COALESCE(array_length(v_t.target_department_ids, 1), 0) > 0 THEN
      FOREACH v_dept_id IN ARRAY v_t.target_department_ids LOOP
        IF _is_director_department(v_dept_id) THEN CONTINUE; END IF;
        v_target_id := _resolve_default_assignee(v_dept_id);
        IF v_target_id IS NULL THEN CONTINUE; END IF;
        INSERT INTO tasks (title, description, priority, due_date, department_id, assignee_id, created_by, status, metadata, is_archived, requires_approval, batch_id)
        VALUES (v_t.title, v_t.description, v_t.priority, v_due_date,
                v_dept_id, v_target_id, v_uid, 'todo'::task_status, jsonb_build_object('from_recurring', true, 'recurring_template_id', v_t.id), FALSE, TRUE, v_batch_id)
        RETURNING id INTO v_task_id;
        INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_target_id) ON CONFLICT DO NOTHING;
        INSERT INTO notifications (user_id, title, content, type, link)
        VALUES (v_target_id, 'Công việc định kỳ', 'Hệ thống đã sinh: ' || v_t.title, 'task', '/dashboard/tasks?id=' || v_task_id::text);
        v_count := v_count + 1;
      END LOOP;
    END IF;

    IF COALESCE(array_length(v_t.target_user_ids, 1), 0) > 0 THEN
      FOREACH v_a IN ARRAY v_t.target_user_ids LOOP
        INSERT INTO tasks (title, description, priority, due_date, department_id, assignee_id, created_by, status, metadata, is_archived, requires_approval, batch_id)
        SELECT v_t.title, v_t.description, v_t.priority, v_due_date,
               p.department_id, p.id, v_uid, 'todo'::task_status, jsonb_build_object('from_recurring', true, 'recurring_template_id', v_t.id), FALSE, TRUE, v_batch_id
        FROM profiles p
        WHERE p.id = v_a AND p.is_active = TRUE AND p.role NOT IN ('admin','director','driver','secretary','hr_officer')
        RETURNING id INTO v_task_id;
        IF v_task_id IS NOT NULL THEN
          INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_a) ON CONFLICT DO NOTHING;
          INSERT INTO notifications (user_id, title, content, type, link)
          VALUES (v_a, 'Công việc định kỳ', 'Hệ thống đã sinh: ' || v_t.title, 'task', '/dashboard/tasks?id=' || v_task_id::text);
          v_count := v_count + 1;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION recurring_fire_due(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION recurring_template_force_run(p_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT := 0;
BEGIN
  SELECT public.recurring_fire_due(p_id) INTO v_count;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION recurring_template_force_run(UUID) TO authenticated, service_role;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION task_remind(p_task_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_task RECORD;
  v_count INT := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  
  IF v_task.created_by != v_uid AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_uid AND role IN ('admin', 'director')) THEN
    IF NOT EXISTS (SELECT 1 FROM profiles p JOIN profiles c ON p.department_id = c.department_id WHERE p.id = v_uid AND p.role = 'manager' AND c.id = v_task.created_by) THEN
        RAISE EXCEPTION 'Chỉ người giao việc hoặc quản lý mới được nhắc nhở';
    END IF;
  END IF;

  IF v_task.status IN ('done', 'canceled') THEN
    RAISE EXCEPTION 'Công việc đã hoàn thành hoặc huỷ, không thể nhắc nhở';
  END IF;

  IF v_task.last_reminded_at IS NOT NULL AND NOW() < v_task.last_reminded_at + interval '1 minute' THEN
    RAISE EXCEPTION 'Bạn vừa nhắc nhở rồi, vui lòng đợi 1 phút rồi thử lại';
  END IF;

  UPDATE tasks SET last_reminded_at = NOW() WHERE id = p_task_id;

  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT ta.user_id, 'Nhắc nhở hoàn thành công việc', 'Người giao việc đang nhắc bạn hoàn thành: ' || v_task.title, 'task', '/dashboard/tasks?id=' || p_task_id::text
  FROM task_assignees ta
  WHERE ta.task_id = p_task_id;
END;
$$;
GRANT EXECUTE ON FUNCTION task_remind(UUID) TO authenticated, service_role;

