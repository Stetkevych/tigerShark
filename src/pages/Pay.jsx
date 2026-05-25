import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useApp } from '../context/AppContext'
import './Pay.css'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

const COINS = [
  { symbol: 'BTC',  name: 'Bitcoin',  icon: '₿', color: '#f7931a', price: 67420 },
  { symbol: 'ETH',  name: 'Ethereum', icon: 'Ξ', color: '#627eea', price: 3540  },
  { symbol: 'SOL',  name: 'Solana',   icon: '◎', color: '#9945ff', price: 178   },
  { symbol: 'USDC', name: 'USD Coin', icon: '$', color: '#2775ca', price: 1     },
]

const CARD_STYLE = {
  style: {
    base: { color: '#e8f4f8', fontFamily: 'Inter, sans-serif', fontSize: '16px', '::placeholder': { color: '#3d5a73' }, iconColor: '#00d4aa' },
    invalid: { color: '#ff4757', iconColor: '#ff4757' },
  },
}

// ── Card form ─────────────────────────────────────────────────
function CardForm({ amount, onSuccess, onCancel }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    const card = elements.getElement(CardElement)
    const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({ type: 'card', card })
    if (pmError) { setError(pmError.message); setLoading(false); return }
    onSuccess({ id: paymentMethod.id, status: 'succeeded', method: 'card' })
  }

  return (
    <form onSubmit={handleSubmit} className="checkout-form">
      <div className="card-element-wrap"><CardElement options={CARD_STYLE} /></div>
      <p className="test-card-hint">Test card: <strong>4242 4242 4242 4242</strong> · Any future date · Any CVC</p>
      {error && <p className="pay-error">{error}</p>}
      <div className="checkout-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={!stripe || loading}>
          {loading ? <span className="spinner" /> : `Add $${amount}`}
        </button>
      </div>
    </form>
  )
}

