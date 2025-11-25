import { useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ChatContext } from "../../context/ChatContext";
import fmtTime from "./chat_page_utils";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import MessageCard from "./components/MessageCard";
import ScheduleMessageCard from "./components/ScheduleMessageCard";
import NextStepsMessageCard from "./components/NextStepsMessageCard";
import ImageModal from "./components/ImageModal";
import ConfirmMessageCard from "./components/ConfirmMessageCard";
import ReviewPromptMessageCard from "./components/ReviewPromptMessageCard";
import BuyerRatingPromptMessageCard from "./components/BuyerRatingPromptMessageCard";

const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const API_BASE = (process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`).replace(/\/$/, "");

// Typing indicator message component (displays in messages area)
const TypingIndicatorMessage = ({ firstName }) => {
  const displayName = firstName || "Someone";
  
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl px-3 py-2 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-200 shadow">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-sm italic truncate block">{displayName} is typing...</span>
        </div>
      </div>
    </div>
  );
};

/** Root Chat page: wires context, sidebar, messages, and composer together */
export default function ChatPage() {
  /** Chat global state and actions from context */
  const ctx = useContext(ChatContext);
  const {
    conversations,
    activeConvId,
    messages,
    messagesByConv,
    typingStatusByConv,
    convError,
    chatByConvError,
    unreadMsgByConv,
    myId,
    fetchConversation,
    createMessage,
    createImageMessage,
    clearActiveConversation,
    removeConversationLocal
  } = ctx;

  const [searchParams, setSearchParams] = useSearchParams();
  const MAX_LEN = 500;
  const scrollRef = useRef(null);
  const [draft, setDraft] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteConvId, setPendingDeleteConvId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const typingTimeoutRef = useRef(null);
  const typingStatusTimeoutRef = useRef(null);
  const currentConvIdRef = useRef(null); // Track current active conversation
  const sendTypingAbortControllerRef = useRef(null); // For canceling send typing requests
  const lastTypingStatusSentRef = useRef(false); // Track last sent typing status for reference
  const isMountedRef = useRef(true); // Track if component is mounted
  
  // Prevent body scroll when delete confirmation modal is open
  useEffect(() => {
    if (deleteConfirmOpen) {
      const scrollY = window.scrollY;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      const scrollY = document.body.style.top;
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [deleteConfirmOpen]);
  const [attachedImage, setAttachedImage] = useState(null);
  const [hasActiveScheduledPurchase, setHasActiveScheduledPurchase] = useState(false);
  const [usernameMap, setUsernameMap] = useState({});
  const usernameCacheRef = useRef({});
  const pendingUsernameRequests = useRef(new Set());
  useEffect(() => {
    usernameCacheRef.current = usernameMap;
  }, [usernameMap]);

  const taRef = useRef(null);
  const [confirmStatus, setConfirmStatus] = useState(null);

  /** Auto-resize the textarea height based on its content */
  const autoGrow = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.style.overflowY = el.scrollHeight > el.clientHeight ? "auto" : "hidden";
  }, []);

  /** Re-run autoGrow when draft changes */
  useEffect(() => {
    autoGrow();
  }, [draft, autoGrow]);

  const navigate = useNavigate();
  const location = useLocation();
  const navigationState = location.state && typeof location.state === "object" ? location.state : null;
  const activeConversation = conversations.find((c) => c.conv_id === activeConvId);

  /** Clear draft when item is deleted and prevent any input */
  useEffect(() => {
    if (activeConversation?.item_deleted) {
      // Clear draft immediately
      setDraft('');
      // Clear textarea value and remove focus
      if (taRef.current) {
        taRef.current.value = '';
        taRef.current.blur();
        // Force the textarea to be disabled
        taRef.current.disabled = true;
        taRef.current.readOnly = true;
      }
    } else {
      // Re-enable if item is not deleted
      if (taRef.current) {
        taRef.current.disabled = false;
        taRef.current.readOnly = false;
      }
    }
  }, [activeConversation?.item_deleted]);

  /** Compute header label for the active chat */
  const activeLabel = useMemo(() => {
    const c = conversations.find((c) => c.conv_id === activeConvId);
    if (c) return c.receiverName;
    if (navigationState?.receiverName) return navigationState.receiverName;
    if (navigationState?.receiverId) return `User ${navigationState.receiverId}`;
    return "Select a chat";
  }, [conversations, activeConvId, navigationState]);

  /** Extract first name for mobile display */
  const activeLabelFirstName = useMemo(() => {
    if (!activeLabel || activeLabel === "Select a chat") return activeLabel;
    return activeLabel.split(' ')[0];
  }, [activeLabel]);
  const activeReceiverId = activeConversation?.receiverId ?? navigationState?.receiverId ?? null;
  const activeReceiverUsername = activeReceiverId ? usernameMap[activeReceiverId] : null;
  const activeProfilePath = activeReceiverUsername
    ? `/app/profile?username=${encodeURIComponent(activeReceiverUsername)}`
    : null;

  const ensureUsername = useCallback((userId) => {
    if (!userId || usernameCacheRef.current[userId] || pendingUsernameRequests.current.has(userId)) {
      return;
    }
    pendingUsernameRequests.current.add(userId);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/profile/get_username.php?user_id=${encodeURIComponent(userId)}`, {
          credentials: "include",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && json.username) {
          setUsernameMap((prev) => {
            if (prev[userId]) return prev;
            return { ...prev, [userId]: json.username };
          });
        }
      } catch (_) {
        // ignore errors
      } finally {
        pendingUsernameRequests.current.delete(userId);
      }
    })();
  }, []);

  useEffect(() => {
    conversations.forEach((c) => c?.receiverId && ensureUsername(c.receiverId));
  }, [conversations, ensureUsername]);

  useEffect(() => {
    if (navigationState?.receiverId) {
      ensureUsername(navigationState.receiverId);
    }
  }, [navigationState, ensureUsername]);

  const handleProfileHeaderClick = useCallback(() => {
    if (!activeReceiverId) return;
    if (activeProfilePath) {
      navigate(activeProfilePath);
      return;
    }
    pendingUsernameRequests.current.add(activeReceiverId);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/profile/get_username.php?user_id=${encodeURIComponent(activeReceiverId)}`, {
          credentials: "include",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && json.username) {
          setUsernameMap((prev) => {
            if (prev[activeReceiverId]) return prev;
            return { ...prev, [activeReceiverId]: json.username };
          });
          navigate(`/app/profile?username=${encodeURIComponent(json.username)}`);
        }
      } catch (_) {
        // ignore errors
      } finally {
        pendingUsernameRequests.current.delete(activeReceiverId);
      }
    })();
  }, [activeReceiverId, activeProfilePath, navigate]);


  /** Controls which pane is visible on mobile (list vs messages) */
  const [isMobileList, setIsMobileList] = useState(true);

  /** Handle deep-link via ?conv=ID in URL and auto-open that conversation */
  useEffect(() => {
    const convParam = searchParams.get('conv');
    if (convParam) {
      const convId = parseInt(convParam, 10);
      if (convId && convId !== activeConvId) {
        fetchConversation(convId);
        setIsMobileList(false);
      }
      setSearchParams({});
    }
  }, [searchParams, activeConvId, fetchConversation, setSearchParams]);

  /** When an active conversation exists, show the message pane on mobile */
  useEffect(() => {
    if (activeConvId) setIsMobileList(false);
  }, [activeConvId]);

  // Derive typing status from context (comes from fetch_new_messages)
  const typingStatus = activeConvId ? (typingStatusByConv[activeConvId] || { is_typing: false, typing_user_first_name: null }) : null;
  const isOtherPersonTyping = typingStatus?.is_typing || false;
  const typingUserName = typingStatus?.typing_user_first_name || null;

  /** Cleanup typing-related timeouts and requests when conversation changes */
  useEffect(() => {
    if (!activeConvId) {
      currentConvIdRef.current = null;
      lastTypingStatusSentRef.current = false;
      return;
    }

    currentConvIdRef.current = activeConvId;
    lastTypingStatusSentRef.current = false; // Reset when conversation changes

    return () => {
      // Clear all timeouts
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (typingStatusTimeoutRef.current) {
        clearTimeout(typingStatusTimeoutRef.current);
        typingStatusTimeoutRef.current = null;
      }
      
      // Cancel all in-flight requests
      if (sendTypingAbortControllerRef.current) {
        sendTypingAbortControllerRef.current.abort();
        sendTypingAbortControllerRef.current = null;
      }
    };
  }, [activeConvId]);

  /** Component mount/unmount tracking */
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cleanup all timeouts and abort controllers on unmount
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (typingStatusTimeoutRef.current) {
        clearTimeout(typingStatusTimeoutRef.current);
        typingStatusTimeoutRef.current = null;
      }
      if (sendTypingAbortControllerRef.current) {
        sendTypingAbortControllerRef.current.abort();
        sendTypingAbortControllerRef.current = null;
      }
    };
  }, []);

  /** Auto-scroll to bottom when active conversation or messages change */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    // Note: Removed automatic hiding of typing indicator on messages.length change
    // The backend already handles typing status expiration, and this was causing
    // race conditions where the indicator would disappear when messages were being fetched
  }, [activeConvId, messages.length]);

  /** Auto-scroll to bottom when typing indicator appears */
  useEffect(() => {
    if (isOtherPersonTyping) {
      // Use setTimeout to ensure DOM has updated with typing indicator
      const timeoutId = setTimeout(() => {
        const el = scrollRef.current;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [isOtherPersonTyping]);

  /** Send typing status to backend */
  const sendTypingStatus = useCallback(async (conversationId, isTyping) => {
    if (!conversationId || !isMountedRef.current) return;
    
    // Verify conversation is still active
    if (currentConvIdRef.current !== conversationId) {
      return;
    }
    
    // Cancel any previous send typing requests
    if (sendTypingAbortControllerRef.current) {
      sendTypingAbortControllerRef.current.abort();
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController();
    sendTypingAbortControllerRef.current = abortController;
    
    try {
      const response = await fetch(`${API_BASE}/chat/typing_status.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: abortController.signal,
        body: JSON.stringify({
          conversation_id: conversationId,
          is_typing: isTyping
        })
      });
      
      if (response.ok && currentConvIdRef.current === conversationId && isMountedRef.current) {
        // Track if we successfully sent typing status
        lastTypingStatusSentRef.current = isTyping;
      }
    } catch (error) {
      // Ignore abort errors - typing indicator is not critical, fail silently
      if (error.name !== 'AbortError') {
        // Only log non-abort errors for debugging
        console.warn('Failed to send typing status:', error);
      }
    }
  }, []);

  /** Handle draft input change and track typing status */
  const handleDraftChange = useCallback((e) => {
    // Prevent typing if item is deleted
    const currentConv = conversations.find((c) => c.conv_id === activeConvId);
    if (currentConv?.item_deleted) {
      e.preventDefault();
      e.stopPropagation();
      // Force the value to stay empty and prevent any state update
      if (taRef.current) {
        taRef.current.value = '';
        taRef.current.blur(); // Remove focus
      }
      setDraft('');
      return false; // Explicitly return false
    }
    
    const newValue = e.target.value;
    setDraft(newValue);

    if (!activeConvId || !isMountedRef.current) return;

    // Capture conversation ID to avoid stale closure
    const convId = activeConvId;

    // Verify conversation is still active
    if (currentConvIdRef.current !== convId) {
      return;
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (typingStatusTimeoutRef.current) {
      clearTimeout(typingStatusTimeoutRef.current);
      typingStatusTimeoutRef.current = null;
    }

    // Send "typing" status after 500ms debounce when user types
    // Always set up the timeout to ensure typing status is sent reliably
    typingTimeoutRef.current = setTimeout(() => {
      // Verify conversation is still active and component is mounted before sending
      if (currentConvIdRef.current === convId && isMountedRef.current) {
        sendTypingStatus(convId, true);
      }
    }, 500);

    // Send "stopped" status after 3s of inactivity (reduced from 4s for better UX)
    typingStatusTimeoutRef.current = setTimeout(() => {
      // Verify conversation is still active and component is mounted before sending
      if (currentConvIdRef.current === convId && isMountedRef.current) {
        sendTypingStatus(convId, false);
        lastTypingStatusSentRef.current = false;
      }
    }, 3000);
  }, [activeConvId, sendTypingStatus, conversations]);

  /** Wrapper to prevent message creation when item is deleted */
  const handleCreateMessage = useCallback((content) => {
    if (activeConversation?.item_deleted) {
      return;
    }
    createMessage(content);
  }, [activeConversation?.item_deleted, createMessage]);

  /** Wrapper to prevent image message creation when item is deleted */
  const handleCreateImageMessage = useCallback((content, file) => {
    if (activeConversation?.item_deleted) {
      return;
    }
    createImageMessage(content, file);
  }, [activeConversation?.item_deleted, createImageMessage]);

  /** Keydown handler for textarea: submit on Enter (without Shift) */
  function handleKeyDown(e) {
    // Prevent ALL keyboard input if item is deleted
    if (activeConversation?.item_deleted) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
    
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (attachedImage) {
        handleCreateImageMessage(draft, attachedImage);
      } else {
        handleCreateMessage(draft);
      }
      setDraft("");
      setAttachedImage(null);
      
      // Stop typing status when message is sent
      const convId = activeConvId;
      if (convId && currentConvIdRef.current === convId && isMountedRef.current) {
        sendTypingStatus(convId, false);
        lastTypingStatusSentRef.current = false;
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
        if (typingStatusTimeoutRef.current) {
          clearTimeout(typingStatusTimeoutRef.current);
          typingStatusTimeoutRef.current = null;
        }
      }
    }
  }

  /** Open delete confirmation modal for a given conversation */
  function handleDeleteClick(convId, e) {
    e.stopPropagation();
    setPendingDeleteConvId(convId);
    setDeleteConfirmOpen(true);
    setDeleteError('');
  }

  /** Confirm deletion: call API, clear active if needed, then reload page */
  async function handleDeleteConfirm() {
    if (!pendingDeleteConvId || isDeleting) return;

    const convId = pendingDeleteConvId;            // keep a local copy
    const wasActive = convId === activeConvId;     // was this the open chat?

    // Immediately update local UI and stop polling for this conversation
    removeConversationLocal(convId);
    if (wasActive) {
      clearActiveConversation();
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      const API = (process.env.REACT_APP_API_BASE || 'api').replace(/\/?$/, '');
      const res = await fetch(`${API}/chat/delete_conversation.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ conv_id: convId }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete conversation');
      }

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete conversation');
      }

      setDeleteConfirmOpen(false);
      setPendingDeleteConvId(null);

      // Optional: you probably don't need this anymore, but you can keep it as a safety net.
      // window.location.reload();
    } catch (error) {
      setDeleteError(error.message || 'Failed to delete conversation. Please try again.');
      // If you want to "undo" the local removal on error, you could reload or refetch here.
    } finally {
      setIsDeleting(false);
    }
  }


  /** Cancel deletion: close modal and clear state */
  function handleDeleteCancel() {
    setDeleteConfirmOpen(false);
    setPendingDeleteConvId(null);
    setDeleteError('');
  }

  /** Detect listing intro message and whether current user is seller */
  const hasListingIntro = messages.some(m => m.metadata?.type === "listing_intro");
  const listingIntroMsg = messages.find(m => m.metadata?.type === "listing_intro");
  const isSeller = hasListingIntro && listingIntroMsg && listingIntroMsg.sender === "them";

  /** Determine if current user is the seller (seller perspective) */
  const isSellerPerspective = activeConversation?.productId && activeConversation?.productSellerId && myId &&
    Number(activeConversation.productSellerId) === Number(myId);

  /** Check if buyer has accepted confirm purchase and should see review prompt */
  const hasAcceptedConfirm = messages.some(m => {
    const msgType = m.metadata?.type;
    // Buyer sees confirm_accepted when they accept (sender === "me") or when seller sends it (sender === "them")
    // We show the prompt to buyers (not seller perspective) when there's an accepted confirm message
    return (msgType === 'confirm_accepted' || msgType === 'confirm_auto_accepted');
  });
  const shouldShowReviewPrompt = !isSellerPerspective && hasAcceptedConfirm && activeConversation?.productId;

  /** Check if seller should see buyer rating prompt */
  const shouldShowBuyerRatingPrompt = isSellerPerspective && hasAcceptedConfirm && activeConversation?.productId && activeReceiverId;

  /** Header background color based on buyer vs seller perspective */
  const headerBgColor = isSellerPerspective
    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
    : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";

  /** Seller-only confirm state (null if not seller perspective) */
  const confirmState = isSellerPerspective
    ? (confirmStatus ?? { can_confirm: false, message: 'Checking Confirm Purchase status…' })
    : null;

  /** Disable Confirm Purchase button if cannot confirm */
  const confirmButtonDisabled = confirmState ? !confirmState.can_confirm : true;
  /** Tooltip/title text for Confirm Purchase button */
  const confirmButtonTitle = confirmState?.message || '';

  /** Check if there is an active scheduled purchase for the item (seller view only) */
  const checkActiveScheduledPurchase = useCallback(async (signal) => {
    const productId = activeConversation?.productId;
    const sellerView = activeConversation?.productId && activeConversation?.productSellerId && myId &&
      Number(activeConversation.productSellerId) === Number(myId);
    if (!productId || !sellerView) {
      setHasActiveScheduledPurchase(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/scheduled-purchases/check_active.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        signal,
        body: JSON.stringify({ product_id: productId }),
      });
      if (!res.ok) {
        console.error('Failed to check active scheduled purchase');
        setHasActiveScheduledPurchase(false);
        return;
      }
      const result = await res.json();
      setHasActiveScheduledPurchase(result.success ? result.has_active === true : false);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error checking active scheduled purchase:', error);
        setHasActiveScheduledPurchase(false);
      }
    }
  }, [activeConversation?.productId, activeConversation?.productSellerId, myId]);

  /** Check Confirm Purchase status for current conversation and product (seller only) */
  const checkConfirmStatus = useCallback(async (signal) => {
    if (!activeConvId || !activeConversation?.productId || !isSellerPerspective) {
      setConfirmStatus(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/confirm-purchases/status.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        signal,
        body: JSON.stringify({ conversation_id: activeConvId, product_id: activeConversation.productId }),
      });
      if (!res.ok) throw new Error('Failed to load confirm status');
      const result = await res.json();
      if (result.success) {
        const data = result.data || {};
        if (typeof data.can_confirm !== 'boolean') data.can_confirm = false;
        if (!data.can_confirm && !data.message) {
          if (data.reason_code === 'pending_request') data.message = 'Waiting for the buyer to respond to your confirmation.';
          else if (data.reason_code === 'missing_schedule') data.message = 'Create and get a Schedule Purchase accepted before confirming.';
          else if (data.reason_code === 'already_confirmed') data.message = 'This purchase has already been confirmed.';
          else data.message = 'Confirm Purchase is not available right now.';
        }
        setConfirmStatus(data);
      } else {
        setConfirmStatus({ can_confirm: false, message: result.error || 'Unable to check Confirm Purchase status.' });
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        setConfirmStatus({ can_confirm: false, message: 'Unable to check Confirm Purchase status.' });
      }
    }
  }, [activeConvId, activeConversation?.productId, isSellerPerspective]);

  /** Initial load: check for active scheduled purchase once */
  useEffect(() => {
    const controller = new AbortController();
    checkActiveScheduledPurchase(controller.signal);
    return () => controller.abort();
  }, [checkActiveScheduledPurchase]);

  /** Initial load: check confirm status once */
  useEffect(() => {
    const controller = new AbortController();
    checkConfirmStatus(controller.signal);
    return () => controller.abort();
  }, [checkConfirmStatus]);

  /** Re-check schedule + confirm status when messages change in seller view */
  useEffect(() => {
    if (!activeConversation?.productId || !isSellerPerspective) return;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      checkActiveScheduledPurchase(controller.signal);
      checkConfirmStatus(controller.signal);
    }, 500);
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [messages.length, activeConversation?.productId, isSellerPerspective, checkActiveScheduledPurchase, checkConfirmStatus]);

  /** Navigate to Schedule Purchase flow for seller */
  function handleSchedulePurchase() {
    if (!activeConvId || !activeConversation?.productId || hasActiveScheduledPurchase) return;
    navigate("/app/seller-dashboard/schedule-purchase", {
      state: { convId: activeConvId, productId: activeConversation.productId }
    });
  }

  /** Navigate to Confirm Purchase flow for seller */
  function handleConfirmPurchase() {
    if (!activeConvId || !activeConversation?.productId) return;
    navigate("/app/seller-dashboard/confirm-purchase", {
      state: { convId: activeConvId, productId: activeConversation.productId }
    });
  }

  /** Render a single conversation item in the sidebar, with grouping styles */
  function renderConversationItem(c, sectionType = 'sellers') {
    const isActive = c.conv_id === activeConvId;
    const unread = unreadMsgByConv?.[c.conv_id] ?? 0;
    const isHighlighted = isActive && !isMobileList;

    const activeMessages = isActive ? messages : [];
    const hasListingIntro = activeMessages.some(m => m.metadata?.type === "listing_intro");
    const listingIntroMsg = activeMessages.find(m => m.metadata?.type === "listing_intro");
    const isBuyer = listingIntroMsg && listingIntroMsg.sender === "me";
    const isSeller = listingIntroMsg && listingIntroMsg.sender === "them";

    let buttonColorClass = "";
    if (isHighlighted) {
      if (hasListingIntro) {
        if (isBuyer) {
          buttonColorClass = "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
        } else if (isSeller) {
          buttonColorClass = "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300";
        } else {
          buttonColorClass = "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300";
        }
      } else {
        buttonColorClass = "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300";
      }
    }
    const hoverColor = sectionType === 'buyers' ? "hover:bg-green-600" : "hover:bg-blue-600";
    const profileUsername = usernameMap[c.receiverId] || null;
    const profilePath = profileUsername ? `/app/profile?username=${encodeURIComponent(profileUsername)}` : null;

    return (
      <li key={c.conv_id} className="relative group">
        <button
          onClick={() => {
            fetchConversation(c.conv_id);
            setIsMobileList(false);
          }}
          className={
            "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition " +
            (buttonColorClass || (isHighlighted ? "bg-indigo-50 text-indigo-700" : hoverColor))
          }
          aria-current={isHighlighted ? "true" : undefined}
        >
          <div className="flex flex-col min-w-0 flex-1">
            {(c.productTitle || c.productId) && (
              <span className="truncate font-semibold text-sm">
                {c.productTitle || `Item #${c.productId}`}
              </span>
            )}
            <span className="truncate text-sm">{c.receiverName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {c.productImageUrl && (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700">
                <img
                  src={c.productImageUrl.startsWith('http') || c.productImageUrl.startsWith('/data/images/') || c.productImageUrl.startsWith('/images/') ? `${API_BASE}/image.php?url=${encodeURIComponent(c.productImageUrl)}` : c.productImageUrl}
                  alt={c.productTitle || 'Product'}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {unread > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs leading-5" aria-label={`${unread} unread`}>
                {unread > 99 ? "99+" : unread}
              </span>
            )}
            <div
              onClick={(e) => handleDeleteClick(c.conv_id, e)}
              className="opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 cursor-pointer"
              aria-label="Delete conversation"
              title="Delete conversation"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleDeleteClick(c.conv_id, e);
                }
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
          </div>
        </button>
      </li>
    );
  }

  return (
    <div className="h-[100dvh] md:h-[calc(100dvh-var(--nav-h))] w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100" style={{ "--nav-h": "64px" }}>
      <div className="mx-auto h-full max-w-[1200px] px-4 py-6">
        <div className="grid h-full grid-cols-12 gap-4">
          {/* Sidebar */}
          <aside
            className={
              `col-span-12 md:col-span-3 rounded-2xl border-4 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ` +
              (isMobileList ? "block" : "hidden") + " md:block"
            }
          >
            <div className="border-b-4 border-gray-200 dark:border-gray-700 p-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Chats</h2>
            </div>
            <ul className="max-h-[70vh] overflow-y-auto p-2" aria-label="Conversation list">
              {convError ? (
                <li>
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                    Something went wrong, please try again later
                  </div>
                </li>
              ) : (() => {
                /** Split conversations into seller and buyer sections for sidebar grouping */
                const messagesToSellers = [];
                const messagesToBuyers = [];
                conversations.forEach((c) => {
                  const isSellerConversation = c.productId && c.productSellerId && myId && Number(c.productSellerId) === Number(myId);
                  if (isSellerConversation) messagesToBuyers.push(c);
                  else messagesToSellers.push(c);
                });
                return (
                  <>
                    {messagesToSellers.length > 0 && (
                      <>
                        <li className="px-2 py-2">
                          <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                            Messages To Sellers
                          </h3>
                        </li>
                        {messagesToSellers.map((c) => renderConversationItem(c, 'sellers'))}
                      </>
                    )}
                    {messagesToBuyers.length > 0 && (
                      <>
                        <li className="px-2 py-2 mt-4">
                          <h3 className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">
                            Messages to Buyers
                          </h3>
                        </li>
                        {messagesToBuyers.map((c) => renderConversationItem(c, 'buyers'))}
                      </>
                    )}
                  </>
                );
              })()}
            </ul>
          </aside>

          {/* Main chat pane */}
          <section
            className={
              `col-span-12 md:col-span-8 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ` +
              (isMobileList ? "hidden" : "flex") + " md:flex"
            }
          >
            {/* Header */}
            <div className={`relative border-4 ${headerBgColor} px-5 py-4 overflow-hidden`}>
              <div className="flex items-center justify-between min-w-0">
                <div className="flex flex-col flex-shrink-0">
                  {activeReceiverId ? (
                    <button
                      type="button"
                      onClick={handleProfileHeaderClick}
                      className="text-left text-lg font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                    >
                      <span className="md:hidden">{activeLabelFirstName}</span>
                      <span className="hidden md:inline">{activeLabel}</span>
                    </button>
                  ) : (
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      <span className="md:hidden">{activeLabelFirstName}</span>
                      <span className="hidden md:inline">{activeLabel}</span>
                    </h2>
                  )}
                  <p className="hidden md:block text-xs text-gray-500 dark:text-gray-400">Direct message</p>
                </div>

                {(activeConversation?.productTitle || activeConversation?.productId) && (
                  <div className="flex-1 flex flex-col items-center text-center min-w-0 px-2">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate block w-full">
                      {activeConversation.productTitle || `Item #${activeConversation.productId}`}
                    </h2>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {activeConversation?.productImageUrl && (
                    <div className="inline-flex items-center justify-center h-[44px] w-[44px] rounded-xl border-2 border-gray-300 dark:border-gray-600 overflow-hidden shrink-0 bg-gray-200 dark:bg-gray-700">
                      <img
                        src={activeConversation.productImageUrl.startsWith('http') || activeConversation.productImageUrl.startsWith('/data/images/') || activeConversation.productImageUrl.startsWith('/images/') ? `${API_BASE}/image.php?url=${encodeURIComponent(activeConversation.productImageUrl)}` : activeConversation.productImageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {activeConversation?.productId && (
                    <button
                      onClick={() => {
                        navigate(`/app/viewProduct/${activeConversation.productId}`, {
                          state: { returnTo: `/app/chat?conv=${activeConvId}` }
                        });
                      }}
                      className={`hidden md:flex px-3 py-1.5 text-sm text-white rounded-lg font-medium transition-colors ${
                        isSellerPerspective
                          ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                          : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
                      }`}
                      aria-label="View item"
                    >
                      View Item
                    </button>
                  )}
                  <button
                    onClick={() => { setIsMobileList(true); clearActiveConversation(); }}
                    className="md:hidden rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:shadow transition-all duration-200"
                    aria-label="Back"
                  >
                    Back
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden space-y-2 px-4 py-4"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
            >
              {!activeConvId ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Select a chat to view messages.</p>
                </div>
              ) : chatByConvError[activeConvId] === true ? (
                <p className="text-center text-sm text-red-600 dark:text-red-400">Something went wrong, please try again later</p>
              ) : messagesByConv[activeConvId] === undefined ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400">No messages yet.</p>
              ) : (
                (() => {
                  // Filter out duplicate confirm_request messages if a response exists
                  // Build a map of confirm_request_id to response messages
                  const confirmResponses = new Map();
                  const confirmRequestIds = new Set(); // Track all confirm_request_ids we've seen
                  let latestConfirmAcceptedTs = null;
                  
                  // First pass: identify all confirm_request messages and their IDs
                  messages.forEach((m) => {
                    const metadata = typeof m.metadata === 'string' ? (() => {
                      try { return JSON.parse(m.metadata); } catch { return null; }
                    })() : (m.metadata || null);
                    const messageType = metadata?.type;
                    const confirmRequestId = metadata?.confirm_request_id;
                    
                    if (messageType === 'confirm_request' && confirmRequestId) {
                      confirmRequestIds.add(confirmRequestId);
                    }
                  });
                  
                  // Second pass: identify response messages and map them to request IDs
                  messages.forEach((m) => {
                    const metadata = typeof m.metadata === 'string' ? (() => {
                      try { return JSON.parse(m.metadata); } catch { return null; }
                    })() : (m.metadata || null);
                    const messageType = metadata?.type;
                    const confirmRequestId = metadata?.confirm_request_id;
                    
                    // Check if this is a response message
                    if (confirmRequestId && (
                      messageType === 'confirm_accepted' ||
                      messageType === 'confirm_denied' ||
                      messageType === 'confirm_auto_accepted'
                    )) {
                      // Track that we have a response for this confirm_request_id
                      confirmResponses.set(confirmRequestId, true);
                      
                      // Track the latest confirm_accepted/confirm_auto_accepted timestamp
                      if ((messageType === 'confirm_accepted' || messageType === 'confirm_auto_accepted') && m.ts) {
                        if (!latestConfirmAcceptedTs || m.ts > latestConfirmAcceptedTs) {
                          latestConfirmAcceptedTs = m.ts;
                        }
                      }
                    }
                    
                    // Also check enriched metadata for confirm_purchase_status
                    // This handles cases where backend enriches messages with status
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
                  
                  // Filter messages: hide confirm_request if a response exists for the same confirm_request_id
                  // Also deduplicate: if multiple response messages exist for the same confirm_request_id, keep only the latest one
                  const responseMessagesByRequestId = new Map(); // Track confirm_request_id -> array of response messages
                  
                  // First, collect all response messages grouped by confirm_request_id
                  messages.forEach((m) => {
                    const metadata = typeof m.metadata === 'string' ? (() => {
                      try { return JSON.parse(m.metadata); } catch { return null; }
                    })() : (m.metadata || null);
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
                  
                  // For each confirm_request_id with responses, find the latest one
                  const latestResponseByRequestId = new Map();
                  responseMessagesByRequestId.forEach((responseMessages, confirmRequestId) => {
                    // Sort by timestamp descending and take the first (latest) one
                    const sorted = responseMessages.sort((a, b) => {
                      const tsA = a.ts || 0;
                      const tsB = b.ts || 0;
                      return tsB - tsA; // Descending order
                    });
                    latestResponseByRequestId.set(confirmRequestId, sorted[0]);
                  });
                  
                  // Now filter messages
                  let filteredMessages = messages.filter((m) => {
                    const metadata = typeof m.metadata === 'string' ? (() => {
                      try { return JSON.parse(m.metadata); } catch { return null; }
                    })() : (m.metadata || null);
                    const messageType = metadata?.type;
                    const confirmRequestId = metadata?.confirm_request_id;
                    
                    // If this is a confirm_request and we have a response for it, hide it
                    // This ensures only the response message (confirm_accepted/confirm_denied) is shown
                    if (messageType === 'confirm_request' && confirmRequestId && confirmResponses.has(confirmRequestId)) {
                      return false; // Hide this message
                    }
                    
                    // If this is a response message, only show it if it's the latest one for this confirm_request_id
                    if (confirmRequestId && (
                      messageType === 'confirm_accepted' ||
                      messageType === 'confirm_denied' ||
                      messageType === 'confirm_auto_accepted'
                    )) {
                      const latestResponse = latestResponseByRequestId.get(confirmRequestId);
                      // Only show this message if it's the latest one (same message object reference)
                      return latestResponse === m;
                    }
                    
                    return true; // Show this message
                  });
                  
                  // Insert virtual messages for review/rating prompts right after the latest confirm_accepted message
                  if (latestConfirmAcceptedTs !== null && hasAcceptedConfirm && activeConversation?.productId) {
                    const virtualMessages = [];
                    
                    // Add review prompt for buyers
                    if (shouldShowReviewPrompt) {
                      virtualMessages.push({
                        message_id: `review_prompt_${activeConversation.productId}`,
                        sender: 'system',
                        content: '',
                        ts: latestConfirmAcceptedTs + 1, // Place right after confirm_accepted
                        metadata: {
                          type: 'review_prompt'
                        }
                      });
                    }
                    
                    // Add buyer rating prompt for sellers
                    if (shouldShowBuyerRatingPrompt && activeReceiverId) {
                      virtualMessages.push({
                        message_id: `buyer_rating_prompt_${activeConversation.productId}_${activeReceiverId}`,
                        sender: 'system',
                        content: '',
                        ts: latestConfirmAcceptedTs + 2, // Place after review prompt if both exist
                        metadata: {
                          type: 'buyer_rating_prompt'
                        }
                      });
                    }
                    
                    // Insert virtual messages into the array and sort by timestamp
                    filteredMessages = [...filteredMessages, ...virtualMessages].sort((a, b) => {
                      const tsA = a.ts || 0;
                      const tsB = b.ts || 0;
                      if (tsA !== tsB) return tsA - tsB;
                      // If timestamps are equal, ensure virtual messages come after regular messages
                      const aMsgId = String(a.message_id || '');
                      const bMsgId = String(b.message_id || '');
                      const aIsVirtual = aMsgId.startsWith('review_prompt_') || aMsgId.startsWith('buyer_rating_prompt_');
                      const bIsVirtual = bMsgId.startsWith('review_prompt_') || bMsgId.startsWith('buyer_rating_prompt_');
                      if (aIsVirtual && !bIsVirtual) return 1;
                      if (!aIsVirtual && bIsVirtual) return -1;
                      return 0;
                    });
                  }
                  
                  return filteredMessages;
                })().map((m) => {
                  /** Categorize message type: basic, schedule, confirm, listing intro, or next steps */
                  // Handle metadata that might be a string or object
                  const metadata = typeof m.metadata === 'string' ? (() => {
                    try { return JSON.parse(m.metadata); } catch { return null; }
                  })() : (m.metadata || null);
                  const messageType = metadata?.type;
                  const isScheduleMessage = messageType === 'schedule_request' ||
                                            messageType === 'schedule_accepted' ||
                                            messageType === 'schedule_denied' ||
                                            messageType === 'schedule_cancelled';
                  // Check if this is a confirm message type
                  const isConfirmMessageType = messageType === 'confirm_request' ||
                                              messageType === 'confirm_accepted' ||
                                              messageType === 'confirm_denied' ||
                                              messageType === 'confirm_auto_accepted';
                  
                  // Validate confirm message metadata - must match ConfirmMessageCard's early return logic exactly
                  // ConfirmMessageCard returns null if: !messageType || (messageType === 'confirm_request' && !confirmRequestId)
                  const confirmRequestId = metadata?.confirm_request_id;
                  const wouldConfirmCardReturnNull = !messageType || (messageType === 'confirm_request' && !confirmRequestId);
                  
                  // Only treat as valid confirm message if it's a confirm type AND would not return null
                  const isConfirmMessage = isConfirmMessageType && !wouldConfirmCardReturnNull;
                  const isNextStepsMessage = messageType === 'next_steps';
                  const isReviewPrompt = messageType === 'review_prompt';
                  const isBuyerRatingPrompt = messageType === 'buyer_rating_prompt';
                  const isItemDeletedMessage = messageType === 'item_deleted';

                  // Ensure message has parsed metadata
                  const messageWithMetadata = metadata ? { ...m, metadata } : m;
                  
                  // Skip rendering entirely if this is an invalid confirm message (would return null)
                  // This prevents wrapper div creation and whitespace
                  if (isConfirmMessageType && wouldConfirmCardReturnNull) {
                    return null;
                  }
                  
                  // Handle virtual prompt messages
                  if (isReviewPrompt) {
                    return (
                      <div key={m.message_id}>
                        <ReviewPromptMessageCard
                          productId={activeConversation?.productId}
                          productTitle={activeConversation?.productTitle}
                        />
                      </div>
                    );
                  }
                  
                  if (isBuyerRatingPrompt) {
                    return (
                      <div key={m.message_id}>
                        <BuyerRatingPromptMessageCard
                          productId={activeConversation?.productId}
                          productTitle={activeConversation?.productTitle}
                          buyerId={activeReceiverId}
                        />
                      </div>
                    );
                  }
                  
                  return (
                    <div key={m.message_id}>
                      {isNextStepsMessage ? (
                        <NextStepsMessageCard message={messageWithMetadata} />
                      ) : isItemDeletedMessage ? (
                        <div className="flex justify-center my-2">
                          <div className="max-w-[85%] rounded-2xl border-2 border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 overflow-hidden">
                            <div className="p-4">
                              <div className="flex items-start gap-2">
                                <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">Item Removed</p>
                                  <p className="text-sm text-red-700 dark:text-red-300">
                                    This chat has been closed.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className={m.sender === "me" ? "flex justify-end" : "flex justify-start"}>
                          {messageType === "listing_intro" ? (
                            <MessageCard message={messageWithMetadata} isMine={m.sender === "me"} />
                          ) : isScheduleMessage ? (
                            <ScheduleMessageCard
                              message={messageWithMetadata}
                              isMine={m.sender === "me"}
                              onRespond={async () => {
                                if (activeConvId) {
                                  await fetchConversation(activeConvId);
                                  const controller = new AbortController();
                                  await checkActiveScheduledPurchase(controller.signal);
                                  await checkConfirmStatus(controller.signal);
                                }
                              }}
                            />
                          ) : isConfirmMessage ? (
                            <ConfirmMessageCard
                              message={messageWithMetadata}
                              isMine={m.sender === "me"}
                              onRespond={async () => {
                                if (activeConvId) {
                                  await fetchConversation(activeConvId);
                                  const controller = new AbortController();
                                  await checkConfirmStatus(controller.signal);
                                }
                              }}
                            />
                          ) : (
                            messageWithMetadata.image_url ? (
                              <div
                                className={
                                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow " +
                                  (m.sender === "me" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-900")
                                }
                              >
                                {(() => {
                                  const imgSrc = `${API_BASE}/chat/serve_chat_image.php?message_id=${m.message_id}`;
                                  const dlSrc  = `${imgSrc}&download=1`;
                                  return (
                                    <>
                                      <a 
                                        href={imgSrc} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="block"
                                        title="Chat Image - Click to view full size"
                                      >
                                        <img
                                          src={imgSrc}
                                          alt="Image attachment"
                                          className={
                                            "max-h-72 w-full object-contain rounded-lg " +
                                            (m.sender === "me" ? "bg-white/10" : "bg-black/5")
                                          }
                                        />
                                      </a>
                                      {m.content && (
                                        <p className="mt-2 whitespace-pre-wrap break-words">{m.content}</p>
                                      )}
                                      <div
                                        className={
                                          "mt-1 flex items-center justify-between text-[10px] " +
                                          (m.sender === "me" ? "text-indigo-100" : "text-gray-500 dark:text-gray-400")
                                        }
                                      >
                                        <span>{fmtTime(m.ts)}</span>
                                        <a
                                          href={dlSrc}
                                          className={
                                            "ml-3 underline hover:no-underline " +
                                            (m.sender === "me" ? "text-indigo-100" : "text-gray-600 dark:text-gray-400")
                                          }
                                        >
                                          Download
                                        </a>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            ) : (
                              <div
                                className={
                                  "max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow " +
                                  (m.sender === "me" ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100")
                                }
                              >
                                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                                <div className={"mt-1 text-[10px] " + (m.sender === "me" ? "text-indigo-100" : "text-gray-500 dark:text-gray-400")}>
                                  {fmtTime(m.ts)}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {isOtherPersonTyping && activeConvId && (
                <TypingIndicatorMessage 
                  firstName={typingUserName} 
                />
              )}
            </div>

            {/* Composer */}
            <div className={`sticky bottom-0 z-10 border-t border-gray-200 dark:border-gray-700 p-4 relative ${activeConversation?.item_deleted ? 'bg-gray-100 dark:bg-gray-700' : 'bg-white dark:bg-gray-800'}`}>
              {/* Overlay to block all interactions when item is deleted */}
              {activeConversation?.item_deleted && (
                <div className="absolute inset-0 z-50 bg-gray-100 dark:bg-gray-700 opacity-90 cursor-not-allowed" 
                     onClick={(e) => e.preventDefault()}
                     onMouseDown={(e) => e.preventDefault()}
                     onKeyDown={(e) => e.preventDefault()}
                     style={{ pointerEvents: 'all' }}
                     aria-label="Chat is closed">
                </div>
              )}
              {isSellerPerspective && activeConversation?.productId && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSchedulePurchase}
                    disabled={hasActiveScheduledPurchase}
                    className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
                      hasActiveScheduledPurchase
                        ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white'
                        : 'bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-600 text-white'
                    }`}
                    title={hasActiveScheduledPurchase ? 'There is already a Scheduled Purchase for this item' : ''}
                  >
                    Schedule Purchase
                  </button>

                  <button
                    onClick={handleConfirmPurchase}
                    disabled={confirmButtonDisabled}
                    className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
                      confirmButtonDisabled
                        ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white'
                    }`}
                    title={confirmButtonTitle}
                  >
                    Confirm Purchase
                  </button>

                  {confirmState && confirmState.message && !confirmState.can_confirm && (
                    <p className="hidden md:block w-full text-xs text-gray-500 dark:text-gray-400">
                      {confirmState.message}
                    </p>
                  )}
                </div>
              )}

              {attachedImage && (
                <div className="mb-1 flex items-center justify-between rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40 px-3 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <circle cx="8.5" cy="10" r="1.6" />
                      <path d="M21 16l-5.5-5.5L9 17l-3-3-3 3" />
                    </svg>
                    <span className="truncate text-xs text-gray-700 dark:text-gray-200">{attachedImage.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedImage(null)}
                    className="rounded-md p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                    aria-label="Remove attached image"
                    title="Remove"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!activeConversation?.item_deleted) {
                      setAttachOpen(true);
                    }
                  }}
                  disabled={activeConversation?.item_deleted}
                  aria-label="Attach a file"
                  aria-haspopup="dialog"
                  aria-expanded={attachOpen}
                  className={`inline-flex items-center justify-center h-[44px] w-[44px] rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0 ${activeConversation?.item_deleted ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                  title={activeConversation?.item_deleted ? 'Item has been deleted' : 'Attach'}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <circle cx="8.5" cy="10" r="1.6" />
                    <path d="M21 16l-5.5-5.5L9 17l-3-3-3 3" />
                  </svg>
                </button>

                <div className="relative w-full">
                  <div className="flex items-end gap-2">
                    {activeConversation?.item_deleted ? (
                      <div className="relative w-full">
                        <div className="w-full h-auto rounded-xl border-2 border-gray-300 dark:border-gray-600 px-3 py-2.5 pr-12 text-sm leading-5 min-h-[44px] bg-gray-300 dark:bg-gray-800 text-gray-500 dark:text-gray-500 cursor-not-allowed opacity-80 flex items-center pointer-events-none">
                          <span>This chat has been closed.</span>
                        </div>
                      </div>
                    ) : (
                      <div className="relative w-full">
                        <textarea
                          ref={taRef}
                          value={draft}
                          onChange={handleDraftChange}
                          onInput={autoGrow}
                          onKeyDown={handleKeyDown}
                          placeholder="Type a message…"
                          rows={1}
                          maxLength={MAX_LEN}
                          aria-describedby="message-char-remaining"
                          wrap="soft"
                          className="w-full h-auto resize-none rounded-xl border-2 border-gray-300 dark:border-gray-600 px-3 py-2.5 pr-12 text-sm leading-5 min-h-[44px] whitespace-pre-wrap break-words overflow-y-hidden max-h-[28vh] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                          aria-label="Message input"
                        />
                        <span id="message-char-remaining" className="pointer-events-none absolute right-3 bottom-2 text-xs text-gray-500 dark:text-gray-400">
                          {MAX_LEN - draft.length}
                        </span>
                      </div>
                    )}
                  </div>

                  <ImageModal
                    open={attachOpen}
                    onClose={() => setAttachOpen(false)}
                    onSelect={(file) => {
                      // Prevent attaching if item is deleted
                      if (activeConversation?.item_deleted) {
                        setAttachOpen(false);
                        return;
                      }
                      // On mobile, auto-send the image immediately
                      const isMobile = window.innerWidth < 768; // md breakpoint
                      if (isMobile) {
                        handleCreateImageMessage(draft, file);
                        setDraft("");
                        setAttachedImage(null);
                      } else {
                        setAttachedImage(file);
                      }
                      setAttachOpen(false);
                    }}
                  />
                </div>
              </div>
            </div>

          </section>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleDeleteCancel}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Delete Conversation?</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">Are you sure you want to delete this conversation?</p>
              <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-4">Warning: All scheduled purchases associated with this conversation will also be deleted.</p>
              {deleteError && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{deleteError}</p>}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleDeleteCancel}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
