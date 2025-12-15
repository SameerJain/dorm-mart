import { useEffect, useRef, useCallback } from "react";
import { getApiBase } from "../../../utils/api";

/**
 * Hook to manage typing status tracking and sending
 * @param {number} activeConvId - Currently active conversation ID
 * @param {Array} conversations - Array of conversations
 * @param {Function} setDraft - Function to set draft state
 * @param {Object} taRef - Ref to textarea element
 * @returns {Object} Object containing sendTypingStatus function and handleDraftChange function
 */
export function useTypingStatus(activeConvId, conversations, setDraft, taRef) {
  const typingTimeoutRef = useRef(null);
  const typingStatusTimeoutRef = useRef(null);
  const currentConvIdRef = useRef(null);
  const sendTypingAbortControllerRef = useRef(null);
  const lastTypingStatusSentRef = useRef(false);
  const isMountedRef = useRef(true);
  const typingRequestSequenceRef = useRef(0);
  const pendingTypingFalseTimeoutRef = useRef(null);
  const typingStartedAtRef = useRef(null);

  // Cleanup typing-related timeouts and requests when conversation changes
  useEffect(() => {
    if (!activeConvId) {
      currentConvIdRef.current = null;
      lastTypingStatusSentRef.current = false;
      typingStartedAtRef.current = null;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (typingStatusTimeoutRef.current) {
        clearTimeout(typingStatusTimeoutRef.current);
        typingStatusTimeoutRef.current = null;
      }
      if (pendingTypingFalseTimeoutRef.current) {
        clearTimeout(pendingTypingFalseTimeoutRef.current);
        pendingTypingFalseTimeoutRef.current = null;
      }
      if (sendTypingAbortControllerRef.current) {
        sendTypingAbortControllerRef.current.abort();
        sendTypingAbortControllerRef.current = null;
      }
      return;
    }

    const previousConvId = currentConvIdRef.current;
    currentConvIdRef.current = activeConvId;
    lastTypingStatusSentRef.current = false;
    typingStartedAtRef.current = null;
    
    if (previousConvId !== activeConvId) {
      typingRequestSequenceRef.current = 0;
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (typingStatusTimeoutRef.current) {
        clearTimeout(typingStatusTimeoutRef.current);
        typingStatusTimeoutRef.current = null;
      }
      if (pendingTypingFalseTimeoutRef.current) {
        clearTimeout(pendingTypingFalseTimeoutRef.current);
        pendingTypingFalseTimeoutRef.current = null;
      }
      if (sendTypingAbortControllerRef.current) {
        sendTypingAbortControllerRef.current.abort();
        sendTypingAbortControllerRef.current = null;
      }
    };
  }, [activeConvId]);

  // Component mount/unmount tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (typingStatusTimeoutRef.current) {
        clearTimeout(typingStatusTimeoutRef.current);
        typingStatusTimeoutRef.current = null;
      }
      if (pendingTypingFalseTimeoutRef.current) {
        clearTimeout(pendingTypingFalseTimeoutRef.current);
        pendingTypingFalseTimeoutRef.current = null;
      }
      if (sendTypingAbortControllerRef.current) {
        sendTypingAbortControllerRef.current.abort();
        sendTypingAbortControllerRef.current = null;
      }
    };
  }, []);

  const sendTypingStatus = useCallback(async (conversationId, isTyping) => {
    if (!conversationId || !isMountedRef.current) return;
    
    if (currentConvIdRef.current !== conversationId) {
      return;
    }
    
    const sequenceNumber = ++typingRequestSequenceRef.current;
    
    if (sendTypingAbortControllerRef.current) {
      sendTypingAbortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    sendTypingAbortControllerRef.current = abortController;
    
    const requestTimestamp = Date.now();
    
    try {
      const response = await fetch(`${getApiBase()}/chat/typing_status.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: abortController.signal,
        body: JSON.stringify({
          conversation_id: conversationId,
          is_typing: isTyping,
          timestamp: requestTimestamp
        })
      });
      
      if (response.ok && 
          currentConvIdRef.current === conversationId && 
          isMountedRef.current &&
          sequenceNumber === typingRequestSequenceRef.current) {
        lastTypingStatusSentRef.current = isTyping;
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.warn('Failed to send typing status:', error);
      }
    }
  }, []);

  const handleDraftChange = useCallback((e) => {
    const currentConv = conversations.find((c) => c.conv_id === activeConvId);
    if (currentConv?.item_deleted) {
      e.preventDefault();
      e.stopPropagation();
      if (taRef.current) {
        taRef.current.value = '';
        taRef.current.blur();
      }
      setDraft('');
      return false;
    }
    
    const newValue = e.target.value;
    setDraft(newValue);

    if (!activeConvId || !isMountedRef.current) return;

    const convId = activeConvId;

    if (currentConvIdRef.current !== convId) {
      return;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (typingStatusTimeoutRef.current) {
      clearTimeout(typingStatusTimeoutRef.current);
      typingStatusTimeoutRef.current = null;
    }
    if (pendingTypingFalseTimeoutRef.current) {
      clearTimeout(pendingTypingFalseTimeoutRef.current);
      pendingTypingFalseTimeoutRef.current = null;
    }

    const hasSentTyping = lastTypingStatusSentRef.current === true;
    
    const now = Date.now();
    if (!typingStartedAtRef.current) {
      typingStartedAtRef.current = now;
    }
    
    const typingDuration = now - typingStartedAtRef.current;
    const shouldShowTyping = typingDuration < 30000;
    
    if (!hasSentTyping && shouldShowTyping) {
      if (currentConvIdRef.current === convId && isMountedRef.current) {
        sendTypingStatus(convId, true);
      }
    } else if (hasSentTyping && shouldShowTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        const currentTypingDuration = Date.now() - (typingStartedAtRef.current || Date.now());
        if (currentConvIdRef.current === convId && isMountedRef.current && currentTypingDuration < 30000) {
          sendTypingStatus(convId, true);
        }
      }, 50);
    }

    typingStatusTimeoutRef.current = setTimeout(() => {
      if (currentConvIdRef.current === convId && isMountedRef.current) {
        typingStatusTimeoutRef.current = null;
        sendTypingStatus(convId, false);
        lastTypingStatusSentRef.current = false;
        typingStartedAtRef.current = null;
      }
    }, 1500);
  }, [activeConvId, sendTypingStatus, conversations, setDraft, taRef]);

  const stopTypingStatus = useCallback((convId) => {
    if (convId && currentConvIdRef.current === convId && isMountedRef.current) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (typingStatusTimeoutRef.current) {
        clearTimeout(typingStatusTimeoutRef.current);
        typingStatusTimeoutRef.current = null;
      }
      if (pendingTypingFalseTimeoutRef.current) {
        clearTimeout(pendingTypingFalseTimeoutRef.current);
        pendingTypingFalseTimeoutRef.current = null;
      }
      sendTypingStatus(convId, false);
      lastTypingStatusSentRef.current = false;
      typingStartedAtRef.current = null;
    }
  }, [sendTypingStatus]);

  return { handleDraftChange, stopTypingStatus };
}



