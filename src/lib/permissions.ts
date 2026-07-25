export function isCoordinatorDepartment(profile: any): boolean {
  if (!profile) return false;
  const depts = profile.departments;
  if (!depts) return false;
  const first = Array.isArray(depts) ? depts[0] : depts;
  return first?.code === '13602' || first?.name === 'Tổ chức Tổng hợp';
}

export function canCoordinateSharedResources(profile: any): boolean {
  if (!profile) return false;

  if (profile.role === 'admin' || profile.role === 'secretary') return true;

  return profile.role === 'manager' && isCoordinatorDepartment(profile);
}

export function canManageResourceCatalog(profile: any): boolean {
  if (!profile) return false;

  return profile.role === 'admin' || profile.role === 'secretary';
}

export function canUseDriverWorkspace(profile: any): boolean {
  return profile?.role === 'driver';
}

export function canUseHumanResourcesWorkspace(profile: any): boolean {
  return profile?.role === 'hr_officer';
}

export function canAccessPeopleDirectory(profile: any): boolean {
  if (!profile) return false;

  return ['admin', 'director', 'hr_officer'].includes(profile.role) || profile.role === 'manager';
}

// Xem danh bạ — mở rộng cho staff/secretary/hr_officer/manager/director/admin.
// Driver vẫn chặn vì không có nhu cầu nghiệp vụ (workspace riêng).
export function canViewPeopleDirectory(profile: any): boolean {
  return !!profile && profile.role !== 'driver';
}

// Xem field nhạy cảm trên hồ sơ người khác (birthday, ad_account, employee_code, gender).
// Self luôn xem được; ngoài ra chỉ admin/hr_officer/director.
export function canViewSensitiveProfileFields(viewer: any, target: any): boolean {
  if (!viewer || !target) return false;
  if (viewer.id === target.id) return true;
  return ['admin', 'hr_officer', 'director'].includes(viewer.role);
}

// Sửa hồ sơ — self sửa field hạn chế; admin/hr_officer sửa full.
export function canEditProfile(viewer: any, target: any): boolean {
  if (!viewer || !target) return false;
  if (viewer.id === target.id) return true;
  return ['admin', 'hr_officer'].includes(viewer.role);
}

// Gửi ghi nhận đồng nghiệp (recognitions) — mọi role active trừ driver.
export function canRecognize(profile: any): boolean {
  return !!profile && profile.role !== 'driver';
}

// Kiểm tra quyền xem badge "Đi công tác" (Business Trip)
export function canViewBusinessTripBadge(viewer: any, target: any): boolean {
  if (!viewer || !target) return false;
  if (viewer.id === target.id) return true;
  if (['admin', 'director'].includes(viewer.role)) return true;
  return viewer.department_id === target.department_id;
}

export function canApproveLeave(profile: any, leave?: any): boolean {
  if (!profile) return false;

  if (profile.role === 'admin') return true;

  // HR Officer chỉ READ đơn nghỉ phép, không duyệt
  if (profile.role === 'hr_officer') return false;

  if (!leave) {
    return profile.role === 'director' || profile.role === 'manager';
  }

  if (profile.role === 'director') {
    return leave.creator?.is_department_head === true || leave.creator?.role === 'manager';
  }

  if (profile.role === 'manager') {
    const isCurrentUserHead = profile.is_department_head === true;
    const isCreatorHead = leave.creator?.is_department_head === true;
    const isCreatorManager = leave.creator?.role === 'manager';

    return (
      leave.creator?.department_id === profile.department_id &&
      leave.created_by !== profile.id &&
      (isCurrentUserHead || (!isCreatorHead && !isCreatorManager))
    );
  }

  return false;
}

// Module Luân chuyển & Truy vết Hồ sơ vật lý ---------------------------------

// Chỉ admin được tạo/sửa/xoá nhóm hồ sơ (đi kèm cấu hình SLA)
export function canManageDocumentCategories(profile: any): boolean {
  return profile?.role === 'admin';
}

