// src/components/ChatFAQ.jsx
import React from "react";

// Static list of FAQ entries for the Chat page
const CHAT_FAQ_ITEMS = [
  {
    question: "How do I start a conversation with someone?",
    answer: `Only buyers can send the first message to start a conversation. When buyers find an item in which they are interested in, they will start a conversation via "Message Seller" button on a item's detail page.`,
  },
  {
    question: "How do we use the chat for?",
    answer: `The chat is used for sellers and buyers to communicate to make a trade happen. They can chat to inquire or share more details of an item, negotiate on the final price, and schedule the location and time to trade an item.
    `
  },
  {
    question: "What is Schedule Purchase?",
    answer: `Only sellers can see the “Schedule Purchase” button on their chat view with buyers. When a 
buyer and seller agree on a transaction for an item, the seller will send a “Schedule Purchase” 
request to the buyer to schedule a meeting for the trade, including the time, location, final price, 
and the item being traded. The buyer should accept the request only when they agree on the details 
of the scheduled meeting, since “Schedule Purchase” serves as a contractual agreement between sellers 
and buyers. Once the buyer accepts the request, both the seller and buyer will be able to view the 
schedule on the Ongoing Purchases page, to which you can navigate from the Market Icon on the 
platform’s main navigation bar.`,
  },
  {
    question: "What is Confirm Purchase?",
    answer: `When a transaction has succeeded, meaning sellers and buyers have met and made the agreed 
trade, the seller will send a “Confirm Purchase” request to the buyer to close the scheduled meeting 
and confirm the trade of the item and payment. The buyer should accept the request only after 
acquiring the item and paying the price to the seller. Once the buyer accepts the request, both the 
seller and buyer will be able to review each other based on their experience with the transaction. 
You will receive a message from the chat to help you redirect to review pages. If the buyer doesn’t 
accept the request within 24 hours of receiving the request, the system will automatically mark the 
transaction as complete. Since this automatic confirmation can cause issues (e.g., sellers send a 
confirm purchase request without making a transaction), the developer team plans to implement a 
moderator to address those issues.`,
  },
  {
    question: "I can’t make it to a scheduled meeting. What do I do?",
    answer: `You can cancel the meeting at any time if you can’t make it there. Currently, there is no 
penalty for this. However, the development team is currently planning to implement a moderator that 
allows you to mark your presence when you show up for a scheduled meeting. Along with the moderator 
system, if you cancel a meeting or don’t show up, it will enforce a penalty since we are supposed to 
treat every schedule as a contractual agreement. In the absence of such a system, make sure to 
communicate with the other user to help them avoid showing up for the scheduled meeting, only to 
realize you won’t be there.`,
  },
  {
    question: "What does deleting a chat do?",
    answer: `If you have agreed to a schedule, deleting the chat for that item will automatically cancel 
it. Deleting a chat on your side won’t delete the chat on the other person’s side. An entire chat log 
is deleted only when both users delete the chat on their end.`,
  },
];

function ChatFAQ() {
  return (
    <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
      {CHAT_FAQ_ITEMS.map((item, index) => (
        <div
          key={index} // React key for each FAQ block
          className="pb-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
        >
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {item.question}
          </h3>
          <p className="mt-1">
            {item.answer}
          </p>
        </div>
      ))}
    </div>
  );
}

export default ChatFAQ;
