import { useRef, useEffect } from "react";
import MessageCard from "./MessageCard";
import ScheduleMessageCard from "./ScheduleMessageCard";
import NextStepsMessageCard from "./NextStepsMessageCard";
import ConfirmMessageCard from "./ConfirmMessageCard";
import ReviewPromptMessageCard from "./ReviewPromptMessageCard";
import BuyerRatingPromptMessageCard from "./BuyerRatingPromptMessageCard";
import TypingIndicatorMessage from "./TypingIndicatorMessage";
import fmtTime from "../chat_page_utils";
import { getApiBase } from "../../../utils/api";

/**
 * Chat message list component
 */
export default function ChatMessageList({
  scrollRef,
  activeConvId,
  conversations,
  messagesByConv,
  chatByConvError,
  filteredMessages,
  activeConversation,
  activeReceiverId,
  isOtherPersonTyping,
  typingUserName,
  parseMetadata,
  fetchConversation,
  checkActiveScheduledPurchase,
  checkConfirmStatus
}) {
  const messages = messagesByConv[activeConvId] || [];

  // Auto-scroll to bottom when active conversation or messages change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    const rafId = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    
    return () => cancelAnimationFrame(rafId);
  }, [activeConvId, messages.length, scrollRef]);

  // Auto-scroll to bottom when typing indicator appears
  useEffect(() => {
    if (isOtherPersonTyping) {
      const rafId = requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [isOtherPersonTyping, scrollRef]);

  if (!activeConvId) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        {conversations.length === 0 ? (
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 text-center font-medium">
            Any chats with users will be displayed here
          </p>
        ) : (
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 text-center">
            Select a chat to view messages.
          </p>
        )}
      </div>
    );
  }

  if (chatByConvError[activeConvId] === true) {
    return (
      <p className="text-center text-sm text-red-600 dark:text-red-400">
        Something went wrong, please try again later
      </p>
    );
  }

  if (messagesByConv[activeConvId] === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading messages...</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <p className="text-center text-sm text-gray-500 dark:text-gray-400">No messages yet.</p>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden space-y-2 px-4 py-4"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {filteredMessages.map((m) => {
        const metadata = m.parsedMetadata || parseMetadata(m.metadata);
        const messageType = metadata?.type;
        const isScheduleMessage = messageType === 'schedule_request' ||
                                  messageType === 'schedule_accepted' ||
                                  messageType === 'schedule_denied' ||
                                  messageType === 'schedule_cancelled';
        const isConfirmMessageType = messageType === 'confirm_request' ||
                                    messageType === 'confirm_accepted' ||
                                    messageType === 'confirm_denied' ||
                                    messageType === 'confirm_auto_accepted';
        
        const confirmRequestId = metadata?.confirm_request_id;
        const wouldConfirmCardReturnNull = !messageType || (messageType === 'confirm_request' && !confirmRequestId);
        const isConfirmMessage = isConfirmMessageType && !wouldConfirmCardReturnNull;
        const isNextStepsMessage = messageType === 'next_steps';
        const isReviewPrompt = messageType === 'review_prompt';
        const isBuyerRatingPrompt = messageType === 'buyer_rating_prompt';
        const isItemDeletedMessage = messageType === 'item_deleted';

        const messageWithMetadata = { ...m, metadata: metadata || m.metadata };
        
        if (isConfirmMessageType && wouldConfirmCardReturnNull) {
          return null;
        }
        
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
                        const imgSrc = `${getApiBase()}/chat/serve_chat_image.php?message_id=${m.message_id}`;
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
                                alt="Chat attachment"
                                className={
                                  "max-h-72 w-full object-contain rounded-lg " +
                                  (m.sender === "me" ? "bg-white/10" : "bg-black/5")
                                }
                                loading="lazy"
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
      })}
      {isOtherPersonTyping && activeConvId && (
        <TypingIndicatorMessage 
          firstName={typingUserName} 
        />
      )}
    </div>
  );
}



