import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import './Messages.css'

// ── Conversation List ─────────────────────────────────────────
function ConversationList() {
  const { profile, client } = useApp()
  const navigate = useNavigate()
  const [threads,  setThreads]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [newUser,  setNewUser]  = useState('')
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!client || !profile) { setLoading(false); return }
    const load = async () => {
      try {
        const { data } = await client.models.Thread.list({
          filter: {
            or: [
              { participantA: { eq: profile.userId } },
              { participantB: { eq: profile.userId } },
            ],
          },
        })
        setThreads((data || []).sort((a, b) =>
          new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt)
        ))
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [client, profile])

  const startNewChat = async () => {
    if (!newUser.trim() || !client) return
    setSearching(true)
    try {
      const { data } = await client.models.UserProfile.list({
        filter: { username: { eq: newUser.trim().replace('@', '') } },
      })
      if (data?.length > 0) {
        const other = data[0]
        // Check if thread already exists
        const existing = threads.find(t =>
          (t.participantA === profile.userId && t.participantB === other.userId) ||
          (t.participantB === profile.userId && t.participantA === other.userId)
        )
        if (existing) {
          navigate(`/messages/${existing.id}`)
        } else {
          const { data: thread } = await client.models.Thread.create({
            participantA: profile.userId,
            participantB: other.userId,
            lastMessage: '',
          })
          navigate(`/messages/${thread.id}`)
        }
      }
    } catch (e) { console.error(e) }
    finally { setSearching(false) }
  }

  return (
    <div className="messages-page page">
      <div className="container">
        <div className="messages-header">
          <h1 className="messages-title">Messages</h1>
        </div>

        {/* New chat */}
        <div className="new-chat-row">
          <input
            className="input"
            placeholder="Start chat with @username"
            value={newUser}
            onChange={e => setNewUser(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startNewChat()}
          />
          <button className="btn btn-primary new-chat-btn" onClick={startNewChat} disabled={searching}>
            {searching ? <span className="spinner" /> : '+'}
          </button>
        </div>

        {loading ? (
          <div className="loading-row"><div className="spinner" /></div>
        ) : threads.length === 0 ? (
          <div className="empty-state card animate-scale-in">
            <div className="empty-icon">✉</div>
            <p>No conversations yet</p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Search for a username above to start chatting</p>
          </div>
        ) : (
          <div className="thread-list">
            {threads.map(t => (
              <ThreadRow key={t.id} thread={t} myId={profile.userId} onClick={() => navigate(`/messages/${t.id}`)} client={client} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ThreadRow({ thread, myId, onClick, client }) {
  const otherId = thread.participantA === myId ? thread.participantB : thread.participantA
  const [other, setOther] = useState(null)

  useEffect(() => {
    if (!client) return
    client.models.UserProfile.list({ filter: { userId: { eq: otherId } } })
      .then(({ data }) => { if (data?.length > 0) setOther(data[0]) })
  }, [otherId, client])

  return (
    <button className="thread-row" onClick={onClick}>
      <div className="avatar thread-avatar" style={{ background: other?.avatarColor || 'var(--grad-main)' }}>
        {(other?.displayName || '?')[0]}
      </div>
      <div className="thread-info">
        <div className="thread-top">
          <span className="thread-name">{other?.displayName || '...'}</span>
          <span className="thread-time">
            {thread.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>
        <p className="thread-preview">{thread.lastMessage || 'Say hello!'}</p>
      </div>
    </button>
  )
}

// ── Chat View ─────────────────────────────────────────────────
function ChatView({ threadId }) {
  const { profile, client } = useApp()
  const navigate = useNavigate()
  const [messages,  setMessages]  = useState([])
  const [input,     setInput]     = useState('')
  const [other,     setOther]     = useState(null)
  const [sending,   setSending]   = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!client || !threadId) return
    client.models.Thread.get({ id: threadId }).then(({ data: thread }) => {
      if (!thread) return
      const otherId = thread.participantA === profile.userId ? thread.participantB : thread.participantA
      client.models.UserProfile.list({ filter: { userId: { eq: otherId } } })
        .then(({ data }) => { if (data?.length > 0) setOther(data[0]) })
    })
    const loadMessages = async () => {
      const { data } = await client.models.Message.list({
        filter: { threadId: { eq: threadId } },
      })
      setMessages((data || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)))
    }
    loadMessages()
    const sub = client.models.Message.onCreate({
      filter: { threadId: { eq: threadId } },
    }).subscribe({
      next: (msg) => setMessages(prev => [...prev, msg]),
      error: (e) => console.error(e),
    })
    return () => sub.unsubscribe()
  }, [client, threadId, profile])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || !client || sending) return
    setSending(true)
    setInput('')
    try {
      await client.models.Message.create({
        threadId, senderId: profile.userId, content: text, read: false,
      })
      await client.models.Thread.update({
        id: threadId, lastMessage: text, lastMessageAt: new Date().toISOString(),
      })
    } catch (e) { console.error(e) }
    finally { setSending(false) }
  }

  return (
    <div className="chat-view">
      <div className="chat-header">
        <button className="chat-back" onClick={() => navigate('/messages')}>←</button>
        <div className="avatar chat-header-avatar" style={{ background: other?.avatarColor || 'var(--grad-main)' }}>
          {(other?.displayName || '?')[0]}
        </div>
        <div className="chat-header-info">
          <span className="chat-header-name">{other?.displayName || '...'}</span>
          <span className="chat-header-sub">@{other?.username || ''}</span>
        </div>
        <button className="chat-pay-btn" onClick={() => navigate(`/pay?action=send&to=${other?.username}`)}>Pay</button>
      </div>

      <div className="chat-messages">
        {messages.map(msg => {
          const isMe = msg.senderId === profile.userId
          return (
            <div key={msg.id} className={`bubble-wrap ${isMe ? 'me' : 'them'}`}>
              <div className={`bubble ${isMe ? 'bubble-me' : 'bubble-them'}`}>{msg.content}</div>
              <span className="bubble-time">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-bar">
        <input className="chat-input" placeholder="Message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
        />
        <button className="chat-send" onClick={send} disabled={!input.trim() || sending}>
          {sending ? <span className="spinner" style={{ width:16, height:16 }} /> : '➤'}
        </button>
      </div>
    </div>
  )
}

export default function Messages() {
  const { id } = useParams()
  return id ? <ChatView threadId={id} /> : <ConversationList />
}