// ── ACH Bank form ─────────────────────────────────────────────
function BankForm({ amount, onSuccess, onCancel }) {
  const stripe = useStripe()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [bankData, setBankData] = useState({ accountHolderName: '', routingNumber: '', accountNumber: '', accountType: 'checking' })

  const handleLink = async (e) => {
    e.preventDefault()
    if (!stripe) return
    setLoading(true)
    try {
      const { token, error: tokenError } = await stripe.createToken('bank_account', {
        country: 'US', currency: 'usd',
        routing_number: bankData.routingNumber,
        account_number: bankData.accountNumber,
        account_holder_name: bankData.accountHolderName,
        account_holder_type: bankData.accountType,
      })
      if (tokenError) { setError(tokenError.message); setLoading(false); return }
      onSuccess({ id: token.id, status: 'succeeded', method: 'ach', last4: token.bank_account?.last4 })
    } catch (err) { setError(err.message || 'Bank linking failed') }
    finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleLink} className="checkout-form">
      <div className="bank-form-header">
        <span className="bank-icon">🏦</span>
        <div><p className="bank-form-title">Link Bank Account</p><p className="bank-form-sub">ACH · 1–3 business days</p></div>
      </div>
      <input className="input" placeholder="Account holder name" value={bankData.accountHolderName} onChange={e => setBankData(d => ({ ...d, accountHolderName: e.target.value }))} required />
      <input className="input" placeholder="Routing number (9 digits)" value={bankData.routingNumber} onChange={e => setBankData(d => ({ ...d, routingNumber: e.target.value }))} maxLength={9} required />
      <input className="input" placeholder="Account number" value={bankData.accountNumber} onChange={e => setBankData(d => ({ ...d, accountNumber: e.target.value }))} required />
      <div className="account-type-row">
        {['checking', 'savings'].map(t => (
          <button key={t} type="button" className={`account-type-btn${bankData.accountType === t ? ' active' : ''}`} onClick={() => setBankData(d => ({ ...d, accountType: t }))}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <p className="test-card-hint">Test routing: <strong>110000000</strong> · Account: <strong>000123456789</strong></p>
      {error && <p className="pay-error">{error}</p>}
      <div className="checkout-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading || !bankData.accountHolderName || !bankData.routingNumber || !bankData.accountNumber}>
          {loading ? <span className="spinner" /> : `Add $${amount} via Bank`}
        </button>
      </div>
    </form>
  )
}

// ── Add Cash method selector ──────────────────────────────────
function AddCashFlow({ amount, onSuccess, onCancel }) {
  const [method, setMethod] = useState(null)
  if (method === 'card') return <Elements stripe={stripePromise}><CardForm amount={amount} onSuccess={onSuccess} onCancel={() => setMethod(null)} /></Elements>
  if (method === 'bank') return <Elements stripe={stripePromise}><BankForm amount={amount} onSuccess={onSuccess} onCancel={() => setMethod(null)} /></Elements>
  return (
    <div className="add-cash-methods">
      <p className="add-cash-label">Choose funding method</p>
      <button className="method-btn" onClick={() => setMethod('card')}>
        <span className="method-icon">💳</span>
        <div className="method-info"><strong>Debit / Credit Card</strong><span>Instant · Visa, Mastercard, Amex</span></div>
        <span className="method-arrow">›</span>
      </button>
      <button className="method-btn" onClick={() => setMethod('bank')}>
        <span className="method-icon">🏦</span>
        <div className="method-info"><strong>Bank Account (ACH)</strong><span>1–3 business days · No fees</span></div>
        <span className="method-arrow">›</span>
      </button>
      <button className="btn btn-ghost" style={{ marginTop: 4 }} onClick={onCancel}>Cancel</button>
    </div>
  )
}

// ── Crypto section — buy + send ───────────────────────────────
function CryptoSection({ amount, profile, client, refreshProfile, onSuccess, onError }) {
  const [mode, setMode] = useState('buy') // 'buy' | 'send'
  const [selectedCoin, setSelectedCoin] = useState(null)
  const [recipient, setRecipient] = useState('')
  const [recipientUser, setRecipientUser] = useState(null)
  const [qty, setQty] = useState('')
  const [searchError, setSearchError] = useState('')
  const [loading, setLoading] = useState(false)

  const searchUser = async () => {
    if (!recipient.trim() || !client) return
    setSearchError('')
    try {
      const { data } = await client.models.UserProfile.list({
        filter: { username: { eq: recipient.trim().replace('@', '') } },
      })
      if (data?.length > 0) setRecipientUser(data[0])
      else { setSearchError('User not found'); setRecipientUser(null) }
    } catch { setSearchError('Error searching') }
  }

  const handleBuy = async (coin) => {
    if (!amount || Number(amount) <= 0) { onError('Enter an amount above'); return }
    if (Number(amount) > (profile?.balance || 0)) { onError('Insufficient balance'); return }
    setLoading(true)
    try {
      const amt = Number(amount)
      const coinQty = (amt / coin.price).toFixed(6)
      await client.models.UserProfile.update({ id: profile.id, balance: (profile.balance || 0) - amt })
      await client.models.Transaction.create({
        senderId: profile.userId, recipientId: profile.userId,
        senderName: profile.displayName, recipientName: profile.displayName,
        amount: amt, memo: `Bought ${coinQty} ${coin.symbol} @ $${coin.price.toLocaleString()}`,
        status: 'completed', type: 'crypto',
      })
      await refreshProfile()
      onSuccess({ type: 'crypto_buy', amount: amt, coin: coin.symbol, qty: coinQty })
    } catch { onError('Purchase failed. Try again.') }
    finally { setLoading(false) }
  }

  const handleSend = async () => {
    if (!selectedCoin || !qty || Number(qty) <= 0) { setSearchError('Select a coin and enter quantity'); return }
    if (!recipientUser) { setSearchError('Find a recipient first'); return }
    const usdValue = Number(qty) * selectedCoin.price
    if (usdValue > (profile?.balance || 0)) { setSearchError('Insufficient balance'); return }
    setLoading(true)
    try {
      await client.models.UserProfile.update({ id: profile.id, balance: (profile.balance || 0) - usdValue })
      await client.models.UserProfile.update({ id: recipientUser.id, balance: (recipientUser.balance || 0) + usdValue })
      await client.models.Transaction.create({
        senderId: profile.userId, recipientId: recipientUser.userId,
        senderName: profile.displayName, recipientName: recipientUser.displayName,
        amount: usdValue, memo: `Sent ${qty} ${selectedCoin.symbol} (~$${usdValue.toFixed(2)})`,
        status: 'completed', type: 'crypto',
      })
      await refreshProfile()
      onSuccess({ type: 'crypto_send', qty, coin: selectedCoin.symbol, name: recipientUser.displayName, usdValue })
    } catch { setSearchError('Send failed. Try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="crypto-section">
      {/* Mode toggle */}
      <div className="crypto-mode-toggle">
        <button className={`crypto-mode-btn${mode === 'buy' ? ' active' : ''}`} onClick={() => { setMode('buy'); setSelectedCoin(null); setSearchError('') }}>Buy</button>
        <button className={`crypto-mode-btn${mode === 'send' ? ' active' : ''}`} onClick={() => { setMode('send'); setSearchError('') }}>Send</button>
      </div>

      {/* BUY mode */}
      {mode === 'buy' && (
        <>
          <div className="crypto-header">
            <span className="crypto-icon">₿</span>
            <div><p className="crypto-title">Buy Crypto</p><p className="crypto-sub">Deducted from your TigerShark balance</p></div>
          </div>
          <div className="crypto-coins">
            {COINS.map(coin => (
              <button key={coin.symbol} className="crypto-coin-btn" onClick={() => handleBuy(coin)} disabled={loading}>
                <span className="coin-icon" style={{ color: coin.color }}>{coin.icon}</span>
                <div className="coin-info">
                  <strong>{coin.name}</strong>
                  <span>{coin.symbol} · ${coin.price.toLocaleString()}</span>
                </div>
                {amount && Number(amount) > 0 && (
                  <span className="coin-qty">≈ {(Number(amount) / coin.price).toFixed(6)}</span>
                )}
                <span className="coin-arrow">›</span>
              </button>
            ))}
          </div>
          <p className="crypto-disclaimer">Simulated. Real trading via Coinbase Commerce coming soon.</p>
        </>
      )}

      {/* SEND mode */}
      {mode === 'send' && (
        <>
          <div className="crypto-header">
            <span className="crypto-icon">↑</span>
            <div><p className="crypto-title">Send Crypto</p><p className="crypto-sub">Send to another TigerShark user</p></div>
          </div>

          {/* Coin selector */}
          <p className="add-cash-label">Select coin</p>
          <div className="crypto-coin-select">
            {COINS.map(coin => (
              <button key={coin.symbol}
                className={`coin-select-btn${selectedCoin?.symbol === coin.symbol ? ' active' : ''}`}
                onClick={() => setSelectedCoin(coin)}
                style={{ '--coin-color': coin.color }}>
                <span style={{ color: coin.color }}>{coin.icon}</span>
                <span>{coin.symbol}</span>
              </button>
            ))}
          </div>

          {/* Quantity */}
          {selectedCoin && (
            <div className="crypto-qty-wrap">
              <input className="input" type="number" placeholder={`Amount in ${selectedCoin.symbol}`}
                value={qty} onChange={e => setQty(e.target.value)} min="0" step="0.000001" />
              {qty && Number(qty) > 0 && (
                <p className="crypto-usd-value">≈ ${(Number(qty) * selectedCoin.price).toFixed(2)} USD</p>
              )}
            </div>
          )}

          {/* Recipient */}
          <div className="recipient-search">
            <input className="input" placeholder="@username"
              value={recipient}
              onChange={e => { setRecipient(e.target.value); setRecipientUser(null) }}
              onKeyDown={e => e.key === 'Enter' && searchUser()}
              onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
            />
            <button className="btn btn-ghost search-btn" onClick={searchUser}>Find</button>
          </div>

          {recipientUser && (
            <div className="recipient-found">
              <div className="avatar recipient-avatar" style={{ background: recipientUser.avatarColor || 'var(--grad-main)' }}>
                {recipientUser.displayName[0]}
              </div>
              <div>
                <p className="recipient-name">{recipientUser.displayName}</p>
                <p className="recipient-username">@{recipientUser.username}</p>
              </div>
              <span className="recipient-check">✓</span>
            </div>
          )}

          {searchError && <p className="pay-error">{searchError}</p>}

          <button className="btn btn-primary pay-cta"
            disabled={loading || !selectedCoin || !qty || Number(qty) <= 0 || !recipientUser}
            onClick={handleSend}>
            {loading ? <span className="spinner" /> : `Send ${qty || '0'} ${selectedCoin?.symbol || 'crypto'}`}
          </button>
        </>
      )}
    </div>
  )
}

// ── Main Pay page ─────────────────────────────────────────────
export default function Pay() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { profile, client, refreshProfile } = useApp()

  const defaultAction = searchParams.get('action') || 'send'
  const [action,        setAction]        = useState(defaultAction)
  const [amount,        setAmount]        = useState('')
  const [memo,          setMemo]          = useState('')
  const [recipient,     setRecipient]     = useState('')
  const [recipientUser, setRecipientUser] = useState(null)
  const [searchError,   setSearchError]   = useState('')
  const [showFunding,   setShowFunding]   = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [success,       setSuccess]       = useState(null)

  const switchAction = (key) => {
    setAction(key); setSuccess(null); setShowFunding(false)
    setSearchError(''); setRecipientUser(null); setRecipient('')
  }

  const searchUser = async () => {
    if (!recipient.trim() || !client) return
    setSearchError('')
    try {
      const { data } = await client.models.UserProfile.list({
        filter: { username: { eq: recipient.trim().replace('@', '') } },
      })
      if (data?.length > 0) setRecipientUser(data[0])
      else { setSearchError('User not found'); setRecipientUser(null) }
    } catch { setSearchError('Error searching for user') }
  }

  const onFundingSuccess = async (paymentMethod) => {
    setLoading(true)
    try {
      const amt = Number(amount)
      const fundMemo = paymentMethod.method === 'ach' ? `Bank transfer ···${paymentMethod.last4 || ''}` : 'Added cash via card'
      await client.models.UserProfile.update({ id: profile.id, balance: (profile.balance || 0) + amt })
      await client.models.Transaction.create({
        senderId: profile.userId, recipientId: profile.userId,
        senderName: profile.displayName, recipientName: profile.displayName,
        amount: amt, memo: fundMemo, status: 'completed', type: 'topup',
        stripePaymentId: paymentMethod.id,
      })
      await refreshProfile()
      setSuccess({ type: 'topup', amount: amt, method: paymentMethod.method })
      setShowFunding(false)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleSend = async () => {
    if (!recipientUser || !amount || Number(amount) <= 0) return
    if (Number(amount) > (profile?.balance || 0)) { setSearchError('Insufficient balance — add cash first'); return }
    setLoading(true)
    try {
      const amt = Number(amount)
      await client.models.UserProfile.update({ id: profile.id, balance: (profile.balance || 0) - amt })
      await client.models.UserProfile.update({ id: recipientUser.id, balance: (recipientUser.balance || 0) + amt })
      await client.models.Transaction.create({
        senderId: profile.userId, recipientId: recipientUser.userId,
        senderName: profile.displayName, recipientName: recipientUser.displayName,
        amount: amt, memo: memo || '', status: 'completed', type: 'send',
      })
      await refreshProfile()
      setSuccess({ type: 'send', amount: amt, name: recipientUser.displayName })
    } catch { setSearchError('Transfer failed. Try again.') }
    finally { setLoading(false) }
  }

  const handleRequest = async () => {
    if (!recipientUser || !amount || Number(amount) <= 0) return
    setLoading(true)
    try {
      await client.models.Transaction.create({
        senderId: recipientUser.userId, recipientId: profile.userId,
        senderName: recipientUser.displayName, recipientName: profile.displayName,
        amount: Number(amount), memo: memo || 'Payment request', status: 'pending', type: 'request',
      })
      setSuccess({ type: 'request', amount: Number(amount), name: recipientUser.displayName })
    } catch { setSearchError('Request failed. Try again.') }
    finally { setLoading(false) }
  }

  if (success) {
    return (
      <div className="pay page">
        <div className="container">
          <div className="pay-success card animate-scale-in">
            <div className="success-icon">✓</div>
            <h2>
              {success.type === 'topup'        && `$${success.amount.toFixed(2)} added!`}
              {success.type === 'send'         && `$${success.amount.toFixed(2)} sent to ${success.name}!`}
              {success.type === 'request'      && `Requested $${success.amount.toFixed(2)} from ${success.name}!`}
              {success.type === 'crypto_buy'   && `${success.qty} ${success.coin} purchased!`}
              {success.type === 'crypto_send'  && `${success.qty} ${success.coin} sent to ${success.name}!`}
            </h2>
            <p>
              {success.type === 'topup' && success.method === 'ach'  && 'ACH initiated. Funds arrive in 1–3 business days.'}
              {success.type === 'topup' && success.method === 'card' && 'Balance updated instantly.'}
              {success.type === 'send'         && 'Transfer was instant.'}
              {success.type === 'request'      && "They'll be notified."}
              {success.type === 'crypto_buy'   && `$${success.amount.toFixed(2)} deducted from your balance.`}
              {success.type === 'crypto_send'  && `≈ $${success.usdValue.toFixed(2)} transferred instantly.`}
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/home')}>Back to Home</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pay page">
      <div className="container">

        <div className="pay-header">
          <h1 className="pay-title">Pay & Request</h1>
          <p className="pay-balance">Balance: <strong>${(profile?.balance || 0).toFixed(2)}</strong></p>
        </div>

        <div className="pay-tabs">
          {[
            { key: 'send',     label: 'Send'     },
            { key: 'request',  label: 'Request'  },
            { key: 'topup',    label: 'Add Cash' },
            { key: 'crypto',   label: '₿ Crypto' },
            { key: 'withdraw', label: 'Withdraw' },
          ].map(t => (
            <button key={t.key}
              className={`pay-tab${action === t.key ? ' active' : ''}`}
              onClick={() => switchAction(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="pay-card card animate-scale-in" key={action}>

          {/* Amount — shown for send/request/topup */}
          {!showFunding && action !== 'crypto' && action !== 'withdraw' && (
            <div className="amount-input-wrap">
              <span className="amount-dollar">$</span>
              <input className="amount-input" type="number" placeholder="0.00"
                value={amount} onChange={e => setAmount(e.target.value)} min="0.01" step="0.01" />
            </div>
          )}

          {/* Recipient — send & request */}
          {(action === 'send' || action === 'request') && !showFunding && (
            <div className="recipient-section">
              <div className="recipient-search">
                <input className="input" placeholder="@username" value={recipient}
                  onChange={e => { setRecipient(e.target.value); setRecipientUser(null) }}
                  onKeyDown={e => e.key === 'Enter' && searchUser()}
                  onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                />
                <button className="btn btn-ghost search-btn" onClick={searchUser}>Find</button>
              </div>
              {searchError && <p className="pay-error">{searchError}</p>}
              {recipientUser && (
                <div className="recipient-found">
                  <div className="avatar recipient-avatar" style={{ background: recipientUser.avatarColor || 'var(--grad-main)' }}>
                    {recipientUser.displayName[0]}
                  </div>
                  <div>
                    <p className="recipient-name">{recipientUser.displayName}</p>
                    <p className="recipient-username">@{recipientUser.username}</p>
                  </div>
                  <span className="recipient-check">✓</span>
                </div>
              )}
            </div>
          )}

          {/* Memo */}
          {(action === 'send' || action === 'request') && !showFunding && (
            <input className="input" placeholder="What's it for? (optional)"
              value={memo} onChange={e => setMemo(e.target.value)} />
          )}

          {/* Add Cash */}
          {action === 'topup' && showFunding && (
            <AddCashFlow amount={Number(amount).toFixed(2)} onSuccess={onFundingSuccess} onCancel={() => setShowFunding(false)} />
          )}

          {/* Withdraw */}
          {action === 'withdraw' && (
            <div className="withdraw-notice">
              <p>Withdrawals processed within 1–3 business days to your linked bank account.</p>
              <p className="withdraw-coming">Bank linking via Stripe Connect coming soon.</p>
            </div>
          )}

          {/* Crypto */}
          {action === 'crypto' && (
            <CryptoSection
              amount={amount}
              profile={profile}
              client={client}
              refreshProfile={refreshProfile}
              onSuccess={setSuccess}
              onError={setSearchError}
            />
          )}

          {/* CTA */}
          {!showFunding && action !== 'withdraw' && action !== 'crypto' && (
            <button className="btn btn-primary pay-cta"
              disabled={loading || !amount || Number(amount) <= 0 ||
                ((action === 'send' || action === 'request') && !recipientUser)}
              onClick={
                action === 'topup'   ? () => setShowFunding(true) :
                action === 'send'    ? handleSend :
                handleRequest
              }>
              {loading ? <span className="spinner" /> :
                action === 'send'    ? `Send $${amount || '0.00'}` :
                action === 'request' ? `Request $${amount || '0.00'}` :
                `Add $${amount || '0.00'}`
              }
            </button>
          )}

          {action === 'withdraw' && (
            <button className="btn btn-outline pay-cta" disabled>Coming Soon</button>
          )}

        </div>
      </div>
    </div>
  )
}
