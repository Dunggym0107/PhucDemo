'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { notifyError, notifySuccess } from '@/lib/notify'
import { Workflow, Loader2, Lock, Mail, User, ShieldCheck } from 'lucide-react'
import { Logo } from "@/components/ui/logo"

function RegisterContent() {
 const [email, setEmail] = useState('')
 const [password, setPassword] = useState('')
 const [fullName, setFullName] = useState('')
 const [loading, setLoading] = useState(false)
 const router = useRouter()
 const searchParams = useSearchParams()
 const supabase = createClient()
 
 const inviteCode = searchParams.get('invite')

 const handleSignUp = async (e: React.FormEvent) => {
 e.preventDefault()
 setLoading(true)

 try {
 const { error } = await supabase.auth.signUp({
 email,
 password,
 options: {
 data: {
 full_name: fullName,
 role: 'staff', // Mặc định là nhân viên khi đăng ký qua link mời
 },
 },
 })
 
 if (error) throw error

 notifySuccess(
   "Đăng ký thành công",
   "Chào mừng bạn gia nhập đội ngũ WorkFlow!"
 )

 router.push('/dashboard')
 } catch (error) {
 notifyError(error, "Đăng ký thất bại, vui lòng thử lại.")
 } finally {
 setLoading(false)
 }
 }

 if (!inviteCode) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
 <Card className="w-full max-w-md shadow-xl border-t-4 border-t-red-500">
 <CardHeader className="text-center">
 <CardTitle className="text-xl font-bold text-red-600 tabular-nums">Link không hợp lệ</CardTitle>
 <CardDescription>Bạn cần có mã mời từ Lãnh đạo để đăng ký tài khoản.</CardDescription>
 </CardHeader>
 <CardFooter>
 <Button onClick={() => router.push('/login')} className="w-full">Quay lại Đăng nhập</Button>
 </CardFooter>
 </Card>
 </div>
 )
 }

 return (
 <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
 <div className="w-full max-w-md z-10 flex flex-col items-center gap-6">
 <Card className="w-full shadow-2xl border-none rounded-2xl bg-white/80 backdrop-blur-xl overflow-hidden">
 <div className="bg-primary p-8 text-white text-center relative overflow-hidden">
 <div className="absolute top-0 right-0 p-4 opacity-5">
 <Logo className="w-24 h-24 rotate-12" variant="white" />
 </div>
 <div className="relative z-10 flex flex-col items-center">
 <div className="mb-4 transition-transform hover:scale-105 flex items-center justify-center">
 <Logo className="h-14 w-14" variant="white" />
 </div>
 <CardTitle className="text-2xl font-bold tabular-nums">Gia nhập WorkFlow</CardTitle>
 <CardDescription className="text-primary-foreground/70 mt-2 font-medium">Hệ thống điều hành và quản trị mục tiêu</CardDescription>
 </div>
 </div>

 <form onSubmit={handleSignUp}>
 <CardContent className="p-8 space-y-5">
 <div className="space-y-2">
 <Label htmlFor="fullName" className="text-sm font-medium text-slate-500 ml-1 truncate whitespace-nowrap">Họ và tên</Label>
 <div className="relative">
 <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
 <Input
 id="fullName"
 placeholder="Nhập họ và tên cán bộ"
 className="pl-11 min-h-11 bg-slate-50 border-none rounded-xl font-medium text-base md:text-sm"
 value={fullName}
 onChange={(e) => setFullName(e.target.value)}
 required
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label htmlFor="email" className="text-sm font-medium text-slate-500 ml-1 truncate whitespace-nowrap">Email</Label>
 <div className="relative">
 <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
 <Input
 id="email"
 type="email"
 placeholder="name@bank.com.vn"
 className="pl-11 min-h-11 bg-slate-50 border-none rounded-xl font-medium text-base md:text-sm"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 required
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label htmlFor="password" className="text-sm font-medium text-slate-500 ml-1 truncate whitespace-nowrap">Mật khẩu</Label>
 <div className="relative">
 <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
 <Input
 id="password"
 type="password"
 placeholder="••••••••"
 className="pl-11 min-h-11 bg-slate-50 border-none rounded-xl font-medium text-base md:text-sm"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 required
 />
 </div>
 </div>
 
 <div className="pt-2">
 <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex items-start gap-3">
 <div className="w-2 h-2 bg-amber-500 rounded-full mt-1.5 shrink-0" />
 <p className="text-xs md:text-[11px] text-amber-700 font-medium leading-relaxed">Mã mời hợp lệ: <span className="font-bold">{inviteCode}</span>. Bạn đang đăng ký với vai trò cán bộ chi nhánh.</p>
 </div>
 </div>
 </CardContent>

 <CardFooter className="p-8 pt-0 flex flex-col space-y-4">
 <Button type="submit" className="w-full min-h-11 bg-primary hover:bg-primary/90 rounded-xl font-bold shadow-lg shadow-primary/20" disabled={loading}>
 {loading ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Đang xử lý...
 </>
 ) : 'Hoàn tất đăng ký'}
 </Button>
 <Button
 type="button"
 variant="ghost"
 className="min-h-11 rounded-xl px-4 text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-primary"
 onClick={() => router.push('/login')}
 >
 Đã có tài khoản? Đăng nhập
 </Button>
 </CardFooter>
 </form>
 </Card>
 
 <p className="text-[11px] font-medium text-slate-500 italic">made by phuctd</p>
 </div>
 </div>
 )
}

export default function RegisterPage() {
 return (
 <Suspense fallback={
 <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
 <Loader2 className="h-10 w-10 animate-spin text-primary" />
 </div>
 }>
 <RegisterContent />
 </Suspense>
 )
}
