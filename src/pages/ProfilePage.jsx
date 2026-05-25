import { useState } from 'react'
import { useApp, getAvatarColor } from '../context/AppContext'
import './ProfilePage.css'

export default function ProfilePage() {
  const { profile, user, client, refreshProfile, signOut } = useApp()
  const [editing, setEditing]   = useState(false)
  const [draft,   setDraft]     = useState({})
  const [saving,  setSaving]    = useState(false)

  if (!profile) return null

  const startEdit = () => {
    setDraft({ displayName: profile.displayName, bio: profile.bio || '', username: profile.username })
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!client) return
    setSaving(true)
    try {
      await client.models.UserProfile.update({
        id:          profile.id,
        displayName: draft.displayName,
        bio:         draft.bio,
        username:    draft.username,
        avatarColor: getAvatarColor(draft.username),
      })
      await refreshProfile()
      setEditing(false)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  return (
    <div className="profile-pg page">
      <div className="container">

        <div className="profile-pg-header">
          <h1 className="profile-pg-title">Profile</h1>
          {!editing
            ? <button className="btn btn-ghost edit-btn" onClick={startEdit}>✎ Edit</button>
            : <button className="btn btn-ghost edit-btn" onClick={() => setEditing(false)}>Cancel</button>
          }
        </div>

        {/* Avatar + info */}
        <div className="profile-hero card animate-fade-up">
          <div className="profile-avatar-wrap">
            <div className="avatar profile-avatar" style={{ background: profile.avatarColor || 'var(--grad-main)' }}>
              {(profile.displayName || '?')[0].toUpperCase()}
            </div>
            <div className="profile-avatar-glow" style={{ background: profile.avatarColor }} />
          </div>

          {editing ? (
            <div className="profile-edit-fields">
              <input className="input" placeholder="Display name" value={draft.displayName}
                onChange={e => setDraft(d => ({ ...d, displayName: e.target.value }))} />
              <input className="input" placeholder="Username" value={draft.username}
                onChange={e => setDraft(d => ({ ...d, username: e.target.value }))} />
              <textarea className="input profile-bio-input" rows={3} placeholder="Bio"
                value={draft.bio}
                onChange={e => setDraft(d => ({ ...d, bio: e.target.value }))} />
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? <span className="spinner" /> : 'Save Changes'}
              </button>
            </div>
          ) : (
            <>
              <h2 className="profile-display-name">{profile.displayName}</h2>
              <p className="profile-username">@{profile.username}</p>
              {profile.bio && <p className="profile-bio-text">{profile.bio}</p>}
              <p className="profile-email">{user?.email}</p>
            </>
          )}
        </div>

        {/* Balance */}
        <div className="balance-strip card animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <div className="balance-strip-left">
            <span className="balance-strip-label">TigerShark Balance</span>
            <span className="balance-strip-amount">
              ${(profile.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="balance-strip-icon">🦈</div>
        </div>

        {/* Sign out */}
        <button className="btn sign-out-btn" onClick={signOut}>
          Sign Out
        </button>

      </div>
    </div>
  )
}
