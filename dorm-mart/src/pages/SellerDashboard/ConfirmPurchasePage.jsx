import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const API_BASE = (process.env.REACT_APP_API_BASE || 'api').replace(/\/?$/, '');

const DEFAULT_FAILURE_REASONS = [
  { value: 'buyer_no_show', label: 'Buyer no showed' },
  { value: 'insufficient_funds', label: 'Buyer did not have enough money' },
  { value: 'other', label: 'Other (describe)' },
];

function formatDateTime(iso) {
  if (!iso) return 'TBD';
  try {
    const date = new Date(iso);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (Number.isNaN(number)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(number);
}

export default function ConfirmPurchasePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const navState = location.state && typeof location.state === 'object' ? location.state : null;

  const [prefill, setPrefill] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isSuccessful, setIsSuccessful] = useState(true);
  const [finalPrice, setFinalPrice] = useState('');
  const [sellerNotes, setSellerNotes] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [failureReasonNotes, setFailureReasonNotes] = useState('');

  useEffect(() => {
    if (!navState?.convId || !navState?.productId) {
      setError('Open Confirm Purchase from a chat with a scheduled buyer.');
      return;
    }

    const controller = new AbortController();
    async function loadPrefill() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/confirm-purchases/prefill.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({
            conversation_id: navState.convId,
            product_id: navState.productId,
          }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const payload = await res.json();
        if (!payload.success) {
          throw new Error(payload.error || 'Unable to load scheduled purchase details');
        }
        const data = payload.data;
        setPrefill(data);
        setIsSuccessful(true);
        if (data?.default_final_price !== null && data?.default_final_price !== undefined) {
          setFinalPrice(String(data.default_final_price));
        } else {
          setFinalPrice('');
        }
        const reasons = data?.available_failure_reasons ?? DEFAULT_FAILURE_REASONS;
        setFailureReason(reasons[0]?.value || 'buyer_no_show');
        setFailureReasonNotes('');
        setSellerNotes('');
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Unable to load scheduled purchase details.');
        }
      } finally {
        setLoading(false);
      }
    }

    loadPrefill();
    return () => controller.abort();
  }, [navState]);

  const failureReasonOptions = useMemo(() => {
    if (prefill?.available_failure_reasons && Array.isArray(prefill.available_failure_reasons)) {
      return prefill.available_failure_reasons;
    }
    return DEFAULT_FAILURE_REASONS;
  }, [prefill]);

  const disableForm = loading || !prefill;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!prefill) return;
    setFormError('');
    setFormSuccess('');

    if (finalPrice !== '' && Number.isNaN(Number(finalPrice))) {
      setFormError('Final price must be a valid number.');
      return;
    }

    if (!isSuccessful) {
      if (!failureReason) {
        setFormError('Please select a reason for the unsuccessful purchase.');
        return;
      }
      if (failureReason === 'other' && failureReasonNotes.trim() === '') {
        setFormError('Please describe what happened.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/confirm-purchases/create.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          scheduled_request_id: prefill.scheduled_request_id,
          conversation_id: prefill.conversation_id,
          product_id: prefill.inventory_product_id,
          is_successful: isSuccessful,
          final_price: finalPrice === '' ? null : Number(finalPrice),
          seller_notes: sellerNotes,
          failure_reason: isSuccessful ? null : failureReason,
          failure_reason_notes: isSuccessful ? null : failureReasonNotes,
        }),
      });
      const payload = await res.json().catch(() => ({ success: false, error: 'Unexpected response' }));
      if (!res.ok || !payload.success) {
        const msg = payload.error || 'Failed to send confirmation to the buyer.';
        throw new Error(msg);
      }
      setFormSuccess('Sent! The buyer now has 24 hours to accept or deny this confirmation.');
      setFormError('');
      // Redirect to chat page with the conversation ID
      navigate('/app/chat', { state: { convId: navState.convId } });
    } catch (err) {
      setFormError(err.message || 'Unable to submit the form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!navState?.convId || !navState?.productId) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Confirm Purchase</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Open a conversation from the chat page to use this form.
          </p>
          <button
            onClick={() => navigate('/app/chat')}
            className="inline-flex items-center h-11 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Go to Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Confirm Purchase</h1>
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
        >
          Back
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {!error && (
          <>
            <section className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Review what you agreed with the buyer. Once submitted, the buyer will have 24 hours to accept or deny the confirmation. If they do nothing, it will automatically be accepted.
              </p>
            </section>

            <section className="grid gap-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Item</p>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {prefill?.item_title || '—'}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Buyer</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{prefill?.buyer_name || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Meeting</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {formatDateTime(prefill?.meeting_at)}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pickup Location</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{prefill?.meet_location || '—'}</p>
              </div>
              {prefill?.description && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Notes from scheduling</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{prefill.description}</p>
                </div>
              )}
            </section>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">How did the meet-up go?</p>
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                    <input
                      type="radio"
                      name="is_successful"
                      value="true"
                      checked={isSuccessful === true}
                      disabled={disableForm}
                      onChange={() => setIsSuccessful(true)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    Successful
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                    <input
                      type="radio"
                      name="is_successful"
                      value="false"
                      checked={isSuccessful === false}
                      disabled={disableForm}
                      onChange={() => setIsSuccessful(false)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    Unsuccessful
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block text-sm text-gray-700 dark:text-gray-200">
                  Final price (optional)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={finalPrice}
                    disabled={disableForm}
                    onChange={(e) => setFinalPrice(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/40 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                    placeholder="0.00"
                  />
                </label>
                <div className="text-sm text-gray-500 dark:text-gray-300">
                  Previously agreed price:{' '}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(prefill?.negotiated_price ?? prefill?.default_final_price)}
                  </span>
                </div>
              </div>

              <label className="block text-sm text-gray-700 dark:text-gray-200">
                Additional notes for the buyer (optional)
                <textarea
                  rows={3}
                  value={sellerNotes}
                  disabled={disableForm}
                  onChange={(e) => setSellerNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/40 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  placeholder="Share anything else you'd like the buyer to know."
                  maxLength={2000}
                />
              </label>

              {!isSuccessful && (
                <div className="grid gap-4">
                  <label className="block text-sm text-gray-700 dark:text-gray-200">
                    Why was it unsuccessful?
                    <select
                      value={failureReason}
                      disabled={disableForm}
                      onChange={(e) => setFailureReason(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/40 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                    >
                      {failureReasonOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm text-gray-700 dark:text-gray-200">
                    Add details (optional unless "Other")
                    <textarea
                      rows={3}
                      disabled={disableForm}
                      value={failureReasonNotes}
                      onChange={(e) => setFailureReasonNotes(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/40 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                      placeholder="Extra context helps the buyer understand what happened."
                      maxLength={1000}
                    />
                  </label>
                </div>
              )}

              {formError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3 text-sm text-red-700 dark:text-red-300">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 p-3 text-sm text-green-700 dark:text-green-300">
                  {formSuccess}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={disableForm || isSubmitting}
                  className="inline-flex items-center h-11 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                >
                  {isSubmitting ? 'Sending...' : 'Send to Buyer'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/app/chat', { state: { convId: navState.convId } })}
                  className="inline-flex items-center h-11 rounded-lg border border-gray-300 dark:border-gray-600 px-5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/40"
                >
                  Return to Chat
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
