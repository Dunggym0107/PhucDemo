'use client'

import { useEffect } from 'react'
import { usePushSubscription } from '@/hooks/use-push-subscription'
import { Bell, BellOff, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { notifyError, notifySuccess } from '@/lib/notify'

export function PWANotificationHandler() {
 const { isSupported, subscription, permission, subscribe } = usePushSubscription()

 useEffect(() => {
 // Tự động đăng ký Service Worker khi mount
 if ('serviceWorker' in navigator) {
 navigator.serviceWorker.register('/sw.js').then(
 (registration) => {
 console.log('SW registered with scope:', registration.scope)
 },
 (err) => {
 console.error('SW registration failed:', err)
 }
 )
 }
 }, [])

 const handleEnableNotifications = async () => {
 const sub = await subscribe()
 if (sub) {
 notifySuccess(
   "Đã kích hoạt thông báo đẩy",
   "Bạn sẽ nhận tin nhắn tức thời trên thiết bị này."
 )
 } else if (Notification.permission === 'denied') {
 notifyError(
   null,
   "Vui lòng mở cài đặt trình duyệt để cấp quyền thông báo cho ứng dụng."
 )
 }
 }

 if (!isSupported) return null

 // Nếu đã cấp quyền nhưng chưa có subscription (có thể do clear cache), hiển thị nhắc nhở nhẹ
 if (permission === 'granted' && !subscription) {
 return (
 <div className="fixed bottom-4 right-4 z-[100] animate-in slide-in-from-right-10">
 <Button 
 size="sm" 
 className="bg-primary hover:bg-primary/90 text-white rounded-full shadow-lg gap-2"
 onClick={handleEnableNotifications}
 >
 <Bell className="w-4 h-4" /> Kích hoạt lại thông báo
 </Button>
 </div>
 );
 }

 // Nếu chưa cấp quyền, có thể hiển thị một banner nhỏ trong settings hoặc profile
 return null
}
