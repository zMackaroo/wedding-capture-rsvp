import { useCallback, useState } from 'react'
import { Envelope } from '../components/Envelope'

export function InvitationPage() {
  const [revealed, setRevealed] = useState(false)
  const onOpened = useCallback(() => setRevealed(true), [])

  return (
    <section
      className={`page invitation${revealed ? ' is-revealed' : ''}`}
      aria-label="Wedding invitation"
    >
      <Envelope onOpened={onOpened} />

      <div className="invite-body">
        <header className="invite-top">
          <svg
            className="together-arc"
            viewBox="0 0 320 42"
            role="img"
            aria-label="Together"
          >
            <defs>
              <path id="together-path" d="M18 36 Q160 4 302 36" fill="none" />
            </defs>
            <text className="together-text">
              <textPath
                href="#together-path"
                startOffset="50%"
                textAnchor="middle"
              >
                TOGETHER
              </textPath>
            </text>
          </svg>
          <p className="families">With their families</p>
          <h1 className="names">Christian &amp; Franhess</h1>
          <p className="invite-copy">
            Invite
            <br />
            you to celebrate
            <br />
            their marriage
          </p>
        </header>

        <div className="invite-mid" aria-hidden="true" />

        <div className="invite-details">
          <p className="month">August</p>
          <div className="date-row">
            <div className="date-side">
              <span className="rule" />
              <span>Saturday</span>
              <span className="rule" />
            </div>
            <span className="day">15</span>
            <div className="date-side">
              <span className="rule" />
              <span>At 4 PM</span>
              <span className="rule" />
            </div>
          </div>
          <p className="year">2026</p>

          <p className="venue-name">Bale Caimito</p>
          <p className="venue-addr">
            Purok 6, Brgy Paguiruan
            <br />
            Floridablanca, Pampanga
          </p>
        </div>
      </div>

      <a className="scroll-hint" href="#album" aria-label="Scroll to photo album">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>
    </section>
  )
}
