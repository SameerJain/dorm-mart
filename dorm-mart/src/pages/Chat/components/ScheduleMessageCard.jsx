import React, { useState } from "react";

const API_BASE = (process.env.REACT_APP_API_BASE || 'api').replace(/\/?$/, '');

function ScheduleMessageCard({ message, isMine, onRespond }) {
  const metadata = message.metadata || {};
  const messageType = metadata.type;
  const requestId = metadata.request_id;
  const [isResponding, setIsResponding] = useState(false);

  // Track local response status to update UI immediately after Accept/Deny
  // Initialize from messageType if already responded, or from metadata status/buyer_response_at
  const [localResponseStatus, setLocalResponseStatus] = useState(() => {
    if (messageType === 'schedule_accepted') return 'accepted';
    if (messageType === 'schedule_denied') return 'declined';
    // Check if buyer has already responded (from enriched metadata)
    if (messageType === 'schedule_request') {
      const scheduledStatus = metadata.scheduled_purchase_status;
      const buyerResponseAt = metadata.buyer_response_at;
      if (scheduledStatus === 'accepted' || scheduledStatus === 'declined' || buyerResponseAt) {
        return scheduledStatus === 'accepted' ? 'accepted' : 'declined';
      }
    }
    return null;
  });

  const handleAction = async (action) => {
    if (!requestId || isResponding || localResponseStatus !== null) return;
    setIsResponding(true);
    try {
      const res = await fetch(`${API_BASE}/scheduled-purchases/respond.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          request_id: requestId,
          action: action,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to ${action} request`);
      }
      const result = await res.json();
      if (result.success) {
        // Update local state immediately to reflect response
        setLocalResponseStatus(action === 'accept' ? 'accepted' : 'declined');
        if (onRespond) {
        onRespond();
        }
      } else {
        throw new Error(result.error || `Failed to ${action} request`);
      }
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
      alert(error.message || `Failed to ${action} request. Please try again.`);
    } finally {
      setIsResponding(false);
    }
  };

  const handleAccept = () => handleAction('accept');
  const handleDeny = () => handleAction('decline');

  // Format meeting date/time
  const formatMeetingTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // Use consistent styling matching site's design system
  // Light backgrounds, solid borders, text matching border color
  // schedule_request always stays blue regardless of response status
  // Other message types (accepted/denied/cancelled) keep their colors
  const getMessageConfig = () => {
    // schedule_request card always stays blue, regardless of localResponseStatus
    if (messageType === 'schedule_request') {
      // Check if buyer has already responded (from metadata or local state)
      const scheduledStatus = metadata.scheduled_purchase_status;
      const buyerResponseAt = metadata.buyer_response_at;
      const hasResponded = localResponseStatus !== null || 
                          scheduledStatus === 'accepted' || 
                          scheduledStatus === 'declined' || 
                          buyerResponseAt !== null && buyerResponseAt !== undefined;
      
      return {
        bgColor: 'bg-blue-50 dark:bg-blue-900/30',
        borderColor: 'border-blue-400 dark:border-blue-700',
        textColor: 'text-blue-600 dark:text-blue-300',
        iconColor: 'text-blue-600 dark:text-blue-300',
        innerBgColor: 'bg-blue-100/50 dark:bg-blue-800/30',
        showActions: !hasResponded && !isMine, // Buyer sees actions only if not responded
      };
    }
    
    // For other message types, use their specific colors
    switch (messageType) {
      case 'schedule_accepted':
        return {
          bgColor: 'bg-green-50 dark:bg-green-900/30',
          borderColor: 'border-green-400 dark:border-green-700',
          textColor: 'text-green-600 dark:text-green-300',
          iconColor: 'text-green-600 dark:text-green-300',
          innerBgColor: 'bg-green-100/50 dark:bg-green-800/30',
          showActions: false,
        };
      case 'schedule_denied':
        return {
          bgColor: 'bg-red-50 dark:bg-red-900/30',
          borderColor: 'border-red-400 dark:border-red-700',
          textColor: 'text-red-600 dark:text-red-300',
          iconColor: 'text-red-600 dark:text-red-300',
          innerBgColor: 'bg-red-100/50 dark:bg-red-800/30',
          showActions: false,
        };
      case 'schedule_cancelled':
        return {
          bgColor: 'bg-red-50 dark:bg-red-900/30',
          borderColor: 'border-red-400 dark:border-red-700',
          textColor: 'text-red-600 dark:text-red-300',
          iconColor: 'text-red-600 dark:text-red-300',
          innerBgColor: 'bg-red-100/50 dark:bg-red-800/30',
          showActions: false,
        };
      default:
        return {
          bgColor: 'bg-blue-50 dark:bg-blue-900/30',
          borderColor: 'border-blue-400 dark:border-blue-700',
          textColor: 'text-blue-600 dark:text-blue-300',
          iconColor: 'text-blue-600 dark:text-blue-300',
          innerBgColor: 'bg-blue-100/50 dark:bg-blue-800/30',
          showActions: false,
        };
    }
  };

  const config = getMessageConfig();
  const meetingAt = metadata.meeting_at ? formatMeetingTime(metadata.meeting_at) : null;
  const meetLocation = metadata.meet_location || null;
  const description = metadata.description || null;
  const verificationCode = metadata.verification_code || null;
  const productTitle = metadata.product_title || null;
  const negotiatedPrice = metadata.negotiated_price !== null && metadata.negotiated_price !== undefined ? parseFloat(metadata.negotiated_price) : null;
  const listingPrice = metadata.listing_price !== null && metadata.listing_price !== undefined ? parseFloat(metadata.listing_price) : null;
  const isTrade = metadata.is_trade === true || metadata.is_trade === 1 || metadata.is_trade === '1';
  
  // Determine display price: use negotiated price if available and different from listing, otherwise use listing price
  const displayPrice = (negotiatedPrice !== null && negotiatedPrice !== listingPrice) ? negotiatedPrice : listingPrice;
  
  // Format price for display
  const formatPrice = (price) => {
    if (price === null || price === undefined || isNaN(price)) return null;
    return `$${price.toFixed(2)}`;
  };

  // Conditionally format message content for seller perspective
  const getDisplayMessage = () => {
    let content = message.content || '';
    
    // If this is a schedule_request from seller's perspective, remove "Please Accept or Deny" text
    if (isMine && messageType === 'schedule_request') {
      // Remove "Please Accept or Deny" (case-insensitive, with or without period)
      content = content.replace(/\s*Please\s+Accept\s+or\s+Deny\.?\s*/gi, '').trim();
    }
    
    return content;
  };

  const displayMessage = getDisplayMessage();

  return (
    <div className={`max-w-[85%] rounded-2xl border-2 ${config.borderColor} ${config.bgColor} ${config.textColor} overflow-hidden`}>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {(messageType === 'schedule_cancelled' || localResponseStatus === 'declined') ? (
            <svg className={`w-5 h-5 ${config.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
          <svg className={`w-5 h-5 ${config.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          )}
          <p className={`font-bold text-base ${config.textColor}`}>
            {displayMessage}
          </p>
        </div>
        
        {/* Product title and price for schedule_request messages */}
        {messageType === 'schedule_request' && productTitle && (
          <div className={`px-3 py-2 rounded-lg ${config.innerBgColor} border ${config.borderColor}`}>
            <p className={`text-sm font-semibold ${config.textColor}`}>
              <span className="font-bold">Item:</span> {productTitle}
            </p>
            {displayPrice !== null && !isTrade && (
              <p className={`text-sm font-semibold ${config.textColor} mt-1`}>
                <span className="font-bold">Cost:</span> {formatPrice(displayPrice)}
                {negotiatedPrice !== null && negotiatedPrice !== listingPrice && (
                  <span className="text-xs ml-1 opacity-75">(negotiated)</span>
                )}
              </p>
            )}
            {isTrade && metadata.trade_item_description && (
              <p className={`text-sm font-semibold ${config.textColor} mt-1`}>
                <span className="font-bold">Trade:</span> {metadata.trade_item_description}
              </p>
            )}
          </div>
        )}
        
        {(meetingAt || meetLocation || description || verificationCode) && (
          <div className={`px-3 py-2 rounded-lg ${config.innerBgColor} border ${config.borderColor} space-y-2`}>
            {meetingAt && (
              <p className={`text-sm ${config.textColor}`}>
                <span className="font-semibold">Meeting Time:</span> {meetingAt}
              </p>
            )}
            {meetLocation && (
              <p className={`text-sm ${config.textColor}`}>
                <span className="font-semibold">Location:</span> {meetLocation}
              </p>
            )}
            {description && (
              <p className={`text-sm ${config.textColor} break-words`}>
                <span className="font-semibold">Description:</span> {description}
              </p>
            )}
            {verificationCode && (
              <p className={`text-sm ${config.textColor}`}>
                <span className="font-semibold">Verification Code:</span> <span className="font-mono font-bold">{verificationCode}</span>
              </p>
            )}
          </div>
        )}

        {config.showActions && (
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleAccept}
              disabled={isResponding || localResponseStatus !== null}
              className="flex-1 px-4 py-2 bg-green-50 dark:bg-green-900/30 border-2 border-green-400 dark:border-green-700 text-green-600 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition"
            >
              {isResponding ? 'Processing...' : 'Accept'}
            </button>
            <button
              onClick={handleDeny}
              disabled={isResponding || localResponseStatus !== null}
              className="flex-1 px-4 py-2 bg-red-50 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-700 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition"
            >
              {isResponding ? 'Processing...' : 'Deny'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScheduleMessageCard;

