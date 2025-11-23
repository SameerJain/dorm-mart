import React from "react";
import { useNavigate } from "react-router-dom";

const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const API_BASE = (process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`).replace(/\/$/, "");

function MessageCard({ message, isMine }) {
  const navigate = useNavigate();
  const metadata = message.metadata || {};
  const product = metadata.product || {};
  const previewText = message.content || "";
  const rawImageUrl = product.image_url;
  const productId = product.product_id;
  
  // Route image URL through proxy if it's a relative path or /images/ path
  const imageUrl = rawImageUrl && (rawImageUrl.startsWith('http') || rawImageUrl.startsWith('/data/images/') || rawImageUrl.startsWith('/images/'))
    ? `${API_BASE}/image.php?url=${encodeURIComponent(rawImageUrl)}`
    : rawImageUrl;

  const handleClick = () => {
    if (productId) {
      navigate(`/app/viewProduct/${encodeURIComponent(productId)}`);
    }
  };

  // Use consistent styling for listing_intro messages regardless of sender - matching site's blue color scheme
  return (
    <div 
      onClick={handleClick}
      className={`max-w-[85%] rounded-2xl border-2 border-blue-400 bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg overflow-hidden ${productId ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-200' : ''}`}
    >
      {imageUrl ? (
        <div className="w-full h-48 overflow-hidden border-b-2 border-blue-400/30">
          <img
            src={imageUrl}
            alt={product.title || "Listing image"}
            className="w-full h-full object-cover"
          />
        </div>
      ) : null}
      <div className="p-4 space-y-3 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-5 h-5 text-blue-100 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="font-bold text-base text-white truncate block min-w-0 flex-1">
            {product.title || "Listing"}
          </p>
        </div>
        <div className="px-3 py-2 rounded-lg bg-blue-500/30 backdrop-blur-sm">
          <p className="whitespace-pre-wrap break-words text-sm text-blue-50">
            {previewText}
          </p>
        </div>
      </div>
    </div>
  );
}

export default MessageCard;