// BGĐ + admin được xem toàn bộ hồ sơ chi nhánh (read-only truy vết)
export function canViewAllDocuments(profile: any): boolean {
  return profile?.role === 'admin' || profile?.role === 'director';
}

// Lái xe có workspace riêng, không tham gia luồng hồ sơ giấy
export function canCreateDocument(profile: any): boolean {
  if (!profile) return false;
  return profile.role !== 'driver';
}

// Module Công việc (Tasks) -----------------------------------------------------

// Phòng đầu mối — code đặc biệt được phép giao việc cho phòng khác,
// kể cả cán bộ staff. Theo nghiệp vụ chi nhánh (phòng điều phối + các phòng đầu mối khác).
const HUB_DEPARTMENT_CODES = ['13618', '13601', '13602', '13605', '13609', '13603'];

// Trích code phòng từ profile — Supabase có thể trả `departments` dưới dạng
// object hoặc array (1-1 vs ambiguous FK). Helper này xử lý cả 2 case.
export function getProfileDepartmentCode(profile: any): string | null {
  const depts = profile?.departments;
  if (!depts) return null;
  if (Array.isArray(depts)) return depts[0]?.code ?? null;
  return depts?.code ?? null;
}

export function isHubDepartment(profile: any): boolean {
  const code = getProfileDepartmentCode(profile);
  return !!code && HUB_DEPARTMENT_CODES.includes(code);
}

export function isDepartmentHeadManager(profile: any): boolean {
  return !!profile && profile.role === 'manager' && profile.is_department_head === true;
}

export function isManagerRole(profile: any): boolean {
  return !!profile && profile.role === 'manager';
}

// Lái xe, lễ tân và nhân sự không thấy module Tasks.
export function canAccessTasksModule(profile: any): boolean {
  if (!profile) return false;
  return !['driver', 'secretary', 'hr_officer'].includes(profile.role);
}

export type TaskScopeValue = 'mine' | 'dept' | 'branch';

export function getDefaultTaskScope(profile: any): TaskScopeValue {
  if (!profile) return 'mine';
  if (profile.role === 'admin' || profile.role === 'director') return 'branch';
  if (isDepartmentHeadManager(profile)) return 'dept';
  return 'mine';
}

export function canViewTaskScopeTabs(profile: any): boolean {
  return !!profile && (['admin', 'director'].includes(profile.role) || isDepartmentHeadManager(profile));
}

export function canViewBranchTaskScope(profile: any): boolean {
  return !!profile && ['admin', 'director'].includes(profile.role);
}

// Tạo/giao công việc.
export function canCreateTaskAssignment(profile: any): boolean {
  if (!profile) return false;
  if (['admin', 'director', 'manager'].includes(profile.role)) return true;
  return profile.role === 'staff' && isHubDepartment(profile);
}

// Cho phép giao cho phòng ban khác. Non-hub manager giao trực tiếp trong phòng mình.
export function canTargetCrossDepartment(profile: any): boolean {
  if (!profile) return false;
  if (['admin', 'director'].includes(profile.role)) return true;
  return ['manager', 'staff'].includes(profile.role) && isHubDepartment(profile);
}

// Quyền quản trị cấp phòng chỉ thuộc Trưởng phòng.
export function canManageDepartmentTask(profile: any, task: { department_id?: string | null } | null): boolean {
  if (!profile || !task) return false;
  if (profile.role === 'admin' || profile.role === 'director') return true;
  return isDepartmentHeadManager(profile) && profile.department_id === task.department_id;
}

export function canDelegateTask(profile: any, task: { department_id?: string | null } | null): boolean {
  return canManageDepartmentTask(profile, task);
}

export function canApproveTaskResult(profile: any, task: { department_id?: string | null } | null): boolean {
  return canManageDepartmentTask(profile, task);
}

