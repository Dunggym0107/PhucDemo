'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function NavbarPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const container = document.getElementById('navbar-actions-portal')
  if (!container) return null

  return createPortal(children, container)
}
