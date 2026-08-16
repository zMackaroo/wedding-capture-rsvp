import { useEffect, useState } from 'react'

type EnvelopeProps = {
  onOpened: () => void
}

export function Envelope({ onOpened }: EnvelopeProps) {
  const [phase, setPhase] = useState<'closed' | 'opening' | 'gone'>(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'gone' : 'closed',
  )
  const [waitForTap] = useState(
    () => window.matchMedia('(pointer: coarse)').matches,
  )

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) onOpened()
  }, [onOpened])

  useEffect(() => {
    if (phase !== 'closed' || waitForTap) return
    const open = window.setTimeout(() => setPhase('opening'), 420)
    return () => window.clearTimeout(open)
  }, [phase, waitForTap])

  useEffect(() => {
    if (phase !== 'opening') return
    const gone = window.setTimeout(() => {
      setPhase('gone')
      onOpened()
    }, 3200)
    return () => window.clearTimeout(gone)
  }, [phase, onOpened])

  if (phase === 'gone') return null

  return (
    <button
      type="button"
      className={`envelope-scene${phase === 'opening' ? ' is-opening' : ''}`}
      onClick={() => setPhase('opening')}
      aria-label="Open invitation"
    >
      <span className="envelope" aria-hidden="true">
        <span className="envelope-back" />
        <span className="envelope-liner" />
        <span className="envelope-slot">
          <span className="envelope-letter">
            <span className="letter-rule" />
            <span className="letter-kicker">Together</span>
            <span className="letter-names">Christian &amp; Franhess</span>
            <span className="letter-date">15 August 2026</span>
            <span className="letter-rule" />
          </span>
        </span>
        <span className="envelope-flap" />
        <span className="envelope-pocket" />
        <span className="envelope-seal">
          <svg viewBox="0 0 24 24">
            <path d="M12 20S4.8 15.4 4.8 10.4C4.8 8 6.7 6.3 9 6.3c1.3 0 2.5.7 3 1.8.5-1.1 1.7-1.8 3-1.8 2.3 0 4.2 1.7 4.2 4.1C19.2 15.4 12 20 12 20Z" />
          </svg>
        </span>
        <span className="envelope-names">Christian &amp; Franhess</span>
      </span>
      <span className="envelope-hint">
        {waitForTap ? 'Tap to open' : 'The invitation'}
      </span>
    </button>
  )
}
