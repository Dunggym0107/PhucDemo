-- ==============================================================================
-- WorkFlow Portal — Consolidated Schema (v1.2 — 2026-05-24)
-- ==============================================================================
-- Đây là schema hợp nhất từ:
--   • schema.sql gốc (base)
--   • 23 migration_*.sql + 2 fix_*.sql trong supabase/
--
-- File này thay thế toàn bộ migration_*.sql cũ. Có thể replay trên DB trống.
-- File supabase/migration_handover_module.sql vẫn được giữ làm MẪU CHUẨN
-- cho module mới (header + naming + comment style).
--
-- Mọi câu lệnh đều idempotent (IF NOT EXISTS / IF EXISTS / DO block).
-- ==============================================================================

-- ==============================================================================
-- [BASE] Core enums, departments, profiles, tasks, schedules, notifications…
-- ==============================================================================
-- 1. Tạo Enums (Sử dụng DO block để tránh lỗi nếu đã tồn tại)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'director', 'manager', 'staff');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'secretary';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hr_officer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'driver';

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('todo', 'doing', 'done', 'late');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'closed';



DO $$ BEGIN
    CREATE TYPE schedule_type AS ENUM ('meeting', 'trip', 'event');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE schedule_status AS ENUM ('pending', 'approved', 'rejected', 'in_progress', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- 2. Tạo bảng Departments (Phòng ban)
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;

-- 3. Tạo bảng Profiles (Thông tin người dùng)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    department_id UUID REFERENCES departments(id),
    role user_role DEFAULT 'staff',
    avatar_url TEXT,
    phone TEXT,
    birthday DATE,
    gender TEXT,
    ad_account TEXT UNIQUE,
    branch_join_date DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thêm các cột mới nếu bảng đã được tạo trước đó
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ad_account TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_join_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_department_head BOOLEAN DEFAULT false;

-- 4. Tạo bảng Tasks (Công việc & Mục tiêu)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    status task_status DEFAULT 'todo',
    priority task_priority DEFAULT 'medium',
    task_type TEXT DEFAULT 'task',
    progress INTEGER DEFAULT 0,
    assignee_id UUID REFERENCES profiles(id),
    created_by UUID REFERENCES profiles(id),
    due_date TIMESTAMPTZ,
    target_value BIGINT,
    current_value BIGINT DEFAULT 0,
    unit TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Đảm bảo các cột mới tồn tại nếu bảng đã được tạo trước đó
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'task';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_value BIGINT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS current_value BIGINT DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Cập nhật dữ liệu cũ
UPDATE tasks SET is_archived = false WHERE is_archived IS NULL;

-- Hàm tự động dọn dẹp dữ liệu cũ
CREATE OR REPLACE FUNCTION auto_archive_and_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Đưa công việc/báo cáo đã hoàn thành hoặc đóng trên 60 ngày vào lưu trữ
    UPDATE tasks
    SET is_archived = true
    WHERE status IN ('done', 'closed')
    AND created_at < NOW() - INTERVAL '60 days'
    AND is_archived = false;

    -- Xóa thông báo cũ hơn 30 ngày
    DELETE FROM notifications
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- 5. Tạo bảng Task Comments (Bình luận công việc)
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tạo bảng Notifications (Thông báo)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    type TEXT,
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tạo bảng Vehicles (Phương tiện)
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    plate_number TEXT NOT NULL UNIQUE,
    type TEXT, -- 4 chỗ, 7 chỗ, 16 chỗ
    status TEXT DEFAULT 'available', -- available, busy, maintenance
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tạo bảng Rooms (Phòng họp)
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    capacity INTEGER,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Tạo bảng Schedules (Lịch trình & Đặt chỗ)
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    type schedule_type DEFAULT 'meeting',
    status schedule_status DEFAULT 'pending',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    location TEXT, -- Địa điểm bên ngoài hoặc ghi chú
    room_id UUID REFERENCES rooms(id),
    vehicle_id UUID REFERENCES vehicles(id),
    department_id UUID REFERENCES departments(id),
    created_by UUID REFERENCES profiles(id),
    use_room BOOLEAN DEFAULT false,
    use_vehicle BOOLEAN DEFAULT false,
    requested_vehicle_type TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Tạo bảng Recognitions (Vinh danh)
-- type: 4 giá trị enum khớp với RECOGNITION_TYPES trong src/app/dashboard/team/_lib/constants.ts
CREATE TABLE IF NOT EXISTS recognitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES profiles(id),
    receiver_id UUID REFERENCES profiles(id),
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'great_work'
        CHECK (type IN ('great_work', 'team_player', 'innovation', 'mentor')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration cho DB đã tồn tại từ trước (column type chưa có / không khớp enum mới)
ALTER TABLE recognitions
    ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'great_work';
ALTER TABLE recognitions
    DROP CONSTRAINT IF EXISTS recognitions_type_check;
ALTER TABLE recognitions
    ADD CONSTRAINT recognitions_type_check
    CHECK (type IN ('great_work', 'team_player', 'innovation', 'mentor'));

-- 11. Bảng trung gian Người tham gia lịch trình
CREATE TABLE IF NOT EXISTS schedule_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE schedule_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read schedule_participants" ON schedule_participants;
DROP POLICY IF EXISTS "Anyone can join/be invited to schedules" ON schedule_participants;
DROP POLICY IF EXISTS "Anyone can delete schedule_participants" ON schedule_participants;
CREATE POLICY "Public read schedule_participants" ON schedule_participants FOR SELECT USING (true);
CREATE POLICY "Anyone can join/be invited to schedules" ON schedule_participants FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Anyone can delete schedule_participants" ON schedule_participants FOR DELETE
USING (
    auth.uid() IS NOT NULL AND (
        profile_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM schedules s
            WHERE s.id = schedule_participants.schedule_id AND s.created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles p
            LEFT JOIN departments d ON p.department_id = d.id
            WHERE p.id = auth.uid()
            AND (p.role IN ('admin', 'secretary', 'hr_officer') OR (p.role = 'manager' AND d.code = '13602'))
        )
    )
);

-- 11. Tạo bảng Notifications (Thông báo)
INSERT INTO departments (name) 
VALUES 
('Tín dụng'), 
('Giao dịch viên'), 
('Kho quỹ'), 
('Pháp chế'), 
('Công nghệ thông tin'),
('Tổ chức Tổng hợp')
ON CONFLICT (name) DO NOTHING;

-- Chèn dữ liệu mẫu cho Xe
INSERT INTO vehicles (name, plate_number, type)
VALUES 
('Toyota Fortuner', '30F-123.45', '7 chỗ'),
('Toyota Camry', '30A-999.99', '4 chỗ'),
('Ford Transit', '30B-555.55', '16 chỗ')
ON CONFLICT (plate_number) DO NOTHING;

-- Chèn dữ liệu mẫu cho Phòng họp
INSERT INTO rooms (name, capacity, location)
VALUES 
('Phòng họp lớn (Tầng 2)', 30, 'Tầng 2 - Khu A'),
('Phòng họp nhỏ (Tầng 1)', 10, 'Tầng 1 - Khu B'),
('Hội trường chính', 100, 'Tầng 3')
ON CONFLICT (name) DO NOTHING;

-- 7. Thiết lập Row Level Security (RLS)
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE recognitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Xóa các policies cũ nếu có để tránh lỗi trùng lặp khi chạy lại
DROP POLICY IF EXISTS "Public read departments" ON departments;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin and HR can update any profile" ON profiles;
DROP POLICY IF EXISTS "Staff see assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Anyone can create tasks" ON tasks;
DROP POLICY IF EXISTS "Managers, Directors and Admin can update tasks" ON tasks;

-- Tạo lại Policies
CREATE POLICY "Public read departments" ON departments FOR SELECT USING (true);
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
-- Helper function: SECURITY DEFINER để bypass RLS khi check role, tránh recursion
-- (policy đọc lại profiles → trigger policy → infinite recursion).
CREATE OR REPLACE FUNCTION public.is_admin_or_hr()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'hr_officer')
  );
$$;
-- Admin & HR officer được sửa hồ sơ của bất kỳ ai (toàn diện danh bạ)
CREATE POLICY "Admin and HR can update any profile" ON profiles FOR UPDATE
USING (public.is_admin_or_hr());

CREATE POLICY "Tasks read access" ON tasks FOR SELECT 
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director')
    OR (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
        AND department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    )
    OR auth.uid() = assignee_id 
    OR auth.uid() = created_by
    OR (metadata->>'assigned_line' IS NOT NULL AND auth.uid()::text = ANY(ARRAY(SELECT jsonb_array_elements_text(metadata->'assigned_line'))))
);

CREATE POLICY "Anyone can create tasks" ON tasks FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Tasks update access" ON tasks FOR UPDATE 
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director')
    OR (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
        AND department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    )
    OR auth.uid() = assignee_id 
    OR auth.uid() = created_by
    OR (metadata->>'assigned_line' IS NOT NULL AND auth.uid()::text = ANY(ARRAY(SELECT jsonb_array_elements_text(metadata->'assigned_line'))))
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Xóa các policies cũ nếu có
DROP POLICY IF EXISTS "Anyone can view task comments" ON task_comments;
DROP POLICY IF EXISTS "Users can post comments" ON task_comments;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;

-- Tạo lại Policies
CREATE POLICY "Anyone can view task comments" ON task_comments FOR SELECT USING (true);
CREATE POLICY "Users can post comments" ON task_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view recognitions" ON recognitions;
DROP POLICY IF EXISTS "Admins can create recognitions" ON recognitions;
DROP POLICY IF EXISTS "Anyone active except driver can create recognitions" ON recognitions;
CREATE POLICY "Anyone can view recognitions" ON recognitions FOR SELECT USING (true);
CREATE POLICY "Anyone active except driver can create recognitions" ON recognitions FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    public.current_user_role() != 'driver' AND
    public.current_user_is_active() = true
);

CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can create notifications" ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.check_schedule_participant_conflicts(
  p_participant_ids uuid[],
  p_start timestamptz,
  p_end timestamptz,
  p_ignore_schedule_id uuid DEFAULT NULL
)
RETURNS TABLE (
  schedule_id uuid,
  title text,
  start_time timestamptz,
  end_time timestamptz,
  status schedule_status,
  profile_id uuid,
  full_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.title,
    s.start_time,
    s.end_time,
    s.status,
    p.id,
    p.full_name
  FROM schedules s
  JOIN schedule_participants sp ON sp.schedule_id = s.id
  JOIN profiles p ON p.id = sp.profile_id
  WHERE s.status <> 'rejected'
    AND (p_ignore_schedule_id IS NULL OR s.id <> p_ignore_schedule_id)
    AND sp.profile_id = ANY(p_participant_ids)
    AND s.start_time < p_end
    AND s.end_time > p_start;
$$;

GRANT EXECUTE ON FUNCTION public.check_schedule_participant_conflicts(uuid[], timestamptz, timestamptz, uuid) TO authenticated;

-- Policies cho Lịch trình
DROP POLICY IF EXISTS "Public read schedules" ON schedules;
CREATE POLICY "Public read schedules" ON schedules FOR SELECT USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (
        SELECT 1 FROM schedule_participants sp
        WHERE sp.schedule_id = schedules.id AND sp.profile_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM schedule_participants sp
        JOIN profiles p ON p.id = sp.profile_id
        WHERE sp.schedule_id = schedules.id AND p.role = 'director'
    )
    OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = schedules.created_by AND p.role = 'director'
    )
    OR EXISTS (
        SELECT 1 FROM profiles p
        LEFT JOIN departments d ON p.department_id = d.id
        WHERE p.id = auth.uid()
        AND schedules.use_vehicle = true
        AND (p.role = 'secretary' OR (p.role = 'manager' AND d.code = '13602'))
    )
    OR driver_id = auth.uid()
);

DROP POLICY IF EXISTS "Anyone can create schedules" ON schedules;
CREATE POLICY "Anyone can create schedules" ON schedules FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Legacy policy name cleanup (đổi sang "Coordinator and Creator ..."); chừa DROP để DB cũ chạy migration được sạch.
DROP POLICY IF EXISTS "TCTH and Creator can update schedules" ON schedules;
DROP POLICY IF EXISTS "Coordinator and Creator can update schedules" ON schedules;
CREATE POLICY "Coordinator and Creator can update schedules" ON schedules FOR UPDATE
USING (
    auth.uid() = created_by 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.id = auth.uid() 
      AND schedules.use_vehicle = true
      AND (p.role = 'secretary' OR (p.role = 'manager' AND d.code = '13602'))
    )
    OR driver_id = auth.uid()
)
WITH CHECK (
    auth.uid() = created_by 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.id = auth.uid() 
      AND (p.role = 'secretary' OR (p.role = 'manager' AND d.code = '13602'))
    )
    OR driver_id = auth.uid()
);

-- Policies cho Phòng và Xe (Admin và Thư ký Tổ chức Tổng hợp toàn quyền, User chỉ xem)
DROP POLICY IF EXISTS "Public read vehicles" ON vehicles;
CREATE POLICY "Public read vehicles" ON vehicles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin write vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admin and Secretary write vehicles" ON vehicles;
CREATE POLICY "Admin and Secretary write vehicles" ON vehicles FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        LEFT JOIN departments d ON p.department_id = d.id 
        WHERE p.id = auth.uid() 
        AND (p.role IN ('admin', 'secretary') OR d.name = 'Tổ chức Tổng hợp')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles p 
        LEFT JOIN departments d ON p.department_id = d.id 
        WHERE p.id = auth.uid() 
        AND (p.role IN ('admin', 'secretary') OR d.name = 'Tổ chức Tổng hợp')
    )
);

DROP POLICY IF EXISTS "Public read rooms" ON rooms;
CREATE POLICY "Public read rooms" ON rooms FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin write rooms" ON rooms;
DROP POLICY IF EXISTS "Admin and Secretary write rooms" ON rooms;
CREATE POLICY "Admin and Secretary write rooms" ON rooms FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        LEFT JOIN departments d ON p.department_id = d.id 
        WHERE p.id = auth.uid() 
        AND (p.role IN ('admin', 'secretary') OR d.name = 'Tổ chức Tổng hợp')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles p 
        LEFT JOIN departments d ON p.department_id = d.id 
        WHERE p.id = auth.uid() 
        AND (p.role IN ('admin', 'secretary') OR d.name = 'Tổ chức Tổng hợp')
    )
);

-- 8. Trigger tự động tạo Profile khi Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'staff')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Xóa trigger cũ nếu có trước khi tạo lại
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- 9. Cấu hình Supabase Storage cho Avatars
-- Chạy các lệnh này trong SQL Editor để tạo bucket và phân quyền
/*
-- Tạo bucket lưu trữ ảnh đại diện
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Cho phép mọi người xem ảnh đại diện (Public Read)
CREATE POLICY "Avatar Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- Cho phép người dùng tải lên ảnh của chính mình
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid);

-- Cho phép người dùng cập nhật ảnh của chính mình
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid);

-- Admin/HR được upload + cập nhật avatar cho bất kỳ user nào (sửa hồ sơ toàn diện danh bạ)
CREATE POLICY "Admin and HR can upload any avatar" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND public.is_admin_or_hr());

CREATE POLICY "Admin and HR can update any avatar" ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND public.is_admin_or_hr());
*/

-- 12. Tạo bảng Push Subscriptions (Lưu đăng ký thông báo PWA)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    device_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, subscription)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON push_subscriptions;
CREATE POLICY "Users can manage their own subscriptions" 
ON push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- 13. Tạo bảng Account Requests (Yêu cầu cấp tài khoản mới)
CREATE TABLE IF NOT EXISTS account_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role user_role DEFAULT 'staff',
    department_id UUID REFERENCES departments(id),
    password TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE account_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert account requests" ON account_requests;
CREATE POLICY "Anyone can insert account requests" ON account_requests 
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Only admins can view account requests" ON account_requests;
CREATE POLICY "Only admins can view account requests" ON account_requests 
FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Only admins can update account requests" ON account_requests;
CREATE POLICY "Only admins can update account requests" ON account_requests 
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

NOTIFY pgrst, 'reload schema';




-- ==============================================================================
-- [fix_schedule_notifications_conflicts.sql]
-- ==============================================================================
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
CREATE POLICY "Authenticated users can create notifications"
ON notifications FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can delete schedule_participants" ON schedule_participants;
CREATE POLICY "Anyone can delete schedule_participants" ON schedule_participants FOR DELETE
USING (
    auth.uid() IS NOT NULL AND (
        profile_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM schedules s
            WHERE s.id = schedule_participants.schedule_id AND s.created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles p
            LEFT JOIN departments d ON p.department_id = d.id
            WHERE p.id = auth.uid()
            AND (p.role IN ('admin', 'secretary', 'hr_officer') OR d.name = 'Tổ chức Tổng hợp')
        )
    )
);

CREATE OR REPLACE FUNCTION public.check_schedule_participant_conflicts(
  p_participant_ids uuid[],
  p_start timestamptz,
  p_end timestamptz,
  p_ignore_schedule_id uuid DEFAULT NULL
)
RETURNS TABLE (
  schedule_id uuid,
  title text,
  start_time timestamptz,
  end_time timestamptz,
  status schedule_status,
  profile_id uuid,
  full_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.title,
    s.start_time,
    s.end_time,
    s.status,
    p.id,
    p.full_name
  FROM schedules s
  JOIN schedule_participants sp ON sp.schedule_id = s.id
  JOIN profiles p ON p.id = sp.profile_id
  WHERE s.status <> 'rejected'
    AND (p_ignore_schedule_id IS NULL OR s.id <> p_ignore_schedule_id)
    AND sp.profile_id = ANY(p_participant_ids)
    AND s.start_time < p_end
    AND s.end_time > p_start;
$$;

GRANT EXECUTE ON FUNCTION public.check_schedule_participant_conflicts(uuid[], timestamptz, timestamptz, uuid) TO authenticated;


-- ==============================================================================
-- [fix_security_and_logic_patch.sql]
-- ==============================================================================
-- ==============================================
-- MIGRATION: BẢN VÁ BẢO MẬT & PHÂN QUYỀN RLS DATABASE
-- Mục đích: Khắc phục các lỗ hổng Spoofing, thắt chặt RLS bảng participants và enum.
-- ==============================================

-- 1. Bổ sung giá trị 'leave' vào kiểu dữ liệu Enum schedule_type
ALTER TYPE schedule_type ADD VALUE IF NOT EXISTS 'leave';

-- 2. Sửa chính sách RLS cho bảng tasks (Ngăn chặn mạo danh người tạo công việc)
DROP POLICY IF EXISTS "Anyone can create tasks" ON tasks;
CREATE POLICY "Anyone can create tasks" ON tasks FOR INSERT 
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
);

-- 3. Sửa chính sách RLS cho bảng schedules (Ngăn chặn mạo danh người tạo lịch trình)
DROP POLICY IF EXISTS "Anyone can create schedules" ON schedules;
CREATE POLICY "Anyone can create schedules" ON schedules FOR INSERT 
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
);

-- 4. Thắt chặt RLS bảng schedule_participants để ngăn chặn thêm thành viên bừa bãi
DROP POLICY IF EXISTS "Anyone can join/be invited to schedules" ON schedule_participants;
CREATE POLICY "Anyone can join/be invited to schedules" ON schedule_participants FOR INSERT 
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (
        profile_id = auth.uid() -- Tự đăng ký tham gia lịch trình
        OR EXISTS (
            SELECT 1 FROM schedules s
            WHERE s.id = schedule_participants.schedule_id AND s.created_by = auth.uid() -- Được mời bởi người tạo lịch trình
        )
    )
);


-- ==============================================================================
-- [migration_driver_assignment.sql]
-- ==============================================================================
-- ==============================================
-- MIGRATION: THÊM DRIVER_ID VÀO VEHICLES VÀ SCHEDULES
-- Mục đích: Hỗ trợ gán Lái xe chuyên trách cho Xe và Lái xe cụ thể cho Lịch trình
-- ==============================================

-- 1. Bảng vehicles: Thêm cột driver_id để xác định tài xế chuyên trách mặc định của xe
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Bảng schedules: Thêm cột driver_id để gán tài xế thực hiện chuyến đi
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. Cập nhật RLS cho schedules để cho phép driver_id được xem và cập nhật chuyến đi của mình
-- Xóa policy cũ nếu có (Policy SELECT và UPDATE cho driver)
DROP POLICY IF EXISTS "Driver can view schedules they are assigned to" ON schedules;
DROP POLICY IF EXISTS "Driver can update schedules they are assigned to" ON schedules;

-- Policy SELECT: Lái xe được quyền xem các chuyến đi mà họ được gán
CREATE POLICY "Driver can view schedules they are assigned to"
ON schedules FOR SELECT
USING (
    driver_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM schedule_participants sp
        WHERE sp.schedule_id = id AND sp.profile_id = auth.uid()
    )
);

-- Policy UPDATE: Lái xe được quyền cập nhật (progress/status/start_km/end_km/etc) chuyến đi của mình
-- WITH CHECK cho phép driver set driver_id = null (từ chối lịch)
CREATE POLICY "Driver can update schedules they are assigned to"
ON schedules FOR UPDATE
USING (driver_id = auth.uid())
WITH CHECK (driver_id = auth.uid() OR driver_id IS NULL);

-- Tùy chọn (Tùy chọn di chuyển dữ liệu cũ): Nếu bạn muốn, có thể cập nhật driver_id dựa trên một logic nào đó, nhưng thường bỏ qua vì dữ liệu mới sẽ gán trực tiếp.


-- ==============================================================================
-- [migration_security_and_integrity.sql]
-- ==============================================================================
-- =====================================================
-- MIGRATION: VÁ BẢO MẬT, TOÀN VẸN & HỢP NHẤT KPI
-- Mục tiêu:
--   1. Loại bỏ lưu mật khẩu plaintext trong account_requests
--   2. Bổ sung policy DELETE cho tasks/kpis/schedules có ràng buộc
--   3. Hợp nhất KPI vào bảng kpis (chấm dứt task_type='kpi' trong bảng tasks)
--   4. RPC cập nhật đóng góp KPI an toàn (kiểm tra quyền cấp DB)
--   5. CASCADE cho task_comments / task_assignees
--   6. Thêm indexes hỗ trợ truy vấn
--   7. Cờ is_active để admin duyệt tài khoản
-- =====================================================

-- =====================================================
-- 1. KÍCH HOẠT TÀI KHOẢN & GỠ MẬT KHẨU PLAINTEXT
-- =====================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Đặt mặc định cho dữ liệu sẵn có: tất cả người đang dùng coi như đã được duyệt
UPDATE profiles SET is_active = TRUE WHERE is_active IS NULL;

-- Trigger handle_new_user: tài khoản mới mặc định chưa kích hoạt (chờ admin duyệt)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    'staff',
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Xóa cột password plaintext (nếu còn tồn tại trên DB cũ)
ALTER TABLE account_requests DROP COLUMN IF EXISTS password;

-- =====================================================
-- 2. POLICY DELETE CHO TASKS / KPIS / SCHEDULES
-- =====================================================
DROP POLICY IF EXISTS "Tasks delete access" ON tasks;
CREATE POLICY "Tasks delete access" ON tasks FOR DELETE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director')
  OR auth.uid() = created_by
  OR (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
    AND department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
  )
);

DROP POLICY IF EXISTS "KPIs delete access" ON kpis;
CREATE POLICY "KPIs delete access" ON kpis FOR DELETE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director')
  OR auth.uid() = created_by
  OR (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
    AND department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
  )
);

-- Schedules: cấm xóa khi đang in_progress để không mất hành trình tài xế
DROP POLICY IF EXISTS "Schedules delete access" ON schedules;
CREATE POLICY "Schedules delete access" ON schedules FOR DELETE
USING (
  status <> 'in_progress'
  AND (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'secretary', 'hr_officer', 'director')
        OR (p.role = 'manager' AND d.code = '13602')
      )
    )
  )
);

-- =====================================================
-- 3. SIẾT POLICY UPDATE TASKS — KHÔNG CHO STAFF ĐỔI OWNERSHIP
-- (Hạn chế cột nhạy cảm thông qua trigger BEFORE UPDATE)
-- =====================================================
CREATE OR REPLACE FUNCTION public.guard_tasks_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text;
  v_dept uuid;
BEGIN
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = auth.uid();

  -- Admin / Director / Manager cùng phòng được phép thay đổi mọi cột
  IF v_role IN ('admin', 'director')
     OR (v_role = 'manager' AND OLD.department_id = v_dept) THEN
    RETURN NEW;
  END IF;

  -- Người tạo được sửa nội dung nhưng không chuyển sở hữu
  IF auth.uid() = OLD.created_by
     AND NEW.created_by = OLD.created_by THEN
    RETURN NEW;
  END IF;

  -- Còn lại (assignee / assigned_line) chỉ được cập nhật progress/status/current_value/metadata
  IF NEW.title       IS DISTINCT FROM OLD.title       THEN RAISE EXCEPTION 'Không có quyền đổi tiêu đề'; END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN RAISE EXCEPTION 'Không có quyền đổi mô tả'; END IF;
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN RAISE EXCEPTION 'Không có quyền đổi người tiếp nhận'; END IF;
  IF NEW.created_by  IS DISTINCT FROM OLD.created_by  THEN RAISE EXCEPTION 'Không có quyền đổi người tạo'; END IF;
  IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN RAISE EXCEPTION 'Không có quyền chuyển phòng ban'; END IF;
  IF NEW.priority    IS DISTINCT FROM OLD.priority    THEN RAISE EXCEPTION 'Không có quyền đổi mức độ'; END IF;
  IF NEW.due_date    IS DISTINCT FROM OLD.due_date    THEN RAISE EXCEPTION 'Không có quyền đổi hạn'; END IF;
  IF NEW.target_value IS DISTINCT FROM OLD.target_value THEN RAISE EXCEPTION 'Không có quyền đổi mục tiêu'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_tasks_update_trigger ON tasks;
CREATE TRIGGER guard_tasks_update_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_tasks_update();

-- =====================================================
-- 4. HỢP NHẤT KPI — DI CHUYỂN task_type='kpi' VỀ kpis
-- =====================================================
INSERT INTO kpis (
  id, title, description, status, priority, progress, assignee_id, created_by,
  department_id, due_date, target_value, current_value, unit, metadata, is_archived, created_at
)
SELECT
  id,
  title,
  description,
  status,
  priority,
  progress,
  assignee_id,
  created_by,
  department_id,
  due_date,
  target_value,
  current_value,
  unit,
  COALESCE(metadata, '{}'::jsonb),
  COALESCE(is_archived, FALSE),
  created_at
FROM tasks
WHERE task_type = 'kpi'
ON CONFLICT (id) DO NOTHING;

-- Sao chép comment qua KPI nếu có (giữ history thảo luận)
-- task_comments không liên kết tới kpis nên tạm để nguyên, sẽ refactor sau.

DELETE FROM tasks WHERE task_type = 'kpi';

-- Vô hiệu hoá task_type='kpi' về sau bằng CHECK constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_not_kpi;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_not_kpi
  CHECK (task_type IS NULL OR task_type <> 'kpi');

-- =====================================================
-- 5. RPC CẬP NHẬT ĐÓNG GÓP KPI AN TOÀN
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_kpi_contribution(
  p_kpi_id uuid,
  p_user_id uuid,
  p_value bigint
)
RETURNS TABLE (current_value bigint, progress int, status task_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_caller_dept uuid;
  v_kpi_dept uuid;
  v_target bigint;
  v_new_value bigint;
  v_new_progress int;
  v_new_status task_status;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Chưa xác thực';
  END IF;
  IF p_value < 0 THEN
    RAISE EXCEPTION 'Giá trị đóng góp không thể âm';
  END IF;

  SELECT role, department_id INTO v_caller_role, v_caller_dept
  FROM profiles WHERE id = v_caller;

  SELECT department_id, target_value, status INTO v_kpi_dept, v_target, v_new_status
  FROM kpis WHERE id = p_kpi_id;

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy KPI';
  END IF;

  -- Quyền: chính mình | admin | director | manager cùng phòng
  IF NOT (
    v_caller = p_user_id
    OR v_caller_role IN ('admin', 'director')
    OR (v_caller_role = 'manager' AND v_caller_dept IS NOT DISTINCT FROM v_kpi_dept)
  ) THEN
    RAISE EXCEPTION 'Không có quyền chỉnh đóng góp của người khác';
  END IF;

  -- Cập nhật metadata.contributions[p_user_id] = p_value
  UPDATE kpis
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    ARRAY['contributions', p_user_id::text],
    to_jsonb(p_value),
    TRUE
  )
  WHERE id = p_kpi_id;

  -- Tính tổng đóng góp + hiệu chỉnh phòng
  SELECT
    COALESCE((
      SELECT SUM((value)::bigint)
      FROM jsonb_each_text(COALESCE(metadata->'contributions', '{}'::jsonb))
    ), 0)
    + COALESCE((metadata->>'general_adjustment')::bigint, 0)
  INTO v_new_value
  FROM kpis WHERE id = p_kpi_id;

  v_new_progress := CASE
    WHEN v_target > 0 THEN LEAST(100, GREATEST(0, ROUND(v_new_value::numeric / v_target * 100)::int))
    ELSE 0
  END;

  IF v_new_progress >= 100 AND v_new_status NOT IN ('done', 'closed') THEN
    v_new_status := 'done';
  END IF;

  UPDATE kpis
  SET
    current_value = v_new_value,
    progress = v_new_progress,
    status = v_new_status
  WHERE id = p_kpi_id;

  RETURN QUERY SELECT v_new_value, v_new_progress, v_new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_kpi_contribution(uuid, uuid, bigint) TO authenticated;

