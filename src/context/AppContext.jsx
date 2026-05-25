import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getCurrentUser, signOut, fetchUserAttributes } from 'aws-amplify/auth'
import { generateClient } from 'aws-amplify/data'

const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

// Amplify Data client — typed when amplify_outputs.json exists
let client = null
try {
  client = generateClient()
} catch {
  // sandbox not running yet
}

// Avatar color palette
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
  const [user,    setUser]    = useState(null)   // Cognito user
  const [profile, setProfile] = useState(null)   // DynamoDB UserProfile
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    try {
      const cognitoUser = await getCurrentUser()
      const attrs = await fetchUserAttributes()
      setUser({ ...cognitoUser, ...attrs })

      // Load or create DynamoDB profile
      if (client) {
        const { data: profiles } = await client.models.UserProfile.list({
          filter: { userId: { eq: cognitoUser.userId } },
        })
        if (profiles?.length > 0) {
          setProfile(profiles[0])
        } else {
          // Auto-create profile on first login
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

  const refreshProfile = useCallback(async () => {
    if (!user || !client) return
    const { data: profiles } = await client.models.UserProfile.list({
      filter: { userId: { eq: user.userId } },
    })
    if (profiles?.length > 0) setProfile(profiles[0])
  }, [user])

  const handleSignOut = useCallback(async () => {
    await signOut()
    setUser(null)
    setProfile(null)
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
