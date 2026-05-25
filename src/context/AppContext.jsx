import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { getCurrentUser, signOut, fetchUserAttributes } from 'aws-amplify/auth'
import { generateClient } from 'aws-amplify/data'

const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

let client = null
try { client = generateClient() } catch {}

const AVATAR_COLORS = [
  'linear-gradient(135deg,#00d4aa,#0077b6)',
  'linear-gradient(135deg,#f5c842,#f39c12)',
  'linear-gradient(135deg,#ff6b6b,#ee5a24)',
  'linear-gradient(135deg,#a29bfe,#6c5ce7)',
  'linear-gradient(135deg,#fd79a8,#e84393)',
  'linear-gradient(135deg,#55efc4,#00b894)',
]
export const getAvatarColor = (str) =>
  AVATAR_COLORS[str?.charCodeAt(0) % AVATAR_COLORS.length] || AVATAR_COLORS[0]

export function AppProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const profileIdRef = useRef(null)

  const loadUser = useCallback(async () => {
    try {
      const cognitoUser = await getCurrentUser()
      const attrs = await fetchUserAttributes()
      setUser({ ...cognitoUser, ...attrs })

      if (client) {
        const { data: profiles } = await client.models.UserProfile.list({
          filter: { userId: { eq: cognitoUser.userId } },
        })
        if (profiles?.length > 0) {
          setProfile(profiles[0])
          profileIdRef.current = profiles[0].id
        } else {
          const username = attrs.preferred_username ||
            attrs.email?.split('@')[0] ||
            cognitoUser.userId.slice(0, 8)
          const { data: newProfile } = await client.models.UserProfile.create({
            userId:      cognitoUser.userId,
            username,
            displayName: attrs.given_name || username,
            balance:     0,
            avatarColor: getAvatarColor(username),
          })
          setProfile(newProfile)
          profileIdRef.current = newProfile.id
        }
      }
    } catch {
      setUser(null)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUser() }, [loadUser])

  // ── Subscribe to real-time balance updates ────────────────
  useEffect(() => {
    if (!client || !profileIdRef.current) return

    // Re-fetch profile whenever UserProfile is updated
    const sub = client.models.UserProfile.onUpdate().subscribe({
      next: (updated) => {
        if (updated.id === profileIdRef.current) {
          setProfile(updated)
        }
      },
      error: (e) => console.error('Profile subscription error:', e),
    })

    return () => sub.unsubscribe()
  }, [profile?.id])

  // ── Manual refresh (called after transactions) ────────────
  const refreshProfile = useCallback(async () => {
    if (!client || !profileIdRef.current) return
    try {
      const { data } = await client.models.UserProfile.get({ id: profileIdRef.current })
      if (data) setProfile(data)
    } catch {
      // fallback to list
      if (!user) return
      const { data: profiles } = await client.models.UserProfile.list({
        filter: { userId: { eq: user.userId } },
      })
      if (profiles?.length > 0) {
        setProfile(profiles[0])
        profileIdRef.current = profiles[0].id
      }
    }
  }, [user])

  const handleSignOut = useCallback(async () => {
    await signOut()
    setUser(null)
    setProfile(null)
    profileIdRef.current = null
  }, [])

  return (
    <AppCtx.Provider value={{
      user, profile, loading, client,
      loadUser, refreshProfile, signOut: handleSignOut,
    }}>
      {children}
    </AppCtx.Provider>
  )
}