-- =====================================================
-- 6. RPC HIỆU CHỈNH PHÒNG (general_adjustment) — chỉ leader
-- =====================================================
CREATE OR REPLACE FUNCTION public.adjust_kpi_general(
  p_kpi_id uuid,
  p_delta bigint
)
RETURNS TABLE (current_value bigint, progress int, status task_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_caller_dept uuid;
  v_kpi_dept uuid;
  v_target bigint;
  v_new_adj bigint;
  v_new_value bigint;
  v_new_progress int;
  v_new_status task_status;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Chưa xác thực'; END IF;

  SELECT role, department_id INTO v_caller_role, v_caller_dept
  FROM profiles WHERE id = v_caller;

  SELECT department_id, target_value, status INTO v_kpi_dept, v_target, v_new_status
  FROM kpis WHERE id = p_kpi_id;

  IF v_target IS NULL THEN RAISE EXCEPTION 'Không tìm thấy KPI'; END IF;

  IF NOT (
    v_caller_role IN ('admin', 'director')
    OR (v_caller_role = 'manager' AND v_caller_dept IS NOT DISTINCT FROM v_kpi_dept)
  ) THEN
    RAISE EXCEPTION 'Chỉ lãnh đạo phòng/BGĐ/Admin được hiệu chỉnh phòng';
  END IF;

  v_new_adj := COALESCE((SELECT (metadata->>'general_adjustment')::bigint FROM kpis WHERE id = p_kpi_id), 0) + p_delta;

  UPDATE kpis
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    ARRAY['general_adjustment'],
    to_jsonb(v_new_adj),
    TRUE
  )
  WHERE id = p_kpi_id;

  SELECT
    COALESCE((
      SELECT SUM((value)::bigint)
      FROM jsonb_each_text(COALESCE(metadata->'contributions', '{}'::jsonb))
    ), 0) + v_new_adj
  INTO v_new_value
  FROM kpis WHERE id = p_kpi_id;

  v_new_progress := CASE
    WHEN v_target > 0 THEN LEAST(100, GREATEST(0, ROUND(v_new_value::numeric / v_target * 100)::int))
    ELSE 0
  END;

  IF v_new_progress >= 100 AND v_new_status NOT IN ('done', 'closed') THEN
    v_new_status := 'done';
  END IF;

  UPDATE kpis
  SET current_value = v_new_value, progress = v_new_progress, status = v_new_status
  WHERE id = p_kpi_id;

  RETURN QUERY SELECT v_new_value, v_new_progress, v_new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_kpi_general(uuid, bigint) TO authenticated;

-- =====================================================
-- 7. CASCADE & FK BỔ SUNG
-- =====================================================
ALTER TABLE task_comments
  DROP CONSTRAINT IF EXISTS task_comments_task_id_fkey;
ALTER TABLE task_comments
  ADD CONSTRAINT task_comments_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

ALTER TABLE task_comments
  DROP CONSTRAINT IF EXISTS task_comments_user_id_fkey;
ALTER TABLE task_comments
  ADD CONSTRAINT task_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- task_assignees: cascade
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_assignees') THEN
    ALTER TABLE task_assignees DROP CONSTRAINT IF EXISTS task_assignees_task_id_fkey;
    ALTER TABLE task_assignees
      ADD CONSTRAINT task_assignees_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =====================================================
-- 8. INDEXES TỐI ƯU TRUY VẤN
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_schedules_driver_status ON schedules(driver_id, type, status);
CREATE INDEX IF NOT EXISTS idx_schedules_department_start ON schedules(department_id, start_time);
CREATE INDEX IF NOT EXISTS idx_schedules_end_time ON schedules(end_time);
CREATE INDEX IF NOT EXISTS idx_schedules_room_time ON schedules(room_id, start_time, end_time) WHERE room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schedules_vehicle_time ON schedules(vehicle_id, start_time, end_time) WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_department_status ON tasks(department_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_kpis_department ON kpis(department_id);
CREATE INDEX IF NOT EXISTS idx_kpis_assignee ON kpis(assignee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_participants_profile ON schedule_participants(profile_id);

CREATE INDEX IF NOT EXISTS idx_tasks_active_status 
  ON tasks(is_archived, status) 
  WHERE is_archived = FALSE;

CREATE INDEX IF NOT EXISTS idx_task_assignees_task 
  ON task_assignees(task_id);

CREATE INDEX IF NOT EXISTS idx_handovers_receiver_status 
  ON document_handovers(receiver_id, status);

-- =====================================================
-- 9. CHẶN GÁN XE TRÙNG LỊCH (TỪ DB LAYER)
-- ⛔ ĐÃ XOÁ — xe cho phép overlapping (điều điều về)
-- Xem migration_remove_vehicle_overlap_guard.sql
-- =====================================================


-- ==============================================================================
--
-- ==============================================================================
-- =====================================================
-- MIGRATION BỔ SUNG: Bảo vệ nội dung đơn nghỉ phép ở tầng RLS
-- Mục tiêu: Khi cán bộ khác phòng xem lịch nghỉ phép, payload không trả
--           description/title chi tiết để chống đọc lén từ DevTools.
-- =====================================================

-- 1. Hàm helper: kiểm tra current user có được xem nội dung lịch không
CREATE OR REPLACE FUNCTION public.can_view_leave_detail(p_schedule_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_caller_dept uuid;
  v_caller_head boolean;
  v_creator_id uuid;
  v_creator_role text;
  v_creator_head boolean;
  v_creator_dept uuid;
  v_type text;
BEGIN
  IF v_caller IS NULL THEN RETURN FALSE; END IF;

  SELECT role, department_id, is_department_head
  INTO v_caller_role, v_caller_dept, v_caller_head
  FROM profiles WHERE id = v_caller;

  SELECT
    s.created_by, s.type::text,
    p.role, p.is_department_head, p.department_id
  INTO v_creator_id, v_type, v_creator_role, v_creator_head, v_creator_dept
  FROM schedules s
  LEFT JOIN profiles p ON p.id = s.created_by
  WHERE s.id = p_schedule_id;

  -- Không phải nghỉ phép → mọi người xem được nội dung
  IF v_type IS DISTINCT FROM 'leave' THEN RETURN TRUE; END IF;

  -- Chủ đơn
  IF v_caller = v_creator_id THEN RETURN TRUE; END IF;

  -- Admin / HR / BGĐ luôn xem được
  IF v_caller_role IN ('admin', 'hr_officer', 'director') THEN RETURN TRUE; END IF;

  -- Trưởng phòng / Manager: chỉ được khi cùng phòng và creator không phải lãnh đạo cùng cấp
  IF v_caller_role = 'manager' AND v_creator_dept = v_caller_dept THEN
    IF v_caller_head OR (NOT v_creator_head AND v_creator_role <> 'manager') THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_leave_detail(uuid) TO authenticated;

-- 2. Trigger BEFORE SELECT không khả thi trên Postgres.
-- Cách an toàn: tạo SECURITY DEFINER function trả về lịch + ẩn nội dung khi không có quyền.
-- App phía client gọi RPC này khi cần chi tiết đơn nghỉ phép.
CREATE OR REPLACE FUNCTION public.get_leave_safe(p_schedule_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  type text,
  status text,
  start_time timestamptz,
  end_time timestamptz,
  created_by uuid,
  department_id uuid,
  metadata jsonb,
  can_view_detail boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  v_allowed := public.can_view_leave_detail(p_schedule_id);

  RETURN QUERY
  SELECT
    s.id,
    CASE WHEN v_allowed THEN s.title ELSE 'Nghỉ phép' END,
    CASE WHEN v_allowed THEN s.description ELSE NULL END,
    s.type::text,
    s.status::text,
    s.start_time,
    s.end_time,
    s.created_by,
    s.department_id,
    CASE WHEN v_allowed THEN s.metadata ELSE jsonb_build_object() END,
    v_allowed
  FROM schedules s
  WHERE s.id = p_schedule_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leave_safe(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ==============================================================================
-- [migration_reset_passwords.sql]
-- ==============================================================================
-- =====================================================
-- MIGRATION: RESET MẬT KHẨU HÀNG LOẠT VỀ MẶC ĐỊNH
-- Dùng khi: sau khi bỏ password plaintext, các tài khoản cũ
-- không còn nguồn để Supabase Auth khớp password.
-- =====================================================
-- HƯỚNG DẪN SỬ DỤNG
-- 1. Mở Supabase Dashboard → SQL Editor
-- 2. Sửa biến v_default_password bên dưới theo ý bạn (tối thiểu 6 ký tự)
-- 3. Chạy script
-- 4. Thông báo cho toàn bộ cán bộ đăng nhập với mật khẩu mặc định, sau đó vào /dashboard/profile để đổi
-- =====================================================

-- Bật extension pgcrypto nếu chưa có (Supabase mặc định đã bật)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_default_password TEXT := 'Workflow@2026';  -- ⬅️ ĐỔI CHỖ NÀY nếu muốn mật khẩu khác
  v_updated_count INTEGER;
BEGIN
  -- Kiểm tra độ dài tối thiểu
  IF char_length(v_default_password) < 6 THEN
    RAISE EXCEPTION 'Mật khẩu mặc định phải ≥ 6 ký tự';
  END IF;

  -- Cập nhật bcrypt hash của TOÀN BỘ user trong auth.users
  -- Đồng thời gắn flag must_change_password để buộc đổi mật khẩu lần đầu đăng nhập
  UPDATE auth.users
  SET
    encrypted_password = crypt(v_default_password, gen_salt('bf')),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
                       || jsonb_build_object('must_change_password', true);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Đã reset mật khẩu cho % tài khoản về: %', v_updated_count, v_default_password;
  RAISE NOTICE '⚠️  Thông báo cho cán bộ vào /dashboard/profile để đổi mật khẩu sau khi đăng nhập.';
END $$;

-- Cập nhật profile flag tương ứng (để FE có thể đọc nhanh không cần đụng auth.users)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
UPDATE profiles SET must_change_password = TRUE WHERE is_active = TRUE;

NOTIFY pgrst, 'reload schema';


-- ==============================================================================
-- [migration_handover_rls_fix.sql]
-- ==============================================================================
-- ============================================================================
-- FIX: Vòng lặp vô hạn (infinite recursion) trong RLS module Handover
-- ----------------------------------------------------------------------------
-- Nguyên nhân: policy của `documents` tham chiếu `document_handovers` qua
-- EXISTS, và policy của `document_handovers` lại tham chiếu ngược `documents`
-- → 2 policy kích hoạt RLS của nhau → recursion (error 42P17).
--
-- Cách fix: tách 2 truy vấn cross-table ra SECURITY DEFINER helper function.
-- Vì SECURITY DEFINER bỏ qua RLS, không trigger lại policy của bảng kia.
--
-- Chạy 1 lần trong Supabase SQL Editor sau khi đã chạy migration_handover_module.sql.
-- ============================================================================

-- 1) Helper: kiểm tra user có nằm trong luồng handover của document nào không
CREATE OR REPLACE FUNCTION user_is_in_document_handovers(p_doc_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM document_handovers
    WHERE document_id = p_doc_id
      AND (sender_id = p_user_id OR receiver_id = p_user_id)
  );
$$;

-- 2) Helper: kiểm tra user có phải creator của document hay không
CREATE OR REPLACE FUNCTION user_is_document_creator(p_doc_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM documents
    WHERE id = p_doc_id AND creator_id = p_user_id
  );
$$;


-- 3) Drop policy cũ (gây recursion) ------------------------------------------
DROP POLICY IF EXISTS "Documents read access" ON documents;
DROP POLICY IF EXISTS "Handovers read access" ON document_handovers;


-- 4) Recreate documents.SELECT — dùng helper thay vì EXISTS inline -----------
CREATE POLICY "Documents read access" ON documents FOR SELECT
USING (
    creator_id = auth.uid()
    OR current_assignee_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director')
    OR user_is_in_document_handovers(id, auth.uid())
);


-- 5) Recreate document_handovers.SELECT — dùng helper khác ------------------
CREATE POLICY "Handovers read access" ON document_handovers FOR SELECT
USING (
    sender_id = auth.uid()
    OR receiver_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director')
    OR user_is_document_creator(document_id, auth.uid())
);


-- ============================================================================
-- Verify: chạy thử 2 câu select dưới (login bất kỳ user) phải trả về data,
-- không còn lỗi 42P17.
--
--   SELECT id, short_code, status FROM documents LIMIT 5;
--   SELECT id, document_id, status FROM document_handovers LIMIT 5;
-- ============================================================================


-- ==============================================================================
-- [migration_drop_kpi_module.sql]
-- ==============================================================================
-- ============================================================================
-- DEPRECATION: GỠ MODULE KPIS HOÀN TOÀN
-- ----------------------------------------------------------------------------
-- Mục đích: Xoá sạch mọi schema/function/policy liên quan đến module KPIs.
-- App đã dừng dùng KPIs từ phiên deprecation 2026-05-23.
--
-- ⚠️ CẢNH BÁO: SCRIPT NÀY KHÔNG THỂ HOÀN TÁC.
-- Trước khi chạy:
--   1. Backup database (Supabase Dashboard → Database → Backups → Manual snapshot)
--   2. Export data nếu cần (Dashboard → Table Editor → kpis → Export CSV)
--
-- Chạy 1 lần trong Supabase SQL Editor → Run.
-- ============================================================================

-- 1) Drop các RPC function liên quan KPIs (CASCADE để xoá luôn dependencies)
DROP FUNCTION IF EXISTS public.update_kpi_contribution(uuid, uuid, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.adjust_kpi_general(uuid, bigint) CASCADE;

-- 2) Drop bảng kpis. CASCADE để tự drop:
--    - Index (idx_kpis_department, idx_kpis_assignee)
--    - Tất cả RLS policies (KPIs read/create/update/delete access)
--    - Trigger nếu có
--    - Foreign key dependents nếu có (không có vì tasks không tham chiếu kpis)
DROP TABLE IF EXISTS public.kpis CASCADE;

-- 3) Bỏ CHECK constraint cấm task_type='kpi' trên bảng tasks
--    (constraint này từng được thêm trong migration_security_and_integrity.sql §4)
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_task_type_not_kpi;

-- 4) Cập nhật function auto_archive_and_cleanup — bỏ khối UPDATE kpis
--    (function này còn được dùng cho tasks, nên KHÔNG drop hẳn — chỉ ghi đè)
CREATE OR REPLACE FUNCTION auto_archive_and_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Đưa công việc/báo cáo đã hoàn thành hoặc đóng trên 60 ngày vào lưu trữ
    UPDATE tasks
    SET is_archived = true
    WHERE status IN ('done', 'closed')
    AND created_at < NOW() - INTERVAL '60 days'
    AND is_archived = false;

    -- Xóa thông báo cũ hơn 30 ngày
    DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- ============================================================================
-- Verify sau khi chạy:
--   SELECT * FROM information_schema.tables WHERE table_name = 'kpis';
--   -- Phải trả 0 row.
--
--   SELECT proname FROM pg_proc WHERE proname IN ('update_kpi_contribution', 'adjust_kpi_general');
--   -- Phải trả 0 row.
--
--   SELECT conname FROM pg_constraint WHERE conname = 'tasks_task_type_not_kpi';
--   -- Phải trả 0 row.
-- ============================================================================


-- ==============================================================================
-- [migration_handover_short_code_fix_2.sql]
-- ==============================================================================
-- ============================================================================
-- FIX: Lỗi "documents_short_code_key" duplicate key
-- ----------------------------------------------------------------------------
-- Nguyên nhân: Hàm sinh mã short_code `generate_document_short_code` chạy
-- dưới quyền của user đang đăng nhập (caller). Do bảng `documents` có RLS
-- (chỉ cho phép user nhìn thấy hồ sơ của mình), khi hàm thực hiện câu lệnh
-- `SELECT MAX(...) FROM documents`, nó sẽ KHÔNG nhìn thấy các hồ sơ do
-- người khác tạo trong cùng ngày.
-- Kết quả là `MAX` trả về 0, và hàm tiếp tục sinh mã `HS-YYYYMMDD-001`,
-- dẫn đến đụng độ (duplicate key) với mã `001` đã được người khác tạo.
--
-- Cách fix: Thêm `SECURITY DEFINER` vào hàm `generate_document_short_code`
-- để hàm luôn chạy dưới quyền của người tạo hàm (admin/postgres), qua đó
-- bypass RLS và đếm được chính xác số lượng hồ sơ thực tế trong toàn hệ thống.
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_document_short_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_date_part TEXT;
    v_seq INTEGER;
    v_code TEXT;
BEGIN
    IF NEW.short_code IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Lấy lock theo ngày để tránh race condition khi insert đồng thời
    PERFORM pg_advisory_xact_lock(hashtext('document_short_code_' || to_char(NOW(), 'YYYYMMDD')));

    v_date_part := to_char(NOW(), 'YYYYMMDD');

    SELECT COALESCE(MAX(SUBSTRING(short_code FROM 13 FOR 3)::INTEGER), 0) + 1
    INTO v_seq
    FROM documents
    WHERE short_code LIKE 'HS-' || v_date_part || '-%';

    v_code := 'HS-' || v_date_part || '-' || lpad(v_seq::TEXT, 3, '0');
    NEW.short_code := v_code;
    RETURN NEW;
END;
$$;


-- ==============================================================================
-- [migration_tasks_revamp.sql]
-- ==============================================================================
-- =====================================================================
-- MIGRATION: TASKS MODULE REVAMP (P0 — DB foundation)
-- =====================================================================
-- Mục đích:
--   1. Tạo enum task_priority (đang ref nhưng chưa CREATE TYPE)
--   2. Thêm task_status: 'submitted', 'canceled'; deprecate 'late','closed'
--   3. Đảm bảo bảng task_assignees tồn tại (junction multi-assignee)
--   4. Drop 4 cột KPI (target_value, current_value, unit, progress)
--   5. Thêm cột tasks.updated_at + trigger touch
--   6. Tạo bảng task_extension_requests (xin gia hạn deadline)
--   7. Trigger auto-cancel khi assignee cuối rời task
--   8. RLS helpers + policies (deny direct mutation, buộc qua RPC)
--   9. 9 RPCs SECURITY DEFINER cốt lõi:
--      - tasks_dashboard (gộp counts+list+resource_view)
--      - task_create, task_update_status, task_delegate
--      - task_request_extension, task_decide_extension
--      - task_add_comment, task_cancel, task_archive
--  10. Cập nhật auto_archive_and_cleanup theo enum mới
--
-- LƯU Ý:
-- - Postgres không cho DROP enum value khi còn ref → giữ 'late'/'closed'
--   nguyên, chỉ migrate row sang status hợp lệ mới + code TS bỏ qua 2 value cũ.
-- - guard_tasks_update trigger cũ (từ migration_security_and_integrity)
--   không còn cần thiết — paradigm mới là RLS DENY direct UPDATE + RPC
--   SECURITY DEFINER validate.
--
-- Cách chạy:
--   1. Backup DB (Supabase Dashboard → Database → Backups → Manual snapshot)
--   2. SQL Editor → paste & run toàn file
--   3. Chạy NOTIFY ở cuối (đã có sẵn)
--   4. Verify bằng các query ở comment cuối file
-- =====================================================================


-- =====================================================================
-- §1. ENUM
-- =====================================================================

-- task_priority: tạo nếu chưa có (line 73 schema.sql ref nhưng KHÔNG CREATE)
DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Thêm 2 status mới (idempotent)
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'canceled';

-- Migrate dữ liệu cũ (KHÔNG drop value 'late','closed' khỏi enum vì Postgres không cho)
-- - 'late' = derived state, chuyển về 'doing' (cron sẽ tự tính late mỗi sáng nếu cần)
-- - 'closed' = gộp vào 'done' + is_archived=true
UPDATE tasks SET status = 'doing' WHERE status = 'late';
UPDATE tasks SET status = 'done', is_archived = true WHERE status = 'closed';


-- =====================================================================
-- §2. BẢNG task_assignees (junction multi-assignee)
-- =====================================================================
-- Bảng có thể đã tồn tại từ trước (tạo qua Supabase UI hoặc migration cũ)
-- với schema khác nhau. Pattern dưới đảm bảo cấu trúc cuối cùng đồng nhất.

-- 2a. Tạo bảng nếu chưa có
CREATE TABLE IF NOT EXISTS task_assignees (
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, user_id)
);

-- 2b. Migrate legacy schema: rename 'created_at' → 'assigned_at' nếu cần
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='task_assignees' AND column_name='created_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='task_assignees' AND column_name='assigned_at'
  ) THEN
    ALTER TABLE task_assignees RENAME COLUMN created_at TO assigned_at;
  END IF;
END $$;

-- 2c. Đảm bảo cột assigned_at có mặt (kể cả khi cả 2 bảng cũ đều thiếu)
ALTER TABLE task_assignees ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(user_id, task_id);

-- 2d. Backfill từ tasks.assignee_id (dùng WHERE NOT EXISTS thay vì ON CONFLICT
--     vì không biết constraint name của bảng legacy)
INSERT INTO task_assignees (task_id, user_id, assigned_at)
SELECT t.id, t.assignee_id, COALESCE(t.created_at, NOW())
FROM tasks t
WHERE t.assignee_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM task_assignees ta
    WHERE ta.task_id = t.id AND ta.user_id = t.assignee_id
  );


-- =====================================================================
-- §3. DROP CỘT KPI + DROP GUARD TRIGGER CŨ
-- =====================================================================
ALTER TABLE tasks DROP COLUMN IF EXISTS target_value;
ALTER TABLE tasks DROP COLUMN IF EXISTS current_value;
ALTER TABLE tasks DROP COLUMN IF EXISTS unit;
ALTER TABLE tasks DROP COLUMN IF EXISTS progress;

-- Trigger guard cũ chặn staff đổi ownership (từ migration_security_and_integrity)
-- Paradigm mới: RLS DENY direct UPDATE, RPC SECURITY DEFINER validate → guard thừa
DROP TRIGGER IF EXISTS guard_tasks_update_trigger ON tasks;
DROP FUNCTION  IF EXISTS guard_tasks_update();

-- Constraint cấm task_type='kpi' (từ migration_security_and_integrity) — KPI đã drop
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_not_kpi;


-- =====================================================================
-- §4. CỘT tasks.updated_at + TRIGGER TOUCH
-- =====================================================================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE tasks SET updated_at = COALESCE(updated_at, created_at, NOW()) WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION _touch_tasks_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tasks_touch_updated ON tasks;
CREATE TRIGGER trg_tasks_touch_updated
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION _touch_tasks_updated();


-- =====================================================================
-- §5. INDEXES
-- =====================================================================
-- idx_tasks_dept_status, idx_tasks_assignee, idx_tasks_created_by đã có sẵn
CREATE INDEX IF NOT EXISTS idx_tasks_status_due ON tasks(status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_updated   ON tasks(updated_at DESC) WHERE is_archived = false;


-- =====================================================================
-- §6. BẢNG task_extension_requests
-- =====================================================================
CREATE TABLE IF NOT EXISTS task_extension_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  requested_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason          TEXT,
  old_due_date    TIMESTAMPTZ,
  new_due_date    TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  review_comment  TEXT,
  decided_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_extension_task      ON task_extension_requests(task_id, status);
CREATE INDEX IF NOT EXISTS idx_extension_requester ON task_extension_requests(requested_by, status);


-- =====================================================================
-- §7. TRIGGER auto-cancel khi assignee cuối rời task
-- =====================================================================
-- Phòng case: admin xoá user → CASCADE xoá row task_assignees → task vô chủ.
CREATE OR REPLACE FUNCTION _auto_cancel_orphaned_task()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status task_status;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM task_assignees WHERE task_id = OLD.task_id) THEN
    SELECT status INTO v_status FROM tasks WHERE id = OLD.task_id;
    IF v_status IS NOT NULL AND v_status NOT IN ('done', 'canceled') THEN
      UPDATE tasks SET status = 'canceled' WHERE id = OLD.task_id;
    END IF;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_task_assignees_orphan ON task_assignees;
CREATE TRIGGER trg_task_assignees_orphan
  AFTER DELETE ON task_assignees
  FOR EACH ROW EXECUTE FUNCTION _auto_cancel_orphaned_task();


-- =====================================================================
-- §8. CẬP NHẬT auto_archive_and_cleanup (theo enum mới)
-- =====================================================================
CREATE OR REPLACE FUNCTION auto_archive_and_cleanup()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Lưu trữ task done/canceled trên 60 ngày
  UPDATE tasks
  SET is_archived = TRUE
  WHERE status IN ('done', 'canceled')
    AND created_at < NOW() - INTERVAL '60 days'
    AND is_archived = FALSE;

  -- Xoá notification cũ trên 30 ngày
  DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '30 days';
END $$;


-- =====================================================================
-- §9. RLS HELPER user_can_see_task
-- =====================================================================
-- SECURITY DEFINER + STABLE — bẻ vòng recursion + cache trong query plan
CREATE OR REPLACE FUNCTION user_can_see_task(p_task_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_role TEXT;
  v_dept UUID;
  v_task_dept UUID;
  v_task_creator UUID;
  v_task_assignee UUID;
BEGIN
  IF p_user_id IS NULL THEN RETURN FALSE; END IF;
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = p_user_id;
  IF v_role IN ('admin', 'director') THEN RETURN TRUE; END IF;

  SELECT department_id, created_by, assignee_id
    INTO v_task_dept, v_task_creator, v_task_assignee
  FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF v_task_creator = p_user_id THEN RETURN TRUE; END IF;
  IF v_task_assignee = p_user_id THEN RETURN TRUE; END IF;
  IF v_role = 'manager' AND v_task_dept = v_dept THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM task_assignees WHERE task_id = p_task_id AND user_id = p_user_id) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END $$;

GRANT EXECUTE ON FUNCTION user_can_see_task(UUID, UUID) TO authenticated;


-- =====================================================================
-- §10. RLS POLICIES — TASKS (drop all existing then create fresh)
-- =====================================================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'tasks' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON tasks', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "tasks_select" ON tasks FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin', 'director')
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
  OR auth.uid() = assignee_id
  OR auth.uid() = created_by
  OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid())
);

-- Chặn INSERT/UPDATE/DELETE direct → buộc qua RPC
CREATE POLICY "tasks_no_direct_insert" ON tasks FOR INSERT TO authenticated WITH CHECK (FALSE);
CREATE POLICY "tasks_no_direct_update" ON tasks FOR UPDATE TO authenticated USING (FALSE);
CREATE POLICY "tasks_no_direct_delete" ON tasks FOR DELETE TO authenticated USING (FALSE);


-- =====================================================================
-- §11. RLS POLICIES — task_assignees + task_extension_requests
-- =====================================================================
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'task_assignees' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON task_assignees', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "task_assignees_select" ON task_assignees FOR SELECT TO authenticated
USING (user_can_see_task(task_id));

CREATE POLICY "task_assignees_no_direct_write" ON task_assignees
  FOR ALL TO authenticated USING (FALSE) WITH CHECK (FALSE);

ALTER TABLE task_extension_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_ext_select" ON task_extension_requests FOR SELECT TO authenticated
USING (user_can_see_task(task_id));

CREATE POLICY "task_ext_no_direct_write" ON task_extension_requests
  FOR ALL TO authenticated USING (FALSE) WITH CHECK (FALSE);


-- =====================================================================
-- §12. RLS POLICIES — task_comments (refresh)
-- =====================================================================
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'task_comments' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON task_comments', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "task_comments_select" ON task_comments FOR SELECT TO authenticated
USING (user_can_see_task(task_id));

CREATE POLICY "task_comments_insert_own" ON task_comments FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND user_can_see_task(task_id));

