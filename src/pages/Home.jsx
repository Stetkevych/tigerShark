import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import './Home.css'

const QUICK_ACTIONS = [
  { icon: '↑', label: 'Send',     to: '/pay?action=send',    color: 'var(--teal)'  },
  { icon: '↓', label: 'Request',  to: '/pay?action=request', color: 'var(--gold)'  },
  { icon: '+', label: 'Add Cash', to: '/pay?action=topup',   color: 'var(--green)' },
  { icon: '⟵', label: 'Withdraw', to: '/pay?action=withdraw',color: 'var(--text-muted)' },
]

export default function Home() {
  const { profile, client } = useApp()
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

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
        ).slice(0, 10))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [client, profile])

  const balance = profile?.balance ?? 0

  return (
    <div className="home page">
      <div className="container">

        {/* Balance card */}
        <div className="balance-card animate-fade-up">
          <div className="balance-bg" />
          <p className="balance-label">Total Balance</p>
          <h1 className="balance-amount">
            ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h1>
          <p className="balance-user">@{profile?.username || '...'}</p>
        </div>

        {/* Quick actions */}
        <div className="quick-actions animate-fade-up" style={{ animationDelay: '0.1s' }}>
          {QUICK_ACTIONS.map(a => (
            <button key={a.label} className="quick-action-btn" onClick={() => navigate(a.to)}>
              <div className="quick-action-icon" style={{ color: a.color, borderColor: a.color + '33' }}>
                {a.icon}
              </div>
              <span className="quick-action-label">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Recent activity */}
        <div className="section-header animate-fade-up" style={{ animationDelay: '0.15s' }}>
          <h2 className="section-title">Recent Activity</h2>
          <button className="see-all" onClick={() => navigate('/activity')}>See all</button>
        </div>

        {loading ? (
          <div className="loading-row"><div className="spinner" /></div>
        ) : transactions.length === 0 ? (
          <div className="empty-state card animate-scale-in">
            <div className="empty-icon">⟳</div>
            <p>No transactions yet</p>
            <button className="btn btn-primary" onClick={() => navigate('/pay')}>
              Make your first payment
            </button>
          </div>
        ) : (
          <div className="tx-list animate-fade-up" style={{ animationDelay: '0.2s' }}>
            {transactions.map(tx => (
              <TransactionRow key={tx.id} tx={tx} myId={profile?.userId} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

function TransactionRow({ tx, myId }) {
  const isSender = tx.senderId === myId
  const name     = isSender ? tx.recipientName : tx.senderName
  const sign     = isSender ? '-' : '+'
  const cls      = isSender ? 'amount-negative' : 'amount-positive'
  const icon     = tx.type === 'topup' ? '↓' : tx.type === 'withdraw' ? '↑' : isSender ? '↑' : '↓'

  return (
    <div className="tx-row card">
      <div className="tx-icon" style={{ color: isSender ? 'var(--red)' : 'var(--green)' }}>
        {icon}
      </div>
      <div className="tx-info">
        <span className="tx-name">{tx.type === 'topup' ? 'Added Cash' : tx.type === 'withdraw' ? 'Withdrawal' : name || 'Unknown'}</span>
        <span className="tx-memo">{tx.memo || tx.type}</span>
      </div>
      <div className="tx-right">
        <span className={`tx-amount ${cls}`}>
          {sign}${Math.abs(tx.amount).toFixed(2)}
        </span>
        <span className="tx-status">{tx.status}</span>
      </div>
    </div>
  )
}
