'use client'

import React, { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { notifyError, notifySuccess, notifyValidation } from '@/lib/notify'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profileId: string | undefined;
  mustChange: boolean;
}

export default function ChangePasswordDialog({ open, onOpenChange, profileId, mustChange }: Props) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!open) {
      setNewPassword('')
      setConfirmPassword('')
    }
  }, [open])

  const submit = async () => {
    if (newPassword.length < 6) {
      notifyValidation('Mật khẩu mới phải có tối thiểu 6 ký tự.', 'Mật khẩu quá ngắn')
      return
    }
    if (newPassword !== confirmPassword) {
      notifyValidation('Mật khẩu xác nhận không khớp với mật khẩu mới.', 'Không khớp')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      if (profileId) {
        await supabase.from('profiles').update({ must_change_password: false }).eq('id', profileId)
      }

      notifySuccess('Đã đổi mật khẩu')
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      notifyError(err, 'Không đổi được mật khẩu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="app-dialog-sheet">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="heading-section">Đổi mật khẩu</DialogTitle>
        </DialogHeader>

        <ScrollArea className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 item-stack">
            {mustChange && (
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-100">
                <AlertTriangle className="icon-sm text-amber-600 shrink-0 mt-0.5" />
                <div className="item-stack !gap-1">
                  <p className="text-label !text-amber-800 font-bold">Đang dùng mật khẩu mặc định</p>
                  <p className="text-meta !text-amber-700">Hãy đặt mật khẩu cá nhân để bảo mật tài khoản.</p>
                </div>
              </div>
            )}

            <div className="item-stack !gap-2">
              <Label className="text-label">Mật khẩu mới</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
                placeholder="Tối thiểu 6 ký tự"
                className="min-h-11 rounded-xl"
                autoFocus
              />
            </div>

            <div className="item-stack !gap-2">
              <Label className="text-label">Xác nhận mật khẩu</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
                placeholder="Nhập lại mật khẩu mới"
                className="min-h-11 rounded-xl"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="app-dialog-sheet-footer flex-row gap-2">
          <Button variant="outline" className="flex-1 min-h-11 rounded-xl" onClick={() => onOpenChange(false)} disabled={saving}>
            Huỷ
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !newPassword || !confirmPassword}
            className="flex-1 min-h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold"
          >
            {saving ? <Loader2 className="icon-sm animate-spin mr-1.5" /> : <CheckCircle2 className="icon-sm mr-1.5" />}
            {saving ? 'Đang lưu…' : 'Cập nhật'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