CREATE POLICY "task_comments_update_own" ON task_comments FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- =====================================================================
-- §13. RPC — tasks_dashboard (gộp counts + list + resource_view)
-- =====================================================================
CREATE OR REPLACE FUNCTION tasks_dashboard(
  p_scope  TEXT  DEFAULT 'mine',   -- 'mine' | 'dept' | 'branch'
  p_filter JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_role     TEXT;
  v_dept     UUID;
  v_now      TIMESTAMPTZ := NOW();
  v_counts   JSONB;
  v_lists    JSONB;
  v_resource JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;

  -- Restrict scope theo role
  IF v_role = 'staff' THEN
    p_scope := 'mine';
  ELSIF v_role NOT IN ('admin', 'director') AND p_scope = 'branch' THEN
    p_scope := 'dept';
  END IF;

  -- Counts
  WITH visible AS (
    SELECT t.*
    FROM tasks t
    WHERE t.is_archived = FALSE
      AND (
        (p_scope = 'mine' AND (
          t.assignee_id = v_uid OR t.created_by = v_uid
          OR EXISTS (SELECT 1 FROM task_assignees ta
                     WHERE ta.task_id = t.id AND ta.user_id = v_uid)
        ))
        OR (p_scope = 'dept'   AND t.department_id = v_dept)
        OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
      )
  )
  SELECT jsonb_build_object(
    'todo',              COUNT(*) FILTER (WHERE status = 'todo'),
    'doing',             COUNT(*) FILTER (WHERE status = 'doing'),
    'submitted',         COUNT(*) FILTER (WHERE status = 'submitted'),
    'done',              COUNT(*) FILTER (WHERE status = 'done'),
    'canceled',          COUNT(*) FILTER (WHERE status = 'canceled'),
    'overdue',           COUNT(*) FILTER (WHERE due_date < v_now AND status NOT IN ('done','canceled')),
    'awaiting_approval', COUNT(*) FILTER (WHERE status = 'submitted'),
    'extensions_pending', (
      SELECT COUNT(*) FROM task_extension_requests er
      WHERE er.status = 'pending'
        AND user_can_see_task(er.task_id, v_uid)
    )
  )
  INTO v_counts
  FROM visible;

  -- List (top 50 mới nhất, ưu tiên due_date gần nhất)
  SELECT jsonb_agg(row_to_json(x.*) ORDER BY x.is_overdue DESC, x.due_date NULLS LAST, x.created_at DESC)
  INTO v_lists
  FROM (
    SELECT t.id, t.title, t.description, t.status, t.priority, t.task_type,
           t.assignee_id, t.created_by, t.department_id,
           t.due_date, t.created_at, t.updated_at, t.metadata, t.is_archived,
           (t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS is_overdue,
           jsonb_build_object('id', d.id, 'name', d.name) AS department,
           jsonb_build_object('id', c.id, 'full_name', c.full_name, 'avatar_url', c.avatar_url) AS creator,
           (SELECT jsonb_agg(jsonb_build_object(
                'id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url
              ))
            FROM task_assignees ta JOIN profiles p ON p.id = ta.user_id
            WHERE ta.task_id = t.id) AS assignees
    FROM tasks t
    LEFT JOIN departments d ON d.id = t.department_id
    LEFT JOIN profiles    c ON c.id = t.created_by
    WHERE t.is_archived = FALSE
      AND (
        (p_scope = 'mine' AND (
          t.assignee_id = v_uid OR t.created_by = v_uid
          OR EXISTS (SELECT 1 FROM task_assignees ta
                     WHERE ta.task_id = t.id AND ta.user_id = v_uid)
        ))
        OR (p_scope = 'dept'   AND t.department_id = v_dept)
        OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
      )
    ORDER BY (t.due_date < v_now AND t.status NOT IN ('done','canceled')) DESC,
             t.due_date ASC NULLS LAST, t.created_at DESC
    LIMIT 50
  ) x;

  -- Resource view — chỉ manager/director/admin
  IF v_role IN ('manager', 'admin', 'director') THEN
    SELECT jsonb_agg(row_to_json(r.*) ORDER BY r.active_count DESC)
    INTO v_resource
    FROM (
      SELECT p.id AS user_id, p.full_name, p.avatar_url,
             COUNT(*) FILTER (WHERE t.status NOT IN ('done','canceled')) AS active_count,
             COUNT(*) FILTER (WHERE t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS overdue_count
      FROM task_assignees ta
      JOIN tasks t   ON t.id = ta.task_id
      JOIN profiles p ON p.id = ta.user_id
      WHERE t.is_archived = FALSE
        AND (
          (p_scope = 'dept'   AND t.department_id = v_dept)
          OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
          OR (p_scope = 'mine'   AND p.id = v_uid)
        )
      GROUP BY p.id, p.full_name, p.avatar_url
      HAVING COUNT(*) FILTER (WHERE t.status NOT IN ('done','canceled')) > 0
      LIMIT 20
    ) r;
  ELSE
    v_resource := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'counts',        COALESCE(v_counts,   '{}'::jsonb),
    'lists',         COALESCE(v_lists,    '[]'::jsonb),
    'resource_view', COALESCE(v_resource, '[]'::jsonb),
    'scope',         p_scope,
    'role',          v_role
  );
END $$;

GRANT EXECUTE ON FUNCTION tasks_dashboard(TEXT, JSONB) TO authenticated;


-- =====================================================================
-- §14. RPC — task_create
-- =====================================================================
CREATE OR REPLACE FUNCTION task_create(
  p_title        TEXT,
  p_description  TEXT,
  p_task_type    TEXT,           -- 'task' | 'report'
  p_priority     task_priority,
  p_due_date     TIMESTAMPTZ,
  p_dept_id      UUID,
  p_assignee_ids UUID[],
  p_metadata     JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_role    TEXT;
  v_dept    UUID;
  v_task_id UUID;
  v_a       UUID;
  v_creator_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT role, department_id, full_name
    INTO v_role, v_dept, v_creator_name
  FROM profiles WHERE id = v_uid;

  IF v_role IN ('driver', 'secretary', 'hr_officer') THEN
    RAISE EXCEPTION 'Vai trò của bạn không có quyền tạo công việc';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập tiêu đề công việc';
  END IF;
  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn hạn hoàn thành';
  END IF;
  IF p_task_type NOT IN ('task', 'report') THEN
    RAISE EXCEPTION 'Loại công việc không hợp lệ';
  END IF;

  -- Staff chỉ tự ghi chú cho mình
  IF v_role = 'staff' THEN
    IF p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) != 1 OR p_assignee_ids[1] != v_uid THEN
      RAISE EXCEPTION 'Bạn chỉ được tự ghi chú việc cho mình';
    END IF;
    IF p_task_type = 'report' THEN
      RAISE EXCEPTION 'Nhân viên không được tạo yêu cầu báo cáo';
    END IF;
    IF p_dept_id IS NULL THEN p_dept_id := v_dept; END IF;
  END IF;

  -- Luồng A bắt buộc có assignee
  IF p_task_type = 'task' AND (p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) = 0) THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận';
  END IF;

  -- Insert task
  INSERT INTO tasks (
    title, description, task_type, priority, due_date, department_id,
    assignee_id, created_by, status, metadata, is_archived
  ) VALUES (
    p_title, p_description, p_task_type,
    COALESCE(p_priority, 'medium'),
    p_due_date, p_dept_id,
    CASE
      WHEN p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0
        THEN p_assignee_ids[1]
      ELSE NULL
    END,
    v_uid, 'todo'::task_status, COALESCE(p_metadata, '{}'::jsonb), FALSE
  )
  RETURNING id INTO v_task_id;

  -- Insert assignees + notifications cá nhân
  IF p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
    FOREACH v_a IN ARRAY p_assignee_ids LOOP
      INSERT INTO task_assignees (task_id, user_id)
      VALUES (v_task_id, v_a)
      ON CONFLICT (task_id, user_id) DO NOTHING;

      IF v_a <> v_uid THEN
        INSERT INTO notifications (user_id, title, content, type, link)
        SELECT v_a,
               CASE WHEN p_task_type = 'report' THEN 'Bạn có yêu cầu báo cáo mới'
                    ELSE 'Bạn có công việc mới' END,
               v_creator_name || ' đã giao: ' || p_title,
               p_task_type,
               '/dashboard/tasks/' || v_task_id::text
        WHERE (SELECT role FROM profiles WHERE id = v_a) <> 'driver';
      END IF;
    END LOOP;
  ELSIF p_task_type = 'report' AND p_dept_id IS NOT NULL THEN
    -- Báo cáo chưa phân công → notify Trưởng phòng + Phó phòng của phòng đó
    INSERT INTO notifications (user_id, title, content, type, link)
    SELECT p.id,
           'Phòng có yêu cầu báo cáo mới',
           v_creator_name || ' đã yêu cầu: ' || p_title,
           'report',
           '/dashboard/tasks/' || v_task_id::text
    FROM profiles p
    WHERE p.department_id = p_dept_id
      AND p.role <> 'driver'
      AND (p.role = 'manager' OR p.is_department_head = TRUE)
      AND p.id <> v_uid;
  END IF;

  RETURN v_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_create(TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB) TO authenticated;


-- =====================================================================
-- §15. RPC — task_update_status (state machine)
-- =====================================================================
CREATE OR REPLACE FUNCTION task_update_status(
  p_task_id    UUID,
  p_new_status task_status,
  p_comment    TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_role          TEXT;
  v_dept          UUID;
  v_task          tasks%ROWTYPE;
  v_creator_dept  UUID;
  v_is_assignee   BOOLEAN;
  v_is_manager    BOOLEAN;
  v_is_top_admin  BOOLEAN;
  v_is_creator    BOOLEAN;
  v_is_creator_manager BOOLEAN;
  v_actor_name    TEXT;
  v_self_approve  BOOLEAN := FALSE;
  v_is_reopen     BOOLEAN := FALSE;
  v_is_return_sub BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, full_name INTO v_role, v_dept, v_actor_name
  FROM profiles WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  IF NOT user_can_see_task(p_task_id, v_uid) THEN
    RAISE EXCEPTION 'Bạn không có quyền với công việc này';
  END IF;

  SELECT department_id INTO v_creator_dept FROM profiles WHERE id = v_task.created_by;

  v_is_assignee  := (v_task.assignee_id = v_uid)
    OR EXISTS (SELECT 1 FROM task_assignees WHERE task_id = p_task_id AND user_id = v_uid);
  v_is_top_admin := v_role IN ('admin', 'director');
  v_is_manager   := v_is_top_admin
    OR (v_role = 'manager' AND v_task.department_id = v_dept);
  v_is_creator   := v_task.created_by = v_uid;
  v_is_creator_manager := (v_role = 'manager' AND v_dept = v_creator_dept);

  IF v_task.status = p_new_status THEN RETURN; END IF;

  -- State machine
  IF p_new_status = 'canceled' THEN
    RAISE EXCEPTION 'Hãy dùng task_cancel để hủy công việc';

  ELSIF p_new_status = 'doing' THEN
    IF v_task.status NOT IN ('todo', 'submitted', 'done') THEN
      RAISE EXCEPTION 'Không thể chuyển sang Đang làm từ trạng thái hiện tại';
    END IF;

    IF v_task.status = 'submitted' THEN
      IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
        RAISE EXCEPTION 'Vui lòng nhập lý do trả về';
      END IF;
      IF NOT (v_is_manager OR v_is_creator OR v_is_creator_manager) THEN
        RAISE EXCEPTION 'Bạn không có quyền trả về báo cáo này';
      END IF;
      v_is_return_sub := TRUE;

    ELSIF v_task.status = 'done' THEN
      IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
        RAISE EXCEPTION 'Vui lòng nhập lý do trả lại';
      END IF;
      IF NOT (v_is_manager OR v_is_creator OR v_is_creator_manager) THEN
        RAISE EXCEPTION 'Chỉ người giao hoặc cấp có thẩm quyền mới được mở lại báo cáo.';
      END IF;
      v_is_reopen := TRUE;

    ELSE
      -- todo → doing
      IF NOT (v_is_assignee OR v_is_manager) THEN
        RAISE EXCEPTION 'Bạn không có quyền chuyển trạng thái';
      END IF;
    END IF;

  ELSIF p_new_status = 'submitted' THEN
    IF v_task.task_type <> 'report' THEN
      RAISE EXCEPTION 'Chỉ báo cáo mới có trạng thái Đã nộp';
    END IF;
    IF NOT v_task.requires_approval THEN
      RAISE EXCEPTION 'Báo cáo này không cần duyệt, hãy bấm Hoàn thành';
    END IF;
    IF NOT v_is_assignee THEN
      RAISE EXCEPTION 'Chỉ người được giao mới được nộp báo cáo';
    END IF;
    IF v_task.status <> 'doing' THEN
      RAISE EXCEPTION 'Báo cáo cần đang thực hiện trước khi nộp';
    END IF;

  ELSIF p_new_status = 'done' THEN
    IF v_task.task_type = 'task' THEN
      IF NOT (v_is_assignee OR v_is_manager OR v_is_creator OR v_is_creator_manager OR v_is_top_admin) THEN
        RAISE EXCEPTION 'Bạn không có quyền hoàn thành công việc này';
      END IF;
      IF v_task.status NOT IN ('todo', 'doing') THEN
        RAISE EXCEPTION 'Không thể hoàn thành từ trạng thái hiện tại';
      END IF;
    ELSE
      -- Report
      IF v_task.requires_approval = FALSE THEN
        IF NOT (v_is_assignee OR v_is_creator OR v_is_creator_manager OR v_is_top_admin) THEN
          RAISE EXCEPTION 'Bạn không có quyền ghi nhận hoàn thành báo cáo này';
        END IF;
        IF v_task.status NOT IN ('todo', 'doing') THEN
          RAISE EXCEPTION 'Không thể hoàn thành từ trạng thái hiện tại';
        END IF;
        IF v_is_manager THEN v_self_approve := TRUE; END IF;
      ELSE
        -- Report requires approval
        IF v_task.status = 'submitted' THEN
          IF NOT (v_is_manager OR v_is_creator OR v_is_creator_manager OR v_is_top_admin) THEN
            RAISE EXCEPTION 'Bạn không có quyền duyệt / ghi nhận báo cáo';
          END IF;
        ELSIF v_task.status = 'doing' AND v_is_assignee AND v_is_manager THEN
          v_self_approve := TRUE;
        ELSIF v_task.status IN ('todo', 'doing') AND (v_is_creator OR v_is_creator_manager OR v_is_top_admin) THEN
          -- Force complete
          v_self_approve := FALSE;
        ELSE
          RAISE EXCEPTION 'Báo cáo cần được nộp trước khi duyệt';
        END IF;
      END IF;
    END IF;

  ELSIF p_new_status = 'todo' THEN
    IF NOT v_is_manager THEN
      RAISE EXCEPTION 'Chỉ Trưởng phòng được đặt lại trạng thái Chưa làm';
    END IF;

  ELSE
    RAISE EXCEPTION 'Trạng thái không hợp lệ: %', p_new_status;
  END IF;

  -- Update trạng thái
  IF v_is_reopen OR v_is_return_sub THEN
    UPDATE tasks
    SET status = p_new_status,
        last_returned_at  = NOW(),
        last_return_reason = p_comment
    WHERE id = p_task_id;
  ELSE
    UPDATE tasks SET status = p_new_status WHERE id = p_task_id;
  END IF;

  -- Ghi nhận lịch sử
  IF v_self_approve THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            v_actor_name || ' đã hoàn thành.');
  ELSIF p_new_status = 'done' THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            CASE WHEN v_task.task_type = 'report' AND v_task.status = 'submitted'
                 THEN v_actor_name || ' đã duyệt báo cáo.'
                 ELSE v_actor_name || ' đã hoàn thành.' END);
  END IF;

  IF v_is_reopen THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            v_actor_name || ' trả lại báo cáo đã hoàn thành. Lý do: ' || p_comment);
  ELSIF v_is_return_sub THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            v_actor_name || ' trả về báo cáo để sửa. Lý do: ' || p_comment);
  ELSIF p_comment IS NOT NULL AND length(trim(p_comment)) > 0 THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid, p_comment);
  END IF;

  -- Notify (trừ actor + driver)
  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT u,
         CASE WHEN v_is_reopen THEN 'Báo cáo bị trả lại'
              WHEN v_is_return_sub THEN 'Báo cáo cần sửa lại'
              ELSE 'Trạng thái công việc đã đổi' END,
         v_actor_name || ' → "' || v_task.title || '": ' ||
           CASE p_new_status
             WHEN 'doing'     THEN
               CASE WHEN v_is_reopen THEN 'Cần làm lại — ' || COALESCE(p_comment, '')
                    WHEN v_is_return_sub THEN 'Trả về sửa — ' || COALESCE(p_comment, '')
                    ELSE 'Đang làm' END
             WHEN 'submitted' THEN 'Đã nộp'
             WHEN 'done'      THEN 'Hoàn thành'
             WHEN 'todo'      THEN 'Chưa làm'
             ELSE p_new_status::text
           END,
         v_task.task_type,
         '/dashboard/tasks?id=' || p_task_id::text
  FROM (
    SELECT v_task.created_by AS u
    UNION
    SELECT user_id FROM task_assignees WHERE task_id = p_task_id
  ) tg
  WHERE u IS NOT NULL
    AND u <> v_uid
    AND (SELECT role FROM profiles WHERE id = u) <> 'driver';
END $$;

GRANT EXECUTE ON FUNCTION task_update_status(UUID, task_status, TEXT) TO authenticated;


