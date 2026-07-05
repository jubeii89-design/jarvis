'use client'

import { useEffect, useState } from 'react'

/**
 * ArcReactor — the pulsing central focal point of the JARVIS HUD.
 * Pure SVG + CSS animation. No external assets.
 */
export function ArcReactor({ active = true, size = 120 }: { active?: boolean; size?: number }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick(t => (t + 1) % 1000), 50)
    return () => clearInterval(id)
  }, [active])

  return (
    <div
      className="relative animate-pulse-reactor"
      style={{ width: size, height: size }}
      aria-label="Arc reactor"
      role="img"
    >
      <svg viewBox="0 0 120 120" width={size} height={size} fill="none">
        <defs>
          <radialGradient id="reactor-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.95 0.05 195)" />
            <stop offset="60%" stopColor="oklch(0.82 0.18 195)" />
            <stop offset="100%" stopColor="oklch(0.55 0.16 200)" />
          </radialGradient>
          <radialGradient id="reactor-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.78 0.16 195 / 0.5)" />
            <stop offset="100%" stopColor="oklch(0.78 0.16 195 / 0)" />
          </radialGradient>
        </defs>

        {/* Outer glow */}
        <circle cx="60" cy="60" r="58" fill="url(#reactor-glow)" />

        {/* Outer ring */}
        <circle cx="60" cy="60" r="50" stroke="oklch(0.78 0.16 195 / 0.6)" strokeWidth="1" />

        {/* Rotating outer segments */}
        <g className="animate-spin-slow" style={{ transformOrigin: '60px 60px' }}>
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180
            const x1 = 60 + Math.cos(angle) * 42
            const y1 = 60 + Math.sin(angle) * 42
            const x2 = 60 + Math.cos(angle) * 48
            const y2 = 60 + Math.sin(angle) * 48
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="oklch(0.78 0.16 195 / 0.8)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )
          })}
        </g>

        {/* Counter-rotating inner ring */}
        <g className="animate-spin-reverse-slow" style={{ transformOrigin: '60px 60px' }}>
          <circle cx="60" cy="60" r="36" stroke="oklch(0.78 0.16 195 / 0.4)" strokeWidth="0.5" strokeDasharray="4 4" />
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * 45 * Math.PI) / 180
            const x = 60 + Math.cos(angle) * 32
            const y = 60 + Math.sin(angle) * 32
            return <circle key={i} cx={x} cy={y} r="1.2" fill="oklch(0.78 0.16 195 / 0.9)" />
          })}
        </g>

        {/* Inner ring */}
        <circle cx="60" cy="60" r="28" stroke="oklch(0.82 0.18 195 / 0.7)" strokeWidth="1.5" fill="none" />

        {/* Core */}
        <circle cx="60" cy="60" r="22" fill="url(#reactor-core)" />
        <circle cx="60" cy="60" r="22" stroke="oklch(0.95 0.05 195 / 0.9)" strokeWidth="0.5" />

        {/* Triangle inside core (Stark signature) */}
        <g style={{ transformOrigin: '60px 60px' }} transform={`rotate(${tick * 0.3} 60 60)`}>
          <polygon
            points="60,46 73,68 47,68"
            fill="none"
            stroke="oklch(0.95 0.05 195 / 0.9)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </g>

        {/* Tiny data ticks on outer rim */}
        <g>
          {Array.from({ length: 60 }).map((_, i) => {
            const angle = (i * 6 * Math.PI) / 180
            const isMajor = i % 5 === 0
            const r1 = 54
            const r2 = isMajor ? 58 : 56
            const x1 = 60 + Math.cos(angle) * r1
            const y1 = 60 + Math.sin(angle) * r1
            const x2 = 60 + Math.cos(angle) * r2
            const y2 = 60 + Math.sin(angle) * r2
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={isMajor ? 'oklch(0.78 0.16 195 / 0.7)' : 'oklch(0.78 0.16 195 / 0.25)'}
                strokeWidth="0.5"
              />
            )
          })}
        </g>
      </svg>
    </div>
  )
}
