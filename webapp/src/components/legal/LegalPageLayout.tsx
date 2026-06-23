import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface LegalPageLayoutProps {
  title: string
  lastUpdated: string
  children: ReactNode
}

export function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-stratum-bg">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link to="/" className="text-body-md text-stratum-text-muted no-underline hover:underline">
          ← Back to home
        </Link>
        <h1 className="text-display-md mt-6 mb-1 text-stratum-text">{title}</h1>
        <p className="text-body-md text-stratum-text-muted mb-8">Last updated: {lastUpdated}</p>
        <div className="text-body-md text-stratum-text space-y-6 [&_h2]:text-label-md [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-stratum-accent-2 [&_h2]:mt-8 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_table]:w-full [&_table]:border-collapse [&_th]:text-label-md [&_th]:text-left [&_th]:border-b [&_th]:border-stratum-border [&_th]:py-2 [&_td]:border-b [&_td]:border-stratum-border [&_td]:py-2 [&_td]:align-top">
          {children}
        </div>
      </div>
    </div>
  )
}