-- =====================================================================
-- §16. RPC — task_delegate
-- =====================================================================
CREATE OR REPLACE FUNCTION task_delegate(
  p_task_id      UUID,
  p_assignee_ids UUID[]
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_role      TEXT;
  v_dept      UUID;
  v_task      tasks%ROWTYPE;
  v_actor     TEXT;
  v_a         UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, full_name INTO v_role, v_dept, v_actor
  FROM profiles WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;

  IF NOT (
    v_role IN ('admin', 'director')
    OR (v_role = 'manager' AND v_task.department_id = v_dept)
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền phân công công việc này';
  END IF;

  IF p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận';
  END IF;

  -- Replace assignees
  DELETE FROM task_assignees WHERE task_id = p_task_id;
  FOREACH v_a IN ARRAY p_assignee_ids LOOP
    INSERT INTO task_assignees (task_id, user_id)
    VALUES (p_task_id, v_a)
    ON CONFLICT (task_id, user_id) DO NOTHING;
  END LOOP;

  UPDATE tasks
  SET assignee_id = p_assignee_ids[1],
      status = CASE WHEN v_task.status = 'todo' THEN 'doing'::task_status ELSE v_task.status END
  WHERE id = p_task_id;

  -- Notify new assignees
  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT a,
         'Bạn được phân công công việc mới',
         v_actor || ' đã phân công: ' || v_task.title,
         v_task.task_type,
         '/dashboard/tasks/' || p_task_id::text
  FROM unnest(p_assignee_ids) a
  WHERE a <> v_uid
    AND (SELECT role FROM profiles WHERE id = a) <> 'driver';
END $$;

GRANT EXECUTE ON FUNCTION task_delegate(UUID, UUID[]) TO authenticated;


-- =====================================================================
-- §17. RPC — task_request_extension
-- =====================================================================
CREATE OR REPLACE FUNCTION task_request_extension(
  p_task_id      UUID,
  p_new_due_date TIMESTAMPTZ,
  p_reason       TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_task   tasks%ROWTYPE;
  v_actor  TEXT;
  v_ext_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT full_name INTO v_actor FROM profiles WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;

  IF v_task.assignee_id <> v_uid AND NOT EXISTS (
    SELECT 1 FROM task_assignees WHERE task_id = p_task_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Chỉ người được giao mới được xin gia hạn';
  END IF;

  IF v_task.status IN ('done', 'canceled') THEN
    RAISE EXCEPTION 'Công việc đã đóng, không thể gia hạn';
  END IF;
  IF p_new_due_date IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn ngày gia hạn mới';
  END IF;
  IF v_task.due_date IS NOT NULL AND p_new_due_date <= v_task.due_date THEN
    RAISE EXCEPTION 'Ngày gia hạn phải sau hạn cũ';
  END IF;

  INSERT INTO task_extension_requests (task_id, requested_by, reason, old_due_date, new_due_date)
  VALUES (p_task_id, v_uid, p_reason, v_task.due_date, p_new_due_date)
  RETURNING id INTO v_ext_id;

  -- Notify creator + dept managers (trừ requester + driver)
  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT p.id,
         'Có yêu cầu gia hạn',
         v_actor || ' xin gia hạn: ' || v_task.title,
         'extension',
         '/dashboard/tasks/' || p_task_id::text
  FROM profiles p
  WHERE p.id <> v_uid
    AND p.role <> 'driver'
    AND (
      p.id = v_task.created_by
      OR (p.department_id = v_task.department_id
          AND (p.role = 'manager' OR p.is_department_head = TRUE))
    );

  RETURN v_ext_id;
END $$;

GRANT EXECUTE ON FUNCTION task_request_extension(UUID, TIMESTAMPTZ, TEXT) TO authenticated;


-- =====================================================================
-- §18. RPC — task_decide_extension
-- =====================================================================
CREATE OR REPLACE FUNCTION task_decide_extension(
  p_extension_id UUID,
  p_approve      BOOLEAN,
  p_comment      TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_role  TEXT;
  v_dept  UUID;
  v_ext   task_extension_requests%ROWTYPE;
  v_task  tasks%ROWTYPE;
  v_actor TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, full_name INTO v_role, v_dept, v_actor
  FROM profiles WHERE id = v_uid;

  SELECT * INTO v_ext FROM task_extension_requests WHERE id = p_extension_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy yêu cầu gia hạn'; END IF;
  IF v_ext.status <> 'pending' THEN
    RAISE EXCEPTION 'Yêu cầu đã được xử lý';
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = v_ext.task_id;

  IF NOT (
    v_role IN ('admin', 'director')
    OR (v_role = 'manager' AND v_task.department_id = v_dept)
    OR v_task.created_by = v_uid
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền duyệt yêu cầu này';
  END IF;

  UPDATE task_extension_requests
  SET status         = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by    = v_uid,
      review_comment = p_comment,
      decided_at     = NOW()
  WHERE id = p_extension_id;

  IF p_approve THEN
    UPDATE tasks SET due_date = v_ext.new_due_date WHERE id = v_ext.task_id;
  END IF;

  -- Notify requester
  INSERT INTO notifications (user_id, title, content, type, link)
  VALUES (v_ext.requested_by,
          CASE WHEN p_approve THEN 'Đã duyệt gia hạn' ELSE 'Đã từ chối gia hạn' END,
          v_actor || ' — "' || v_task.title || '"' ||
            CASE WHEN p_comment IS NOT NULL AND length(trim(p_comment)) > 0
                 THEN ': ' || p_comment ELSE '' END,
          'extension',
          '/dashboard/tasks/' || v_ext.task_id::text);
END $$;

GRANT EXECUTE ON FUNCTION task_decide_extension(UUID, BOOLEAN, TEXT) TO authenticated;


-- =====================================================================
-- §19. RPC — task_add_comment
-- =====================================================================
CREATE OR REPLACE FUNCTION task_add_comment(
  p_task_id        UUID,
  p_body           TEXT,
  p_attachment_ids UUID[] DEFAULT NULL  -- P2: link sang task_attachments
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_task       tasks%ROWTYPE;
  v_comment_id UUID;
  v_actor      TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập nội dung';
  END IF;
  IF NOT user_can_see_task(p_task_id, v_uid) THEN
    RAISE EXCEPTION 'Bạn không có quyền bình luận';
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  SELECT full_name INTO v_actor FROM profiles WHERE id = v_uid;

  INSERT INTO task_comments (task_id, user_id, content)
  VALUES (p_task_id, v_uid, p_body)
  RETURNING id INTO v_comment_id;

  -- P2 sẽ link attachment.comment_id sau khi bảng task_attachments được tạo.
  -- Tạm thời chỉ trả comment_id, client tự update.

  -- Notify participants (trừ author + driver)
  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT u,
         'Bình luận mới',
         v_actor || ' đã bình luận: ' || v_task.title,
         'comment',
         '/dashboard/tasks/' || p_task_id::text
  FROM (
    SELECT v_task.created_by AS u
    UNION
    SELECT user_id FROM task_assignees WHERE task_id = p_task_id
  ) tg
  WHERE u IS NOT NULL
    AND u <> v_uid
    AND (SELECT role FROM profiles WHERE id = u) <> 'driver';

  RETURN v_comment_id;
END $$;

GRANT EXECUTE ON FUNCTION task_add_comment(UUID, TEXT, UUID[]) TO authenticated;


-- =====================================================================
-- §20. RPC — task_cancel (creator + assignee + manager đều được)
-- =====================================================================
CREATE OR REPLACE FUNCTION task_cancel(
  p_task_id UUID,
  p_reason  TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_task  tasks%ROWTYPE;
  v_actor TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT full_name INTO v_actor FROM profiles WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  IF NOT user_can_see_task(p_task_id, v_uid) THEN
    RAISE EXCEPTION 'Bạn không có quyền hủy công việc này';
  END IF;
  IF v_task.status IN ('done', 'canceled') THEN
    RAISE EXCEPTION 'Công việc đã đóng';
  END IF;

  UPDATE tasks SET status = 'canceled' WHERE id = p_task_id;

  -- System comment
  INSERT INTO task_comments (task_id, user_id, content)
  VALUES (p_task_id, v_uid,
          'Đã hủy công việc' ||
          CASE WHEN p_reason IS NOT NULL AND length(trim(p_reason)) > 0
               THEN '. Lý do: ' || p_reason ELSE '' END);

  -- Notify others
  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT u,
         'Công việc đã bị hủy',
         v_actor || ' đã hủy: ' || v_task.title ||
         CASE WHEN p_reason IS NOT NULL AND length(trim(p_reason)) > 0
              THEN ' — ' || p_reason ELSE '' END,
         v_task.task_type,
         '/dashboard/tasks/' || p_task_id::text
  FROM (
    SELECT v_task.created_by AS u
    UNION
    SELECT user_id FROM task_assignees WHERE task_id = p_task_id
  ) tg
  WHERE u IS NOT NULL
    AND u <> v_uid
    AND (SELECT role FROM profiles WHERE id = u) <> 'driver';
END $$;

GRANT EXECUTE ON FUNCTION task_cancel(UUID, TEXT) TO authenticated;


-- =====================================================================
-- §21. RPC — task_archive (admin/director)
-- =====================================================================
CREATE OR REPLACE FUNCTION task_archive(
  p_task_id UUID,
  p_archive BOOLEAN DEFAULT TRUE
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'director') THEN
    RAISE EXCEPTION 'Chỉ quản trị viên / Giám đốc được lưu trữ công việc';
  END IF;
  UPDATE tasks SET is_archived = p_archive WHERE id = p_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_archive(UUID, BOOLEAN) TO authenticated;


-- =====================================================================
-- §22. RELOAD POSTGREST
-- =====================================================================
NOTIFY pgrst, 'reload schema';


-- =====================================================================
-- §23. QUERIES VERIFY (chạy thủ công sau migration)
-- =====================================================================
-- SELECT enum_range(NULL::task_status);
--   ⇒ phải có 'submitted', 'canceled'; 'late','closed' vẫn còn (deprecated)
--
-- SELECT enum_range(NULL::task_priority);
--   ⇒ phải có 'low','medium','high'
--
-- SELECT COUNT(*) FROM information_schema.columns
-- WHERE table_name='tasks'
--   AND column_name IN ('target_value','current_value','unit','progress');
--   ⇒ = 0
--
-- SELECT proname FROM pg_proc
-- WHERE pronamespace='public'::regnamespace
--   AND (proname LIKE 'task_%' OR proname='tasks_dashboard' OR proname='user_can_see_task')
-- ORDER BY proname;
--   ⇒ phải thấy: task_add_comment, task_archive, task_cancel, task_create,
--               task_decide_extension, task_delegate, task_request_extension,
--               task_update_status, tasks_dashboard, user_can_see_task
--
-- SELECT * FROM tasks_dashboard('mine', '{}'::jsonb);
--   (chạy trong SQL Editor với "Switch role" → authenticated)
-- =====================================================================


-- ==============================================================================
-- [migration_tasks_attachments.sql]


-- ==============================================================================
-- [migration_tasks_recurring.sql]
-- ==============================================================================
-- =====================================================================
-- MIGRATION: TASK RECURRING TEMPLATES (P3)
-- =====================================================================
-- Cho phép Director/Manager đặt lịch tự sinh task định kỳ
-- (vd: Thứ 6 15:00 hằng tuần → tự sinh task báo cáo cho 4 phòng).
--
-- Hỗ trợ 2 schedule_kind: 'weekly' và 'monthly'. Custom cron để dành.
--
-- Engine fire định kỳ:
--   1) Khuyến nghị: pg_cron (chạy mỗi 15 phút) — cần enable extension
--      qua Supabase Dashboard → Database → Extensions → pg_cron.
--   2) Fallback: gọi RPC recurring_fire_due() từ Vercel cron / cron tự
--      build (xem app/api/cron/notifications/route.ts).
-- =====================================================================

CREATE TABLE IF NOT EXISTS task_recurring_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  description           TEXT,
  task_type             TEXT NOT NULL DEFAULT 'report'
                          CHECK (task_type = 'report'),
  priority              task_priority NOT NULL DEFAULT 'medium',

  target_department_ids UUID[] NOT NULL DEFAULT '{}',
  target_user_ids       UUID[] NOT NULL DEFAULT '{}',

  schedule_kind         TEXT NOT NULL DEFAULT 'weekly'
                          CHECK (schedule_kind IN ('weekly', 'monthly')),
  weekly_dow            SMALLINT CHECK (weekly_dow BETWEEN 0 AND 6),
  weekly_time           TIME,
  monthly_dom           SMALLINT CHECK (monthly_dom BETWEEN 1 AND 31),
  monthly_time          TIME,

  timezone              TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  due_days_after_fire   INT NOT NULL DEFAULT 7 CHECK (due_days_after_fire > 0),
  due_time              TIME NOT NULL DEFAULT '17:00',

  created_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  last_fired_at         TIMESTAMPTZ,
  next_run_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_active_next
  ON task_recurring_templates(next_run_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_recurring_created_by
  ON task_recurring_templates(created_by);


CREATE OR REPLACE FUNCTION _touch_recurring_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_recurring_touch_updated ON task_recurring_templates;
CREATE TRIGGER trg_recurring_touch_updated
  BEFORE UPDATE ON task_recurring_templates
  FOR EACH ROW EXECUTE FUNCTION _touch_recurring_updated();


-- =====================================================================
-- Helper: tính next_run_at dựa schedule_kind
-- =====================================================================
CREATE OR REPLACE FUNCTION _recurring_next_run(
  p_kind       TEXT,
  p_weekly_dow SMALLINT,
  p_weekly_time TIME,
  p_monthly_dom SMALLINT,
  p_monthly_time TIME,
  p_timezone   TEXT,
  p_after      TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_local      TIMESTAMP;
  v_dow        SMALLINT;
  v_days       SMALLINT;
  v_year       INT;
  v_month      INT;
  v_dom_clamp  INT;
  v_candidate  TIMESTAMP;
  v_last_day   INT;
BEGIN
  v_local := (p_after AT TIME ZONE p_timezone)::timestamp;

  IF p_kind = 'weekly' THEN
    IF p_weekly_dow IS NULL OR p_weekly_time IS NULL THEN RETURN NULL; END IF;
    v_dow := EXTRACT(DOW FROM v_local)::smallint;
    v_days := ((p_weekly_dow - v_dow) + 7) % 7;
    IF v_days = 0 AND v_local::time >= p_weekly_time THEN v_days := 7; END IF;
    v_candidate := (v_local::date + v_days)::timestamp + p_weekly_time;
    RETURN v_candidate AT TIME ZONE p_timezone;

  ELSIF p_kind = 'monthly' THEN
    IF p_monthly_dom IS NULL OR p_monthly_time IS NULL THEN RETURN NULL; END IF;
    v_year := EXTRACT(YEAR FROM v_local)::int;
    v_month := EXTRACT(MONTH FROM v_local)::int;
    v_last_day := EXTRACT(DAY FROM (date_trunc('month', make_date(v_year, v_month, 1))
                                    + interval '1 month - 1 day'))::int;
    v_dom_clamp := LEAST(p_monthly_dom, v_last_day);
    v_candidate := make_date(v_year, v_month, v_dom_clamp)::timestamp + p_monthly_time;
    IF (v_candidate AT TIME ZONE p_timezone) <= p_after THEN
      IF v_month = 12 THEN v_month := 1; v_year := v_year + 1; ELSE v_month := v_month + 1; END IF;
      v_last_day := EXTRACT(DAY FROM (date_trunc('month', make_date(v_year, v_month, 1))
                                      + interval '1 month - 1 day'))::int;
      v_dom_clamp := LEAST(p_monthly_dom, v_last_day);
      v_candidate := make_date(v_year, v_month, v_dom_clamp)::timestamp + p_monthly_time;
    END IF;
    RETURN v_candidate AT TIME ZONE p_timezone;
  END IF;

  RETURN NULL;
END $$;


-- =====================================================================
-- RLS
-- =====================================================================
ALTER TABLE task_recurring_templates ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='task_recurring_templates' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON task_recurring_templates', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "recurring_select" ON task_recurring_templates FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin', 'director')
  OR public.current_user_role() = 'manager'
  OR created_by = auth.uid()
);

CREATE POLICY "recurring_no_direct_write" ON task_recurring_templates
  FOR ALL TO authenticated USING (FALSE) WITH CHECK (FALSE);


-- =====================================================================
-- RPCs
-- =====================================================================

CREATE OR REPLACE FUNCTION recurring_template_upsert(
  p_id                    UUID,
  p_title                 TEXT,
  p_description           TEXT,
  p_priority              task_priority,
  p_target_department_ids UUID[],
  p_target_user_ids       UUID[],
  p_schedule_kind         TEXT,
  p_weekly_dow            SMALLINT,
  p_weekly_time           TIME,
  p_monthly_dom           SMALLINT,
  p_monthly_time          TIME,
  p_timezone              TEXT,
  p_due_days_after_fire   INT,
  p_due_time              TIME,
  p_is_active             BOOLEAN
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
  v_id   UUID;
  v_next TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'director', 'manager') THEN
    RAISE EXCEPTION 'Bạn không có quyền tạo lịch định kỳ';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập tiêu đề';
  END IF;
  IF p_schedule_kind NOT IN ('weekly', 'monthly') THEN
    RAISE EXCEPTION 'Loại lịch không hợp lệ';
  END IF;
  IF p_schedule_kind = 'weekly' AND (p_weekly_dow IS NULL OR p_weekly_time IS NULL) THEN
    RAISE EXCEPTION 'Vui lòng chọn thứ và giờ trong tuần';
  END IF;
  IF p_schedule_kind = 'monthly' AND (p_monthly_dom IS NULL OR p_monthly_time IS NULL) THEN
    RAISE EXCEPTION 'Vui lòng chọn ngày và giờ trong tháng';
  END IF;

  v_next := _recurring_next_run(
    p_schedule_kind, p_weekly_dow, p_weekly_time,
    p_monthly_dom, p_monthly_time, p_timezone, NOW()
  );

  IF p_id IS NULL THEN
    INSERT INTO task_recurring_templates (
      title, description, priority,
      target_department_ids, target_user_ids,
      schedule_kind, weekly_dow, weekly_time, monthly_dom, monthly_time,
      timezone, due_days_after_fire, due_time,
      created_by, is_active, next_run_at
    ) VALUES (
      p_title, p_description, COALESCE(p_priority, 'medium'),
      COALESCE(p_target_department_ids, '{}'), COALESCE(p_target_user_ids, '{}'),
      p_schedule_kind, p_weekly_dow, p_weekly_time, p_monthly_dom, p_monthly_time,
      COALESCE(p_timezone, 'Asia/Ho_Chi_Minh'), COALESCE(p_due_days_after_fire, 7), COALESCE(p_due_time, '17:00'::TIME),
      v_uid, COALESCE(p_is_active, TRUE), v_next
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE task_recurring_templates
    SET title = p_title,
        description = p_description,
        priority = COALESCE(p_priority, 'medium'),
        target_department_ids = COALESCE(p_target_department_ids, '{}'),
        target_user_ids = COALESCE(p_target_user_ids, '{}'),
        schedule_kind = p_schedule_kind,
        weekly_dow = p_weekly_dow,
        weekly_time = p_weekly_time,
        monthly_dom = p_monthly_dom,
        monthly_time = p_monthly_time,
        timezone = COALESCE(p_timezone, 'Asia/Ho_Chi_Minh'),
        due_days_after_fire = COALESCE(p_due_days_after_fire, 7),
        is_active = COALESCE(p_is_active, is_active),
        next_run_at = v_next
    WHERE id = p_id
      AND (created_by = v_uid OR v_role IN ('admin', 'director'))
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Không tìm thấy hoặc không có quyền sửa'; END IF;
  END IF;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_upsert(
  UUID, TEXT, TEXT, task_priority, UUID[], UUID[],
  TEXT, SMALLINT, TIME, SMALLINT, TIME, TEXT, INT, TIME, BOOLEAN
) TO authenticated;


CREATE OR REPLACE FUNCTION recurring_template_delete(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  DELETE FROM task_recurring_templates
  WHERE id = p_id
    AND (created_by = v_uid OR v_role IN ('admin', 'director'));
  IF NOT FOUND THEN RAISE EXCEPTION 'Không có quyền hoặc không tìm thấy'; END IF;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_delete(UUID) TO authenticated;


CREATE OR REPLACE FUNCTION recurring_template_toggle(p_id UUID, p_active BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  UPDATE task_recurring_templates
  SET is_active = p_active
  WHERE id = p_id
    AND (created_by = v_uid OR v_role IN ('admin', 'director'));
  IF NOT FOUND THEN RAISE EXCEPTION 'Không có quyền hoặc không tìm thấy'; END IF;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_toggle(UUID, BOOLEAN) TO authenticated;


-- =====================================================================
-- recurring_fire_due — sinh task cho mọi template đã đến hạn
-- =====================================================================
CREATE OR REPLACE FUNCTION recurring_fire_due()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_template     task_recurring_templates%ROWTYPE;
  v_task_id      UUID;
  v_due          TIMESTAMPTZ;
  v_count        INT := 0;
  v_creator_name TEXT;
  v_dept         UUID;
  v_assignee     UUID;
BEGIN
  FOR v_template IN
    SELECT * FROM task_recurring_templates
    WHERE is_active = TRUE
      AND next_run_at IS NOT NULL
      AND next_run_at <= NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Tính deadline = fire_time + N ngày
    v_due := v_template.next_run_at + (v_template.due_days_after_fire || ' days')::interval;
    SELECT full_name INTO v_creator_name FROM profiles WHERE id = v_template.created_by;

    -- Sinh task cho từng department (luồng B — chờ TP phân công)
    IF array_length(v_template.target_department_ids, 1) > 0 THEN
      FOREACH v_dept IN ARRAY v_template.target_department_ids LOOP
        INSERT INTO tasks (
          title, description, task_type, priority, due_date,
          department_id, created_by, status, metadata
        ) VALUES (
          v_template.title, v_template.description, v_template.task_type,
          v_template.priority, v_due,
          v_dept, v_template.created_by, 'todo',
          jsonb_build_object('recurring_template_id', v_template.id)
        )
        RETURNING id INTO v_task_id;

        -- Notify TP phòng đó
        INSERT INTO notifications (user_id, title, content, type, link)
        SELECT p.id,
               'Yêu cầu báo cáo định kỳ',
               COALESCE(v_creator_name, 'Hệ thống tự động') || ' đã sinh tự động: ' || v_template.title,
               v_template.task_type,
               '/dashboard/tasks?id=' || v_task_id::text
        FROM profiles p
        WHERE p.department_id = v_dept
          AND p.role <> 'driver'
          AND (p.role = 'manager' OR p.is_department_head = TRUE);

        v_count := v_count + 1;
      END LOOP;
    END IF;

    -- Sinh task cho từng user đích danh
    IF array_length(v_template.target_user_ids, 1) > 0 THEN
      FOREACH v_assignee IN ARRAY v_template.target_user_ids LOOP
        INSERT INTO tasks (
          title, description, task_type, priority, due_date,
          department_id, assignee_id, created_by, status, metadata
        )
        SELECT v_template.title, v_template.description, v_template.task_type,
               v_template.priority, v_due,
               p.department_id, p.id, v_template.created_by, 'todo',
               jsonb_build_object('recurring_template_id', v_template.id)
        FROM profiles p WHERE p.id = v_assignee
        RETURNING id INTO v_task_id;

        IF v_task_id IS NOT NULL THEN
          INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_assignee)
          ON CONFLICT DO NOTHING;
          INSERT INTO notifications (user_id, title, content, type, link)
          VALUES (v_assignee,
                  'Công việc định kỳ',
                  COALESCE(v_creator_name, 'Hệ thống tự động') || ' đã giao: ' || v_template.title,
                  v_template.task_type,
                  '/dashboard/tasks?id=' || v_task_id::text);
          v_count := v_count + 1;
        END IF;
      END LOOP;
    END IF;

    -- Cập nhật template: last_fired + next_run mới
    UPDATE task_recurring_templates
    SET last_fired_at = v_template.next_run_at,
        next_run_at = _recurring_next_run(
          schedule_kind, weekly_dow, weekly_time,
          monthly_dom, monthly_time, timezone,
          GREATEST(v_template.next_run_at, NOW())
        )
    WHERE id = v_template.id;
  END LOOP;

  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION recurring_fire_due() TO authenticated, service_role;


-- =====================================================================
-- pg_cron schedule — yêu cầu enable extension trước
-- =====================================================================
-- Bỏ qua nếu pg_cron chưa enable. User tự enable qua:
--   Dashboard → Database → Extensions → tìm 'pg_cron' → Enable
-- Sau đó chạy lại block dưới:

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('fire-recurring-tasks')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fire-recurring-tasks');
    PERFORM cron.schedule(
      'fire-recurring-tasks',
      '*/15 * * * *',
      $cron$SELECT public.recurring_fire_due();$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- =====================================================================
-- Reminder engine — nhắc nhở lịch trình 30 phút, công việc sắp hết hạn
-- =====================================================================

-- Add reminded_at columns
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;

-- =====================================================================
CREATE OR REPLACE FUNCTION check_reminders()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT := 0;
BEGIN
  -- 1a. Nhắc lịch trình 30 phút trước giờ bắt đầu (cho participants)
  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT ON (sp.profile_id, s.id)
    sp.profile_id,
    CASE WHEN s.use_vehicle AND s.driver_id IS NOT NULL
      THEN 'Sắp đến lịch trình 🚗'
      ELSE 'Sắp đến lịch trình'
    END,
    CASE WHEN s.use_vehicle AND s.driver_id IS NOT NULL
      THEN 'Lịch "' || s.title || '" của bạn sẽ diễn ra sau 30 phút, từ ' || to_char(s.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI') || ' đến ' || to_char(s.end_time AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI') || '. Xe đã được điều phối.'
      ELSE 'Lịch "' || s.title || '" sẽ diễn ra sau 30 phút, từ ' || to_char(s.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI') || ' đến ' || to_char(s.end_time AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI')
    END,
    'schedule',
    '/dashboard/schedule?id=' || s.id
  FROM schedules s
  JOIN schedule_participants sp ON sp.schedule_id = s.id
  WHERE s.start_time BETWEEN NOW() AND NOW() + INTERVAL '30 minutes'
    AND s.reminded_at IS NULL
    AND s.status IN ('approved', 'in_progress');
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- 1b. Nhắc lịch trình 30 phút trước giờ bắt đầu (cho tài xế được gán)
  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT ON (s.driver_id, s.id)
    s.driver_id,
    'Sắp đến lịch trình - Lái xe',
    'Bạn có lịch lái xe "' || s.title || '" sau 30 phút, từ ' || to_char(s.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI') || ' đến ' || to_char(s.end_time AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI') || '. Vui lòng kiểm tra và chuẩn bị.',
    'schedule',
    '/dashboard/schedule?id=' || s.id
  FROM schedules s
  WHERE s.start_time BETWEEN NOW() AND NOW() + INTERVAL '30 minutes'
    AND s.reminded_at IS NULL
    AND s.status IN ('approved', 'in_progress')
    AND s.driver_id IS NOT NULL;
  GET DIAGNOSTICS v_count = v_count + ROW_COUNT;

  -- Đánh dấu đã nhắc cho cả lịch (chạy 1 lần cho cả participant + driver)
  UPDATE schedules SET reminded_at = NOW()
  WHERE start_time BETWEEN NOW() AND NOW() + INTERVAL '30 minutes'
    AND reminded_at IS NULL
    AND status IN ('approved', 'in_progress');

  -- 2. Nhắc công việc sắp hết hạn (1 tiếng trước deadline)
  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT ON (ta.user_id, t.id)
    ta.user_id,
    'Sắp hết hạn công việc',
    'Công việc "' || t.title || '" hết hạn lúc ' || to_char(t.due_date AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI dd/MM'),
    'task',
    '/dashboard/tasks?id=' || t.id
  FROM tasks t
  JOIN task_assignees ta ON ta.task_id = t.id
  WHERE t.due_date BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
    AND t.reminded_at IS NULL
    AND t.status IN ('todo', 'doing', 'submitted');
  v_count := v_count + ROW_COUNT;

  UPDATE tasks SET reminded_at = NOW()
  WHERE due_date BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
    AND reminded_at IS NULL
    AND status IN ('todo', 'doing', 'submitted');

  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION check_reminders() TO authenticated, service_role;

-- pg_cron cho reminders mỗi 5 phút
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('check-reminders')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-reminders');
    PERFORM cron.schedule(
      'check-reminders',
      '*/5 * * * *',
      $cron$SELECT public.check_reminders();$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


NOTIFY pgrst, 'reload schema';


-- ==============================================================================
-- [migration_tasks_analytics.sql]
-- ==============================================================================
-- =====================================================================
-- MIGRATION: TASKS ANALYTICS RPC (P4)
-- =====================================================================
-- Gộp counts + daily + by_department + top_people trong 1 RPC.
-- Phân quyền: admin/director toàn nhánh; manager phòng mình.
-- =====================================================================

CREATE OR REPLACE FUNCTION tasks_analytics(
  p_from DATE,
  p_to   DATE,
  p_dept_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_role      TEXT;
  v_dept      UUID;
  v_dept_code TEXT;
  v_now       TIMESTAMPTZ := NOW();
  v_scope_dept UUID;
  v_totals    JSONB;
  v_daily     JSONB;
  v_by_dept   JSONB;
  v_top       JSONB;
  v_resource  JSONB;
  v_recur     INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT p.role, p.department_id, d.code
    INTO v_role, v_dept, v_dept_code
    FROM profiles p
    LEFT JOIN departments d ON d.id = p.department_id
   WHERE p.id = v_uid;

  IF v_role NOT IN ('admin', 'director', 'manager') AND NOT (v_role = 'staff' AND v_dept_code = '13602') THEN
    RAISE EXCEPTION 'Bạn không có quyền xem báo cáo';
  END IF;

  v_scope_dept := CASE WHEN v_role IN ('admin', 'director') OR v_dept_code = '13602' THEN p_dept_id ELSE v_dept END;

  -- Totals
  WITH base AS (
    SELECT * FROM tasks
    WHERE created_at::date BETWEEN p_from AND p_to
      AND (v_scope_dept IS NULL OR department_id = v_scope_dept)
      AND is_archived = FALSE
  )
  SELECT jsonb_build_object(
    'completed',         COUNT(*) FILTER (WHERE status = 'done'),
    'overdue',           COUNT(*) FILTER (WHERE due_date < v_now AND status NOT IN ('done','canceled')),
    'submitted_pending', COUNT(*) FILTER (WHERE status = 'submitted'),
    'extensions_pending', (
      SELECT COUNT(*) FROM task_extension_requests er
      JOIN tasks t ON t.id = er.task_id
      WHERE er.status = 'pending'
        AND t.created_at::date BETWEEN p_from AND p_to
        AND (v_scope_dept IS NULL OR t.department_id = v_scope_dept)
    ),
    'total', COUNT(*),
    'canceled', COUNT(*) FILTER (WHERE status = 'canceled')
  )
  INTO v_totals FROM base;

  -- Daily completed
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

  -- By department (chỉ admin/director thấy nhiều phòng; manager chỉ thấy mình)
  SELECT jsonb_agg(row_to_json(r.*) ORDER BY r.overdue DESC, r.active DESC)
  INTO v_by_dept
  FROM (
    SELECT dept.id AS dept_id, dept.name AS dept_name,
           COUNT(t.id) FILTER (WHERE t.status NOT IN ('done','canceled') AND t.is_archived = FALSE) AS active,
           COUNT(t.id) FILTER (WHERE t.due_date < v_now AND t.status NOT IN ('done','canceled') AND t.is_archived = FALSE) AS overdue,
           COUNT(t.id) FILTER (WHERE t.status = 'done' AND t.updated_at::date BETWEEN p_from AND p_to) AS completed
    FROM departments dept
    LEFT JOIN tasks t ON t.department_id = dept.id
    WHERE (v_scope_dept IS NULL OR dept.id = v_scope_dept)
    GROUP BY dept.id, dept.name
    HAVING COUNT(t.id) > 0
  ) r;

  -- Top people (ai ôm nhiều việc)
  SELECT jsonb_agg(row_to_json(p.*) ORDER BY p.active DESC, p.overdue DESC)
  INTO v_top
  FROM (
    SELECT pr.id AS user_id, pr.full_name, pr.avatar_url,
           dpt.name AS department_name,
           COUNT(ta.task_id) FILTER (WHERE t.status NOT IN ('done','canceled') AND t.is_archived = FALSE) AS active,
           COUNT(ta.task_id) FILTER (WHERE t.due_date < v_now AND t.status NOT IN ('done','canceled') AND t.is_archived = FALSE) AS overdue,
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

  -- Recurring count
  SELECT COUNT(*) INTO v_recur
  FROM task_recurring_templates
  WHERE is_active = TRUE
    AND (v_scope_dept IS NULL
         OR v_scope_dept = ANY(target_department_ids)
         OR EXISTS (
           SELECT 1 FROM profiles p
           WHERE p.id = ANY(target_user_ids) AND p.department_id = v_scope_dept
         ));

  -- Resource view: phân bổ công việc theo cán bộ
  SELECT COALESCE(jsonb_agg(r.* ORDER BY r.active_count DESC), '[]'::jsonb)
  INTO v_resource
  FROM (
    SELECT ta.user_id, p.full_name, p.avatar_url,
           COUNT(*) FILTER (WHERE t.status NOT IN ('done','canceled')) AS active_count,
           COUNT(*) FILTER (WHERE t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS overdue_count
    FROM task_assignees ta
    JOIN tasks t ON t.id = ta.task_id
    JOIN profiles p ON p.id = ta.user_id
    WHERE t.is_archived = FALSE
      AND (v_scope_dept IS NULL OR t.department_id = v_scope_dept)
    GROUP BY ta.user_id, p.full_name, p.avatar_url
    HAVING COUNT(*) FILTER (WHERE t.status NOT IN ('done','canceled')) > 0
    LIMIT 20
  ) r;

  RETURN jsonb_build_object(
    'totals',           COALESCE(v_totals, '{}'::jsonb),
    'daily_completed',  COALESCE(v_daily, '[]'::jsonb),
    'by_department',    COALESCE(v_by_dept, '[]'::jsonb),
    'top_people',       COALESCE(v_top, '[]'::jsonb),
    'resource_view',    COALESCE(v_resource, '[]'::jsonb),
    'recurring_active', COALESCE(v_recur, 0),
    'role',            v_role,
    'scope_dept',      v_scope_dept,
    'from',            p_from,
    'to',              p_to
  );
END $$;

GRANT EXECUTE ON FUNCTION tasks_analytics(DATE, DATE, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ==============================================================================
-- [migration_tasks_workflow_v2.sql]
-- ==============================================================================
-- =====================================================================
-- MIGRATION: TASK WORKFLOW V2 (batch grouping + optional approval + self-approve)
-- =====================================================================
-- Thay đổi nghiệp vụ:
--   1. Mặc định bỏ duyệt báo cáo: doing → done thẳng (NV bấm "Hoàn thành").
--      Tickbox 'Cần TP duyệt' khi tạo → bật flow submitted → done.
--   2. Khi người nộp = người có quyền duyệt (TP/PP cùng phòng) → auto-done
--      bất kể requires_approval. Timeline ghi nhận audit comment.
--   3. Gom batch: cùng 1 UUID batch_id cho nhiều task tạo 1 lần.
-- =====================================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_tasks_batch
  ON tasks(batch_id) WHERE batch_id IS NOT NULL;


-- =====================================================================
-- task_create: thêm 2 param p_requires_approval, p_batch_id
-- =====================================================================
DROP FUNCTION IF EXISTS task_create(TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB);

CREATE OR REPLACE FUNCTION task_create(
  p_title             TEXT,
  p_description       TEXT,
  p_task_type         TEXT,
  p_priority          task_priority,
  p_due_date          TIMESTAMPTZ,
  p_dept_id           UUID,
  p_assignee_ids      UUID[],
  p_metadata          JSONB DEFAULT '{}'::jsonb,
  p_requires_approval BOOLEAN DEFAULT FALSE,
  p_batch_id          UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_role         TEXT;
  v_dept         UUID;
  v_task_id      UUID;
  v_a            UUID;
  v_creator_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, full_name INTO v_role, v_dept, v_creator_name
  FROM profiles WHERE id = v_uid;

  IF v_role IN ('driver', 'secretary', 'hr_officer') THEN
    RAISE EXCEPTION 'Vai trò của bạn không có quyền tạo công việc';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập tiêu đề công việc';
  END IF;
  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn hạn hoàn thành';
  END IF;
  IF p_task_type NOT IN ('task', 'report') THEN
    RAISE EXCEPTION 'Loại công việc không hợp lệ';
  END IF;

  IF v_role = 'staff' THEN
    IF p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) != 1
       OR p_assignee_ids[1] != v_uid THEN
      RAISE EXCEPTION 'Bạn chỉ được tự ghi chú việc cho mình';
    END IF;
    IF p_task_type = 'report' THEN
      RAISE EXCEPTION 'Nhân viên không được tạo yêu cầu báo cáo';
    END IF;
    IF p_dept_id IS NULL THEN p_dept_id := v_dept; END IF;
  END IF;

  IF p_task_type = 'task' AND (p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) = 0) THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận';
  END IF;

  INSERT INTO tasks (
    title, description, task_type, priority, due_date, department_id,
    assignee_id, created_by, status, metadata, is_archived,
    requires_approval, batch_id
  ) VALUES (
    p_title, p_description, p_task_type,
    COALESCE(p_priority, 'medium'), p_due_date, p_dept_id,
    CASE WHEN p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0
         THEN p_assignee_ids[1] ELSE NULL END,
    v_uid, 'todo'::task_status,
    COALESCE(p_metadata, '{}'::jsonb), FALSE,
    COALESCE(p_requires_approval, FALSE),
    p_batch_id
  )
  RETURNING id INTO v_task_id;

  IF p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
    FOREACH v_a IN ARRAY p_assignee_ids LOOP
      INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_a)
      ON CONFLICT (task_id, user_id) DO NOTHING;
      IF v_a <> v_uid THEN
        INSERT INTO notifications (user_id, title, content, type, link)
        SELECT v_a,
               CASE WHEN p_task_type = 'report' THEN 'Bạn có yêu cầu báo cáo mới'
                    ELSE 'Bạn có công việc mới' END,
               v_creator_name || ' đã giao: ' || p_title,
               p_task_type,
               '/dashboard/tasks?id=' || v_task_id::text
        WHERE (SELECT role FROM profiles WHERE id = v_a) <> 'driver';
      END IF;
    END LOOP;
  ELSIF p_task_type = 'report' AND p_dept_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, content, type, link)
    SELECT p.id, 'Phòng có yêu cầu báo cáo mới',
           v_creator_name || ' đã yêu cầu: ' || p_title,
           'report', '/dashboard/tasks?id=' || v_task_id::text
    FROM profiles p
    WHERE p.department_id = p_dept_id
      AND p.role <> 'driver'
      AND (p.role = 'manager' OR p.is_department_head = TRUE)
      AND p.id <> v_uid;
  END IF;

  RETURN v_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_create(
  TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID
) TO authenticated;


-- =====================================================================
-- task_update_status: thêm logic skip duyệt + self-approve audit
-- =====================================================================
CREATE OR REPLACE FUNCTION task_update_status(
  p_task_id    UUID,
  p_new_status task_status,
  p_comment    TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_role          TEXT;
  v_dept          UUID;
  v_task          tasks%ROWTYPE;
  v_creator_dept  UUID;
  v_is_assignee   BOOLEAN;
  v_is_manager    BOOLEAN;
  v_is_top_admin  BOOLEAN;
  v_is_creator    BOOLEAN;
  v_is_creator_manager BOOLEAN;
  v_actor_name    TEXT;
  v_self_approve  BOOLEAN := FALSE;
  v_is_reopen     BOOLEAN := FALSE;
  v_is_return_sub BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, full_name INTO v_role, v_dept, v_actor_name
  FROM profiles WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  IF NOT user_can_see_task(p_task_id, v_uid) THEN
    RAISE EXCEPTION 'Bạn không có quyền với công việc này';
  END IF;

  SELECT department_id INTO v_creator_dept FROM profiles WHERE id = v_task.created_by;

  v_is_assignee  := (v_task.assignee_id = v_uid)
    OR EXISTS (SELECT 1 FROM task_assignees WHERE task_id = p_task_id AND user_id = v_uid);
  v_is_top_admin := v_role IN ('admin', 'director');
  v_is_manager   := v_is_top_admin
    OR (v_role = 'manager' AND v_task.department_id = v_dept);
  v_is_creator   := v_task.created_by = v_uid;
  v_is_creator_manager := (v_role = 'manager' AND v_dept = v_creator_dept);

  IF v_task.status = p_new_status THEN RETURN; END IF;

  -- ─── State machine ────────────────────────────────────────────────
  IF p_new_status = 'canceled' THEN
    RAISE EXCEPTION 'Hãy dùng task_cancel để hủy công việc';

  ELSIF p_new_status = 'doing' THEN
    IF v_task.status NOT IN ('todo', 'submitted', 'done') THEN
      RAISE EXCEPTION 'Không thể chuyển sang Đang làm từ trạng thái hiện tại';
    END IF;

    IF v_task.status = 'submitted' THEN
      IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
        RAISE EXCEPTION 'Vui lòng nhập lý do trả về';
      END IF;
      IF NOT (v_is_manager OR v_is_creator OR v_is_creator_manager) THEN
        RAISE EXCEPTION 'Bạn không có quyền trả về báo cáo này';
      END IF;
      v_is_return_sub := TRUE;

    ELSIF v_task.status = 'done' THEN
      IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
        RAISE EXCEPTION 'Vui lòng nhập lý do trả lại';
      END IF;
      IF NOT (v_is_manager OR v_is_creator OR v_is_creator_manager) THEN
        RAISE EXCEPTION 'Chỉ người giao hoặc cấp có thẩm quyền mới được mở lại báo cáo.';
      END IF;
      v_is_reopen := TRUE;

    ELSE
      -- todo → doing
      IF NOT (v_is_assignee OR v_is_manager) THEN
        RAISE EXCEPTION 'Bạn không có quyền chuyển trạng thái';
      END IF;
    END IF;

  ELSIF p_new_status = 'submitted' THEN
    IF v_task.task_type <> 'report' THEN
      RAISE EXCEPTION 'Chỉ báo cáo mới có trạng thái Đã nộp';
    END IF;
    IF NOT v_task.requires_approval THEN
      RAISE EXCEPTION 'Báo cáo này không cần duyệt, hãy bấm Hoàn thành';
    END IF;
    IF NOT v_is_assignee THEN
      RAISE EXCEPTION 'Chỉ người được giao mới được nộp báo cáo';
    END IF;
    IF v_task.status <> 'doing' THEN
      RAISE EXCEPTION 'Báo cáo cần đang thực hiện trước khi nộp';
    END IF;

  ELSIF p_new_status = 'done' THEN
    IF v_task.task_type = 'task' THEN
      IF NOT (v_is_assignee OR v_is_manager OR v_is_creator OR v_is_creator_manager OR v_is_top_admin) THEN
        RAISE EXCEPTION 'Bạn không có quyền hoàn thành công việc này';
      END IF;
      IF v_task.status NOT IN ('todo', 'doing') THEN
        RAISE EXCEPTION 'Không thể hoàn thành từ trạng thái hiện tại';
      END IF;
    ELSE
      -- Report
      IF v_task.requires_approval = FALSE THEN
        IF NOT (v_is_assignee OR v_is_creator OR v_is_creator_manager OR v_is_top_admin) THEN
          RAISE EXCEPTION 'Bạn không có quyền ghi nhận hoàn thành báo cáo này';
        END IF;
        IF v_task.status NOT IN ('todo', 'doing') THEN
          RAISE EXCEPTION 'Không thể hoàn thành từ trạng thái hiện tại';
        END IF;
        IF v_is_manager THEN v_self_approve := TRUE; END IF;
      ELSE
        -- Report requires approval
        IF v_task.status = 'submitted' THEN
          IF NOT (v_is_manager OR v_is_creator OR v_is_creator_manager OR v_is_top_admin) THEN
            RAISE EXCEPTION 'Bạn không có quyền duyệt / ghi nhận báo cáo';
          END IF;
        ELSIF v_task.status = 'doing' AND v_is_assignee AND v_is_manager THEN
          v_self_approve := TRUE;
        ELSIF v_task.status IN ('todo', 'doing') AND (v_is_creator OR v_is_creator_manager OR v_is_top_admin) THEN
          -- Force complete
          v_self_approve := FALSE;
        ELSE
          RAISE EXCEPTION 'Báo cáo cần được nộp trước khi duyệt';
        END IF;
      END IF;
    END IF;

  ELSIF p_new_status = 'todo' THEN
    IF NOT v_is_manager THEN
      RAISE EXCEPTION 'Chỉ Trưởng phòng được đặt lại trạng thái Chưa làm';
    END IF;

  ELSE
    RAISE EXCEPTION 'Trạng thái không hợp lệ: %', p_new_status;
  END IF;

  -- Update trạng thái
  IF v_is_reopen OR v_is_return_sub THEN
    UPDATE tasks
    SET status = p_new_status,
        last_returned_at  = NOW(),
        last_return_reason = p_comment
    WHERE id = p_task_id;
  ELSE
    UPDATE tasks SET status = p_new_status WHERE id = p_task_id;
  END IF;

  -- Ghi nhận lịch sử
  IF v_self_approve THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            v_actor_name || ' đã hoàn thành.');
  ELSIF p_new_status = 'done' THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            CASE WHEN v_task.task_type = 'report' AND v_task.status = 'submitted'
                 THEN v_actor_name || ' đã duyệt báo cáo.'
                 ELSE v_actor_name || ' đã hoàn thành.' END);
  END IF;

  IF v_is_reopen THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            v_actor_name || ' trả lại báo cáo đã hoàn thành. Lý do: ' || p_comment);
  ELSIF v_is_return_sub THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            v_actor_name || ' trả về báo cáo để sửa. Lý do: ' || p_comment);
  ELSIF p_comment IS NOT NULL AND length(trim(p_comment)) > 0 THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid, p_comment);
  END IF;

  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT u,
         CASE WHEN v_is_reopen THEN 'Báo cáo bị trả lại'
              WHEN v_is_return_sub THEN 'Báo cáo cần sửa lại'
              ELSE 'Trạng thái công việc đã đổi' END,
         v_actor_name || ' → "' || v_task.title || '": ' ||
           CASE p_new_status
             WHEN 'doing'     THEN
               CASE WHEN v_is_reopen THEN 'Cần làm lại — ' || COALESCE(p_comment, '')
                    WHEN v_is_return_sub THEN 'Trả về sửa — ' || COALESCE(p_comment, '')
                    ELSE 'Đang làm' END
             WHEN 'submitted' THEN 'Đã nộp'
             WHEN 'done'      THEN 'Hoàn thành'
             WHEN 'todo'      THEN 'Chưa làm'
             ELSE p_new_status::text
           END,
         v_task.task_type,
         '/dashboard/tasks?id=' || p_task_id::text
  FROM (
    SELECT v_task.created_by AS u
    UNION
    SELECT user_id FROM task_assignees WHERE task_id = p_task_id
  ) tg
  WHERE u IS NOT NULL
    AND u <> v_uid
    AND (SELECT role FROM profiles WHERE id = u) <> 'driver';
END $$;

GRANT EXECUTE ON FUNCTION task_update_status(UUID, task_status, TEXT) TO authenticated;


-- =====================================================================
-- tasks_dashboard: thêm batch_id + requires_approval vào list output
-- =====================================================================
CREATE OR REPLACE FUNCTION tasks_dashboard(
  p_scope  TEXT  DEFAULT 'mine',
  p_filter JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_role     TEXT;
  v_dept     UUID;
  v_now      TIMESTAMPTZ := NOW();
  v_counts   JSONB;
  v_lists    JSONB;
  v_resource JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;

  IF v_role = 'staff' THEN
    p_scope := 'mine';
  ELSIF v_role NOT IN ('admin', 'director') AND p_scope = 'branch' THEN
    p_scope := 'dept';
  END IF;

  WITH visible AS (
    SELECT t.* FROM tasks t
    WHERE t.is_archived = FALSE
      AND (
        (p_scope = 'mine' AND (
          t.assignee_id = v_uid OR t.created_by = v_uid
          OR EXISTS (SELECT 1 FROM task_assignees ta
                     WHERE ta.task_id = t.id AND ta.user_id = v_uid)
        ))
        OR (p_scope = 'dept'   AND t.department_id = v_dept)
        OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
      )
  )
  SELECT jsonb_build_object(
    'todo',              COUNT(*) FILTER (WHERE status = 'todo'),
    'doing',             COUNT(*) FILTER (WHERE status = 'doing'),
    'submitted',         COUNT(*) FILTER (WHERE status = 'submitted'),
    'done',              COUNT(*) FILTER (WHERE status = 'done'),
    'canceled',          COUNT(*) FILTER (WHERE status = 'canceled'),
    'overdue',           COUNT(*) FILTER (WHERE due_date < v_now AND status NOT IN ('done','canceled')),
    'awaiting_approval', COUNT(*) FILTER (WHERE status = 'submitted'),
    'extensions_pending', (
      SELECT COUNT(*) FROM task_extension_requests er
      WHERE er.status = 'pending'
        AND user_can_see_task(er.task_id, v_uid)
    )
  )
  INTO v_counts FROM visible;

  SELECT jsonb_agg(row_to_json(x.*) ORDER BY x.is_overdue DESC, x.due_date NULLS LAST, x.created_at DESC)
  INTO v_lists
  FROM (
    SELECT t.id, t.title, t.description, t.status, t.priority, t.task_type,
           t.assignee_id, t.created_by, t.department_id,
           t.due_date, t.created_at, t.updated_at, t.metadata, t.is_archived,
           t.requires_approval, t.batch_id,
           (t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS is_overdue,
           jsonb_build_object('id', d.id, 'name', d.name) AS department,
           jsonb_build_object('id', c.id, 'full_name', c.full_name, 'avatar_url', c.avatar_url) AS creator,
           (SELECT jsonb_agg(jsonb_build_object(
                'id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url))
            FROM task_assignees ta JOIN profiles p ON p.id = ta.user_id
            WHERE ta.task_id = t.id) AS assignees
    FROM tasks t
    LEFT JOIN departments d ON d.id = t.department_id
    LEFT JOIN profiles    c ON c.id = t.created_by
    WHERE t.is_archived = FALSE
      AND (
        (p_scope = 'mine' AND (
          t.assignee_id = v_uid OR t.created_by = v_uid
          OR EXISTS (SELECT 1 FROM task_assignees ta
                     WHERE ta.task_id = t.id AND ta.user_id = v_uid)
        ))
        OR (p_scope = 'dept'   AND t.department_id = v_dept)
        OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
      )
    ORDER BY (t.due_date < v_now AND t.status NOT IN ('done','canceled')) DESC,
             t.due_date ASC NULLS LAST, t.created_at DESC
    LIMIT 100
  ) x;

  IF v_role IN ('manager', 'admin', 'director') THEN
    SELECT jsonb_agg(row_to_json(r.*) ORDER BY r.active_count DESC)
    INTO v_resource
    FROM (
      SELECT p.id AS user_id, p.full_name, p.avatar_url,
             COUNT(*) FILTER (WHERE t.status NOT IN ('done','canceled')) AS active_count,
             COUNT(*) FILTER (WHERE t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS overdue_count
      FROM task_assignees ta
      JOIN tasks t   ON t.id = ta.task_id
      JOIN profiles p ON p.id = ta.user_id
      WHERE t.is_archived = FALSE
        AND ((p_scope = 'dept'   AND t.department_id = v_dept)
             OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
             OR (p_scope = 'mine'   AND p.id = v_uid))
      GROUP BY p.id, p.full_name, p.avatar_url
      HAVING COUNT(*) FILTER (WHERE t.status NOT IN ('done','canceled')) > 0
      LIMIT 20
    ) r;
  ELSE
    v_resource := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'counts',        COALESCE(v_counts,   '{}'::jsonb),
    'lists',         COALESCE(v_lists,    '[]'::jsonb),
    'resource_view', COALESCE(v_resource, '[]'::jsonb),
    'scope',         p_scope,
    'role',          v_role
  );
END $$;

GRANT EXECUTE ON FUNCTION tasks_dashboard(TEXT, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ==============================================================================
-- [migration_tasks_hub_and_pagination.sql]
-- ==============================================================================
-- =====================================================================
-- MIGRATION: HUB DEPT PERMISSIONS + PAGINATION
-- =====================================================================
-- 1) Phòng đầu mối (code IN 13618,13602,13605,13609,13603) — cán bộ
--    được giao việc / yêu cầu báo cáo cho phòng khác (kể cả Staff).
-- 2) tasks_dashboard: thêm p_limit + p_offset cho pagination "Tải thêm".
-- =====================================================================

-- Helper inline check phòng đầu mối — tránh thêm bảng config
CREATE OR REPLACE FUNCTION _is_hub_department(p_dept_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code TEXT;
BEGIN
  IF p_dept_id IS NULL THEN RETURN FALSE; END IF;
  SELECT code INTO v_code FROM departments WHERE id = p_dept_id;
  RETURN v_code IN ('13618', '13602', '13605', '13609', '13603');
END $$;

GRANT EXECUTE ON FUNCTION _is_hub_department(UUID) TO authenticated;


-- =====================================================================
-- task_create: chỉ nhận 'report' (cleanup schema: bỏ nhánh 'task')
-- =====================================================================
DROP FUNCTION IF EXISTS task_create(TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB);
DROP FUNCTION IF EXISTS task_create(TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION task_create(
  p_title             TEXT,
  p_description       TEXT,
  p_task_type         TEXT,
  p_priority          task_priority,
  p_due_date          TIMESTAMPTZ,
  p_dept_id           UUID,
  p_assignee_ids      UUID[],
  p_metadata          JSONB DEFAULT '{}'::jsonb,
  p_requires_approval BOOLEAN DEFAULT FALSE,
  p_batch_id          UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_role         TEXT;
  v_dept         UUID;
  v_task_id      UUID;
  v_a            UUID;
  v_creator_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, full_name INTO v_role, v_dept, v_creator_name
  FROM profiles WHERE id = v_uid;

  IF v_role IN ('driver', 'secretary', 'hr_officer') THEN
    RAISE EXCEPTION 'Vai trò của bạn không có quyền tạo công việc';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập tiêu đề';
  END IF;
  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn hạn hoàn thành';
  END IF;
  IF p_task_type IS DISTINCT FROM 'report' THEN
    RAISE EXCEPTION 'Chỉ hỗ trợ tạo báo cáo';
  END IF;

  -- Staff: không được tạo yêu cầu báo cáo
  IF v_role = 'staff' THEN
    RAISE EXCEPTION 'Nhân viên không được tạo yêu cầu báo cáo';
  END IF;

  INSERT INTO tasks (
    title, description, task_type, priority, due_date, department_id,
    assignee_id, created_by, status, metadata, is_archived,
    requires_approval, batch_id
  ) VALUES (
    p_title, p_description, 'report',
    COALESCE(p_priority, 'medium'), p_due_date, p_dept_id,
    CASE WHEN p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0
         THEN p_assignee_ids[1] ELSE NULL END,
    v_uid, 'todo'::task_status,
    COALESCE(p_metadata, '{}'::jsonb), FALSE,
    COALESCE(p_requires_approval, FALSE),
    p_batch_id
  )
  RETURNING id INTO v_task_id;

  -- Insert assignees + notifications
  IF p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
    FOREACH v_a IN ARRAY p_assignee_ids LOOP
      INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_a)
      ON CONFLICT (task_id, user_id) DO NOTHING;
      IF v_a <> v_uid THEN
        INSERT INTO notifications (user_id, title, content, type, link)
        SELECT v_a,
               'Bạn có yêu cầu báo cáo mới',
               v_creator_name || ' đã yêu cầu: ' || p_title,
               'report',
               '/dashboard/tasks?id=' || v_task_id::text
        WHERE (SELECT role FROM profiles WHERE id = v_a) <> 'driver';
      END IF;
    END LOOP;
  ELSIF p_dept_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, content, type, link)
    SELECT p.id, 'Phòng có yêu cầu báo cáo mới',
           v_creator_name || ' đã yêu cầu: ' || p_title,
           'report', '/dashboard/tasks?id=' || v_task_id::text
    FROM profiles p
    WHERE p.department_id = p_dept_id
      AND p.role <> 'driver'
      AND (p.role = 'manager' OR p.is_department_head = TRUE)
      AND p.id <> v_uid;
  END IF;

  RETURN v_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_create(
  TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID
) TO authenticated;


-- =====================================================================
-- tasks_dashboard: pagination + counts riêng (counts không bị paginated)
-- =====================================================================
CREATE OR REPLACE FUNCTION tasks_dashboard(
  p_scope  TEXT  DEFAULT 'mine',
  p_filter JSONB DEFAULT '{}'::jsonb,
  p_limit  INT   DEFAULT 50,
  p_offset INT   DEFAULT 0
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_role     TEXT;
  v_dept     UUID;
  v_now      TIMESTAMPTZ := NOW();
  v_counts   JSONB;
  v_lists    JSONB;
  v_resource JSONB;
  v_total    INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;

  IF v_role = 'staff' THEN
    p_scope := 'mine';
  ELSIF v_role NOT IN ('admin', 'director') AND p_scope = 'branch' THEN
    p_scope := 'dept';
  END IF;

  p_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  p_offset := GREATEST(COALESCE(p_offset, 0), 0);

  WITH visible AS (
    SELECT t.* FROM tasks t
    WHERE t.is_archived = FALSE
      AND (
        (p_scope = 'mine' AND (
          t.assignee_id = v_uid OR t.created_by = v_uid
          OR EXISTS (SELECT 1 FROM task_assignees ta
                     WHERE ta.task_id = t.id AND ta.user_id = v_uid)
        ))
        OR (p_scope = 'dept'   AND t.department_id = v_dept)
        OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
      )
  )
  SELECT jsonb_build_object(
    'todo',              COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'todo'),
    'doing',             COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'doing'),
    'submitted',         COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'submitted'),
    'done',              COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'done'),
    'canceled',          COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'canceled'),
    'overdue',           COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE due_date < v_now AND status NOT IN ('done','canceled')),
    'awaiting_approval', COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'submitted'),
    'extensions_pending', (
      SELECT COUNT(*) FROM task_extension_requests er
      WHERE er.status = 'pending'
        AND user_can_see_task(er.task_id, v_uid)
    ),
    'total_visible', COUNT(*)
  )
  INTO v_counts FROM visible;

  v_total := COALESCE((v_counts->>'total_visible')::int, 0);

  SELECT jsonb_agg(row_to_json(x.*) ORDER BY x.sort_order)
  INTO v_lists
  FROM (
    SELECT t.id, t.title, t.description, t.status, t.priority, t.task_type,
           t.assignee_id, t.created_by, t.department_id,
           t.due_date, t.created_at, t.updated_at, t.metadata, t.is_archived,
           t.requires_approval, t.batch_id,
           (t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS is_overdue,
           jsonb_build_object('id', d.id, 'name', d.name) AS department,
           jsonb_build_object('id', c.id, 'full_name', c.full_name, 'avatar_url', c.avatar_url) AS creator,
           (SELECT jsonb_agg(jsonb_build_object(
                'id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url))
            FROM task_assignees ta JOIN profiles p ON p.id = ta.user_id
            WHERE ta.task_id = t.id) AS assignees,
           ROW_NUMBER() OVER (
             ORDER BY (t.due_date < v_now AND t.status NOT IN ('done','canceled')) DESC,
                      t.due_date ASC NULLS LAST,
                      t.created_at DESC
           ) AS sort_order
    FROM tasks t
    LEFT JOIN departments d ON d.id = t.department_id
    LEFT JOIN profiles    c ON c.id = t.created_by
    WHERE t.is_archived = FALSE
      AND (
        (p_scope = 'mine' AND (
          t.assignee_id = v_uid OR t.created_by = v_uid
          OR EXISTS (SELECT 1 FROM task_assignees ta
                     WHERE ta.task_id = t.id AND ta.user_id = v_uid)
        ))
        OR (p_scope = 'dept'   AND t.department_id = v_dept)
        OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
      )
    ORDER BY sort_order
    LIMIT p_limit OFFSET p_offset
  ) x;

  IF v_role IN ('manager', 'admin', 'director') THEN
    SELECT jsonb_agg(row_to_json(r.*) ORDER BY r.active_count DESC)
    INTO v_resource
    FROM (
      SELECT p.id AS user_id, p.full_name, p.avatar_url,
             COUNT(*) FILTER (WHERE t.status NOT IN ('done','canceled')) AS active_count,
             COUNT(*) FILTER (WHERE t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS overdue_count
      FROM task_assignees ta
      JOIN tasks t   ON t.id = ta.task_id
      JOIN profiles p ON p.id = ta.user_id
      WHERE t.is_archived = FALSE
        AND ((p_scope = 'dept'   AND t.department_id = v_dept)
             OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
             OR (p_scope = 'mine'   AND p.id = v_uid))
      GROUP BY p.id, p.full_name, p.avatar_url
      HAVING COUNT(*) FILTER (WHERE t.status NOT IN ('done','canceled')) > 0
      LIMIT 20
    ) r;
  ELSE
    v_resource := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'counts',        COALESCE(v_counts,   '{}'::jsonb),
    'lists',         COALESCE(v_lists,    '[]'::jsonb),
    'resource_view', COALESCE(v_resource, '[]'::jsonb),
    'scope',         p_scope,
    'role',          v_role,
    'limit',         p_limit,
    'offset',        p_offset,
    'has_more',      (p_offset + p_limit) < v_total
  );
END $$;

GRANT EXECUTE ON FUNCTION tasks_dashboard(TEXT, JSONB, INT, INT) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ==============================================================================
-- [migration_tasks_reopen.sql]
-- ==============================================================================
-- =====================================================================
-- MIGRATION: TASK REOPEN — Trả lại task đã hoàn thành kèm phản hồi
-- =====================================================================
-- Cho phép người tạo (created_by), Trưởng phòng cùng phòng, Admin/Director
-- trả lại task ở trạng thái 'done' → quay về 'doing' kèm lý do.
--
-- Nghiệp vụ:
--   • NV gửi báo cáo → LĐP không đồng ý → trả lại NV.
--   • Phòng B gửi báo cáo → người tạo phòng A không đồng ý → trả lại Phòng B.
--   • BGĐ giao cho Phòng → Phòng nộp → BGĐ không đồng ý → trả lại Phòng.
-- =====================================================================

CREATE OR REPLACE FUNCTION task_update_status(
  p_task_id    UUID,
  p_new_status task_status,
  p_comment    TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_role          TEXT;
  v_dept          UUID;
  v_task          tasks%ROWTYPE;
  v_creator_dept  UUID;
  v_is_assignee   BOOLEAN;
  v_is_manager    BOOLEAN;
  v_is_top_admin  BOOLEAN;
  v_is_creator    BOOLEAN;
  v_is_creator_manager BOOLEAN;
  v_actor_name    TEXT;
  v_self_approve  BOOLEAN := FALSE;
  v_is_reopen     BOOLEAN := FALSE;
  v_is_return_sub BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, full_name INTO v_role, v_dept, v_actor_name
  FROM profiles WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  IF NOT user_can_see_task(p_task_id, v_uid) THEN
    RAISE EXCEPTION 'Bạn không có quyền với công việc này';
  END IF;

  SELECT department_id INTO v_creator_dept FROM profiles WHERE id = v_task.created_by;

  v_is_assignee  := (v_task.assignee_id = v_uid)
    OR EXISTS (SELECT 1 FROM task_assignees WHERE task_id = p_task_id AND user_id = v_uid);
  v_is_top_admin := v_role IN ('admin', 'director');
  v_is_manager   := v_is_top_admin
    OR (v_role = 'manager' AND v_task.department_id = v_dept);
  v_is_creator   := v_task.created_by = v_uid;
  v_is_creator_manager := (v_role = 'manager' AND v_dept = v_creator_dept);

  IF v_task.status = p_new_status THEN RETURN; END IF;

  IF p_new_status = 'canceled' THEN
    RAISE EXCEPTION 'Hãy dùng task_cancel để hủy công việc';

  ELSIF p_new_status = 'doing' THEN
    IF v_task.status NOT IN ('todo', 'submitted', 'done') THEN
      RAISE EXCEPTION 'Không thể chuyển sang Đang làm từ trạng thái hiện tại';
    END IF;

    IF v_task.status = 'submitted' THEN
      IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
        RAISE EXCEPTION 'Vui lòng nhập lý do trả về';
      END IF;
      IF NOT (v_is_manager OR v_is_creator OR v_is_creator_manager) THEN
        RAISE EXCEPTION 'Bạn không có quyền trả về báo cáo này';
      END IF;
      v_is_return_sub := TRUE;

    ELSIF v_task.status = 'done' THEN
      IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
        RAISE EXCEPTION 'Vui lòng nhập lý do trả lại';
      END IF;
      IF NOT (v_is_manager OR v_is_creator OR v_is_creator_manager) THEN
        RAISE EXCEPTION 'Chỉ người giao hoặc cấp có thẩm quyền mới được mở lại báo cáo.';
      END IF;
      v_is_reopen := TRUE;

    ELSE
      -- todo → doing
      IF NOT (v_is_assignee OR v_is_manager) THEN
        RAISE EXCEPTION 'Bạn không có quyền chuyển trạng thái';
      END IF;
    END IF;

  ELSIF p_new_status = 'submitted' THEN
    IF v_task.task_type <> 'report' THEN
      RAISE EXCEPTION 'Chỉ báo cáo mới có trạng thái Đã nộp';
    END IF;
    IF NOT v_task.requires_approval THEN
      RAISE EXCEPTION 'Báo cáo này không cần duyệt, hãy bấm Hoàn thành';
    END IF;
    IF NOT v_is_assignee THEN
      RAISE EXCEPTION 'Chỉ người được giao mới được nộp báo cáo';
    END IF;
    IF v_task.status <> 'doing' THEN
      RAISE EXCEPTION 'Báo cáo cần đang thực hiện trước khi nộp';
    END IF;

  ELSIF p_new_status = 'done' THEN
    IF v_task.task_type = 'task' THEN
      IF NOT (v_is_assignee OR v_is_manager OR v_is_creator OR v_is_creator_manager OR v_is_top_admin) THEN
        RAISE EXCEPTION 'Bạn không có quyền hoàn thành công việc này';
      END IF;
      IF v_task.status NOT IN ('todo', 'doing') THEN
        RAISE EXCEPTION 'Không thể hoàn thành từ trạng thái hiện tại';
      END IF;
    ELSE
      -- Report
      IF v_task.requires_approval = FALSE THEN
        IF NOT (v_is_assignee OR v_is_creator OR v_is_creator_manager OR v_is_top_admin) THEN
          RAISE EXCEPTION 'Bạn không có quyền ghi nhận hoàn thành báo cáo này';
        END IF;
        IF v_task.status NOT IN ('todo', 'doing') THEN
          RAISE EXCEPTION 'Không thể hoàn thành từ trạng thái hiện tại';
        END IF;
        IF v_is_manager THEN v_self_approve := TRUE; END IF;
      ELSE
        -- Report requires approval
        IF v_task.status = 'submitted' THEN
          IF NOT (v_is_manager OR v_is_creator OR v_is_creator_manager OR v_is_top_admin) THEN
            RAISE EXCEPTION 'Bạn không có quyền duyệt / ghi nhận báo cáo';
          END IF;
        ELSIF v_task.status = 'doing' AND v_is_assignee AND v_is_manager THEN
          v_self_approve := TRUE;
        ELSIF v_task.status IN ('todo', 'doing') AND (v_is_creator OR v_is_creator_manager OR v_is_top_admin) THEN
          -- Force complete
          v_self_approve := FALSE;
        ELSE
          RAISE EXCEPTION 'Báo cáo cần được nộp trước khi duyệt';
        END IF;
      END IF;
    END IF;

  ELSIF p_new_status = 'todo' THEN
    IF NOT v_is_manager THEN
      RAISE EXCEPTION 'Chỉ Trưởng phòng được đặt lại trạng thái Chưa làm';
    END IF;

  ELSE
    RAISE EXCEPTION 'Trạng thái không hợp lệ: %', p_new_status;
  END IF;

  -- Update trạng thái
  IF v_is_reopen OR v_is_return_sub THEN
    UPDATE tasks
    SET status = p_new_status,
        last_returned_at  = NOW(),
        last_return_reason = p_comment
    WHERE id = p_task_id;
  ELSE
    UPDATE tasks SET status = p_new_status WHERE id = p_task_id;
  END IF;

  -- Ghi nhận lịch sử
  IF v_self_approve THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            v_actor_name || ' đã hoàn thành.');
  ELSIF p_new_status = 'done' THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            CASE WHEN v_task.task_type = 'report' AND v_task.status = 'submitted'
                 THEN v_actor_name || ' đã duyệt báo cáo.'
                 ELSE v_actor_name || ' đã hoàn thành.' END);
  END IF;

  IF v_is_reopen THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            v_actor_name || ' trả lại báo cáo đã hoàn thành. Lý do: ' || p_comment);
  ELSIF v_is_return_sub THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            v_actor_name || ' trả về báo cáo để sửa. Lý do: ' || p_comment);
  ELSIF p_comment IS NOT NULL AND length(trim(p_comment)) > 0 THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid, p_comment);
  END IF;

  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT u,
         CASE WHEN v_is_reopen THEN 'Báo cáo bị trả lại'
              WHEN v_is_return_sub THEN 'Báo cáo cần sửa lại'
              ELSE 'Trạng thái công việc đã đổi' END,
         v_actor_name || ' → "' || v_task.title || '": ' ||
           CASE p_new_status
             WHEN 'doing'     THEN
               CASE WHEN v_is_reopen THEN 'Cần làm lại — ' || COALESCE(p_comment, '')
                    WHEN v_is_return_sub THEN 'Trả về sửa — ' || COALESCE(p_comment, '')
                    ELSE 'Đang làm' END
             WHEN 'submitted' THEN 'Đã nộp'
             WHEN 'done'      THEN 'Hoàn thành'
             WHEN 'todo'      THEN 'Chưa làm'
             ELSE p_new_status::text
           END,
         v_task.task_type,
         '/dashboard/tasks?id=' || p_task_id::text
  FROM (
    SELECT v_task.created_by AS u
    UNION
    SELECT user_id FROM task_assignees WHERE task_id = p_task_id
  ) tg
  WHERE u IS NOT NULL
    AND u <> v_uid
    AND (SELECT role FROM profiles WHERE id = u) <> 'driver';
END $$;

GRANT EXECUTE ON FUNCTION task_update_status(UUID, task_status, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ==============================================================================
-- [migration_tasks_hub_extend_permissions.sql]
-- ==============================================================================
-- =====================================================================
-- MIGRATION: HUB PERMISSION cho Analytics + Recurring RPCs
-- =====================================================================
-- Fix: client cho phép staff hub, nhưng server vẫn block.
-- Đồng bộ check: staff hub (code IN 13618/13602/13605/13609/13603)
-- được xem analytics + quản lý recurring templates.
-- =====================================================================

CREATE OR REPLACE FUNCTION tasks_analytics(
  p_from DATE,
  p_to   DATE,
  p_dept_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_role      TEXT;
  v_dept      UUID;
  v_is_hub    BOOLEAN;
  v_now       TIMESTAMPTZ := NOW();
  v_scope_dept UUID;
  v_totals    JSONB;
  v_daily     JSONB;
  v_by_dept   JSONB;
  v_top       JSONB;
  v_recur     INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;
  v_is_hub := _is_hub_department(v_dept);

  IF v_role NOT IN ('admin', 'director', 'manager') AND NOT (v_role = 'staff' AND v_is_hub) THEN
    RAISE EXCEPTION 'Bạn không có quyền xem báo cáo';
  END IF;

  -- Scope:
  --   • admin/director/staff-hub/manager-hub → toàn nhánh (có thể filter dept)
  --   • manager non-hub → chỉ dept mình
  IF v_role = 'manager' AND NOT v_is_hub THEN
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
    'overdue',           COUNT(*) FILTER (WHERE due_date < v_now AND status NOT IN ('done','canceled')),
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
           COUNT(t.id) FILTER (WHERE t.due_date < v_now AND t.status NOT IN ('done','canceled') AND t.is_archived = FALSE) AS overdue,
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
           COUNT(ta.task_id) FILTER (WHERE t.due_date < v_now AND t.status NOT IN ('done','canceled') AND t.is_archived = FALSE) AS overdue,
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
    'recurring_active', COALESCE(v_recur, 0),
    'role',            v_role,
    'scope_dept',      v_scope_dept,
    'from',            p_from,
    'to',              p_to
  );
END $$;

GRANT EXECUTE ON FUNCTION tasks_analytics(DATE, DATE, UUID) TO authenticated;


-- =====================================================================
-- recurring_template_upsert: allow staff hub
-- =====================================================================
CREATE OR REPLACE FUNCTION recurring_template_upsert(
  p_id                    UUID,
  p_title                 TEXT,
  p_description           TEXT,
  p_priority              task_priority,
  p_target_department_ids UUID[],
  p_target_user_ids       UUID[],
  p_schedule_kind         TEXT,
  p_weekly_dow            SMALLINT,
  p_weekly_time           TIME,
  p_monthly_dom           SMALLINT,
  p_monthly_time          TIME,
  p_timezone              TEXT,
  p_due_days_after_fire   INT,
  p_due_time              TIME,
  p_is_active             BOOLEAN
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_role   TEXT;
  v_dept   UUID;
  v_is_hub BOOLEAN;
  v_id     UUID;
  v_next   TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;
  v_is_hub := _is_hub_department(v_dept);

  IF v_role NOT IN ('admin', 'director', 'manager') AND NOT (v_role = 'staff' AND v_is_hub) THEN
    RAISE EXCEPTION 'Bạn không có quyền tạo lịch định kỳ';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập tiêu đề';
  END IF;
  IF p_schedule_kind NOT IN ('weekly', 'monthly') THEN
    RAISE EXCEPTION 'Loại lịch không hợp lệ';
  END IF;
  IF p_schedule_kind = 'weekly' AND (p_weekly_dow IS NULL OR p_weekly_time IS NULL) THEN
    RAISE EXCEPTION 'Vui lòng chọn thứ và giờ trong tuần';
  END IF;
  IF p_schedule_kind = 'monthly' AND (p_monthly_dom IS NULL OR p_monthly_time IS NULL) THEN
    RAISE EXCEPTION 'Vui lòng chọn ngày và giờ trong tháng';
  END IF;

  v_next := _recurring_next_run(
    p_schedule_kind, p_weekly_dow, p_weekly_time,
    p_monthly_dom, p_monthly_time, p_timezone, NOW()
  );

  IF p_id IS NULL THEN
    INSERT INTO task_recurring_templates (
      title, description, priority,
      target_department_ids, target_user_ids,
      schedule_kind, weekly_dow, weekly_time, monthly_dom, monthly_time,
      timezone, due_days_after_fire, due_time,
      created_by, is_active, next_run_at
    ) VALUES (
      p_title, p_description, COALESCE(p_priority, 'medium'),
      COALESCE(p_target_department_ids, '{}'), COALESCE(p_target_user_ids, '{}'),
      p_schedule_kind, p_weekly_dow, p_weekly_time, p_monthly_dom, p_monthly_time,
      COALESCE(p_timezone, 'Asia/Ho_Chi_Minh'), COALESCE(p_due_days_after_fire, 7), COALESCE(p_due_time, '17:00'::TIME),
      v_uid, COALESCE(p_is_active, TRUE), v_next
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE task_recurring_templates
    SET title = p_title, description = p_description,
        priority = COALESCE(p_priority, 'medium'),
        target_department_ids = COALESCE(p_target_department_ids, '{}'),
        target_user_ids = COALESCE(p_target_user_ids, '{}'),
        schedule_kind = p_schedule_kind,
        weekly_dow = p_weekly_dow, weekly_time = p_weekly_time,
        monthly_dom = p_monthly_dom, monthly_time = p_monthly_time,
        timezone = COALESCE(p_timezone, 'Asia/Ho_Chi_Minh'),
        due_days_after_fire = COALESCE(p_due_days_after_fire, 7),
        is_active = COALESCE(p_is_active, is_active),
        next_run_at = v_next
    WHERE id = p_id
      AND (created_by = v_uid OR v_role IN ('admin', 'director'))
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Không tìm thấy hoặc không có quyền sửa'; END IF;
  END IF;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_upsert(
  UUID, TEXT, TEXT, task_priority, UUID[], UUID[],
  TEXT, SMALLINT, TIME, SMALLINT, TIME, TEXT, INT, TIME, BOOLEAN
) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ==============================================================================
-- [migration_tasks_split_task_report_perm.sql]
-- ==============================================================================
-- =====================================================================
-- MIGRATION: SPLIT permission cho Giao việc (task) vs Yêu cầu báo cáo (report)
-- =====================================================================
-- Quy tắc đúng (sửa lại):
--   • Giao việc (task_type='task'): chỉ admin/director/manager.
--     Staff (kể cả phòng đầu mối) → chỉ tự ghi chú.
--   • Yêu cầu báo cáo (task_type='report'): admin/director/manager + staff hub.
-- =====================================================================

DROP FUNCTION IF EXISTS task_create(TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION task_create(
  p_title             TEXT,
  p_description       TEXT,
  p_task_type         TEXT,
  p_priority          task_priority,
  p_due_date          TIMESTAMPTZ,
  p_dept_id           UUID,
  p_assignee_ids      UUID[],
  p_metadata          JSONB DEFAULT '{}'::jsonb,
  p_requires_approval BOOLEAN DEFAULT FALSE,
  p_batch_id          UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_role         TEXT;
  v_dept         UUID;
  v_task_id      UUID;
  v_a            UUID;
  v_creator_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, full_name INTO v_role, v_dept, v_creator_name
  FROM profiles WHERE id = v_uid;

  IF v_role IN ('driver', 'secretary', 'hr_officer') THEN
    RAISE EXCEPTION 'Vai trò của bạn không có quyền tạo công việc';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập tiêu đề';
  END IF;
  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn hạn hoàn thành';
  END IF;
  IF p_task_type IS DISTINCT FROM 'report' THEN
    RAISE EXCEPTION 'Chỉ hỗ trợ tạo báo cáo';
  END IF;

  -- Staff: không được tạo yêu cầu báo cáo
  IF v_role = 'staff' THEN
    RAISE EXCEPTION 'Nhân viên không được tạo yêu cầu báo cáo';
  END IF;

  INSERT INTO tasks (
    title, description, task_type, priority, due_date, department_id,
    assignee_id, created_by, status, metadata, is_archived,
    requires_approval, batch_id
  ) VALUES (
    p_title, p_description, 'report',
    COALESCE(p_priority, 'medium'), p_due_date, p_dept_id,
    CASE WHEN p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0
         THEN p_assignee_ids[1] ELSE NULL END,
    v_uid, 'todo'::task_status,
    COALESCE(p_metadata, '{}'::jsonb), FALSE,
    COALESCE(p_requires_approval, FALSE),
    p_batch_id
  )
  RETURNING id INTO v_task_id;

  -- Insert assignees + notifications
  IF p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
    FOREACH v_a IN ARRAY p_assignee_ids LOOP
      INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_a)
      ON CONFLICT (task_id, user_id) DO NOTHING;
      IF v_a <> v_uid THEN
        INSERT INTO notifications (user_id, title, content, type, link)
        SELECT v_a,
               'Bạn có yêu cầu báo cáo mới',
               v_creator_name || ' đã yêu cầu: ' || p_title,
               'report',
               '/dashboard/tasks?id=' || v_task_id::text
        WHERE (SELECT role FROM profiles WHERE id = v_a) <> 'driver';
      END IF;
    END LOOP;
  ELSIF p_dept_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, content, type, link)
    SELECT p.id, 'Phòng có yêu cầu báo cáo mới',
           v_creator_name || ' đã yêu cầu: ' || p_title,
           'report', '/dashboard/tasks?id=' || v_task_id::text
    FROM profiles p
    WHERE p.department_id = p_dept_id
      AND p.role <> 'driver'
      AND (p.role = 'manager' OR p.is_department_head = TRUE)
      AND p.id <> v_uid;
  END IF;

  RETURN v_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_create(
  TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID
) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ==============================================================================
-- [migration_dashboard_summary.sql]
-- ==============================================================================
-- migration_dashboard_summary.sql
-- RPC dashboard_summary() — gộp 11 query của default dashboard về 1 round-trip duy nhất.
-- Trả về: { counts, today_tasks, pending_docs, role }
-- Visibility:
--   * admin / director: tất cả task active của chi nhánh.
--   * còn lại: task tôi tạo OR tôi là assignee (qua task_assignees junction).

CREATE OR REPLACE FUNCTION dashboard_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_role      TEXT;
  v_dept      UUID;
  v_is_power  BOOLEAN;
  v_now       TIMESTAMPTZ := NOW();
  v_today_end TIMESTAMPTZ := date_trunc('day', NOW()) + INTERVAL '1 day';
  v_counts    JSONB;
  v_today     JSONB;
  v_docs      JSONB;
  v_leaves    JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Chưa đăng nhập';
  END IF;

  SELECT role, department_id
    INTO v_role, v_dept
    FROM profiles
   WHERE id = v_uid;

  v_is_power := v_role IN ('admin', 'director');

  -- 1) Counts — batch-aware: 1 batch chỉ tính 1.
  WITH visible AS (
    SELECT t.id, t.batch_id, t.status, t.priority, t.due_date, t.updated_at
      FROM tasks t
     WHERE t.is_archived = FALSE
       AND (
         v_is_power
         OR t.created_by = v_uid
         OR EXISTS (
           SELECT 1 FROM task_assignees ta
            WHERE ta.task_id = t.id AND ta.user_id = v_uid
         )
       )
  )
  SELECT jsonb_build_object(
    'active',     COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status IN ('todo','doing','submitted')),
    'urgent',     COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status IN ('todo','doing','submitted') AND priority = 'high'),
    'overdue',    COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE due_date < v_now AND status NOT IN ('done','canceled')),
    'done_today', COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'done' AND updated_at >= date_trunc('day', v_now))
  )
    INTO v_counts
    FROM visible;

  -- 2) Việc cần làm hôm nay: top 10 batch/task của tôi — DISTINCT ON batch để không lặp.
  SELECT COALESCE(jsonb_agg(row_to_json(top.*)
                            ORDER BY top.due_date ASC NULLS LAST,
                                     CASE top.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END),
                  '[]'::jsonb)
    INTO v_today
    FROM (
      SELECT * FROM (
        SELECT DISTINCT ON (COALESCE(t.batch_id, t.id))
               t.id,
               t.title,
               t.task_type,
               t.status,
               t.priority,
               t.due_date,
               (t.due_date < v_now) AS is_overdue
          FROM tasks t
         WHERE t.is_archived = FALSE
           AND t.status IN ('todo','doing','submitted')
           AND (t.due_date IS NULL OR t.due_date < v_today_end)
           AND (
             t.created_by = v_uid
             OR EXISTS (
               SELECT 1 FROM task_assignees ta
                WHERE ta.task_id = t.id AND ta.user_id = v_uid
             )
           )
         ORDER BY COALESCE(t.batch_id, t.id),
                  t.due_date ASC NULLS LAST,
                  CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END
      ) deduped
      ORDER BY deduped.due_date ASC NULLS LAST,
               CASE deduped.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END
      LIMIT 10
    ) top;

  -- 3) Pending docs: hồ sơ cần tôi hành động — KHÔNG bao gồm doc tôi đã chuyển đi.
  --    Điều kiện match:
  --      (a) Tôi đang giữ trên bàn (current_assignee_id = me) VÀ không có outgoing PENDING từ tôi.
  --      (b) Có người chuyển cho tôi (incoming PENDING với receiver = me).
  SELECT COALESCE(jsonb_agg(row_to_json(d.*)), '[]'::jsonb)
    INTO v_docs
    FROM (
      SELECT d.id,
             d.short_code,
             d.title,
             d.status,
             d.created_at,
             d.updated_at,
             d.current_assignee_id,
             d.creator_id,
             (
               SELECT row_to_json(c.*) FROM (
                 SELECT id, name, sla_hours, color
                   FROM document_categories
                  WHERE id = d.category_id
               ) c
             ) AS category,
             (
               SELECT COALESCE(jsonb_agg(row_to_json(h.*)), '[]'::jsonb)
                 FROM (
                   SELECT id, document_id, sender_id, receiver_id, status, sent_at, received_at
                     FROM document_handovers
                    WHERE document_id = d.id
                    ORDER BY sent_at DESC
                 ) h
             ) AS handovers
        FROM documents d
       WHERE d.status <> 'COMPLETED'
         AND (
           (
             d.current_assignee_id = v_uid
             AND NOT EXISTS (
               SELECT 1 FROM document_handovers h
                WHERE h.document_id = d.id
                  AND h.sender_id = v_uid
                  AND h.status = 'PENDING'
             )
           )
           OR EXISTS (
             SELECT 1 FROM document_handovers h
              WHERE h.document_id = d.id
                AND h.receiver_id = v_uid
                AND h.status = 'PENDING'
           )
         )
       ORDER BY d.updated_at DESC
       LIMIT 5
    ) d;

  RETURN jsonb_build_object(

  -- 4) Today leaves: lịch nghỉ phép hôm nay
  SELECT COALESCE(jsonb_agg(row_to_json(l.*) ORDER BY l.start_time), '[]'::jsonb)
    INTO v_leaves
    FROM (
      SELECT s.id, s.title, s.status, s.start_time, s.end_time,
             s.created_by, p.full_name AS creator_name,
             p.avatar_url AS creator_avatar
      FROM schedules s
      LEFT JOIN profiles p ON p.id = s.created_by
      WHERE s.type = 'leave'
        AND s.status IN ('approved', 'in_progress')
        AND s.start_time <= NOW()
        AND s.end_time >= date_trunc('day', NOW())
      ORDER BY s.start_time
      LIMIT 20
    ) l;
    'counts',       COALESCE(v_counts, jsonb_build_object('active',0,'urgent',0,'overdue',0,'done_today',0)),
    'today_tasks',  COALESCE(v_today, '[]'::jsonb),
    'pending_docs', COALESCE(v_docs,  '[]'::jsonb),
    'today_leaves', COALESCE(v_leaves, '[]'::jsonb),
    'role',         v_role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION dashboard_summary() TO authenticated;
NOTIFY pgrst, 'reload schema';


-- ==============================================================================
-- [migration_team_phase2.sql]
-- ==============================================================================
-- =============================================================
-- MIGRATION TEAM PHASE 2 — Module Nhân sự nâng cấp
-- 1) Mở rộng profiles: extension, seat_location, employee_code, birthday_notify_optout
-- 2) Bảng out_of_office (1 user — 1 record active)
-- 3) RPC cleanup_expired_ooo (cron daily gọi)
-- 4) RLS cho out_of_office
-- =============================================================

