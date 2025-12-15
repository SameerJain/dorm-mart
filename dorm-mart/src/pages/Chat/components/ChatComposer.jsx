import { useCallback } from "react";
import ImageModal from "./ImageModal";

/**
 * Chat composer component for typing and sending messages
 */
export default function ChatComposer({
  draft,
  setDraft,
  attachedImage,
  setAttachedImage,
  attachOpen,
  setAttachOpen,
  activeConversation,
  isSellerPerspective,
  hasActiveScheduledPurchase,
  confirmButtonDisabled,
  confirmButtonTitle,
  confirmState,
  onSchedulePurchase,
  onConfirmPurchase,
  onCreateMessage,
  onCreateImageMessage,
  handleDraftChange,
  handleKeyDown,
  taRef,
  autoGrow,
  MAX_LEN
}) {
  const handleImageSelect = useCallback((file) => {
    if (activeConversation?.item_deleted) {
      setAttachOpen(false);
      return;
    }
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      onCreateImageMessage(draft, file);
      setDraft("");
      setAttachedImage(null);
    } else {
      setAttachedImage(file);
    }
    setAttachOpen(false);
  }, [activeConversation?.item_deleted, draft, onCreateImageMessage, setDraft, setAttachedImage, setAttachOpen]);

  return (
    <div className={`sticky bottom-0 z-10 border-t border-gray-200 dark:border-gray-700 p-4 relative ${activeConversation?.item_deleted ? 'bg-gray-100 dark:bg-gray-700' : 'bg-white dark:bg-gray-800'}`}>
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
            onClick={onSchedulePurchase}
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
            onClick={onConfirmPurchase}
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
            onSelect={handleImageSelect}
          />
        </div>
      </div>
    </div>
  );
}



