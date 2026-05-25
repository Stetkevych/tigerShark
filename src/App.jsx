import { useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import { AppProvider, useApp } from './context/AppContext'
import TopNav    from './components/TopNav'
import BottomNav from './components/BottomNav'
import Home        from './pages/Home'
import Messages    from './pages/Messages'
import Pay         from './pages/Pay'
import Activity    from './pages/Activity'
import ProfilePage from './pages/ProfilePage'
import './App.css'

function PageTransition({ children }) {
  const location = useLocation()
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.opacity = '0'
    el.style.transform = 'translateY(12px)'
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.style.transition = 'opacity 0.32s cubic-bezier(0,0,0.2,1), transform 0.36s cubic-bezier(0.34,1.56,0.64,1)'
        el.style.opacity = '1'
        el.style.transform = 'translateY(0)'
      })
    )
    return () => cancelAnimationFrame(id)
  }, [location.pathname])
  return <div ref={ref} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
}

function AppShell() {
  const { loading } = useApp()

  if (loading) {
    return (
      <div className="app-loading">
        <img src="/tigershark.png" alt="TigerShark" className="app-loading-logo" />
        <div className="spinner" />
      </div>
    )
  }

  return (
    <>
      <TopNav />
      <PageTransition>
        <Routes>
          <Route path="/"          element={<Navigate to="/home" replace />} />
          <Route path="/home"      element={<Home />}        />
          <Route path="/messages"  element={<Messages />}    />
          <Route path="/messages/:id" element={<Messages />} />
          <Route path="/pay"       element={<Pay />}         />
          <Route path="/activity"  element={<Activity />}    />
          <Route path="/profile"   element={<ProfilePage />} />
          <Route path="*"          element={<Navigate to="/home" replace />} />
        </Routes>
      </PageTransition>
      <BottomNav />
    </>
  )
}

// Custom Amplify Authenticator theme
function InstallBanner() {
  const [prompt, setPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [showIOS, setShowIOS] = useState(false)
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (isStandalone || installed) return null

  return (
    <div className="install-section">
      <p className="install-section-label">📲 Get the app</p>

      {prompt && (
        <button className="install-banner" onClick={async () => {
          prompt.prompt()
          const { outcome } = await prompt.userChoice
          if (outcome === 'accepted') setInstalled(true)
        }}>
          <img src="/tigershark.png" alt="" className="install-icon" />
          <div className="install-text">
            <strong>Add to Home Screen</strong>
            <span>Install TigerShark on your device</span>
          </div>
          <span className="install-cta">Install</span>
        </button>
      )}

      {isIOS && (
        <button className="install-banner" onClick={() => setShowIOS(s => !s)}>
          <img src="/tigershark.png" alt="" className="install-icon" />
          <div className="install-text">
            <strong>Add to Home Screen</strong>
            <span>Tap to see how on iPhone / iPad</span>
          </div>
          <span className="install-cta">How?</span>
        </button>
      )}

      {showIOS && (
        <div className="ios-instructions">
          <div className="ios-step"><span className="ios-num">1</span>Tap the <strong>Share</strong> button at the bottom of Safari</div>
          <div className="ios-step"><span className="ios-num">2</span>Tap <strong>"Add to Home Screen"</strong></div>
          <div className="ios-step"><span className="ios-num">3</span>Tap <strong>"Add"</strong> — done!</div>
        </div>
      )}

      {!prompt && !isIOS && (
        <button className="install-banner" onClick={() => setShowIOS(s => !s)}>
          <img src="/tigershark.png" alt="" className="install-icon" />
          <div className="install-text">
            <strong>Install TigerShark</strong>
            <span>Add to your home screen</span>
          </div>
          <span className="install-cta">↓ Install</span>
        </button>
      )}
    </div>
  )
}

const authComponents = {
  Header() {
    return (
      <div className="auth-header">
        <img src="/tigershark.png" alt="TigerShark" className="auth-logo" />
        <h1 className="auth-title">TigerShark</h1>
        <p className="auth-sub">Send money. Send messages.</p>
        <InstallBanner />
      </div>
    )
  },
}

const authFormFields = {
  signUp: {
    email:    { order: 1 },
    password: { order: 2 },
    confirm_password: { order: 3 },
  },
}

export default function App() {
  return (
    <div className="app-root">
      <Authenticator
        components={authComponents}
        formFields={authFormFields}
      >
        {() => (
          <AppProvider>
            <AppShell />
          </AppProvider>
        )}
      </Authenticator>
    </div>
  )
}