-- 1) Mở rộng profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS extension TEXT,
  ADD COLUMN IF NOT EXISTS seat_location TEXT,
  ADD COLUMN IF NOT EXISTS employee_code TEXT,
  ADD COLUMN IF NOT EXISTS birthday_notify_optout BOOLEAN NOT NULL DEFAULT false;

-- 2) Bảng Out of Office
CREATE TABLE IF NOT EXISTS out_of_office (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_ooo_ends_at ON out_of_office(ends_at);

-- 3) RPC cleanup expired OOO
CREATE OR REPLACE FUNCTION cleanup_expired_ooo()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM out_of_office WHERE ends_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END $$;

-- 4) RLS — OOO ai cũng xem được, chỉ owner sửa
ALTER TABLE out_of_office ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ooo_select_all ON out_of_office;
CREATE POLICY ooo_select_all ON out_of_office FOR SELECT USING (true);

DROP POLICY IF EXISTS ooo_owner_write ON out_of_office;
CREATE POLICY ooo_owner_write ON out_of_office FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';


-- ==============================================================================
-- [migration_schedule_rejection.sql]
-- ==============================================================================
-- Schedule rejection metadata + resubmit flow.
-- Khi bộ phận điều phối từ chối: lưu rejection_reason / rejected_by / rejected_at.
-- Khi creator đẩy lại: lưu change_reason, reset status='pending', clear rejection_*.

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS change_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_schedules_rejected ON schedules(status) WHERE status = 'rejected';

