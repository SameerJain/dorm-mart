import { getApiBase } from "../../../utils/api";
import { groupConversationsByType } from "../utils/conversationUtils";

/**
 * Chat sidebar component displaying conversation list
 */
export default function ChatSidebar({
  conversations,
  activeConvId,
  unreadMsgByConv,
  myId,
  messages,
  onConversationClick,
  onDeleteClick,
  isMobileList,
  convError
}) {
  const renderConversationItem = (c, sectionType = 'sellers') => {
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

    return (
      <li key={c.conv_id} className="relative group">
        <button
          onClick={() => {
            onConversationClick(c.conv_id);
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
                  src={c.productImageUrl.startsWith('http') || c.productImageUrl.startsWith('/images/') ? `${getApiBase()}/media/image.php?url=${encodeURIComponent(c.productImageUrl)}` : c.productImageUrl}
                  alt={c.productTitle || 'Product'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
            {unread > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs leading-5" aria-label={`${unread} unread`}>
                {unread > 99 ? "99+" : unread}
              </span>
            )}
            <div
              onClick={(e) => onDeleteClick(c.conv_id, e)}
              className="opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 cursor-pointer"
              aria-label="Delete conversation"
              title="Delete conversation"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onDeleteClick(c.conv_id, e);
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
  };

  const { messagesToSellers, messagesToBuyers } = groupConversationsByType(conversations, myId);

  return (
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
        ) : messagesToSellers.length === 0 && messagesToBuyers.length === 0 ? (
          <li className="px-4 py-8">
            <div className="text-center">
              <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 font-medium">
                No chats to display
              </p>
              <p className="text-xs md:text-sm text-gray-400 dark:text-gray-500 mt-2">
                Start a conversation to see chats here
              </p>
            </div>
          </li>
        ) : (
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
        )}
      </ul>
    </aside>
  );
}

