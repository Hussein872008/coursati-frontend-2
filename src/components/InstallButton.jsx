import React from 'react'
import useInstallPrompt from '../hooks/useInstallPrompt'
import { ArrowDownTrayIcon } from '@heroicons/react/24/solid'

export default function InstallButton({ className = '', iconOnly = false }) {
  const { canInstall, install } = useInstallPrompt()

  if (!canInstall) return null

  if (iconOnly) {
    return (
      <button
        onClick={() => install()}
        title="تثبيت التطبيق"
        className={`p-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-md ${className}`}
      >
        <ArrowDownTrayIcon className="w-5 h-5" />
      </button>
    )
  }

  return (
    <button
      onClick={() => install()}
      className={`px-3 py-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-md ${className}`}
    >
      تثبيت التطبيق
    </button>
  )
}