NOTIFY pgrst, 'reload schema';


-- ==============================================================================
-- [migration_tasks_analytics_tcth_only.sql]
-- ==============================================================================
-- =====================================================================
-- MIGRATION: ANALYTICS PERMISSION refine — chỉ phòng điều phối (Tổ chức Tổng hợp, code 13602) xem toàn nhánh
-- =====================================================================
-- Quy tắc đúng:
--   • Admin/Director: toàn nhánh.
--   • Manager phòng điều phối (code 13602): toàn nhánh.
--   • Staff phòng điều phối (code 13602): toàn nhánh.
--   • Manager phòng khác: CHỈ phòng mình.
--   • Staff phòng khác: KHÔNG xem được.
-- 4 phòng đầu mối khác (13618/13605/13609/13603) chỉ có quyền yêu cầu báo cáo,
-- KHÔNG xem analytics toàn nhánh.
-- =====================================================================

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

NOTIFY pgrst, 'reload schema';


-- ==============================================================================
-- [migration_rls_optimize.sql]
-- ==============================================================================
-- =====================================================
-- MIGRATION BỔ SUNG #3: TỐI ƯU RLS & SIẾT PROFILES
-- A5: Gói (SELECT role/department FROM profiles WHERE id=auth.uid()) thành STABLE function
--     để Postgres cache trong cùng 1 query plan.
-- A8: Profiles SELECT chỉ cho phép xem trong phạm vi cho phép (cùng phòng / admin / director / hr / secretary)
-- =====================================================

-- 1. STABLE function cache role & department của caller
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_department()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_head()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_department_head, FALSE) FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_active, FALSE) FROM profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_department() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_head() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_active() TO authenticated;

-- 2. Tái cấu trúc policy tasks/kpis với function đã cache
CREATE OR REPLACE FUNCTION public.user_is_task_assignee(p_task_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM task_assignees 
    WHERE task_id = p_task_id AND user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_is_task_assignee(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Tasks read access" ON tasks;
CREATE POLICY "Tasks read access" ON tasks FOR SELECT
USING (
  public.current_user_role() IN ('admin', 'director')
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
  OR auth.uid() = assignee_id
  OR auth.uid() = created_by
  OR public.user_is_task_assignee(id, auth.uid())
);

DROP POLICY IF EXISTS "Tasks update access" ON tasks;
CREATE POLICY "Tasks update access" ON tasks FOR UPDATE
USING (
  public.current_user_role() IN ('admin', 'director')
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
  OR auth.uid() = assignee_id
  OR auth.uid() = created_by
  OR public.user_is_task_assignee(id, auth.uid())
);

DROP POLICY IF EXISTS "Tasks delete access" ON tasks;
CREATE POLICY "Tasks delete access" ON tasks FOR DELETE
USING (
  public.current_user_role() IN ('admin', 'director')
  OR auth.uid() = created_by
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
);

DROP POLICY IF EXISTS "KPIs read access" ON kpis;
CREATE POLICY "KPIs read access" ON kpis FOR SELECT
USING (
  public.current_user_role() IN ('admin', 'director')
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
  OR auth.uid() = assignee_id
  OR auth.uid() = created_by
);

DROP POLICY IF EXISTS "KPIs create access" ON kpis;
CREATE POLICY "KPIs create access" ON kpis FOR INSERT
WITH CHECK (
  public.current_user_role() IN ('admin', 'director')
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
);

DROP POLICY IF EXISTS "KPIs update access" ON kpis;
CREATE POLICY "KPIs update access" ON kpis FOR UPDATE
USING (
  public.current_user_role() IN ('admin', 'director')
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
  OR auth.uid() = assignee_id
  OR auth.uid() = created_by
);

DROP POLICY IF EXISTS "KPIs delete access" ON kpis;
CREATE POLICY "KPIs delete access" ON kpis FOR DELETE
USING (
  public.current_user_role() IN ('admin', 'director')
  OR auth.uid() = created_by
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
);

-- 3. A8: Siết SELECT profiles — không còn USING (true)
-- Cho phép xem profile khi:
--   - Chính mình
--   - Admin / Director / HR Officer / Secretary (toàn quyền nhân sự)
--   - Cùng phòng ban
--   - Cùng tham gia ít nhất 1 schedule (để hiển thị tên người tham gia chéo phòng)
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view profiles in scope" ON profiles FOR SELECT
USING (
  -- Tự xem mình
  id = auth.uid()
  -- Admin/BGĐ/HR/Thư ký toàn quyền xem danh bạ
  OR public.current_user_role() IN ('admin', 'director', 'hr_officer', 'secretary')
  -- Cùng phòng ban
  OR department_id = public.current_user_department()
  -- BGĐ luôn được hiển thị cho mọi người (để xem timeline)
  OR role = 'director'
  -- Driver luôn được hiển thị (để bộ phận điều phối gán xe)
  OR role = 'driver'
  -- Cùng tham gia ít nhất 1 schedule với caller
  OR EXISTS (
    SELECT 1 FROM schedule_participants sp1
    JOIN schedule_participants sp2 ON sp1.schedule_id = sp2.schedule_id
    WHERE sp1.profile_id = profiles.id AND sp2.profile_id = auth.uid()
  )
);

NOTIFY pgrst, 'reload schema';


-- ==============================================================================
-- [migration_tasks_access_workflow_recurring_fix.sql]
-- ==============================================================================
-- Vá access/workflow cho Tasks + overload _recurring_next_run dùng INT/TEXT từ RPC.

CREATE OR REPLACE FUNCTION _recurring_next_run(
  p_kind         TEXT,
  p_weekly_dow   INT,
  p_weekly_time  TEXT,
  p_monthly_dom  INT,
  p_monthly_time TEXT,
  p_timezone     TEXT,
  p_after        TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN _recurring_next_run(
    p_kind,
    p_weekly_dow::SMALLINT,
    NULLIF(p_weekly_time, '')::TIME,
    p_monthly_dom::SMALLINT,
    NULLIF(p_monthly_time, '')::TIME,
    p_timezone,
    p_after
  );
END $$;

CREATE OR REPLACE FUNCTION guard_task_creator_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role TEXT;
  v_creator UUID := COALESCE(NEW.created_by, auth.uid());
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = v_creator;
  IF v_role IN ('driver', 'secretary', 'hr_officer') THEN
    RAISE EXCEPTION 'Vai trò của bạn không có quyền tạo công việc';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_task_creator_role ON tasks;
CREATE TRIGGER trg_guard_task_creator_role
  BEFORE INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION guard_task_creator_role();


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
        RAISE EXCEPTION 'Chỉ người giao hoặc cấp có thẩm quyền mới được mở lại công việc.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_task_status_transition ON tasks;
CREATE TRIGGER trg_guard_task_status_transition
  BEFORE UPDATE OF status ON tasks
  FOR EACH ROW EXECUTE FUNCTION guard_task_status_transition();

CREATE OR REPLACE FUNCTION tasks_dashboard(
  p_scope  TEXT  DEFAULT 'mine',
  p_filter JSONB DEFAULT '{}'::jsonb,
  p_limit  INT   DEFAULT 50,
  p_offset INT   DEFAULT 0
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_role     TEXT;
  v_dept     UUID;
  v_now      TIMESTAMPTZ := NOW();
  v_counts   JSONB;
  v_lists    JSONB;
  v_resource JSONB;
  v_total    INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;

  IF v_role IN ('driver', 'secretary', 'hr_officer') THEN
    RAISE EXCEPTION 'Vai trò của bạn không có quyền xem module Công việc';
  END IF;

  IF v_role = 'staff' THEN
    p_scope := 'mine';
  ELSIF v_role NOT IN ('admin', 'director') AND p_scope = 'branch' THEN
    p_scope := 'dept';
  END IF;

  p_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  p_offset := GREATEST(COALESCE(p_offset, 0), 0);

  WITH visible AS (
    SELECT t.* FROM tasks t
    WHERE t.is_archived = FALSE
      AND (
        (p_scope = 'mine' AND (
          t.assignee_id = v_uid OR t.created_by = v_uid
          OR EXISTS (SELECT 1 FROM task_assignees ta
                     WHERE ta.task_id = t.id AND ta.user_id = v_uid)
        ))
        OR (p_scope = 'dept'   AND t.department_id = v_dept)
        OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
      )
  )
  SELECT jsonb_build_object(
    'todo',              COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'todo'),
    'doing',             COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'doing'),
    'submitted',         COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'submitted'),
    'done',              COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'done'),
    'canceled',          COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'canceled'),
    'overdue',           COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE due_date < v_now AND status NOT IN ('done','canceled')),
    'awaiting_approval', COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'submitted'),
    'extensions_pending', (
      SELECT COUNT(*) FROM task_extension_requests er
      WHERE er.status = 'pending'
        AND user_can_see_task(er.task_id, v_uid)
    ),
    'total_visible', COUNT(*)
  )
  INTO v_counts FROM visible;

  v_total := COALESCE((v_counts->>'total_visible')::int, 0);

  SELECT jsonb_agg(row_to_json(x.*) ORDER BY x.sort_order)
  INTO v_lists
  FROM (
    SELECT t.id, t.title, t.description, t.status, t.priority, t.task_type,
           t.assignee_id, t.created_by, t.department_id,
           t.due_date, t.created_at, t.updated_at, t.metadata, t.is_archived,
           t.requires_approval, t.batch_id,
           (t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS is_overdue,
           jsonb_build_object('id', d.id, 'name', d.name) AS department,
           jsonb_build_object('id', c.id, 'full_name', c.full_name, 'avatar_url', c.avatar_url) AS creator,
           (SELECT jsonb_agg(jsonb_build_object(
                'id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url))
            FROM task_assignees ta JOIN profiles p ON p.id = ta.user_id
            WHERE ta.task_id = t.id) AS assignees,
           ROW_NUMBER() OVER (
             ORDER BY (t.due_date < v_now AND t.status NOT IN ('done','canceled')) DESC,
                      t.due_date ASC NULLS LAST,
                      t.created_at DESC
           ) AS sort_order
    FROM tasks t
    LEFT JOIN departments d ON d.id = t.department_id
    LEFT JOIN profiles    c ON c.id = t.created_by
    WHERE t.is_archived = FALSE
      AND (
        (p_scope = 'mine' AND (
          t.assignee_id = v_uid OR t.created_by = v_uid
          OR EXISTS (SELECT 1 FROM task_assignees ta
                     WHERE ta.task_id = t.id AND ta.user_id = v_uid)
        ))
        OR (p_scope = 'dept'   AND t.department_id = v_dept)
        OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
      )
    ORDER BY sort_order
    LIMIT p_limit OFFSET p_offset
  ) x;

  IF v_role IN ('manager', 'admin', 'director') THEN
    SELECT jsonb_agg(row_to_json(r.*) ORDER BY r.active_count DESC)
    INTO v_resource
    FROM (
      SELECT p.id AS user_id, p.full_name, p.avatar_url,
             COUNT(*) FILTER (WHERE t.status NOT IN ('done','canceled')) AS active_count,
             COUNT(*) FILTER (WHERE t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS overdue_count
      FROM task_assignees ta
      JOIN tasks t   ON t.id = ta.task_id
      JOIN profiles p ON p.id = ta.user_id
      WHERE t.is_archived = FALSE
        AND ((p_scope = 'dept'   AND t.department_id = v_dept)
             OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
             OR (p_scope = 'mine'   AND p.id = v_uid))
      GROUP BY p.id, p.full_name, p.avatar_url
      HAVING COUNT(*) FILTER (WHERE t.status NOT IN ('done','canceled')) > 0
      LIMIT 20
    ) r;
  ELSE
    v_resource := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'counts',        COALESCE(v_counts,   '{}'::jsonb),
    'lists',         COALESCE(v_lists,    '[]'::jsonb),
    'resource_view', COALESCE(v_resource, '[]'::jsonb),
    'scope',         p_scope,
    'role',          v_role,
    'limit',         p_limit,
    'offset',        p_offset,
    'has_more',      (p_offset + p_limit) < v_total
  );
END $$;

GRANT EXECUTE ON FUNCTION tasks_dashboard(TEXT, JSONB, INT, INT) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ==============================================================================
-- 8. INDEXES TỐI ƯU TRUY VẤN
-- ==============================================================================

-- Các chỉ mục hỗ trợ module Hồ sơ vật lý (Handover) đã được mô tả trong docs nhưng thiếu ở SQL
CREATE INDEX IF NOT EXISTS idx_documents_current_assignee ON documents(current_assignee_id);
CREATE INDEX IF NOT EXISTS idx_documents_creator ON documents(creator_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

-- Index cho cursor pagination: ORDER BY updated_at DESC LIMIT N
CREATE INDEX IF NOT EXISTS idx_documents_updated_desc ON documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_handovers_doc_sent ON document_handovers(document_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_handovers_receiver_pending ON document_handovers(receiver_id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_handovers_sender ON document_handovers(sender_id);

-- Chỉ mục hiệu năng cao hỗ trợ hàm kiểm tra bảo mật RLS luân chuyển hồ sơ
CREATE INDEX IF NOT EXISTS idx_handovers_document_sender_receiver ON document_handovers(document_id, sender_id, receiver_id);

-- Chỉ mục hiệu năng cao hỗ trợ tìm kiếm khoảng thời gian Lịch trình/Lịch họp
CREATE INDEX IF NOT EXISTS idx_schedules_start_end ON schedules(start_time, end_time);

-- Chỉ mục một phần (partial index) siêu tốc hỗ trợ thống kê danh sách Nghỉ phép trên Dashboard
CREATE INDEX IF NOT EXISTS idx_schedules_active_leaves 
ON schedules(start_time, end_time) 
WHERE type = 'leave' AND status IN ('approved', 'in_progress');

-- ==============================================================================
-- 9. HANDOVER COMMENTS & STORAGE POLICIES MIGRATION (2026-05-30)
-- ==============================================================================

-- Cấu hình Supabase Storage cho Documents bucket (Public Read)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Xóa các policy cũ để tránh lỗi trùng lặp
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname='storage' AND tablename='objects'
             AND policyname LIKE 'documents_bucket_%' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

-- Tạo Storage Policies cho Documents bucket
CREATE POLICY "documents_bucket_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY "documents_bucket_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "documents_bucket_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND owner = auth.uid());

CREATE POLICY "documents_bucket_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND owner = auth.uid());


-- Tạo bảng document_comments (Ý kiến & Thảo luận hồ sơ)
CREATE TABLE IF NOT EXISTS document_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kích hoạt RLS bảo mật
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

-- Xóa policy cũ nếu có
DROP POLICY IF EXISTS "document_comments_select" ON document_comments;
DROP POLICY IF EXISTS "document_comments_insert" ON document_comments;
DROP POLICY IF EXISTS "document_comments_delete" ON document_comments;

-- Tạo RLS Policies cho document_comments
-- SELECT: Chỉ người xem được hồ sơ mới xem được thảo luận
CREATE POLICY "document_comments_select" ON document_comments FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM documents d
        WHERE d.id = document_id
    )
);

-- INSERT: Chỉ người xem được hồ sơ mới gửi được thảo luận dưới chính tên mình
CREATE POLICY "document_comments_insert" ON document_comments FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1 FROM documents d
        WHERE d.id = document_id
    )
);

-- DELETE: Chỉ chính chủ hoặc admin mới được xoá
CREATE POLICY "document_comments_delete" ON document_comments FOR DELETE TO authenticated
USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
    )
);

