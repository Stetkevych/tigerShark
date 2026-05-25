import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import './Activity.css'

const FILTERS = ['All', 'Sent', 'Received', 'Top-ups']

export default function Activity() {
  const { profile, client } = useApp()
  const [transactions, setTransactions] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState('All')

  useEffect(() => {
    if (!client || !profile) { setLoading(false); return }
    const load = async () => {
      try {
        const { data } = await client.models.Transaction.list({
          filter: {
            or: [
              { senderId:    { eq: profile.userId } },
              { recipientId: { eq: profile.userId } },
            ],
          },
        })
        setTransactions((data || []).sort((a, b) =>
          new Date(b.createdAt) - new Date(a.createdAt)
        ))
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [client, profile])

  const filtered = transactions.filter(tx => {
    if (filter === 'All')      return true
    if (filter === 'Sent')     return tx.senderId === profile.userId && tx.type === 'send'
    if (filter === 'Received') return tx.recipientId === profile.userId && tx.type === 'send'
    if (filter === 'Top-ups')  return tx.type === 'topup'
    return true
  })

  return (
    <div className="activity page">
      <div className="container">

        <div className="activity-header">
          <h1 className="activity-title">Activity</h1>
        </div>

        <div className="activity-filters">
          {FILTERS.map(f => (
            <button key={f}
              className={`filter-btn${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-row"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state card animate-scale-in">
            <div className="empty-icon">◈</div>
            <p>No transactions found</p>
          </div>
        ) : (
          <div className="activity-list">
            {filtered.map(tx => (
              <ActivityRow key={tx.id} tx={tx} myId={profile.userId} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

function ActivityRow({ tx, myId }) {
  const isSender = tx.senderId === myId
  const isTopup  = tx.type === 'topup'
  const name     = isTopup ? 'Added Cash' : isSender ? tx.recipientName : tx.senderName
  const sign     = isSender && !isTopup ? '-' : '+'
  const cls      = isSender && !isTopup ? 'amount-negative' : 'amount-positive'
  const date     = new Date(tx.createdAt)

  return (
    <div className="activity-row card animate-fade-up">
      <div className="activity-icon-wrap">
        <div className="activity-icon" style={{
          color: isTopup ? 'var(--green)' : isSender ? 'var(--red)' : 'var(--green)',
          borderColor: isTopup ? 'rgba(46,213,115,0.2)' : isSender ? 'rgba(255,71,87,0.2)' : 'rgba(46,213,115,0.2)',
        }}>
          {isTopup ? '↓' : isSender ? '↑' : '↓'}
        </div>
      </div>
      <div className="activity-info">
        <span className="activity-name">{name || 'Unknown'}</span>
        <span className="activity-memo">{tx.memo || tx.type}</span>
        <span className="activity-date">
          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="activity-right">
        <span className={`activity-amount ${cls}`}>
          {sign}${Math.abs(tx.amount).toFixed(2)}
        </span>
        <span className={`activity-status status-${tx.status}`}>{tx.status}</span>
      </div>
    </div>
  )
}
