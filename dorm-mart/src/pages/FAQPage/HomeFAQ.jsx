// src/components/qna/HomeFAQ.jsx
import React from "react";

// Static list of FAQ entries for the home page + nav bar
const HOME_FAQ_ITEMS = [
  {
    question: "How do I switch between “For You” and “Explore More”?",
    answer:
      "Use the toggle chips in the personalized feed header. “For You” uses your interests, “Explore More” randomizes listings.",
  },
  {
    question: "Why is the “For You” tab disabled?",
    answer:
      "You need to set interested categories via Settings → User Preferences; once saved, the tab activates.",
  },
  {
    question: "How do I set my interested categories?",
    answer:
      "Go to Settings → User Preferences from the navbar menu, select up to 3 categories, then save.",
  },
  {
    question: "Where do I list a new item from the home page?",
    answer:
      "Click “List an item” in the personalized feed header; on mobile, use the navbar menu to find the listing option.",
  },
  {
    question: "How do I search for products?",
    answer:
      "Use the navbar search bar; type a term and press Enter or click the search icon.",
  },
  {
    question: "Can I quickly jump to a category without leaving the home page?",
    answer:
      "Yes, use the “Quick Search” chips; they deep-link to listings filtered by that category.",
  },
  {
    question: "How do I view my wishlist?",
    answer:
      "Open the navbar menu and select “My Wishlist” (or tap the wishlist entry on mobile).",
  },
  {
    question: "How do I access chat and notifications?",
    answer:
      "Use the chat and bell icons in the top-right navbar; badges show unread counts.",
  },
  {
    question: "How do I manage profile or settings?",
    answer:
      "Open the navbar dropdown (desktop) or hamburger menu (mobile) and select “Settings” or “User Profile.”",
  },
  {
    question: "Can I see only new items?",
    answer:
      "Look for “NEW” badges on cards; for more control, open the listings page and use sort/filter options there.",
  },
  {
    question: "How do I get back to the home feed quickly?",
    answer:
      "Click the home icon in the navbar (desktop) or the home entry in the mobile menu.",
  },
  {
    question: "Where are filters for search results?",
    answer:
      "Filters live on the listings/search page. Start by searching, then the filter options appear.",
  },
  {
    question: "Why don’t I see personalized items yet?",
    answer:
      "You might not have set interests or there may be no listings matching them; try adding interests or switch to “Explore More.”",
  },
  {
    question: "How do I change the view if the toggle is hidden on mobile?",
    answer:
      "Scroll to the personalized feed header and tap the “For You / Explore More” chips.",
  },
  {
    question: "Why does “For You” show a tooltip?",
    answer:
      "If you haven’t set interests, hovering shows a hint to add categories before using “For You.”",
  },
  {
    question: "How do I clear my search input quickly?",
    answer:
      "Use the clear (×) button inside the navbar search bar.",
  },
  {
    question: "How can I see items from a specific campus/location?",
    answer:
      "Use filters on the listings page after searching; the home page doesn’t include location filters directly.",
  },
];

function HomeFAQ() {
  return (
    <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
      {/* Map over FAQ entries and display them as Q/A blocks */}
      {HOME_FAQ_ITEMS.map((item, index) => (
        <div
          key={index}
          className="pb-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
        >
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {index + 1}. {item.question}
          </h3>
          <p className="mt-1">
            {item.answer}
          </p>
        </div>
      ))}
    </div>
  );
}

export default HomeFAQ;