-- Tạo Index tối ưu tốc độ truy vấn bình luận theo thứ tự thời gian
CREATE INDEX IF NOT EXISTS idx_document_comments_doc_created ON document_comments(document_id, created_at ASC);

-- Đăng ký realtime sync cho bảng document_comments
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'document_comments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE document_comments;
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;


-- ==============================================================================
-- 10. SCHEDULE AUTO-COMPLETE HELPERS
-- ==============================================================================

-- Tự hoàn thành lịch họp / sự kiện / nghỉ phép / trip không dùng xe sau khi quá end_time 15 phút.
-- Lịch có xe / có lái xe giữ nguyên để lái xe hoặc điều phối xác nhận thực tế.
CREATE OR REPLACE FUNCTION public.complete_finished_schedules()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  UPDATE public.schedules
  SET status = 'completed'
  WHERE status = 'approved'
    AND end_time < NOW() - INTERVAL '15 minutes'
    AND (
      (type::text IN ('meeting', 'event', 'leave') AND COALESCE(use_vehicle, false) = false AND vehicle_id IS NULL AND driver_id IS NULL)
      OR
      (type::text = 'trip' AND COALESCE(use_vehicle, false) = false AND vehicle_id IS NULL AND driver_id IS NULL)
    )
    -- KHÔNG auto-complete lịch có BGĐ tham gia (phải có người bấm kết thúc)
    AND NOT EXISTS (
      SELECT 1 FROM schedule_participants sp
      JOIN profiles p ON p.id = sp.profile_id
      WHERE sp.schedule_id = public.schedules.id
        AND p.role = 'director'
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_finished_schedules() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_finished_schedules() TO service_role;

-- ==============================================================================
-- [migration_drop_task_type.sql — canonical current Tasks RPCs]
-- ==============================================================================
-- ==============================================================================
-- MIGRATION: Xoá task_type hoàn toàn (chỉ còn Báo cáo)
-- ==============================================================================
-- Mục đích:
--   1. Xoá cột task_type khỏi bảng tasks (đã có CHECK constraint = 'report')
--   2. Xoá cột task_type khỏi bảng task_recurring_templates
--   3. RPC task_create — bỏ tham số p_task_type
--   4. RPC tasks_dashboard — bỏ task_type khỏi SELECT
--   5. Các RPC recurring / analytics — bỏ task_type
--
-- Điều kiện:
--   - Data task_type='task' đã xoá, còn task_type='report' duy nhất
--   - CHECK constraint 'task_type = report' đã active
-- ==============================================================================

-- =====================================================================
-- 1. XOÁ CỘT task_type
-- =====================================================================
ALTER TABLE tasks DROP COLUMN IF EXISTS task_type;
ALTER TABLE task_recurring_templates DROP COLUMN IF EXISTS task_type;

-- =====================================================================
-- 2. RPC task_create — bỏ p_task_type
-- =====================================================================
DROP FUNCTION IF EXISTS task_create(TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB);
DROP FUNCTION IF EXISTS task_create(TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID);
DROP FUNCTION IF EXISTS task_create(TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION task_create(
  p_title             TEXT,
  p_description       TEXT,
  p_priority          task_priority,
  p_due_date          TIMESTAMPTZ,
  p_dept_id           UUID,
  p_assignee_ids      UUID[],
  p_metadata          JSONB DEFAULT '{}'::jsonb,
  p_requires_approval BOOLEAN DEFAULT FALSE,
  p_batch_id          UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_role         TEXT;
  v_dept         UUID;
  v_dept_code    TEXT;
  v_is_hub       BOOLEAN;
  v_task_id      UUID;
  v_a            UUID;
  v_creator_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT p.role, p.department_id, d.code, p.full_name
    INTO v_role, v_dept, v_dept_code, v_creator_name
    FROM profiles p
    LEFT JOIN departments d ON d.id = p.department_id
   WHERE p.id = v_uid;

  v_is_hub := COALESCE(v_dept_code IN ('13618', '13601', '13602', '13605', '13609', '13603'), FALSE);

  IF v_role IN ('driver', 'secretary', 'hr_officer')
     OR (v_role = 'staff' AND NOT v_is_hub) THEN
    RAISE EXCEPTION 'Bạn không có quyền tạo báo cáo';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập tiêu đề';
  END IF;
  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn hạn hoàn thành';
  END IF;
  IF (p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) IS NULL) AND p_dept_id IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận hoặc phòng ban';
  END IF;
  IF v_role = 'manager' AND NOT v_is_hub AND p_dept_id IS DISTINCT FROM v_dept THEN
    RAISE EXCEPTION 'Trưởng phòng chỉ được yêu cầu báo cáo trong phòng mình';
  END IF;
  IF p_assignee_ids IS NOT NULL
     AND array_length(p_assignee_ids, 1) > 0
     AND v_role NOT IN ('admin', 'director')
     AND EXISTS (
       SELECT 1
       FROM profiles p
       WHERE p.id = ANY(p_assignee_ids)
         AND p.department_id IS DISTINCT FROM v_dept
     ) THEN
    RAISE EXCEPTION 'Chỉ được chọn cán bộ trong phòng mình';
  END IF;

  INSERT INTO tasks (
    title, description, priority, due_date, department_id,
    assignee_id, created_by, status, metadata, is_archived,
    requires_approval, batch_id
  ) VALUES (
    p_title, p_description, COALESCE(p_priority, 'medium'),
    p_due_date, p_dept_id,
    CASE WHEN p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0
         THEN p_assignee_ids[1] ELSE NULL END,
    v_uid, 'todo'::task_status,
    COALESCE(p_metadata, '{}'::jsonb), FALSE,
    COALESCE(p_requires_approval, FALSE),
    p_batch_id
  )
  RETURNING id INTO v_task_id;

  -- Insert assignees + notifications
  IF p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
    FOREACH v_a IN ARRAY p_assignee_ids LOOP
      INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_a)
      ON CONFLICT (task_id, user_id) DO NOTHING;
      IF v_a <> v_uid THEN
        INSERT INTO notifications (user_id, title, content, type, link)
        SELECT v_a,
               'Bạn có yêu cầu báo cáo mới',
               v_creator_name || ' đã yêu cầu: ' || p_title,
               'report',
               '/dashboard/tasks?id=' || v_task_id::text
        WHERE (SELECT role FROM profiles WHERE id = v_a) <> 'driver';
      END IF;
    END LOOP;
  ELSIF p_dept_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, content, type, link)
    SELECT p.id, 'Phòng có yêu cầu báo cáo mới',
           v_creator_name || ' đã yêu cầu: ' || p_title,
           'report', '/dashboard/tasks?id=' || v_task_id::text
    FROM profiles p
    WHERE p.department_id = p_dept_id
      AND p.role <> 'driver'
      AND (p.role = 'manager' OR p.is_department_head = TRUE)
      AND p.id <> v_uid;
  END IF;

  RETURN v_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_create(
  TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID
) TO authenticated;

-- =====================================================================
-- 3. RPC tasks_dashboard + INDEXES — tối ưu hiệu suất
-- =====================================================================
DROP FUNCTION IF EXISTS tasks_dashboard(TEXT, JSONB);
DROP FUNCTION IF EXISTS tasks_dashboard(TEXT, JSONB, INT, INT);

-- Index phủ scope mine: assignee_id + created_by (phổ biến nhất)
CREATE INDEX IF NOT EXISTS idx_tasks_mine
  ON tasks(assignee_id, created_by)
  WHERE is_archived = false;

-- Index cho resource_view: user_id → task_id join
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_task
  ON task_assignees(user_id, task_id);

