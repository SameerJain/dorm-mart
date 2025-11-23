import { useMemo, useState } from 'react';

const API_BASE = (process.env.REACT_APP_API_BASE || 'api').replace(/\/?$/, '');

const FAILURE_REASON_LABELS = {
  buyer_no_show: 'Buyer no showed',
  insufficient_funds: 'Buyer did not have enough money',
  other: 'Other',
};

function formatDate(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
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
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

export default function ConfirmMessageCard({ message, isMine, onRespond }) {
  const metadata = message.metadata || {};
  const messageType = metadata.type;
  const confirmRequestId = metadata.confirm_request_id;

  const [localStatus, setLocalStatus] = useState(() => {
    // Check enriched metadata first (from backend enrichment)
    const enrichedStatus = metadata.confirm_purchase_status;
    if (enrichedStatus === 'buyer_accepted' || enrichedStatus === 'auto_accepted') return 'accepted';
    if (enrichedStatus === 'buyer_declined') return 'declined';
    // Fall back to message type if no enriched status
    if (messageType === 'confirm_accepted' || messageType === 'confirm_auto_accepted') return 'accepted';
    if (messageType === 'confirm_denied') return 'declined';
    // Check if buyer_response_at exists in metadata (indicates response was made)
    if (metadata.buyer_response_at) {
      // If there's a response timestamp but no status, check the status again
      // This handles edge cases where status might not be set but response exists
      return null; // Will be determined by enriched status on next render
    }
    return null;
  });
  const [isResponding, setIsResponding] = useState(false);
  const [error, setError] = useState('');

  const snapshot = metadata.snapshot || {};
  const productTitle = metadata.product_title || snapshot.item_title || 'This item';
  const meetingTime = metadata.meeting_at || snapshot.meeting_at;
  const meetLocation = metadata.meet_location || snapshot.meet_location;
  const expiresAt = metadata.expires_at;
  const respondedAt = metadata.responded_at || null;

  const isSuccessful = metadata.is_successful ?? snapshot.is_successful ?? true;
  const finalPrice = metadata.final_price ?? snapshot.negotiated_price ?? null;
  const listingPrice = metadata.listing_price ?? snapshot.listing_price ?? metadata.original_price ?? snapshot.original_price ?? null;
  const sellerNotes = metadata.seller_notes ?? snapshot.description ?? null;
  const failureReason = metadata.failure_reason;
  const failureReasonNotes = metadata.failure_reason_notes;
  
  // Check if price differs from listing price
  const hasPriceChange = finalPrice !== null && listingPrice !== null && 
    parseFloat(finalPrice) !== parseFloat(listingPrice);

  // Check if buttons should be shown - don't show if status indicates response was already made
  const enrichedStatus = metadata.confirm_purchase_status;
  const hasResponded = enrichedStatus && (enrichedStatus === 'buyer_accepted' || enrichedStatus === 'buyer_declined' || enrichedStatus === 'auto_accepted');
  const isActionableRequest =
    messageType === 'confirm_request' && !isMine && localStatus === null && !!confirmRequestId && !hasResponded;

  const statusDescriptor = useMemo(() => {
    if (messageType === 'confirm_accepted') return { label: 'Buyer accepted', tone: 'success' };
    if (messageType === 'confirm_auto_accepted') return { label: 'Auto accepted', tone: 'success' };
    if (messageType === 'confirm_denied') return { label: 'Buyer denied', tone: 'danger' };
    if (messageType === 'confirm_request' && localStatus === 'accepted') return { label: 'Response sent', tone: 'success' };
    if (messageType === 'confirm_request' && localStatus === 'declined') return { label: 'Response sent', tone: 'danger' };
    if (messageType === 'confirm_request' && isMine) return { label: 'Waiting for buyer', tone: 'info' };
    if (messageType === 'confirm_request' && !isMine) return { label: 'Action required', tone: 'warning' };
    // Fallback to ensure we always return a valid object
    return { label: 'Update', tone: 'info' };
  }, [isMine, localStatus, messageType]);

  const toneClasses = {
    success: {
      container: 'bg-green-50 dark:bg-green-900/30 border-2 border-green-400 dark:border-green-700',
      textColor: 'text-green-600 dark:text-green-300',
      iconColor: 'text-green-600 dark:text-green-400',
      titleColor: 'text-green-800 dark:text-green-200',
      badge: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
    },
    danger: {
      container: 'bg-red-50 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-700',
      textColor: 'text-red-600 dark:text-red-300',
      iconColor: 'text-red-600 dark:text-red-400',
      titleColor: 'text-red-800 dark:text-red-200',
      badge: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
    },
    warning: {
      container: 'bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-400 dark:border-yellow-600',
      textColor: 'text-yellow-600 dark:text-yellow-300',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      titleColor: 'text-yellow-800 dark:text-yellow-200',
      badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-100',
    },
    info: {
      container: 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-400 dark:border-blue-700',
      textColor: 'text-blue-600 dark:text-blue-300',
      iconColor: 'text-blue-600 dark:text-blue-400',
      titleColor: 'text-blue-800 dark:text-blue-200',
      badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100',
    },
  };

  // Ensure statusDescriptor and visual are always valid
  const safeStatusDescriptor = statusDescriptor || { label: 'Update', tone: 'info' };
  const visual = toneClasses[safeStatusDescriptor.tone] || toneClasses.info;

  // Get icon based on status
  const getIcon = () => {
    if (messageType === 'confirm_accepted' || messageType === 'confirm_auto_accepted' || localStatus === 'accepted') {
      return (
        <svg className={`w-5 h-5 ${visual.iconColor} flex-shrink-0 mt-0.5`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    if (messageType === 'confirm_denied' || localStatus === 'declined') {
      return (
        <svg className={`w-5 h-5 ${visual.iconColor} flex-shrink-0 mt-0.5`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    }
    // Default info icon
    return (
      <svg className={`w-5 h-5 ${visual.iconColor} flex-shrink-0 mt-0.5`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  const handleAction = async (action) => {
    if (!confirmRequestId || isResponding) return;
    setIsResponding(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/confirm-purchases/respond.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          confirm_request_id: confirmRequestId,
          action,
        }),
      });
      const payload = await res.json().catch(() => ({ success: false, error: 'Unexpected response' }));
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || `Unable to ${action} the confirmation.`);
      }
      setLocalStatus(action === 'accept' ? 'accepted' : 'declined');
      if (typeof onRespond === 'function') {
        onRespond();
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsResponding(false);
    }
  };

  const failureReasonLabel = failureReason ? FAILURE_REASON_LABELS[failureReason] || 'Other' : null;
  const formattedPrice = formatCurrency(finalPrice);
  const formattedMeeting = formatDate(meetingTime);
  const formattedExpires = formatDate(expiresAt);
  const formattedResponded = formatDate(respondedAt);

  // Safety fallback: Early return if critical metadata is missing - prevents empty div rendering
  // Note: Validation should happen in ChatPage.jsx before rendering, so this should rarely trigger
  // Must be after all hooks to comply with React hooks rules
  if (!messageType || (messageType === 'confirm_request' && !confirmRequestId)) {
    return null;
  }

  return (
    <div className="flex justify-center my-2">
      <div className={`max-w-[85%] rounded-2xl ${visual.container} ${visual.textColor} overflow-hidden`}>
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-2 min-w-0">
            {getIcon()}
            <div className="flex-1 min-w-0 max-w-full overflow-hidden">
              <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
                <p className={`text-sm font-semibold ${visual.titleColor} truncate block`}>
                  Confirm Purchase: {isSuccessful ? 'Marked Successful' : 'Marked Unsuccessful'}
                </p>
                <span className={`text-xs font-semibold flex-shrink-0 ${
                  safeStatusDescriptor.tone === 'success' ? 'text-green-800 dark:text-green-200' :
                  safeStatusDescriptor.tone === 'danger' ? 'text-red-800 dark:text-red-200' :
                  safeStatusDescriptor.tone === 'warning' ? 'text-yellow-800 dark:text-yellow-100' :
                  'text-blue-800 dark:text-blue-100'
                }`}>
                  {safeStatusDescriptor.label}
                </span>
              </div>
              <p className={`text-xs ${visual.textColor} opacity-90 mb-2 truncate block`}>{productTitle}</p>
            </div>
          </div>

          <div className="space-y-2">
            {formattedPrice && (
              <div className={hasPriceChange ? 'px-2 py-1.5 rounded-md bg-orange-50 dark:bg-orange-900/30 border border-orange-400 dark:border-orange-700' : ''}>
                <div className="flex items-center gap-2">
                  {hasPriceChange && (
                    <svg className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  <p className={`text-sm ${hasPriceChange ? 'text-orange-600 dark:text-orange-300' : visual.textColor}`}>
                    <span className="font-semibold">Final price:</span> {formattedPrice}
                    {hasPriceChange && listingPrice !== null && (
                      <span className="text-xs ml-1 opacity-75">(was {formatCurrency(listingPrice)})</span>
                    )}
                  </p>
                </div>
              </div>
            )}
            {formattedMeeting && (
              <p className={`text-sm ${visual.textColor}`}>
                <span className="font-semibold">Met:</span> {formattedMeeting}
              </p>
            )}
            {meetLocation && (
              <p className={`text-sm ${visual.textColor} break-words overflow-hidden`}>
                <span className="font-semibold">Location:</span> <span className="break-all">{meetLocation}</span>
              </p>
            )}
            {sellerNotes && (
              <div>
                <p className={`text-xs font-semibold ${visual.textColor} mb-0.5`}>Notes</p>
                <p className={`text-sm whitespace-pre-wrap ${visual.textColor} opacity-90`}>{sellerNotes}</p>
              </div>
            )}
            {!isSuccessful && failureReasonLabel && (
              <div>
                <p className={`text-xs font-semibold ${visual.textColor} mb-0.5`}>Reason</p>
                <p className={`text-sm font-medium ${visual.textColor}`}>{failureReasonLabel}</p>
                {failureReasonNotes && (
                  <p className={`text-sm whitespace-pre-wrap ${visual.textColor} opacity-90 mt-0.5`}>{failureReasonNotes}</p>
                )}
              </div>
            )}
          </div>

          {messageType === 'confirm_request' && (
            <p className={`text-xs ${visual.textColor} opacity-75`}>
              Buyer has 24 hours to respond{formattedExpires ? ` (expires ${formattedExpires})` : ''}.
            </p>
          )}

          {formattedResponded && messageType !== 'confirm_request' && (
            <p className={`text-xs ${visual.textColor} opacity-75`}>Updated {formattedResponded}</p>
          )}

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          {isActionableRequest && (
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => handleAction('accept')}
                disabled={isResponding}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResponding ? 'Sending…' : 'Confirm'}
              </button>
              <button
                onClick={() => handleAction('decline')}
                disabled={isResponding}
                className="flex-1 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/30 text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResponding ? 'Sending…' : 'Deny'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
