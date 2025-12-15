/**
 * Utility functions for conversation grouping and organization
 */

/**
 * Groups conversations into seller and buyer sections
 * @param {Array} conversations - Array of conversation objects
 * @param {number} myId - Current user's ID
 * @returns {Object} Object with messagesToSellers and messagesToBuyers arrays
 */
export function groupConversationsByType(conversations, myId) {
  const messagesToSellers = [];
  const messagesToBuyers = [];
  
  conversations.forEach((c) => {
    const isSellerConversation = c.productId && c.productSellerId && myId && 
      Number(c.productSellerId) === Number(myId);
    if (isSellerConversation) {
      messagesToBuyers.push(c);
    } else {
      messagesToSellers.push(c);
    }
  });
  
  return { messagesToSellers, messagesToBuyers };
}