CREATE OR REPLACE FUNCTION tasks_dashboard(
  p_scope  TEXT  DEFAULT 'mine',
  p_filter JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_role     TEXT;
  v_dept     UUID;
  v_now      TIMESTAMPTZ := NOW();
  v_counts   JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;

  IF v_role = 'staff' THEN p_scope := 'mine';
  ELSIF v_role NOT IN ('admin', 'director') AND p_scope = 'branch' THEN p_scope := 'dept';
  END IF;

  -- Counts + List: 1 shared CTE, không scan 2 lần
  WITH task_set AS (
    SELECT t.*,
           (t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS is_overdue
    FROM tasks t
    WHERE t.is_archived = FALSE
      AND (
        (p_scope = 'mine' AND (t.assignee_id = v_uid OR t.created_by = v_uid
          OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = v_uid)))
        OR (p_scope = 'dept'   AND t.department_id = v_dept)
        OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
      )
  ), counts AS (
    SELECT jsonb_build_object(
      'todo',              COUNT(*) FILTER (WHERE status = 'todo'),
      'doing',             COUNT(*) FILTER (WHERE status = 'doing'),
      'submitted',         COUNT(*) FILTER (WHERE status = 'submitted'),
      'done',              COUNT(*) FILTER (WHERE status = 'done'),
      'canceled',          COUNT(*) FILTER (WHERE status = 'canceled'),
      'overdue',           COUNT(*) FILTER (WHERE is_overdue),
      'awaiting_approval', COUNT(*) FILTER (WHERE status = 'submitted'),
      'extensions_pending', (SELECT COUNT(*) FROM task_extension_requests er
        WHERE er.status = 'pending' AND user_can_see_task(er.task_id, v_uid))
    ) AS val FROM task_set
  ), task_list AS (
    SELECT t.id, t.title, t.description, t.status, t.priority,
           t.assignee_id, t.created_by, t.department_id,
           t.due_date, t.created_at, t.updated_at, t.metadata, t.is_archived,
           t.is_overdue,
           jsonb_build_object('id', d.id, 'name', d.name) AS department,
           jsonb_build_object('id', c.id, 'full_name', c.full_name, 'avatar_url', c.avatar_url) AS creator,
           a.assignees
    FROM task_set t
    LEFT JOIN departments d ON d.id = t.department_id
    LEFT JOIN profiles    c ON c.id = t.created_by
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url)) AS assignees
      FROM task_assignees ta
      JOIN profiles p ON p.id = ta.user_id
      WHERE ta.task_id = t.id
    ) a ON true
    ORDER BY t.is_overdue DESC, t.due_date ASC NULLS LAST, t.created_at DESC
    LIMIT 50
  ), resource_view AS (
    SELECT COALESCE(jsonb_agg(r.* ORDER BY r.active_count DESC), '[]'::jsonb) AS val
    FROM (
      SELECT ta.user_id, p.full_name, p.avatar_url,
             COUNT(*) FILTER (WHERE t.status NOT IN ('done','canceled')) AS active_count,
             COUNT(*) FILTER (WHERE t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS overdue_count
      FROM task_assignees ta
      JOIN tasks t ON t.id = ta.task_id
      JOIN profiles p ON p.id = ta.user_id
      WHERE t.is_archived = FALSE
        AND ((p_scope = 'dept' AND t.department_id = v_dept)
          OR (p_scope = 'branch' AND v_role IN ('admin', 'director')))
      GROUP BY ta.user_id, p.full_name, p.avatar_url
      ORDER BY active_count DESC
      LIMIT 20
    ) r
  )
  SELECT jsonb_build_object(
    'counts', COALESCE(c.val, '{}'::jsonb),
    'lists', COALESCE((SELECT jsonb_agg(row_to_json(tl.*) ORDER BY tl.is_overdue DESC, tl.due_date NULLS LAST, tl.created_at DESC) FROM task_list tl), '[]'::jsonb),
    'resource_view', CASE WHEN p_scope = 'mine' THEN '[]'::jsonb ELSE COALESCE((SELECT val FROM resource_view), '[]'::jsonb) END,
    'scope', p_scope,
    'role', v_role
  )
  INTO v_counts
  FROM counts c;

  RETURN v_counts;
END $$;

GRANT EXECUTE ON FUNCTION tasks_dashboard(TEXT, JSONB) TO authenticated;

-- =====================================================================
-- 3b. RPC task_update / task_delete — đồng bộ action frontend
-- =====================================================================
DROP FUNCTION IF EXISTS task_update(UUID, TEXT, TEXT, task_priority, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS task_delete(UUID);

CREATE OR REPLACE FUNCTION task_update(
  p_task_id     UUID,
  p_title       TEXT,
  p_description TEXT DEFAULT NULL,
  p_priority    task_priority DEFAULT 'medium',
  p_due_date    TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_role         TEXT;
  v_dept         UUID;
  v_task         tasks%ROWTYPE;
  v_creator_dept UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  IF v_task.status = 'canceled' OR v_task.is_archived THEN
    RAISE EXCEPTION 'Không thể sửa công việc đã đóng hoặc đã lưu trữ';
  END IF;
  SELECT department_id INTO v_creator_dept FROM profiles WHERE id = v_task.created_by;

  IF NOT (
    v_role IN ('admin', 'director')
    OR v_task.created_by = v_uid
    OR (v_role = 'manager' AND v_dept = v_creator_dept)
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền sửa công việc này';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập tiêu đề';
  END IF;
  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn hạn hoàn thành';
  END IF;

  UPDATE tasks
     SET title = trim(p_title),
         description = NULLIF(trim(COALESCE(p_description, '')), ''),
         priority = COALESCE(p_priority, 'medium'),
         due_date = p_due_date,
         updated_at = NOW()
   WHERE id = p_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_update(UUID, TEXT, TEXT, task_priority, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION task_delete(p_task_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_role         TEXT;
  v_dept         UUID;
  v_task         tasks%ROWTYPE;
  v_creator_dept UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  SELECT department_id INTO v_creator_dept FROM profiles WHERE id = v_task.created_by;

  IF NOT (
    v_role IN ('admin', 'director')
    OR v_task.created_by = v_uid
    OR (v_role = 'manager' AND v_dept = v_creator_dept)
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền xoá công việc này';
  END IF;

  DELETE FROM tasks WHERE id = p_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_delete(UUID) TO authenticated;

-- =====================================================================
-- 4. RPC recurring_template_upsert — bỏ p_task_type
-- =====================================================================
DROP FUNCTION IF EXISTS recurring_template_upsert(UUID, TEXT, TEXT, TEXT, task_priority, UUID[], UUID[], TEXT, INT, TEXT, INT, TEXT, TEXT, INT, BOOLEAN, UUID);
DROP FUNCTION IF EXISTS recurring_template_upsert(TEXT, TEXT, task_priority, UUID[], UUID[], TEXT, INT, TEXT, INT, TEXT, TEXT, INT, BOOLEAN, UUID, UUID);

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
  p_default_assignee_id   UUID DEFAULT NULL,
  p_id                    UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_role      TEXT;
  v_dept      UUID;
  v_dept_code TEXT;
  v_is_hub    BOOLEAN;
  v_id        UUID;
  v_next      TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT p.role, p.department_id, d.code
    INTO v_role, v_dept, v_dept_code
    FROM profiles p
    LEFT JOIN departments d ON d.id = p.department_id
   WHERE p.id = v_uid;

  v_is_hub := COALESCE(v_dept_code IN ('13618', '13601', '13602', '13605', '13609', '13603'), FALSE);
  IF v_role IN ('driver', 'secretary', 'hr_officer')
     OR (v_role = 'staff' AND NOT v_is_hub) THEN
    RAISE EXCEPTION 'Bạn không có quyền tạo lịch báo cáo định kỳ';
  END IF;
  IF p_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM task_recurring_templates WHERE id = p_id AND created_by = v_uid) THEN
    RAISE EXCEPTION 'Bạn không có quyền sửa template này';
  END IF;
  IF COALESCE(array_length(p_target_department_ids, 1), 0) = 0
     AND COALESCE(array_length(p_target_user_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận hoặc phòng ban';
  END IF;
  IF v_role = 'manager' AND NOT v_is_hub AND EXISTS (
    SELECT 1 FROM unnest(p_target_department_ids) AS target_dept_id
    WHERE target_dept_id IS DISTINCT FROM v_dept
  ) THEN
    RAISE EXCEPTION 'Trưởng phòng chỉ được tạo lịch báo cáo cho phòng mình';
  END IF;
  IF COALESCE(array_length(p_target_user_ids, 1), 0) > 0
     AND v_role NOT IN ('admin', 'director')
     AND EXISTS (
       SELECT 1
       FROM profiles p
       WHERE p.id = ANY(p_target_user_ids)
         AND p.department_id IS DISTINCT FROM v_dept
     ) THEN
    RAISE EXCEPTION 'Chỉ được chọn cán bộ trong phòng mình';
  END IF;

  v_next := _recurring_next_run(
    p_schedule_kind, p_weekly_dow, p_weekly_time,
    p_monthly_dom, p_monthly_time, p_timezone, NOW()
  );

  IF p_id IS NOT NULL AND EXISTS (SELECT 1 FROM task_recurring_templates WHERE id = p_id AND created_by = v_uid) THEN
    UPDATE task_recurring_templates SET
      title = p_title,
      description = p_description,
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
      default_assignee_id = p_default_assignee_id,
      next_run_at = v_next
    WHERE id = p_id
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO task_recurring_templates (
      title, description, priority, target_department_ids, target_user_ids,
      schedule_kind, weekly_dow, weekly_time, monthly_dom, monthly_time,
      timezone, due_days_after_fire, created_by, is_active, default_assignee_id, next_run_at
    ) VALUES (
      p_title, p_description, p_priority, p_target_department_ids, p_target_user_ids,
      p_schedule_kind, p_weekly_dow, p_weekly_time::TIME, p_monthly_dom, p_monthly_time::TIME,
      p_timezone, p_due_days_after_fire, v_uid, p_is_active, p_default_assignee_id, v_next
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_upsert(
  TEXT, TEXT, task_priority, UUID[], UUID[], TEXT, INT, TEXT, INT, TEXT, TEXT, INT, BOOLEAN, UUID, UUID
) TO authenticated;

-- =====================================================================
-- 5. RPC recurring_fire_due — bỏ p_task_type
-- =====================================================================
CREATE OR REPLACE FUNCTION recurring_fire_due()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT := 0;
  v_t     RECORD;
  v_uid   UUID;
  v_task_id UUID;
  v_a     UUID;
BEGIN
  FOR v_t IN
    SELECT * FROM task_recurring_templates
    WHERE is_active = TRUE AND next_run_at <= NOW()
    ORDER BY next_run_at ASC
    LIMIT 20
  LOOP
    -- Gán created_by = admin nếu creator bị xoá
    v_uid := COALESCE(v_t.created_by, (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1));
    IF v_uid IS NULL THEN CONTINUE; END IF;

    -- Ghi nhận đã fire
    UPDATE task_recurring_templates
    SET last_fired_at = NOW(),
        next_run_at = _recurring_next_run(
          v_t.schedule_kind, v_t.weekly_dow, v_t.weekly_time,
          v_t.monthly_dom, v_t.monthly_time, v_t.timezone, NOW()
        )
    WHERE id = v_t.id;

    -- Xác định target
    DECLARE
      v_target_ids UUID[] := v_t.target_user_ids;
      v_dept_id    UUID;
      v_tp_id      UUID;
    BEGIN
      -- Phòng ban: resolve TP
      IF v_t.target_department_ids IS NOT NULL AND array_length(v_t.target_department_ids, 1) > 0 THEN
        FOREACH v_dept_id IN ARRAY v_t.target_department_ids LOOP
          -- Nếu có default_assignee_id thì dùng, không thì resolve TP
          v_tp_id := COALESCE(
            v_t.default_assignee_id,
            _resolve_default_assignee(v_dept_id)
          );
          IF v_tp_id IS NOT NULL THEN
            v_target_ids := array_append(v_target_ids, v_tp_id);
          END IF;
        END LOOP;
      END IF;

      -- Tạo task
      INSERT INTO tasks (
        title, description, priority, due_date, department_id,
        assignee_id, created_by, status, metadata, is_archived,
        requires_approval
      ) VALUES (
        v_t.title, v_t.description, v_t.priority,
        NOW() + (v_t.due_days_after_fire || ' days')::INTERVAL,
        CASE WHEN array_length(v_t.target_department_ids, 1) = 1
             THEN v_t.target_department_ids[1] ELSE NULL END,
        v_target_ids[1],
        v_uid, 'todo'::task_status,
        '{"from_recurring": true}'::jsonb, FALSE,
        TRUE
      )
      RETURNING id INTO v_task_id;

      -- Insert assignees
      IF v_target_ids IS NOT NULL THEN
        FOREACH v_a IN ARRAY v_target_ids LOOP
          INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_a)
          ON CONFLICT (task_id, user_id) DO NOTHING;
        END LOOP;
      END IF;

      v_count := v_count + 1;
    END;
  END LOOP;

  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION recurring_fire_due() TO authenticated;



-- ==============================================================================
-- Kết thúc consolidated schema. NOTIFY pgrst để Supabase reload PostgREST cache.
-- ==============================================================================
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- [migration_tasks_head_manager_and_naming.sql]
-- ==============================================================================
-- =====================================================
-- TASKS: phân quyền Trưởng phòng, quyền mẫu định kỳ, cron UTC và invariant người nhận
-- =====================================================

-- Mẫu định kỳ chỉ người tạo xem/sửa/xoá/bật tắt.
ALTER TABLE task_recurring_templates ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'task_recurring_templates' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON task_recurring_templates', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "recurring_templates_select_own" ON task_recurring_templates
FOR SELECT TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "recurring_templates_no_direct_insert" ON task_recurring_templates
FOR INSERT TO authenticated WITH CHECK (FALSE);

CREATE POLICY "recurring_templates_no_direct_update" ON task_recurring_templates
FOR UPDATE TO authenticated USING (FALSE);

CREATE POLICY "recurring_templates_no_direct_delete" ON task_recurring_templates
FOR DELETE TO authenticated USING (FALSE);

-- Visibility helper: admin/BGĐ toàn chi nhánh; Trưởng phòng thấy phòng mình;
-- manager thường chỉ thấy việc mình tạo hoặc được giao.
CREATE OR REPLACE FUNCTION user_can_see_task(p_task_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_role TEXT;
  v_dept UUID;
  v_is_head BOOLEAN;
  v_task_dept UUID;
  v_task_creator UUID;
  v_task_assignee UUID;
BEGIN
  IF p_user_id IS NULL THEN RETURN FALSE; END IF;

  SELECT role, department_id, COALESCE(is_department_head, FALSE)
    INTO v_role, v_dept, v_is_head
  FROM profiles
  WHERE id = p_user_id;

  IF v_role IN ('admin', 'director') THEN RETURN TRUE; END IF;

  SELECT department_id, created_by, assignee_id
    INTO v_task_dept, v_task_creator, v_task_assignee
  FROM tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_task_creator = p_user_id THEN RETURN TRUE; END IF;
  IF v_task_assignee = p_user_id THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM task_assignees WHERE task_id = p_task_id AND user_id = p_user_id) THEN RETURN TRUE; END IF;
  IF v_role = 'manager' AND v_is_head AND v_task_dept = v_dept THEN RETURN TRUE; END IF;

  RETURN FALSE;
END $$;

GRANT EXECUTE ON FUNCTION user_can_see_task(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION _resolve_default_assignee(p_dept_id UUID)
RETURNS UUID LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT p.id
  FROM profiles p
  WHERE p.department_id = p_dept_id
    AND p.is_active = TRUE
    AND p.role NOT IN ('admin', 'director', 'driver', 'secretary', 'hr_officer')
  ORDER BY
    CASE WHEN p.role = 'manager' AND p.is_department_head = TRUE THEN 0 ELSE 1 END,
    CASE WHEN p.role = 'manager' THEN 0 ELSE 1 END,
    p.full_name ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION _resolve_default_assignee(UUID) TO authenticated, service_role;

-- RLS bảng tasks dùng chung helper để tránh lệch giữa list và detail.
DROP POLICY IF EXISTS "tasks_select" ON tasks;
DROP POLICY IF EXISTS "Tasks read access" ON tasks;
CREATE POLICY "tasks_select" ON tasks FOR SELECT TO authenticated
USING (user_can_see_task(id, auth.uid()));

DROP POLICY IF EXISTS "tasks_no_direct_insert" ON tasks;
DROP POLICY IF EXISTS "Tasks create access" ON tasks;
CREATE POLICY "tasks_no_direct_insert" ON tasks FOR INSERT TO authenticated WITH CHECK (FALSE);

DROP POLICY IF EXISTS "tasks_no_direct_update" ON tasks;
DROP POLICY IF EXISTS "Tasks update access" ON tasks;
CREATE POLICY "tasks_no_direct_update" ON tasks FOR UPDATE TO authenticated USING (FALSE);

DROP POLICY IF EXISTS "tasks_no_direct_delete" ON tasks;
DROP POLICY IF EXISTS "Tasks delete access" ON tasks;
CREATE POLICY "tasks_no_direct_delete" ON tasks FOR DELETE TO authenticated USING (FALSE);

-- Tạo công việc: staff hub được giao việc; người nhận không bao gồm BGĐ/admin/role ngoài module.
DROP FUNCTION IF EXISTS task_create(TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION task_create(
  p_title             TEXT,
  p_description       TEXT DEFAULT NULL,
  p_priority          task_priority DEFAULT 'medium',
  p_due_date          TIMESTAMPTZ DEFAULT NULL,
  p_dept_id           UUID DEFAULT NULL,
  p_assignee_ids      UUID[] DEFAULT NULL,
  p_metadata          JSONB DEFAULT '{}'::jsonb,
  p_requires_approval BOOLEAN DEFAULT FALSE,
  p_batch_id          UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_role         TEXT;
  v_dept         UUID;
  v_dept_code    TEXT;
  v_is_hub       BOOLEAN;
  v_task_id       UUID;
  v_a             UUID;
  v_dept_assignee UUID;
  v_creator_name  TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT p.role, p.department_id, d.code, p.full_name
    INTO v_role, v_dept, v_dept_code, v_creator_name
  FROM profiles p
  LEFT JOIN departments d ON d.id = p.department_id
  WHERE p.id = v_uid;

  v_is_hub := COALESCE(v_dept_code IN ('13618', '13601', '13602', '13605', '13609', '13603'), FALSE);

  IF v_role IN ('driver', 'secretary', 'hr_officer') OR (v_role = 'staff' AND NOT v_is_hub) THEN
    RAISE EXCEPTION 'Bạn không có quyền tạo công việc';
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

  INSERT INTO tasks (
    title, description, priority, due_date, department_id,
    assignee_id, created_by, status, metadata, is_archived,
    requires_approval, batch_id
  ) VALUES (
    trim(p_title), NULLIF(trim(COALESCE(p_description, '')), ''), COALESCE(p_priority, 'medium'),
    p_due_date, p_dept_id,
    CASE WHEN COALESCE(array_length(p_assignee_ids, 1), 0) > 0 THEN p_assignee_ids[1] ELSE v_dept_assignee END,
    v_uid, 'todo'::task_status,
    COALESCE(p_metadata, '{}'::jsonb), FALSE,
    COALESCE(p_requires_approval, FALSE),
    p_batch_id
  ) RETURNING id INTO v_task_id;

  IF COALESCE(array_length(p_assignee_ids, 1), 0) > 0 THEN
    FOREACH v_a IN ARRAY p_assignee_ids LOOP
      INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_a)
      ON CONFLICT (task_id, user_id) DO NOTHING;
      IF v_a <> v_uid THEN
        INSERT INTO notifications (user_id, title, content, type, link)
        VALUES (v_a, 'Bạn có công việc mới', v_creator_name || ' đã giao: ' || trim(p_title), 'task', '/dashboard/tasks?id=' || v_task_id::text);
      END IF;
    END LOOP;
  ELSIF p_dept_id IS NOT NULL THEN
    INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_dept_assignee)
    ON CONFLICT (task_id, user_id) DO NOTHING;

    INSERT INTO notifications (user_id, title, content, type, link)
    VALUES (v_dept_assignee, 'Phòng có công việc mới', v_creator_name || ' đã giao: ' || trim(p_title), 'task', '/dashboard/tasks?id=' || v_task_id::text);
  END IF;

  RETURN v_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_create(TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID) TO authenticated;

-- Phân công lại: quyền cấp phòng chỉ thuộc Trưởng phòng; người nhận phải hợp lệ và cùng phòng công việc.
DROP FUNCTION IF EXISTS task_delegate(UUID, UUID[]);

CREATE OR REPLACE FUNCTION task_delegate(
  p_task_id      UUID,
  p_assignee_ids UUID[]
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_role     TEXT;
  v_dept     UUID;
  v_is_head  BOOLEAN;
  v_task     tasks%ROWTYPE;
  v_actor    TEXT;
  v_a        UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT role, department_id, COALESCE(is_department_head, FALSE), full_name
    INTO v_role, v_dept, v_is_head, v_actor
  FROM profiles
  WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  IF v_task.department_id IS NULL THEN RAISE EXCEPTION 'Công việc chưa có phòng nhận'; END IF;

  IF NOT (
    v_role IN ('admin', 'director')
    OR (v_role = 'manager' AND v_is_head AND v_task.department_id = v_dept)
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền phân công công việc này';
  END IF;

  IF p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận';
  END IF;

  IF EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = ANY(p_assignee_ids)
      AND (
        p.is_active IS DISTINCT FROM TRUE
        OR p.role IN ('admin', 'director', 'driver', 'secretary', 'hr_officer')
        OR p.department_id IS DISTINCT FROM v_task.department_id
      )
  ) THEN
    RAISE EXCEPTION 'Người nhận không hợp lệ hoặc không thuộc phòng nhận việc';
  END IF;

  DELETE FROM task_assignees WHERE task_id = p_task_id;
  FOREACH v_a IN ARRAY p_assignee_ids LOOP
    INSERT INTO task_assignees (task_id, user_id)
    VALUES (p_task_id, v_a)
    ON CONFLICT (task_id, user_id) DO NOTHING;
  END LOOP;

  UPDATE tasks
  SET assignee_id = p_assignee_ids[1],
      status = CASE WHEN v_task.status = 'todo' THEN 'doing'::task_status ELSE v_task.status END
  WHERE id = p_task_id;

  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT a,
         'Bạn được phân công công việc mới',
         v_actor || ' đã phân công: ' || v_task.title,
         'task',
         '/dashboard/tasks?id=' || p_task_id::text
  FROM unnest(p_assignee_ids) a
  WHERE a <> v_uid;
END $$;

GRANT EXECUTE ON FUNCTION task_delegate(UUID, UUID[]) TO authenticated;

-- Dashboard task: non-head manager luôn scope mine; Trưởng phòng mới scope phòng.
DROP FUNCTION IF EXISTS tasks_dashboard(TEXT, JSONB);
DROP FUNCTION IF EXISTS tasks_dashboard(TEXT, JSONB, INT, INT);

CREATE OR REPLACE FUNCTION tasks_dashboard(
  p_scope  TEXT DEFAULT 'mine',
  p_filter JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_role     TEXT;
  v_dept     UUID;
  v_is_head  BOOLEAN;
  v_now      TIMESTAMPTZ := NOW();
  v_counts   JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT role, department_id, COALESCE(is_department_head, FALSE)
    INTO v_role, v_dept, v_is_head
  FROM profiles
  WHERE id = v_uid;

  IF v_role = 'staff' OR (v_role = 'manager' AND NOT v_is_head) THEN
    p_scope := 'mine';
  ELSIF v_role NOT IN ('admin', 'director') AND p_scope = 'branch' THEN
    p_scope := 'dept';
  END IF;

  WITH task_set AS (
    SELECT t.*,
           (t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS is_overdue
    FROM tasks t
    WHERE t.is_archived = FALSE
      AND (
        (p_scope = 'mine' AND user_can_see_task(t.id, v_uid) AND (
          t.assignee_id = v_uid OR t.created_by = v_uid
          OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = v_uid)
        ))
        OR (p_scope = 'dept' AND v_role = 'manager' AND v_is_head AND t.department_id = v_dept)
        OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
      )
  ), counts AS (
    SELECT jsonb_build_object(
      'todo',              COUNT(*) FILTER (WHERE status = 'todo'),
      'doing',             COUNT(*) FILTER (WHERE status = 'doing'),
      'submitted',         COUNT(*) FILTER (WHERE status = 'submitted'),
      'done',              COUNT(*) FILTER (WHERE status = 'done'),
      'canceled',          COUNT(*) FILTER (WHERE status = 'canceled'),
      'overdue',           COUNT(*) FILTER (WHERE is_overdue),
      'awaiting_approval', COUNT(*) FILTER (WHERE status = 'submitted'),
      'extensions_pending', (SELECT COUNT(*) FROM task_extension_requests er WHERE er.status = 'pending' AND user_can_see_task(er.task_id, v_uid))
    ) AS val FROM task_set
  ), task_list AS (
    SELECT t.id, t.title, t.description, t.status, t.priority,
           t.assignee_id, t.created_by, t.department_id,
           t.due_date, t.created_at, t.updated_at, t.metadata, t.is_archived,
           t.requires_approval, t.batch_id, t.is_overdue,
           jsonb_build_object('id', d.id, 'name', d.name) AS department,
           jsonb_build_object('id', c.id, 'full_name', c.full_name, 'avatar_url', c.avatar_url, 'department_id', c.department_id) AS creator,
           COALESCE(a.assignees, '[]'::jsonb) AS assignees
    FROM task_set t
    LEFT JOIN departments d ON d.id = t.department_id
    LEFT JOIN profiles c ON c.id = t.created_by
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url, 'department_id', p.department_id, 'role', p.role, 'is_department_head', p.is_department_head)) AS assignees
      FROM task_assignees ta
      JOIN profiles p ON p.id = ta.user_id
      WHERE ta.task_id = t.id
    ) a ON true
    ORDER BY t.is_overdue DESC, t.due_date ASC NULLS LAST, t.created_at DESC
    LIMIT 50
  ), resource_view AS (
    SELECT COALESCE(jsonb_agg(r.* ORDER BY r.active_count DESC), '[]'::jsonb) AS val
    FROM (
      SELECT ta.user_id, p.full_name, p.avatar_url,
             COUNT(*) FILTER (WHERE t.status NOT IN ('done','canceled')) AS active_count,
             COUNT(*) FILTER (WHERE t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS overdue_count
      FROM task_assignees ta
      JOIN tasks t ON t.id = ta.task_id
      JOIN profiles p ON p.id = ta.user_id
      WHERE t.is_archived = FALSE
        AND ((p_scope = 'dept' AND v_role = 'manager' AND v_is_head AND t.department_id = v_dept)
          OR (p_scope = 'branch' AND v_role IN ('admin', 'director')))
      GROUP BY ta.user_id, p.full_name, p.avatar_url
      LIMIT 20
    ) r
  )
  SELECT jsonb_build_object(
    'counts', COALESCE(c.val, '{}'::jsonb),
    'lists', COALESCE((SELECT jsonb_agg(row_to_json(tl.*) ORDER BY tl.is_overdue DESC, tl.due_date NULLS LAST, tl.created_at DESC) FROM task_list tl), '[]'::jsonb),
    'resource_view', CASE WHEN p_scope = 'mine' THEN '[]'::jsonb ELSE COALESCE((SELECT val FROM resource_view), '[]'::jsonb) END,
    'scope', p_scope,
    'role', v_role
  ) INTO v_counts
  FROM counts c;

  RETURN v_counts;
END $$;

GRANT EXECUTE ON FUNCTION tasks_dashboard(TEXT, JSONB) TO authenticated;

-- Home dashboard counters dùng cùng visibility.
CREATE OR REPLACE FUNCTION dashboard_summary()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_role      TEXT;
  v_now       TIMESTAMPTZ := NOW();
  v_today_end TIMESTAMPTZ := date_trunc('day', NOW()) + INTERVAL '1 day';
  v_counts    JSONB;
  v_today     JSONB;
  v_docs      JSONB;
  v_leaves    JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;

  WITH visible AS (
    SELECT t.id, t.batch_id, t.status, t.priority, t.due_date, t.updated_at
    FROM tasks t
    WHERE t.is_archived = FALSE
      AND user_can_see_task(t.id, v_uid)
  )
  SELECT jsonb_build_object(
    'active', COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status IN ('todo','doing','submitted')),
    'urgent', COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status IN ('todo','doing','submitted') AND priority = 'high'),
    'overdue', COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE due_date < v_now AND status NOT IN ('done','canceled')),
    'done_today', COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'done' AND updated_at >= date_trunc('day', v_now))
  ) INTO v_counts
  FROM visible;

  SELECT COALESCE(jsonb_agg(row_to_json(top.*) ORDER BY top.due_date ASC NULLS LAST), '[]'::jsonb)
  INTO v_today
  FROM (
    SELECT * FROM (
      SELECT DISTINCT ON (COALESCE(t.batch_id, t.id))
             t.id, t.title, t.status, t.priority, t.due_date,
             (t.due_date < v_now) AS is_overdue
      FROM tasks t
      WHERE t.is_archived = FALSE
        AND t.status IN ('todo','doing','submitted')
        AND (t.due_date IS NULL OR t.due_date < v_today_end)
        AND user_can_see_task(t.id, v_uid)
      ORDER BY COALESCE(t.batch_id, t.id), t.due_date ASC NULLS LAST
    ) deduped
    ORDER BY deduped.due_date ASC NULLS LAST
    LIMIT 10
  ) top;

  SELECT COALESCE(jsonb_agg(row_to_json(d.*)), '[]'::jsonb)
  INTO v_docs
  FROM (
    SELECT d.id, d.short_code, d.title, d.status, d.created_at, d.updated_at,
           d.current_assignee_id, d.creator_id,
           (SELECT row_to_json(c.*) FROM (SELECT id, name, sla_hours, color FROM document_categories WHERE id = d.category_id) c) AS category,
           (SELECT COALESCE(jsonb_agg(row_to_json(h.*)), '[]'::jsonb)
            FROM (SELECT id, document_id, sender_id, receiver_id, status, sent_at, received_at
                  FROM document_handovers WHERE document_id = d.id ORDER BY sent_at DESC) h) AS handovers
    FROM documents d
    WHERE d.status <> 'COMPLETED'
      AND ((d.current_assignee_id = v_uid AND NOT EXISTS (
             SELECT 1 FROM document_handovers h WHERE h.document_id = d.id AND h.sender_id = v_uid AND h.status = 'PENDING'))
        OR EXISTS (SELECT 1 FROM document_handovers h WHERE h.document_id = d.id AND h.receiver_id = v_uid AND h.status = 'PENDING'))
    ORDER BY d.updated_at DESC
    LIMIT 5
  ) d;

  SELECT COALESCE(jsonb_agg(row_to_json(l.*) ORDER BY l.start_time), '[]'::jsonb)
  INTO v_leaves
  FROM (
    SELECT s.id, s.title, s.status, s.start_time, s.end_time,
           s.created_by, p.full_name AS creator_name, p.avatar_url AS creator_avatar
    FROM schedules s
    LEFT JOIN profiles p ON p.id = s.created_by
    WHERE s.type = 'leave'
      AND s.status IN ('approved', 'in_progress')
      AND s.start_time <= NOW()
      AND s.end_time >= date_trunc('day', NOW())
    ORDER BY s.start_time
    LIMIT 20
  ) l;

  RETURN jsonb_build_object(
    'counts', COALESCE(v_counts, jsonb_build_object('active',0,'urgent',0,'overdue',0,'done_today',0)),
    'today_tasks', COALESCE(v_today, '[]'::jsonb),
    'pending_docs', COALESCE(v_docs, '[]'::jsonb),
    'today_leaves', COALESCE(v_leaves, '[]'::jsonb),
    'role', v_role
  );
END $$;

GRANT EXECUTE ON FUNCTION dashboard_summary() TO authenticated;

-- Sửa/xoá: creator + Trưởng phòng của creator + admin/BGĐ.
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

CREATE OR REPLACE FUNCTION task_delete(p_task_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_dept UUID;
  v_is_head BOOLEAN;
  v_task tasks%ROWTYPE;
  v_creator_dept UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, COALESCE(is_department_head, FALSE) INTO v_role, v_dept, v_is_head FROM profiles WHERE id = v_uid;
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  SELECT department_id INTO v_creator_dept FROM profiles WHERE id = v_task.created_by;
  IF NOT (v_role IN ('admin','director') OR v_task.created_by = v_uid OR (v_role = 'manager' AND v_is_head AND v_dept = v_creator_dept)) THEN
    RAISE EXCEPTION 'Bạn không có quyền xoá công việc này';
  END IF;
  DELETE FROM tasks WHERE id = p_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_delete(UUID) TO authenticated;

-- Trạng thái: quyền cấp phòng chỉ thuộc Trưởng phòng.
CREATE OR REPLACE FUNCTION task_update_status(
  p_task_id UUID,
  p_new_status task_status,
  p_comment TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_dept UUID;
  v_is_head BOOLEAN;
  v_task tasks%ROWTYPE;
  v_creator_dept UUID;
  v_is_assignee BOOLEAN;
  v_is_top_admin BOOLEAN;
  v_is_head_manager BOOLEAN;
  v_is_creator BOOLEAN;
  v_is_creator_head BOOLEAN;
  v_actor_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, COALESCE(is_department_head, FALSE), full_name
    INTO v_role, v_dept, v_is_head, v_actor_name
  FROM profiles WHERE id = v_uid;
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  IF NOT user_can_see_task(p_task_id, v_uid) THEN RAISE EXCEPTION 'Bạn không có quyền với công việc này'; END IF;

  SELECT department_id INTO v_creator_dept FROM profiles WHERE id = v_task.created_by;
  v_is_assignee := v_task.assignee_id = v_uid OR EXISTS (SELECT 1 FROM task_assignees WHERE task_id = p_task_id AND user_id = v_uid);
  v_is_top_admin := v_role IN ('admin','director');
  v_is_head_manager := v_is_top_admin OR (v_role = 'manager' AND v_is_head AND v_task.department_id = v_dept);
  v_is_creator := v_task.created_by = v_uid;
  v_is_creator_head := v_role = 'manager' AND v_is_head AND v_dept = v_creator_dept;

  IF v_task.status = p_new_status THEN RETURN; END IF;

  IF p_new_status = 'canceled' THEN
    RAISE EXCEPTION 'Hãy dùng chức năng huỷ công việc';
  ELSIF p_new_status = 'doing' THEN
    IF v_task.status NOT IN ('todo','submitted','done') THEN RAISE EXCEPTION 'Không thể chuyển sang Đang làm từ trạng thái hiện tại'; END IF;
    IF v_task.status IN ('submitted','done') THEN
      IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN RAISE EXCEPTION 'Vui lòng nhập lý do'; END IF;
      IF NOT (v_is_head_manager OR v_is_creator OR v_is_creator_head) THEN RAISE EXCEPTION 'Bạn không có quyền trả về công việc này'; END IF;
      UPDATE tasks SET status = p_new_status, last_returned_at = NOW(), last_return_reason = p_comment WHERE id = p_task_id;
    ELSE
      IF NOT (v_is_assignee OR v_is_head_manager) THEN RAISE EXCEPTION 'Bạn không có quyền chuyển trạng thái'; END IF;
      UPDATE tasks SET status = p_new_status WHERE id = p_task_id;
    END IF;
  ELSIF p_new_status = 'submitted' THEN
    IF NOT v_task.requires_approval THEN RAISE EXCEPTION 'Công việc này không cần duyệt, hãy bấm Hoàn thành'; END IF;
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

GRANT EXECUTE ON FUNCTION task_update_status(UUID, task_status, TEXT) TO authenticated;

-- Gia hạn: Trưởng phòng phòng nhận + creator + admin/BGĐ.
CREATE OR REPLACE FUNCTION task_decide_extension(
  p_extension_id UUID,
  p_approve BOOLEAN,
  p_comment TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_dept UUID;
  v_is_head BOOLEAN;
  v_ext task_extension_requests%ROWTYPE;
  v_task tasks%ROWTYPE;
  v_actor TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, COALESCE(is_department_head, FALSE), full_name INTO v_role, v_dept, v_is_head, v_actor FROM profiles WHERE id = v_uid;
  SELECT * INTO v_ext FROM task_extension_requests WHERE id = p_extension_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy yêu cầu gia hạn'; END IF;
  IF v_ext.status <> 'pending' THEN RAISE EXCEPTION 'Yêu cầu đã được xử lý'; END IF;
  SELECT * INTO v_task FROM tasks WHERE id = v_ext.task_id;
  IF NOT (v_role IN ('admin','director') OR v_task.created_by = v_uid OR (v_role = 'manager' AND v_is_head AND v_task.department_id = v_dept)) THEN
    RAISE EXCEPTION 'Bạn không có quyền duyệt yêu cầu này';
  END IF;
  UPDATE task_extension_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by = v_uid, review_comment = p_comment, decided_at = NOW()
  WHERE id = p_extension_id;
  IF p_approve THEN UPDATE tasks SET due_date = v_ext.new_due_date WHERE id = v_ext.task_id; END IF;
  INSERT INTO notifications (user_id, title, content, type, link)
  VALUES (v_ext.requested_by,
          CASE WHEN p_approve THEN 'Đã duyệt gia hạn' ELSE 'Đã từ chối gia hạn' END,
          v_actor || ' — "' || v_task.title || '"' || CASE WHEN p_comment IS NOT NULL AND length(trim(p_comment)) > 0 THEN ': ' || p_comment ELSE '' END,
          'extension', '/dashboard/tasks?id=' || v_ext.task_id::text);
END $$;

GRANT EXECUTE ON FUNCTION task_decide_extension(UUID, BOOLEAN, TEXT) TO authenticated;

-- Mẫu định kỳ: chỉ creator sửa/xoá/bật tắt; target user không gồm BGĐ/admin/role ngoài module.
CREATE OR REPLACE FUNCTION recurring_template_delete(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  DELETE FROM task_recurring_templates WHERE id = p_id AND created_by = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không có quyền hoặc không tìm thấy'; END IF;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_delete(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION recurring_template_toggle(p_id UUID, p_active BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  UPDATE task_recurring_templates SET is_active = p_active WHERE id = p_id AND created_by = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không có quyền hoặc không tìm thấy'; END IF;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_toggle(UUID, BOOLEAN) TO authenticated;

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
  p_default_assignee_id   UUID DEFAULT NULL,
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
  FROM profiles p LEFT JOIN departments d ON d.id = p.department_id WHERE p.id = v_uid;
  v_is_hub := COALESCE(v_dept_code IN ('13618', '13601', '13602', '13605', '13609', '13603'), FALSE);
  IF v_role IN ('driver','secretary','hr_officer') OR (v_role = 'staff' AND NOT v_is_hub) THEN RAISE EXCEPTION 'Bạn không có quyền tạo công việc định kỳ'; END IF;
  IF p_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM task_recurring_templates WHERE id = p_id AND created_by = v_uid) THEN RAISE EXCEPTION 'Bạn không có quyền sửa mẫu định kỳ này'; END IF;
  IF COALESCE(array_length(p_target_department_ids,1),0) = 0 AND COALESCE(array_length(p_target_user_ids,1),0) = 0 THEN RAISE EXCEPTION 'Vui lòng chọn người nhận hoặc phòng ban'; END IF;
  IF v_role = 'manager' AND NOT v_is_hub AND EXISTS (SELECT 1 FROM unnest(p_target_department_ids) AS target_dept_id WHERE target_dept_id IS DISTINCT FROM v_dept) THEN RAISE EXCEPTION 'Chỉ được tạo công việc định kỳ trong phòng mình'; END IF;
  IF COALESCE(array_length(p_target_user_ids,1),0) > 0 AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = ANY(p_target_user_ids) AND (p.is_active IS DISTINCT FROM TRUE OR p.role IN ('admin','director','driver','secretary','hr_officer'))
  ) THEN RAISE EXCEPTION 'Người nhận không hợp lệ'; END IF;
  IF COALESCE(array_length(p_target_user_ids,1),0) > 0 AND v_role NOT IN ('admin','director') AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = ANY(p_target_user_ids) AND p.department_id IS DISTINCT FROM v_dept
  ) THEN RAISE EXCEPTION 'Chỉ được chọn cán bộ trong phòng mình'; END IF;
  IF p_default_assignee_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_default_assignee_id
      AND (
        p.is_active IS DISTINCT FROM TRUE
        OR p.role IN ('admin','director','driver','secretary','hr_officer')
      )
  ) THEN RAISE EXCEPTION 'Người nhận mặc định không hợp lệ'; END IF;
  IF p_default_assignee_id IS NOT NULL AND v_role NOT IN ('admin','director') AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_default_assignee_id
      AND p.department_id IS DISTINCT FROM v_dept
  ) THEN RAISE EXCEPTION 'Chỉ được chọn người nhận mặc định trong phòng mình'; END IF;
  IF p_default_assignee_id IS NOT NULL
     AND COALESCE(array_length(p_target_department_ids,1),0) > 0
     AND NOT EXISTS (
       SELECT 1 FROM profiles p
       WHERE p.id = p_default_assignee_id
         AND p.department_id = ANY(p_target_department_ids)
     ) THEN
    RAISE EXCEPTION 'Người nhận mặc định phải thuộc phòng ban nhận việc';
  END IF;

  v_next := _recurring_next_run(p_schedule_kind, p_weekly_dow, p_weekly_time, p_monthly_dom, p_monthly_time, p_timezone, NOW());

  IF p_id IS NOT NULL THEN
    UPDATE task_recurring_templates SET
      title = trim(p_title), description = NULLIF(trim(COALESCE(p_description,'')), ''), priority = p_priority,
      target_department_ids = p_target_department_ids, target_user_ids = p_target_user_ids,
      schedule_kind = p_schedule_kind, weekly_dow = p_weekly_dow, weekly_time = p_weekly_time::TIME,
      monthly_dom = p_monthly_dom, monthly_time = p_monthly_time::TIME, timezone = p_timezone,
      due_days_after_fire = p_due_days_after_fire, is_active = p_is_active,
      default_assignee_id = p_default_assignee_id, next_run_at = v_next
    WHERE id = p_id AND created_by = v_uid RETURNING id INTO v_id;
  ELSE
    INSERT INTO task_recurring_templates (
      title, description, priority, target_department_ids, target_user_ids,
      schedule_kind, weekly_dow, weekly_time, monthly_dom, monthly_time,
      timezone, due_days_after_fire, created_by, is_active, default_assignee_id, next_run_at
    ) VALUES (
      trim(p_title), NULLIF(trim(COALESCE(p_description,'')), ''), p_priority, p_target_department_ids, p_target_user_ids,
      p_schedule_kind, p_weekly_dow, p_weekly_time::TIME, p_monthly_dom, p_monthly_time::TIME,
      p_timezone, p_due_days_after_fire, v_uid, p_is_active, p_default_assignee_id, v_next
    ) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_upsert(TEXT, TEXT, task_priority, UUID[], UUID[], TEXT, INT, TEXT, INT, TEXT, TEXT, INT, BOOLEAN, UUID, UUID) TO authenticated;



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

NOTIFY pgrst, 'reload schema';

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
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chua dang nhap'; END IF;
  
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Khong tim thay cong viec'; END IF;
  
  -- Check permission: only creator or admin/director/manager of the creator can remind? Or maybe just user_can_see_task but must be creator/manager.
  -- For simplicity, let's just check if user_can_see_task() is true, and maybe if they are the creator or have manager rights.
  -- Actually, let's just allow the creator or admin to remind.
  IF v_task.created_by != v_uid AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_uid AND role IN ('admin', 'director')) THEN
    -- Check if manager of the department
    IF NOT EXISTS (SELECT 1 FROM profiles p JOIN profiles c ON p.department_id = c.department_id WHERE p.id = v_uid AND p.role = 'manager' AND c.id = v_task.created_by) THEN
        RAISE EXCEPTION 'Chi nguoi giao viec hoac quan ly moi duoc nhac nho';
    END IF;
  END IF;

  IF v_task.status IN ('done', 'canceled') THEN
    RAISE EXCEPTION 'Cong viec da hoan thanh hoac huy, khong the nhac nho';
  END IF;

  IF v_task.last_reminded_at IS NOT NULL AND NOW() < v_task.last_reminded_at + interval '1 minute' THEN
    RAISE EXCEPTION 'Ban vua nhac nho roi, vui long doi 1 phut roi thu lai';
  END IF;

  UPDATE tasks SET last_reminded_at = NOW() WHERE id = p_task_id;

  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT ta.user_id, 'Nhac nho hoan thanh cong viec', 'Nguoi giao viec dang nhac ban hoan thanh: ' || v_task.title, 'task', '/dashboard/tasks?id=' || p_task_id::text
  FROM task_assignees ta
  WHERE ta.task_id = p_task_id;
END;
$$;
GRANT EXECUTE ON FUNCTION task_remind(UUID) TO authenticated, service_role;

