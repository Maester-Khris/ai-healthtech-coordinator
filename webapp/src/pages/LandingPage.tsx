import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LoginModal } from '../components/auth/LoginModal'

const STEPS = [
  {
    title: 'Describe your symptoms',
    body: 'Tell us what\'s going on in plain language. No forms, no symptom checklists.',
  },
  {
    title: 'Get an instant severity check',
    body: 'MediCoord AI reviews what you\'ve described and determines how urgent it is.',
  },
  {
    title: 'Get routed to the right place',
    body: 'See the nearest facility equipped to treat you, with a live map and arrival time.',
  },
]

const FEATURES = [
  {
    title: 'One chat, one map',
    body: 'Describe your symptoms and watch your route appear on the same screen — no switching between a search engine and a directions app.',
  },
  {
    title: 'Severity-aware routing',
    body: 'MediCoord AI tells routine concerns apart from urgent ones, so you\'re matched to a facility actually equipped to help — not just the closest one.',
  },
  {
    title: 'Stay in the loop',
    body: 'Get notified if your situation or facility status changes, so you\'re not left checking back manually.',
  },
]

export default function LandingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<'signin' | 'signup'>('signin')

  const openSignIn = () => { setModalTab('signin'); setIsModalOpen(true) }
  const openSignUp = () => { setModalTab('signup'); setIsModalOpen(true) }

  return (
    <div className="bg-stratum-bg min-h-screen">
      <LoginModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} defaultTab={modalTab} />

      <header className="flex items-center justify-between px-8 h-16 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-stratum-md overflow-hidden flex-none">
            <img src="/logo.png" alt="MediCoord AI" className="w-full h-full object-cover" />
          </div>
          <span className="text-label-md text-stratum-text">MediCoord AI</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={openSignIn} className="text-body-md text-stratum-text-muted hover:text-stratum-text">
            Sign in
          </button>
          <button
            onClick={openSignUp}
            className="px-5 py-2.5 text-label-md text-white rounded-stratum-control bg-stratum-accent hover:opacity-90 transition-opacity"
          >
            Get started
          </button>
        </div>
      </header>

      <main>
        <section className="max-w-3xl mx-auto px-8 pt-16 pb-20 text-center">
          <h1 className="text-display-lg text-stratum-text">Know where to go,<br />before you go.</h1>
          <p className="text-body-md text-stratum-text-muted mt-6 max-w-xl mx-auto">
            Describe how you’re feeling, and MediCoord AI matches your symptoms to the right nearby
            facility — with a live route and arrival time, not just a search result.
          </p>
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={openSignUp}
              className="px-6 py-3 text-label-md text-white rounded-stratum-control bg-stratum-accent hover:opacity-90 transition-opacity"
            >
              Get started
            </button>
            <button onClick={openSignIn} className="px-6 py-3 text-label-md text-stratum-text-muted hover:text-stratum-text">
              Sign in
            </button>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-8 py-16">
          <h2 className="text-label-md uppercase tracking-wide text-stratum-accent-2 text-center mb-10">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.title} className="surface-card shell-bezel rounded-stratum-lg p-6">
                <span className="text-label-md text-stratum-accent-2">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="text-label-md text-stratum-text mt-2 mb-1">{step.title}</h3>
                <p className="text-body-md text-stratum-text-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-8 py-16">
          <h2 className="text-label-md uppercase tracking-wide text-stratum-accent-2 text-center mb-10">What you get</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="surface-card shell-bezel rounded-stratum-lg p-6">
                <h3 className="text-label-md text-stratum-text mb-1">{feature.title}</h3>
                <p className="text-body-md text-stratum-text-muted">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-2xl mx-auto px-8 py-16 text-center">
          <p className="text-body-md text-stratum-text-muted">
            Your symptoms and location are used only to find you care — never sold, never shared for
            advertising. Read our <Link to="/privacy" className="text-stratum-accent-2 underline">Privacy Policy</Link> to
            see exactly what we store and why.
          </p>
        </section>
      </main>

      <footer className="border-t border-stratum-border">
        <div className="max-w-5xl mx-auto px-8 h-14 flex items-center justify-between text-body-md text-stratum-text-muted">
          <span>MediCoord AI · Health Tech Platform</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="text-stratum-text-muted hover:text-stratum-text no-underline">Privacy</Link>
            <Link to="/cookies" className="text-stratum-text-muted hover:text-stratum-text no-underline">Cookies</Link>
            <Link to="/data-disclosure" className="text-stratum-text-muted hover:text-stratum-text no-underline">Data Disclosure</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
