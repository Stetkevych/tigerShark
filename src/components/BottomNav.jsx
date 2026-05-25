import { NavLink } from 'react-router-dom'
import './BottomNav.css'

const NAV = [
  { to: '/home',     icon: '⌂',  label: 'Home'     },
  { to: '/messages', icon: '✉',  label: 'Messages' },
  { to: '/pay',      icon: '⟳',  label: 'Pay'      },
  { to: '/activity', icon: '◈',  label: 'Activity' },
  { to: '/profile',  icon: '◉',  label: 'Profile'  },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {NAV.map(({ to, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <span className="nav-icon">{icon}</span>
          <span className="nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
