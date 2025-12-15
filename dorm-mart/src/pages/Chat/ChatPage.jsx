import { useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ChatContext } from "../../context/ChatContext";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { getApiBase } from "../../utils/api";
import ChatSidebar from "./components/ChatSidebar";
import ChatHeader from "./components/ChatHeader";
import ChatMessageList from "./components/ChatMessageList";
import ChatComposer from "./components/ChatComposer";
import { useUsernameMapping } from "./hooks/useUsernameMapping";
import { useTypingStatus } from "./hooks/useTypingStatus";
import { useMessageFiltering } from "./hooks/useMessageFiltering";

/** Root Chat page: wires context, sidebar, messages, and composer together */
export default function ChatPage() {
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
  const taRef = useRef(null);
  const [draft, setDraft] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteConvId, setPendingDeleteConvId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [attachedImage, setAttachedImage] = useState(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [hasActiveScheduledPurchase, setHasActiveScheduledPurchase] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(null);
  const [isMobileList, setIsMobileList] = useState(true);

  const navigate = useNavigate();
  const location = useLocation();
  const navigationState = location.state && typeof location.state === "object" ? location.state : null;
  const activeConversation = conversations.find((c) => c.conv_id === activeConvId);

  // Use extracted hooks
  const { usernameMap, ensureUsername } = useUsernameMapping();
  const { handleDraftChange, stopTypingStatus } = useTypingStatus(activeConvId, conversations, setDraft, taRef);

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

  // Auto-resize textarea
  const autoGrow = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.style.overflowY = el.scrollHeight > el.clientHeight ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    autoGrow();
  }, [draft, autoGrow]);

  // Clear draft when item is deleted
  useEffect(() => {
    if (activeConversation?.item_deleted) {
      setDraft('');
      if (taRef.current) {
        taRef.current.value = '';
        taRef.current.blur();
        taRef.current.disabled = true;
        taRef.current.readOnly = true;
      }
    } else {
      if (taRef.current) {
        taRef.current.disabled = false;
        taRef.current.readOnly = false;
      }
    }
  }, [activeConversation?.item_deleted]);

  // Compute header label
  const activeLabel = useMemo(() => {
    const c = conversations.find((c) => c.conv_id === activeConvId);
    if (c) return c.receiverName;
    if (navigationState?.receiverName) return navigationState.receiverName;
    if (navigationState?.receiverId) return `User ${navigationState.receiverId}`;
    return "Select a chat";
  }, [conversations, activeConvId, navigationState]);

  const activeLabelFirstName = useMemo(() => {
    if (!activeLabel || activeLabel === "Select a chat") return activeLabel;
    return activeLabel.split(' ')[0];
  }, [activeLabel]);

  const { firstName: activeFirstName, lastName: activeLastName } = useMemo(() => {
    if (!activeLabel || activeLabel === "Select a chat") {
      return { firstName: activeLabel, lastName: '' };
    }
    const parts = activeLabel.trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    return { firstName, lastName };
  }, [activeLabel]);

  const activeReceiverId = activeConversation?.receiverId ?? navigationState?.receiverId ?? null;
  const activeReceiverUsername = activeReceiverId ? usernameMap[activeReceiverId] : null;
  const activeProfilePath = activeReceiverUsername
    ? `/app/profile?username=${encodeURIComponent(activeReceiverUsername)}`
    : null;

  // Ensure usernames are fetched
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
    // Fetch username if not cached
    ensureUsername(activeReceiverId);
  }, [activeReceiverId, activeProfilePath, navigate, ensureUsername]);

  // Handle deep-link via ?conv=ID
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

  useEffect(() => {
    if (activeConvId) setIsMobileList(false);
  }, [activeConvId]);

  // Typing status from context
  const typingStatus = activeConvId ? (typingStatusByConv[activeConvId] || { is_typing: false, typing_user_first_name: null }) : null;
  const isOtherPersonTyping = typingStatus?.is_typing || false;
  const typingUserName = typingStatus?.typing_user_first_name || null;

  // Determine seller perspective
  const isSellerPerspective = activeConversation?.productId && activeConversation?.productSellerId && myId &&
    Number(activeConversation.productSellerId) === Number(myId);

  // Use message filtering hook (includes parseMetadata and computed flags)
  const { filteredMessages, parseMetadata, hasAcceptedConfirm, shouldShowReviewPrompt, shouldShowBuyerRatingPrompt } = useMessageFiltering(
    messages,
    isSellerPerspective,
    activeConversation?.productId,
    activeReceiverId
  );

  const headerBgColor = isSellerPerspective
    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
    : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";

  const confirmState = isSellerPerspective
    ? (confirmStatus ?? { can_confirm: false, message: 'Checking Confirm Purchase status…' })
    : null;

  const confirmButtonDisabled = confirmState ? !confirmState.can_confirm : true;
  const confirmButtonTitle = confirmState?.message || '';

  // Check active scheduled purchase
  const checkActiveScheduledPurchase = useCallback(async (signal) => {
    const productId = activeConversation?.productId;
    const sellerView = activeConversation?.productId && activeConversation?.productSellerId && myId &&
      Number(activeConversation.productSellerId) === Number(myId);
    if (!productId || !sellerView) {
      setHasActiveScheduledPurchase(false);
      return;
    }
    try {
      const res = await fetch(`${getApiBase()}/scheduled-purchases/check_active.php`, {
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

  // Check confirm status
  const checkConfirmStatus = useCallback(async (signal) => {
    if (!activeConvId || !activeConversation?.productId || !isSellerPerspective) {
      setConfirmStatus(null);
      return;
    }
    try {
      const res = await fetch(`${getApiBase()}/confirm-purchases/status.php`, {
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

  useEffect(() => {
    const controller = new AbortController();
    checkActiveScheduledPurchase(controller.signal);
    return () => controller.abort();
  }, [checkActiveScheduledPurchase]);

  useEffect(() => {
    const controller = new AbortController();
    checkConfirmStatus(controller.signal);
    return () => controller.abort();
  }, [checkConfirmStatus]);

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

  function handleSchedulePurchase() {
    if (!activeConvId || !activeConversation?.productId || hasActiveScheduledPurchase) return;
    navigate("/app/seller-dashboard/schedule-purchase", {
      state: { convId: activeConvId, productId: activeConversation.productId }
    });
  }

  function handleConfirmPurchase() {
    if (!activeConvId || !activeConversation?.productId) return;
    navigate("/app/seller-dashboard/confirm-purchase", {
      state: { convId: activeConvId, productId: activeConversation.productId }
    });
  }

  function handleDeleteClick(convId, e) {
    e.stopPropagation();
    setPendingDeleteConvId(convId);
    setDeleteConfirmOpen(true);
    setDeleteError('');
  }

  async function handleDeleteConfirm() {
    if (!pendingDeleteConvId || isDeleting) return;

    const convId = pendingDeleteConvId;
    const wasActive = convId === activeConvId;

    removeConversationLocal(convId);
    if (wasActive) {
      clearActiveConversation();
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      const res = await fetch(`${getApiBase()}/chat/delete_conversation.php`, {
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
    } catch (error) {
      setDeleteError(error.message || 'Failed to delete conversation. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }

  function handleDeleteCancel() {
    setDeleteConfirmOpen(false);
    setPendingDeleteConvId(null);
    setDeleteError('');
  }

  const handleCreateMessage = useCallback((content) => {
    if (activeConversation?.item_deleted) {
      return;
    }
    createMessage(content);
  }, [activeConversation?.item_deleted, createMessage]);

  const handleCreateImageMessage = useCallback((content, file) => {
    if (activeConversation?.item_deleted) {
      return;
    }
    createImageMessage(content, file);
  }, [activeConversation?.item_deleted, createImageMessage]);

  function handleKeyDown(e) {
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
      stopTypingStatus(activeConvId);
    }
  }

  return (
    <div className="h-[100dvh] md:h-[calc(100dvh-var(--nav-h))] w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100" style={{ "--nav-h": "64px" }}>
      <div className="mx-auto h-full max-w-[1200px] px-4 py-6">
        <div className="grid h-full grid-cols-12 gap-4">
          <ChatSidebar
            conversations={conversations}
            activeConvId={activeConvId}
            unreadMsgByConv={unreadMsgByConv}
            myId={myId}
            messages={messages}
            onConversationClick={(convId) => {
              fetchConversation(convId);
              setIsMobileList(false);
            }}
            onDeleteClick={handleDeleteClick}
            isMobileList={isMobileList}
            convError={convError}
          />

          <section
            className={
              `col-span-12 md:col-span-8 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ` +
              (isMobileList ? "hidden" : "flex") + " md:flex"
            }
          >
            <ChatHeader
              activeReceiverId={activeReceiverId}
              activeLabel={activeLabel}
              activeLabelFirstName={activeLabelFirstName}
              activeFirstName={activeFirstName}
              activeLastName={activeLastName}
              activeConversation={activeConversation}
              isSellerPerspective={isSellerPerspective}
              onProfileClick={handleProfileHeaderClick}
              onBackClick={() => { setIsMobileList(true); clearActiveConversation(); }}
              headerBgColor={headerBgColor}
              isMobileList={isMobileList}
            />

            <ChatMessageList
              scrollRef={scrollRef}
              activeConvId={activeConvId}
              conversations={conversations}
              messagesByConv={messagesByConv}
              chatByConvError={chatByConvError}
              filteredMessages={filteredMessages}
              activeConversation={activeConversation}
              activeReceiverId={activeReceiverId}
              isOtherPersonTyping={isOtherPersonTyping}
              typingUserName={typingUserName}
              parseMetadata={parseMetadata}
              fetchConversation={fetchConversation}
              checkActiveScheduledPurchase={checkActiveScheduledPurchase}
              checkConfirmStatus={checkConfirmStatus}
            />

            <ChatComposer
              draft={draft}
              setDraft={setDraft}
              attachedImage={attachedImage}
              setAttachedImage={setAttachedImage}
              attachOpen={attachOpen}
              setAttachOpen={setAttachOpen}
              activeConversation={activeConversation}
              isSellerPerspective={isSellerPerspective}
              hasActiveScheduledPurchase={hasActiveScheduledPurchase}
              confirmButtonDisabled={confirmButtonDisabled}
              confirmButtonTitle={confirmButtonTitle}
              confirmState={confirmState}
              onSchedulePurchase={handleSchedulePurchase}
              onConfirmPurchase={handleConfirmPurchase}
              onCreateMessage={handleCreateMessage}
              onCreateImageMessage={handleCreateImageMessage}
              handleDraftChange={handleDraftChange}
              handleKeyDown={handleKeyDown}
              taRef={taRef}
              autoGrow={autoGrow}
              MAX_LEN={MAX_LEN}
            />
          </section>
        </div>
      </div>

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

