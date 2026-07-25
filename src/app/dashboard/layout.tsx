import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth-utils'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { AppDataProvider } from '@/components/providers/AppDataProvider'

export default async function Layout({ children }: { children: React.ReactNode }) {
 const profile = await getProfile()

 if (!profile) {
 redirect('/login')
 }

 return (
 <AppDataProvider currentUserId={profile.id}>
 <DashboardLayout profile={profile}>{children}</DashboardLayout>
 </AppDataProvider>
 )
}