export function canRejectSubmission(
  profile: any,
  task: { department_id?: string | null; created_by?: string | null; status?: string | null } | null,
): boolean {
  if (!profile || !task) return false;
  if (task.status !== 'submitted') return false;
  if (profile.role === 'admin' || profile.role === 'director') return true;
  if (task.created_by === profile.id) return true;
  return canManageDepartmentTask(profile, task);
}

export function canReopenDone(
  profile: any,
  task: { status?: string | null; created_by?: string | null; department_id?: string | null; creator?: { department_id?: string | null } | null } | null,
): boolean {
  if (!profile || !task) return false;
  if (task.status !== 'done') return false;
  if (profile.role === 'admin' || profile.role === 'director') return true;
  if (task.created_by === profile.id) return true;
  if (isDepartmentHeadManager(profile) && profile.department_id === task.creator?.department_id) return true;
  if (isDepartmentHeadManager(profile) && profile.department_id === task.department_id) return true;
  return false;
}

export function canEditTask(
  profile: any,
  task: { created_by?: string | null; status?: string | null; is_archived?: boolean | null; creator?: { department_id?: string | null } | null } | null,
): boolean {
  if (!profile || !task) return false;
  if (task.status === 'canceled' || task.is_archived) return false;
  if (profile.role === 'admin' || profile.role === 'director') return true;
  if (task.created_by === profile.id) return true;
  return isDepartmentHeadManager(profile) && profile.department_id === task.creator?.department_id;
}

export function canDeleteTask(
  profile: any,
  task: {
    created_by?: string | null;
    creator?: { department_id?: string | null } | null;
  } | null,
): boolean {
  if (!profile || !task) return false;
  if (profile.role === 'admin' || profile.role === 'director') return true;
  if (task.created_by === profile.id) return true;
  return isDepartmentHeadManager(profile) && profile.department_id === task.creator?.department_id;
}

export function canArchiveTask(profile: any): boolean {
  return !!profile && ['admin', 'director'].includes(profile.role);
}

export function canComposeTaskComment(profile: any): boolean {
  return !!profile && profile.role !== 'admin';
}

export function shouldDefaultAssignTaskToSelf(profile: any): boolean {
  return !!profile && profile.role === 'staff';
}

export function canSelectSpecificAssigneesAcrossDepartments(profile: any): boolean {
  return !!profile && ['admin', 'director'].includes(profile.role);
}

export function canForceCompleteTask(
  profile: any,
  task: {
    created_by?: string | null;
    creator?: { department_id?: string | null } | null;
  } | null,
): boolean {
  return canDeleteTask(profile, task);
}

export function canApproveExtension(
  profile: any,
  task: { department_id?: string | null; created_by?: string | null } | null,
): boolean {
  if (!profile || !task) return false;
  if (profile.role === 'admin' || profile.role === 'director') return true;
  if (task.created_by === profile.id) return true;
  return canManageDepartmentTask(profile, task);
}

// Tạo công việc định kỳ — BGĐ + manager + cán bộ phòng đầu mối.
export function canCreateRecurringTemplate(profile: any): boolean {
  if (!profile) return false;
  if (['admin', 'director', 'manager'].includes(profile.role)) return true;
  return profile.role === 'staff' && isHubDepartment(profile);
}

// Xem Analytics module Tasks.
//   • Admin/Director: toàn nhánh.
//   • Trưởng phòng: phòng mình.
//   • Coordinator: toàn nhánh.
export function canViewTaskAnalytics(profile: any): boolean {
  if (!profile) return false;
  if (['admin', 'director'].includes(profile.role)) return true;
  if (isDepartmentHeadManager(profile)) return true;
  return profile.role === 'staff' && isCoordinatorDepartment(profile);
}

export function canViewBranchAnalytics(profile: any): boolean {
  if (!profile) return false;
  if (['admin', 'director'].includes(profile.role)) return true;
  return isCoordinatorDepartment(profile);
}
