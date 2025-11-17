import { useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ChatContext } from "../../context/ChatContext";
import fmtTime from "./chat_page_utils";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import MessageCard from "./components/MessageCard";
import ScheduleMessageCard from "./components/ScheduleMessageCard";
import ImageModal from "./components/ImageModal";
import ConfirmMessageCard from "./components/ConfirmMessageCard";
import ProfileLink from "../../components/ProfileLink";

const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const API_BASE = (process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`).replace(/\/$/, "");

/** Root Chat page: wires context, sidebar, messages, and composer together */
export default function ChatPage() {
  /** Chat global state and actions from context */
  const ctx = useContext(ChatContext);
  const {
    conversations,
    activeConvId,
    messages,
    messagesByConv,
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
  const [attachedImage, setAttachedImage] = useState(null);
  const [hasActiveScheduledPurchase, setHasActiveScheduledPurchase] = useState(false);

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

  /** Compute header label for the active chat */
  const activeLabel = useMemo(() => {
    const c = conversations.find((c) => c.conv_id === activeConvId);
    if (c) return c.receiverName;
    if (navigationState?.receiverName) return navigationState.receiverName;
    if (navigationState?.receiverId) return `User ${navigationState.receiverId}`;
    return "Select a chat";
  }, [conversations, activeConvId, navigationState]);

  /** Mobile back button handler: go back or to /app as fallback */
  function goBackOrHome() {
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate("/app");
    }
  }

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

  /** Auto-scroll to bottom when active conversation or messages change */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeConvId, messages.length]);

  /** Keydown handler for textarea: submit on Enter (without Shift) */
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (attachedImage) {
        createImageMessage(draft, attachedImage);
      } else {
        createMessage(draft);
      }
      setDraft("");
      setAttachedImage(null);
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

  /** Lookup for active conversation object */
  const activeConversation = conversations.find(c => c.conv_id === activeConvId);

  /** Detect listing intro message and whether current user is seller */
  const hasListingIntro = messages.some(m => m.metadata?.type === "listing_intro");
  const listingIntroMsg = messages.find(m => m.metadata?.type === "listing_intro");
  const isSeller = hasListingIntro && listingIntroMsg && listingIntroMsg.sender === "them";

  /** Determine if current user is the seller (seller perspective) */
  const isSellerPerspective = activeConversation?.productId && activeConversation?.productSellerId && myId &&
    Number(activeConversation.productSellerId) === Number(myId);

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
          buttonColorClass = "bg-indigo-50 text-indigo-700";
        }
      } else {
        buttonColorClass = "bg-indigo-50 text-indigo-700";
      }
    }
    const hoverColor = sectionType === 'buyers' ? "hover:bg-green-600" : "hover:bg-blue-600";

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
            <ProfileLink
              fallback={c.receiverName}
              className="truncate text-sm font-medium"
              hoverClass="hover:text-blue-600"
            >
              {c.receiverName}
            </ProfileLink>
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
    <div className="h-[calc(100dvh-var(--nav-h))] w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100" style={{ "--nav-h": "64px" }}>
      <div className="mx-auto h-full max-w-[1200px] px-4 py-6">
        <div className="grid h-full grid-cols-12 gap-4">
          {/* Sidebar */}
          <aside
            className={
              `col-span-12 md:col-span-3 rounded-2xl border-4 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ` +
              (isMobileList ? "block" : "hidden") + " md:block"
            }
          >
            <div className="border-b-4 border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Chats</h2>
              <button
                onClick={goBackOrHome}
                className="md:hidden rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm text-gray-700 dark:text-gray-200"
                aria-label="Back to previous page"
              >
                Back
              </button>
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
            <div className={`relative border-4 ${headerBgColor} px-5 py-4`}>
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  {activeConvId ? (
                    <ProfileLink
                      fallback={activeLabel}
                      className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                    >
                      {activeLabel}
                    </ProfileLink>
                  ) : (
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{activeLabel}</h2>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400">Direct message</p>
                </div>

                {(activeConversation?.productTitle || activeConversation?.productId) && (
                  <div className="flex-1 flex flex-col items-center text-center">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {activeConversation.productTitle || `Item #${activeConversation.productId}`}
                    </h2>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {activeConversation?.productImageUrl && (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700">
                      <img
                        src={activeConversation.productImageUrl.startsWith('http') || activeConversation.productImageUrl.startsWith('/data/images/') || activeConversation.productImageUrl.startsWith('/images/') ? `${API_BASE}/image.php?url=${encodeURIComponent(activeConversation.productImageUrl)}` : activeConversation.productImageUrl}
                        alt={activeConversation.productTitle || 'Product'}
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
                      className={`px-3 py-1.5 text-sm text-white rounded-lg font-medium transition-colors ${
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
                    className="md:hidden rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm text-gray-700 dark:text-gray-200"
                    aria-label="Back to conversations"
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
                  <p className="text-sm text-gray-500">Select a chat to view messages.</p>
                </div>
              ) : chatByConvError[activeConvId] === true ? (
                <p className="text-center text-sm text-red-600 dark:text-red-400">Something went wrong, please try again later</p>
              ) : messagesByConv[activeConvId] === undefined ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-gray-500">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-gray-500">No messages yet.</p>
              ) : (
                messages.map((m) => {
                  /** Categorize message type: basic, schedule, confirm, or listing intro */
                  const messageType = m.metadata?.type;
                  const isScheduleMessage = messageType === 'schedule_request' ||
                                            messageType === 'schedule_accepted' ||
                                            messageType === 'schedule_denied' ||
                                            messageType === 'schedule_cancelled';
                  const isConfirmMessage = messageType === 'confirm_request' ||
                                           messageType === 'confirm_accepted' ||
                                           messageType === 'confirm_denied' ||
                                           messageType === 'confirm_auto_accepted';

                  return (
                    <div key={m.message_id} className={m.sender === "me" ? "flex justify-end" : "flex justify-start"}>
                      {messageType === "listing_intro" ? (
                        <MessageCard message={m} isMine={m.sender === "me"} />
                      ) : isScheduleMessage ? (
                        <ScheduleMessageCard
                          message={m}
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
                          message={m}
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
                        m.image_url ? (
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
                                  <a href={imgSrc} target="_blank" rel="noopener noreferrer" className="block">
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
                                      (m.sender === "me" ? "text-indigo-100" : "text-gray-500")
                                    }
                                  >
                                    <span>{fmtTime(m.ts)}</span>
                                    <a
                                      href={dlSrc}
                                      className={
                                        "ml-3 underline hover:no-underline " +
                                        (m.sender === "me" ? "text-indigo-100" : "text-gray-600")
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
                              (m.sender === "me" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-900")
                            }
                          >
                            <p className="whitespace-pre-wrap break-words">{m.content}</p>
                            <div className={"mt-1 text-[10px] " + (m.sender === "me" ? "text-indigo-100" : "text-gray-500")}>
                              {fmtTime(m.ts)}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Composer */}
            <div className="sticky bottom-0 z-10 border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
              {isSellerPerspective && activeConversation?.productId && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSchedulePurchase}
                    disabled={hasActiveScheduledPurchase}
                    className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
                      hasActiveScheduledPurchase
                        ? 'bg-gray-400 cursor-not-allowed text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
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
                        ? 'bg-gray-400 cursor-not-allowed text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                    title={confirmButtonTitle}
                  >
                    Confirm Purchase
                  </button>

                  {confirmState && confirmState.message && !confirmState.can_confirm && (
                    <p className="w-full text-xs text-gray-500 dark:text-gray-400">
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
                  onClick={() => setAttachOpen(true)}
                  aria-label="Attach a file"
                  aria-haspopup="dialog"
                  aria-expanded={attachOpen}
                  className="inline-flex items-center justify-center h-[44px] w-[44px] rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
                  title="Attach"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <circle cx="8.5" cy="10" r="1.6" />
                    <path d="M21 16l-5.5-5.5L9 17l-3-3-3 3" />
                  </svg>
                </button>

                <div className="relative w-full">
                  <div className="flex items-end gap-2">
                    <div className="relative w-full">
                      <textarea
                        ref={taRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onInput={autoGrow}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message…"
                        rows={1}
                        maxLength={MAX_LEN}
                        aria-describedby="message-char-remaining"
                        wrap="soft"
                        className="w-full h-auto resize-none rounded-xl border-2 border-gray-300 dark:border-gray-600 px-3 py-2.5 pr-12 text-sm leading-5 min-h-[44px] focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words overflow-y-hidden max-h-[28vh]"
                        aria-label="Message input"
                      />
                      <span id="message-char-remaining" className="pointer-events-none absolute right-3 bottom-2 text-xs text-gray-500 dark:text-gray-400">
                        {MAX_LEN - draft.length}
                      </span>
                    </div>
                  </div>

                  <ImageModal
                    open={attachOpen}
                    onClose={() => setAttachOpen(false)}
                    onSelect={(file) => {
                      setAttachedImage(file);
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
