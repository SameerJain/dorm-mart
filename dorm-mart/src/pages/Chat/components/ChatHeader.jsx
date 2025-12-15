import { useNavigate } from "react-router-dom";
import { getApiBase } from "../../../utils/api";

/**
 * Chat header component
 */
export default function ChatHeader({
  activeReceiverId,
  activeLabel,
  activeLabelFirstName,
  activeFirstName,
  activeLastName,
  activeConversation,
  isSellerPerspective,
  onProfileClick,
  onBackClick,
  headerBgColor,
  isMobileList
}) {
  const navigate = useNavigate();

  return (
    <div className={`relative border-4 ${headerBgColor} px-5 py-4 overflow-hidden`}>
      <div className="flex items-center justify-between min-w-0 gap-2">
        <div className="flex flex-col min-w-0 flex-shrink overflow-hidden max-w-[120px] md:max-w-[200px] -ml-1">
          {activeReceiverId ? (
            <button
              type="button"
              onClick={onProfileClick}
              className="text-left text-lg font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 min-w-0 w-full flex flex-col"
            >
              <span className="md:hidden block w-full truncate" title={activeLabelFirstName}>{activeLabelFirstName}</span>
              <span className="hidden md:block w-full break-words min-w-0 leading-tight" title={activeLabel}>
                <span className="block break-words">{activeFirstName}</span>
                {activeLastName && <span className="block break-words">{activeLastName}</span>}
              </span>
            </button>
          ) : (
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 min-w-0 w-full flex flex-col">
              <span className="md:hidden block w-full truncate" title={activeLabelFirstName}>{activeLabelFirstName}</span>
              <span className="hidden md:block w-full break-words min-w-0 leading-tight" title={activeLabel}>
                <span className="block break-words">{activeFirstName}</span>
                {activeLastName && <span className="block break-words">{activeLastName}</span>}
              </span>
            </h2>
          )}
          <p className="hidden md:block text-xs text-gray-500 dark:text-gray-400 truncate w-full mt-0.5">Direct message</p>
        </div>

        {(activeConversation?.productTitle || activeConversation?.productId) && (
          <div className="flex-1 flex flex-col items-center text-center min-w-0 px-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate block w-full">
              {activeConversation.productTitle || `Item #${activeConversation.productId}`}
            </h2>
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          {activeConversation?.productImageUrl && (
            <div className="inline-flex items-center justify-center h-[44px] w-[44px] rounded-xl border-2 border-gray-300 dark:border-gray-600 overflow-hidden shrink-0 bg-gray-200 dark:bg-gray-700">
              <img
                src={activeConversation.productImageUrl.startsWith('http') || activeConversation.productImageUrl.startsWith('/images/') ? `${getApiBase()}/media/image.php?url=${encodeURIComponent(activeConversation.productImageUrl)}` : activeConversation.productImageUrl}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}
          {activeConversation?.productId && (
            <button
              onClick={() => {
                navigate(`/app/viewProduct/${activeConversation.productId}`, {
                  state: { returnTo: `/app/chat` }
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
            onClick={onBackClick}
            className="md:hidden rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:shadow transition-all duration-200"
            aria-label="Back"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

