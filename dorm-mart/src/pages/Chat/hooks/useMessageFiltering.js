import { useMemo, useCallback } from "react";

/**
 * Hook to filter and process messages for display
 * @param {Array} messages - Array of message objects
 * @param {boolean} isSellerPerspective - Whether current user is seller
 * @param {number} activeConversationProductId - Product ID of active conversation
 * @param {number} activeReceiverId - Receiver ID for active conversation
 * @returns {Object} Object containing filteredMessages and parseMetadata function
 */
export function useMessageFiltering(
  messages,
  isSellerPerspective,
  activeConversationProductId,
  activeReceiverId
) {
  const parseMetadata = useCallback((metadata) => {
    if (!metadata) return null;
    if (typeof metadata === "object") return metadata;
    try {
      return JSON.parse(metadata);
    } catch {
      return null;
    }
  }, []);

  // Compute hasAcceptedConfirm and prompt flags
  const { hasAcceptedConfirm, shouldShowReviewPrompt, shouldShowBuyerRatingPrompt } = useMemo(() => {
    const accepted = messages.some(m => {
      const meta = parseMetadata(m.metadata);
      const msgType = meta?.type;
      return (msgType === 'confirm_accepted' || msgType === 'confirm_auto_accepted');
    });
    const showReview = !isSellerPerspective && accepted && activeConversationProductId;
    const showBuyerRating = isSellerPerspective && accepted && activeConversationProductId && activeReceiverId;
    return { 
      hasAcceptedConfirm: accepted, 
      shouldShowReviewPrompt: showReview,
      shouldShowBuyerRatingPrompt: showBuyerRating
    };
  }, [messages, isSellerPerspective, activeConversationProductId, activeReceiverId, parseMetadata]);

  const filteredMessages = useMemo(() => {
    if (!messages.length) return [];
    
    const confirmResponses = new Map();
    const confirmRequestIds = new Set();
    let latestConfirmAcceptedTs = null;
    
    const messagesWithParsedMetadata = messages.map(m => ({
      ...m,
      parsedMetadata: parseMetadata(m.metadata)
    }));
    
    messagesWithParsedMetadata.forEach((m) => {
      const metadata = m.parsedMetadata;
      const messageType = metadata?.type;
      const confirmRequestId = metadata?.confirm_request_id;
      
      if (messageType === 'confirm_request' && confirmRequestId) {
        confirmRequestIds.add(confirmRequestId);
      }
    });
    
    messagesWithParsedMetadata.forEach((m) => {
      const metadata = m.parsedMetadata;
      const messageType = metadata?.type;
      const confirmRequestId = metadata?.confirm_request_id;
      
      if (confirmRequestId && (
        messageType === 'confirm_accepted' ||
        messageType === 'confirm_denied' ||
        messageType === 'confirm_auto_accepted'
      )) {
        confirmResponses.set(confirmRequestId, true);
        
        if ((messageType === 'confirm_accepted' || messageType === 'confirm_auto_accepted') && m.ts) {
          if (!latestConfirmAcceptedTs || m.ts > latestConfirmAcceptedTs) {
            latestConfirmAcceptedTs = m.ts;
          }
        }
      }
      
      const enrichedStatus = metadata?.confirm_purchase_status;
      if (confirmRequestId && enrichedStatus && (
        enrichedStatus === 'buyer_accepted' ||
        enrichedStatus === 'buyer_declined' ||
        enrichedStatus === 'auto_accepted'
      )) {
        confirmResponses.set(confirmRequestId, true);
        
        if ((enrichedStatus === 'buyer_accepted' || enrichedStatus === 'auto_accepted') && m.ts) {
          if (!latestConfirmAcceptedTs || m.ts > latestConfirmAcceptedTs) {
            latestConfirmAcceptedTs = m.ts;
          }
        }
      }
    });
    
    const responseMessagesByRequestId = new Map();
    
    messagesWithParsedMetadata.forEach((m) => {
      const metadata = m.parsedMetadata;
      const messageType = metadata?.type;
      const confirmRequestId = metadata?.confirm_request_id;
      
      if (confirmRequestId && (
        messageType === 'confirm_accepted' ||
        messageType === 'confirm_denied' ||
        messageType === 'confirm_auto_accepted'
      )) {
        if (!responseMessagesByRequestId.has(confirmRequestId)) {
          responseMessagesByRequestId.set(confirmRequestId, []);
        }
        responseMessagesByRequestId.get(confirmRequestId).push(m);
      }
    });
    
    const latestResponseByRequestId = new Map();
    responseMessagesByRequestId.forEach((responseMessages, confirmRequestId) => {
      const sorted = responseMessages.sort((a, b) => {
        const tsA = a.ts || 0;
        const tsB = b.ts || 0;
        return tsB - tsA;
      });
      latestResponseByRequestId.set(confirmRequestId, sorted[0]);
    });
    
    let filtered = messagesWithParsedMetadata.filter((m) => {
      const metadata = m.parsedMetadata;
      const messageType = metadata?.type;
      const confirmRequestId = metadata?.confirm_request_id;
      
      if (messageType === 'confirm_request' && confirmRequestId && confirmResponses.has(confirmRequestId)) {
        return false;
      }
      
      if (confirmRequestId && (
        messageType === 'confirm_accepted' ||
        messageType === 'confirm_denied' ||
        messageType === 'confirm_auto_accepted'
      )) {
        const latestResponse = latestResponseByRequestId.get(confirmRequestId);
        return latestResponse === m;
      }
      
      return true;
    });
    
    if (latestConfirmAcceptedTs !== null && hasAcceptedConfirm && activeConversationProductId) {
      const virtualMessages = [];
      
      if (shouldShowReviewPrompt) {
        virtualMessages.push({
          message_id: `review_prompt_${activeConversationProductId}`,
          sender: 'system',
          content: '',
          ts: latestConfirmAcceptedTs + 1,
          metadata: {
            type: 'review_prompt'
          },
          parsedMetadata: { type: 'review_prompt' }
        });
      }
      
      if (shouldShowBuyerRatingPrompt && activeReceiverId) {
        virtualMessages.push({
          message_id: `buyer_rating_prompt_${activeConversationProductId}_${activeReceiverId}`,
          sender: 'system',
          content: '',
          ts: latestConfirmAcceptedTs + 2,
          metadata: {
            type: 'buyer_rating_prompt'
          },
          parsedMetadata: { type: 'buyer_rating_prompt' }
        });
      }
      
      filtered = [...filtered, ...virtualMessages].sort((a, b) => {
        const tsA = a.ts || 0;
        const tsB = b.ts || 0;
        if (tsA !== tsB) return tsA - tsB;
        const aMsgId = String(a.message_id || '');
        const bMsgId = String(b.message_id || '');
        const aIsVirtual = aMsgId.startsWith('review_prompt_') || aMsgId.startsWith('buyer_rating_prompt_');
        const bIsVirtual = bMsgId.startsWith('review_prompt_') || bMsgId.startsWith('buyer_rating_prompt_');
        if (aIsVirtual && !bIsVirtual) return 1;
        if (!aIsVirtual && bIsVirtual) return -1;
        return 0;
      });
    }
    
    return filtered;
  }, [messages, hasAcceptedConfirm, activeConversationProductId, shouldShowReviewPrompt, shouldShowBuyerRatingPrompt, activeReceiverId, parseMetadata]);

  return { filteredMessages, parseMetadata, hasAcceptedConfirm, shouldShowReviewPrompt, shouldShowBuyerRatingPrompt };
}

