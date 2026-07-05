'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * VoiceWaveform — animated audio-reactive bars. When `active` is true,
 * bars animate with random heights to simulate live audio. When inactive,
 * bars settle to a flat line.
 */
export function VoiceWaveform({ active, engine }: { active: boolean; engine?: string }) {
  const [heights, setHeights] = useState<number[]>(() => Array.from({ length: 48 }, () => 0.1))
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) {
      // settle to flat — deferred to avoid synchronous setState in effect
      const id = requestAnimationFrame(() => {
        setHeights(Array.from({ length: 48 }, () => 0.05))
      })
      return () => cancelAnimationFrame(id)
    }
    let t = 0
    const animate = () => {
      t += 0.08
      setHeights(
        Array.from({ length: 48 }, (_, i) => {
          const base = Math.sin(t + i * 0.3) * 0.5 + 0.5
          const noise = Math.random() * 0.3
          const envelope = Math.exp(-Math.pow((i - 24) / 18, 2)) // bell shape
          return Math.max(0.05, Math.min(1, (base * 0.6 + noise) * envelope))
        })
      )
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [active])

  return (
    <div className="flex items-center justify-center gap-[2px] h-12 w-full">
      {heights.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-full transition-all duration-75"
          style={{
            height: `${h * 100}%`,
            background: active
              ? `linear-gradient(to top, oklch(0.78 0.16 195 / 0.9), oklch(0.95 0.05 195))`
              : 'oklch(0.78 0.16 195 / 0.2)',
            boxShadow: active && h > 0.5 ? '0 0 6px oklch(0.78 0.16 195 / 0.6)' : 'none'
          }}
        />
      ))}
    </div>
  )
}
