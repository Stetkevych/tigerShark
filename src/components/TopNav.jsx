import { NavLink } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import './TopNav.css'

export default function TopNav() {
  const { profile } = useApp()

  return (
    <header className="top-nav">
      <NavLink to="/home" className="top-nav-logo">
        <img src="/tigershark.png" alt="TigerShark" className="top-nav-logo-img" /> TigerShark
      </NavLink>
      <nav className="top-nav-links">
        {[
          { to: '/home',     label: 'Home'     },
          { to: '/messages', label: 'Messages' },
          { to: '/pay',      label: 'Pay'      },
          { to: '/activity', label: 'Activity' },
        ].map(({ to, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => `top-nav-link${isActive ? ' active' : ''}`}>
            {label}
          </NavLink>
        ))}
      </nav>
      <NavLink to="/profile" className="top-nav-avatar">
        <div className="avatar top-nav-user-avatar"
          style={{ background: profile?.avatarColor || 'var(--grad-main)' }}>
          {(profile?.displayName || profile?.username || '?')[0].toUpperCase()}
        </div>
      </NavLink>
    </header>
  )
}
