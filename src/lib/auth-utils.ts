import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

// RSC layout chỉ cần các field hiển thị trên top-bar / sidebar / banner.
// Field nhạy cảm + thông tin chi tiết (employee_code, ad_account, gender, birthday, ...) 
// để Client-side lấy từ AppDataProvider — tránh kéo payload nặng mỗi navigation.
const LAYOUT_PROFILE_SELECT = `
  id,
  full_name,
  role,
  department_id,
  avatar_url,
  title,
  is_department_head,
  is_active,
  must_change_password,
  branch_join_date,
  departments ( name )
`

export async function getProfile() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select(LAYOUT_PROFILE_SELECT)
    .eq('id', user.id)
    .single()

  return profile
}
