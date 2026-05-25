import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useApp } from '../context/AppContext'
import './Pay.css'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

const STRIPE_APPEARANCE = {
  theme: 'night',
  variables: {
    colorPrimary: '#00d4aa',
    colorBackground: '#0a1628',
    colorText: '#e8f4f8',
    colorDanger: '#ff4757',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '12px',
  },
}

// ── Stripe checkout form ──────────────────────────────────────
function CheckoutForm({ amount, onSuccess, onCancel }) {
  const stripe   = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    setError(null)

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.origin + '/activity' },
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message)
      setLoading(false)
    } else if (paymentIntent?.status === 'succeeded') {
      onSuccess(paymentIntent)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="checkout-form">
      <PaymentElement />
      {error && <p className="pay-error">{error}</p>}
      <div className="checkout-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={!stripe || loading}>
          {loading ? <span className="spinner" /> : `Pay $${amount}`}
        </button>
      </div>
    </form>
  )
}

// ── Main Pay page ─────────────────────────────────────────────
export default function Pay() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const { profile, client, refreshProfile } = useApp()

  const defaultAction = searchParams.get('action') || 'send'
  const [action,        setAction]        = useState(defaultAction)
  const [amount,        setAmount]        = useState('')
  const [memo,          setMemo]          = useState('')
  const [recipient,     setRecipient]     = useState('')
  const [recipientUser, setRecipientUser] = useState(null)
  const [searchError,   setSearchError]   = useState('')
  const [clientSecret,  setClientSecret]  = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [success,       setSuccess]       = useState(null)

  // Search for recipient by username
  const searchUser = async () => {
    if (!recipient.trim() || !client) return
    setSearchError('')
    try {
      const { data } = await client.models.UserProfile.list({
        filter: { username: { eq: recipient.trim().replace('@', '') } },
      })
      if (data?.length > 0) {
        setRecipientUser(data[0])
      } else {
        setSearchError('User not found')
        setRecipientUser(null)
      }
    } catch (e) {
      setSearchError('Error searching for user')
    }
  }

  // Create Stripe payment intent for top-up
  const handleTopup = async () => {
    if (!amount || isNaN(amount) || Number(amount) <= 0) return
    setLoading(true)
    try {
      // Call our Lambda function
      const res = await fetch('/api/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createPaymentIntent',
          amount: Number(amount),
          customerId: profile?.stripeCustomerId,
        }),
      })
      const data = await res.json()
      setClientSecret(data.clientSecret)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Handle P2P send (internal balance transfer)
  const handleSend = async () => {
    if (!recipientUser || !amount || Number(amount) <= 0) return
    if (Number(amount) > (profile?.balance || 0)) {
      setSearchError('Insufficient balance')
      return
    }
    setLoading(true)
    try {
      const amt = Number(amount)
      // Deduct from sender
      await client.models.UserProfile.update({
        id: profile.id,
        balance: (profile.balance || 0) - amt,
      })
      // Add to recipient
      await client.models.UserProfile.update({
        id: recipientUser.id,
        balance: (recipientUser.balance || 0) + amt,
      })
      // Record transaction
      await client.models.Transaction.create({
        senderId:      profile.userId,
        recipientId:   recipientUser.userId,
        senderName:    profile.displayName,
        recipientName: recipientUser.displayName,
        amount:        amt,
        memo:          memo || '',
        status:        'completed',
        type:          'send',
      })
      await refreshProfile()
      setSuccess({ type: 'send', amount: amt, name: recipientUser.displayName })
    } catch (e) {
      setSearchError('Transfer failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  // Handle request money
  const handleRequest = async () => {
    if (!recipientUser || !amount || Number(amount) <= 0) return
    setLoading(true)
    try {
      await client.models.Transaction.create({
        senderId:      recipientUser.userId,
        recipientId:   profile.userId,
        senderName:    recipientUser.displayName,
        recipientName: profile.displayName,
        amount:        Number(amount),
        memo:          memo || 'Payment request',
        status:        'pending',
        type:          'request',
      })
      setSuccess({ type: 'request', amount: Number(amount), name: recipientUser.displayName })
    } catch (e) {
      setSearchError('Request failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const onStripeSuccess = async (paymentIntent) => {
    // Update balance in DynamoDB
    const amt = Number(amount)
    await client.models.UserProfile.update({
      id: profile.id,
      balance: (profile.balance || 0) + amt,
    })
    await client.models.Transaction.create({
      senderId:    profile.userId,
      recipientId: profile.userId,
      senderName:  profile.displayName,
      amount:      amt,
      memo:        'Added cash',
      status:      'completed',
      type:        'topup',
      stripePaymentId: paymentIntent.id,
    })
    await refreshProfile()
    setSuccess({ type: 'topup', amount: amt })
    setClientSecret(null)
  }

  if (success) {
    return (
      <div className="pay page">
        <div className="container">
          <div className="pay-success card animate-scale-in">
            <div className="success-icon">✓</div>
            <h2>
              {success.type === 'topup'    && `$${success.amount.toFixed(2)} added!`}
              {success.type === 'send'     && `$${success.amount.toFixed(2)} sent to ${success.name}!`}
              {success.type === 'request'  && `Requested $${success.amount.toFixed(2)} from ${success.name}!`}
            </h2>
            <p>
              {success.type === 'topup'   && 'Your balance has been updated.'}
              {success.type === 'send'    && 'The transfer was instant.'}
              {success.type === 'request' && 'They\'ll be notified.'}
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

        {/* Action tabs */}
        <div className="pay-tabs">
          {[
            { key: 'send',     label: 'Send'      },
            { key: 'request',  label: 'Request'   },
            { key: 'topup',    label: 'Add Cash'  },
            { key: 'withdraw', label: 'Withdraw'  },
          ].map(t => (
            <button key={t.key}
              className={`pay-tab${action === t.key ? ' active' : ''}`}
              onClick={() => { setAction(t.key); setSuccess(null); setClientSecret(null); setSearchError('') }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="pay-card card animate-scale-in" key={action}>

          {/* Amount input — all actions */}
          <div className="amount-input-wrap">
            <span className="amount-dollar">$</span>
            <input
              className="amount-input"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min="0.01"
              step="0.01"
            />
          </div>

          {/* Recipient — send & request */}
          {(action === 'send' || action === 'request') && (
            <div className="recipient-section">
              <div className="recipient-search">
                <input
                  className="input"
                  placeholder="@username"
                  value={recipient}
                  onChange={e => { setRecipient(e.target.value); setRecipientUser(null) }}
                  onKeyDown={e => e.key === 'Enter' && searchUser()}
                />
                <button className="btn btn-ghost search-btn" onClick={searchUser}>Find</button>
              </div>
              {searchError && <p className="pay-error">{searchError}</p>}
              {recipientUser && (
                <div className="recipient-found">
                  <div className="avatar recipient-avatar"
                    style={{ background: recipientUser.avatarColor || 'var(--grad-main)' }}>
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
          {(action === 'send' || action === 'request') && (
            <input
              className="input"
              placeholder="What's it for? (optional)"
              value={memo}
              onChange={e => setMemo(e.target.value)}
            />
          )}

          {/* Stripe checkout for top-up */}
          {action === 'topup' && clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: STRIPE_APPEARANCE }}>
              <CheckoutForm
                amount={Number(amount).toFixed(2)}
                onSuccess={onStripeSuccess}
                onCancel={() => setClientSecret(null)}
              />
            </Elements>
          )}

          {/* Withdraw notice */}
          {action === 'withdraw' && (
            <div className="withdraw-notice">
              <p>Withdrawals are processed within 1–3 business days to your linked bank account.</p>
              <p className="withdraw-coming">Bank linking via Stripe Connect coming soon.</p>
            </div>
          )}

          {/* CTA button */}
          {!(action === 'topup' && clientSecret) && action !== 'withdraw' && (
            <button
              className="btn btn-primary pay-cta"
              disabled={loading || !amount || Number(amount) <= 0 || ((action === 'send' || action === 'request') && !recipientUser)}
              onClick={action === 'topup' ? handleTopup : action === 'send' ? handleSend : handleRequest}
            >
              {loading ? <span className="spinner" /> :
                action === 'send'    ? `Send $${amount || '0.00'}` :
                action === 'request' ? `Request $${amount || '0.00'}` :
                `Add $${amount || '0.00'}`
              }
            </button>
          )}

          {action === 'withdraw' && (
            <button className="btn btn-outline pay-cta" disabled>
              Coming Soon
            </button>
          )}

        </div>
      </div>
    </div>
  )
}
