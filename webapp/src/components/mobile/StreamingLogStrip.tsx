// webapp/src/components/mobile/StreamingLogStrip.tsx
import { useEffect, useRef } from 'react'

interface LogEntry {
  tag: string
  message: string
}

interface StreamingLogStripProps {
  logs: LogEntry[]
}

export function StreamingLogStrip({ logs }: StreamingLogStripProps) {
  const lineRefs = useRef<Array<HTMLSpanElement | null>>([])

  useEffect(() => {
    lineRefs.current.forEach((el, i) => {
      if (!el) return
      el.style.width = '0%'
      el.style.transition = 'none'
      // Stagger: line 0 immediately, line 1 after 200ms
      const delay = i * 200
      const timer = setTimeout(() => {
        el.style.transition = 'width 0.8s ease-out'
        el.style.width = '100%'
      }, delay)
      return () => clearTimeout(timer)
    })
  }, [logs])

  return (
    <div
      style={{
        background: 'rgba(6,18,25,0.95)',
        borderTop: '1px solid rgba(28,70,89,0.30)',
        borderBottom: '1px solid rgba(28,70,89,0.30)',
        padding: '0 16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
        height: 48,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {logs.slice(0, 2).map((entry, i) => (
        <div key={i} style={{ overflow: 'hidden', height: 16, display: 'flex' }}>
          <span
            ref={el => { lineRefs.current[i] = el }}
            className="font-mono text-[9px] tracking-wide whitespace-nowrap overflow-hidden"
            style={{ color: '#48F6C1', width: '0%', display: 'inline-block' }}
          >
            <span className="font-bold">[{entry.tag}]</span>
            {' '}
            <span className="font-normal">{entry.message}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
