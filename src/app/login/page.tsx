'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  Loader2,
  Lock,
  User,
  Building2,
  Briefcase,
  Clock,
  ArrowLeft,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Logo } from "@/components/ui/logo"

// Trang gốc phải bọc Suspense vì LoginForm dùng useSearchParams() — Next.js yêu cầu
// để có thể bailout sang client-side render khi prerender.
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('staff')
  const [departmentId, setDepartmentId] = useState('')
  const [departments, setDepartments] = useState<any[]>([])

  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [isPendingApproval, setIsPendingApproval] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Tự động hiển thị màn chờ duyệt nếu middleware đẩy về với pending=1
  useEffect(() => {
    if (searchParams.get('pending') === '1') {
      setIsPendingApproval(true)
    }
  }, [searchParams])

  // Lấy danh sách phòng ban từ Database khi bật chế độ đăng ký
  useEffect(() => {
    if (isSignUp) {
      fetchDepartments()
    }
  }, [isSignUp])

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name')
      if (error) throw error
      setDepartments(data || [])
      if (data && data.length > 0) {
        setDepartmentId(data[0].id)
      }
    } catch (err) {
      console.error('Lỗi lấy danh sách phòng ban:', err)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Tự động gán domain ảo nếu người dùng đăng nhập bằng Username (không có ký tự @)
    const finalEmail = email.includes('@') ? email.trim() : `${email.trim()}@vietinbank.vn`

    try {
      if (isSignUp) {
        // Tạo tài khoản auth thật, profile sẽ được trigger handle_new_user tạo với is_active=false
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: finalEmail,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        })

        if (signUpError) {
          if (signUpError.message?.toLowerCase().includes('already registered')
              || signUpError.message?.toLowerCase().includes('already')) {
            throw new Error('Tên đăng nhập này đã tồn tại trong hệ thống.')
          }
          throw signUpError
        }

        // Đăng nhập tạm để có quyền cập nhật profile của chính mình (RLS profiles UPDATE = auth.uid()=id)
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: finalEmail,
          password,
        })

        if (!signInError && signUpData?.user?.id) {
          await supabase.from('profiles').update({
            full_name: fullName,
            department_id: departmentId || null,
            role,
          }).eq('id', signUpData.user.id)
        }

        // Ghi lại yêu cầu duyệt (audit) — không còn mật khẩu
        await supabase.from('account_requests').insert({
          full_name: fullName,
          email: finalEmail,
          role,
          department_id: departmentId || null,
          status: 'pending',
        })

        // Đăng xuất ngay để chờ admin duyệt is_active
        await supabase.auth.signOut()

        setIsPendingApproval(true)
        notifySuccess(
          "Đã gửi yêu cầu",
          "Tài khoản đã được tạo. Vui lòng chờ Quản trị viên kích hoạt."
        )
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email: finalEmail,
          password,
        })
        if (error) throw error

        // Kiểm tra trạng thái kích hoạt — nếu chưa được duyệt thì đăng xuất
        if (signInData?.user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_active')
            .eq('id', signInData.user.id)
            .maybeSingle()

          if (profile && profile.is_active === false) {
            await supabase.auth.signOut()
            setIsPendingApproval(true)
            return
          }
        }

        const redirectTo = searchParams.get('redirect') || '/dashboard'
        router.refresh()
        router.push(redirectTo)
      }
    } catch (error) {
      notifyError(error, "Đăng nhập thất bại, vui lòng thử lại.")
    } finally {
      setLoading(false)
    }
  }

  // Màn hình trạng thái chờ duyệt
  if (isPendingApproval) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
        <div className="w-full max-w-md z-10 flex flex-col items-center gap-8 animate-fade-in-up">
          <Card className="w-full shadow-2xl border-none rounded-2xl bg-white/90 backdrop-blur-xl overflow-hidden p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-primary/5 relative">
              <Clock className="w-10 h-10 animate-pulse text-primary" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full animate-ping" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">Tài khoản đang chờ kích hoạt</h2>
              <p className="text-slate-500 text-sm font-medium leading-relaxed px-2">
                Yêu cầu của bạn đã được ghi nhận. Quản trị viên sẽ kích hoạt tài khoản trong thời gian sớm nhất.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl text-left text-[11px] font-bold text-slate-500 space-y-2.5 border border-slate-100">
              <div className="flex justify-between items-center">
                <span>Họ và tên</span>
                <span className="text-slate-900 font-extrabold">{fullName || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Tên đăng nhập</span>
                <span className="text-slate-900 font-extrabold normal-case">{email.includes('@') ? email.split('@')[0] : email || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Chức danh</span>
                <span className="text-slate-900 font-extrabold">{role === 'manager' ? 'Lãnh đạo phòng' : 'Cán bộ'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Phòng ban công tác</span>
                <span className="text-slate-900 font-extrabold">{departments.find(d => d.id === departmentId)?.name || 'Chưa chọn'}</span>
              </div>
            </div>

            <Button
              onClick={() => {
                setIsSignUp(false)
                setIsPendingApproval(false)
                setEmail('')
                setPassword('')
                setFullName('')
              }}
              className="w-full min-h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all text-xs"
            >
              Quay lại Đăng nhập
            </Button>
          </Card>
          <p className="text-[11px] font-medium text-slate-500 italic">made by phuctd</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
      <div className="w-full max-w-md z-10 flex flex-col items-center gap-8">
        <Card className="w-full shadow-2xl border-none rounded-2xl bg-white/80 backdrop-blur-xl overflow-hidden transition-all duration-500">
          <CardHeader className="space-y-1 flex flex-col items-center p-8 pb-4">
            <div className="mb-3 transition-transform hover:scale-105 flex items-center justify-center">
              <Logo className="h-16 w-16" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              WorkFlow Portal
            </CardTitle>
            <CardDescription className="text-center font-semibold text-xs text-slate-500">
              {isSignUp ? 'Yêu cầu cấp tài khoản mới' : 'Quản lý công việc nội bộ chi nhánh ngân hàng'}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleAuth}>
            <CardContent className="p-8 pt-4 space-y-4">
              {/* Chế độ Đăng ký */}
              {isSignUp && (
                <div className="space-y-4 animate-fade-in-up">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-sm font-medium text-slate-500 ml-1">Họ và tên</Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Nguyễn Văn A"
                        className="pl-11 min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required={isSignUp}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-sm font-medium text-slate-500 ml-1">Chức danh</Label>
                    <div className="relative">
                      <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 z-10" />
                      <Select value={role} onValueChange={setRole}>
                        <SelectTrigger className="pl-11 min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm text-slate-950 focus:ring-0">
                          <SelectValue placeholder="Chọn chức danh" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-premium p-2">
                          <SelectItem value="staff" className="rounded-xl py-3 font-semibold">Cán bộ</SelectItem>
                          <SelectItem value="manager" className="rounded-xl py-3 font-semibold">Lãnh đạo phòng</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department" className="text-sm font-medium text-slate-500 ml-1">Phòng ban công tác</Label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 z-10" />
                      <Select value={departmentId} onValueChange={setDepartmentId}>
                        <SelectTrigger className="pl-11 min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm text-slate-950 focus:ring-0">
                          <SelectValue placeholder="Chọn phòng ban" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-premium p-2 max-h-48 overflow-y-auto">
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id} className="rounded-xl py-3 font-semibold">
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-500 ml-1">Tên đăng nhập</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="email"
                    type="text"
                    placeholder="VD: UserAD"
                    className="pl-11 min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-500 ml-1">Mật khẩu</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    minLength={isSignUp ? 6 : undefined}
                    className="pl-11 min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="p-8 pt-0 flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full min-h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all text-xs"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  isSignUp ? 'Gửi yêu cầu cấp tài khoản' : 'Đăng nhập'
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-medium text-slate-500 transition-colors duration-300 hover:bg-slate-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setEmail('')
                  setPassword('')
                  setFullName('')
                }}
              >
                {isSignUp ? (
                  <>
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Tôi đã có tài khoản? Đăng nhập
                  </>
                ) : (
                  'Yêu cầu cấp tài khoản mới'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
        <p className="text-[11px] font-medium text-slate-500 italic">made by phuctd</p>
      </div>
    </div>
  )
}
