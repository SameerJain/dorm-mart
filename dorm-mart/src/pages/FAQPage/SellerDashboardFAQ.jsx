// src/components/SellerDashboardFAQ.jsx
import React from "react";

const SELLER_DASHBOARD_SECTIONS = [
  {
    title: "Listing Status & Availability",
    items: [
      {
        question: "What do the different listing statuses mean?",
        answer: `Active: Listed and visible to buyers
Pending: Sale in progress (buyer has accepted a scheduled purchase)
Sold: Item has been sold
Removed: Item has been removed from public view`,
      },
      {
        question: "How do I change a listing's status?",
        answer: `Status changes automatically based on actions:
- When a buyer accepts a scheduled purchase → status becomes "Pending"
- When a purchase is confirmed → status becomes "Sold"
- You can manually change status through the listing edit page (if editing is available)`,
      },
      {
        question: "Why can't I edit or delete some of my listings?",
        answer: `- Sold items: Cannot be deleted (permanent record)
- Items with accepted scheduled purchases: Cannot be edited or deleted while a scheduled purchase is active
- Active/Pending items: Can be edited and deleted (unless a scheduled purchase is accepted)`,
      },
    ],
  },
  {
    title: "Statistics & Metrics",
    items: [
      {
        question: "What do the statistics at the top mean?",
        answer: `- Active Listings: Currently published items
- Pending Sales: Items with sales in progress
- Items Sold: Total sold items`,
      },
    ],
  },
  {
    title: "Filtering & Sorting",
    items: [
      {
        question: "How do I filter my listings?",
        answer: `Use the dropdowns at the top:
- Status: Filter by Active, Draft, Sold, Pending, or Removed
- Category: Filter by product category
- Sort By: Sort by date, price, or review status`,
      },
      {
        question: "What sorting options are available?",
        answer: `- Newest First / Oldest First: By listing date
- Price: Low to High / High to Low: By price
- Reviewed Items On Top / Bottom: Only available when viewing "Sold" items; prioritizes items with buyer reviews`,
      },
    ],
  },
  {
    title: "Reviews & Ratings",
    items: [
      {
        question: `What's the difference between "View Review" and "Rate Buyer"?`,
        answer: `- View Review: See the review a buyer left for your item (seller rating and product rating)
- Rate Buyer: Leave a rating for the buyer (only available for sold items)`,
      },
      {
        question: "When can I rate a buyer?",
        answer: `Only after an item is marked as "Sold" and you have the buyer's information.`,
      },
      {
        question: "What do the seller and product ratings mean?",
        answer: `- Seller Rating: How the buyer rated you as a seller
- Product Rating: How the buyer rated the item itself
- Both appear as star ratings on sold items that have been reviewed.`,
      },
      {
        question: "Can I see reviews before an item is sold?",
        answer: `No. Reviews are only available after an item is marked as "Sold" and the buyer has submitted a review.`,
      },
    ],
  },
  {
    title: "Managing Listings",
    items: [
      {
        question: "How do I create a new listing?",
        answer: `Click the "Create New Listing" button in the Statistics section at the top of the dashboard.`,
      },
      {
        question: "How do I edit a listing?",
        answer: `Click the "Edit" button next to any listing (if available). Editing is disabled for items with accepted scheduled purchases.`,
      },
      {
        question: "How do I delete a listing?",
        answer: `Click the "Delete" button next to any listing (if available). You'll be asked to confirm.
Note: Sold items and items with accepted scheduled purchases cannot be deleted.`,
      },
      {
        question: "What happens when I delete a listing?",
        answer: `The listing is permanently removed from the marketplace. This action cannot be undone.`,
      },
    ],
  },
  {
    title: "Scheduled Purchases",
    items: [
      {
        question: `What does "has accepted scheduled purchase" mean?`,
        answer: `A buyer has accepted a scheduled purchase request for that item. While active, you cannot edit or delete the listing.`,
      },
      {
        question: "Why can't I edit an item with an accepted scheduled purchase?",
        answer: `To prevent changes that could affect the scheduled transaction. Once the purchase is completed or cancelled, editing becomes available again.`,
      },
    ],
  },
  {
    title: "Wishlists",
    items: [
      {
        question: `What does "Number of Wishlists" mean?`,
        answer: `How many users have added your item to their wishlist. This shows interest but doesn't guarantee a sale.`,
      },
      {
        question: "Why does the wishlist count show 0 for sold items?",
        answer: `Wishlists are hidden for sold items since they're no longer available.`,
      },
    ],
  },
  {
    title: "General",
    items: [
      {
        question: "How do I view a listing as buyers see it?",
        answer: `Click on the listing title or image to open the public product page.`,
      },
      {
        question: "Can I see who bought my items?",
        answer: `For sold items, you can see buyer information and rate them, but full buyer details are only available through the chat/conversation feature.`,
      },
      {
        question: "What should I do if a listing isn't showing up?",
        answer: `- Check your Status filter (it might be filtered out)
- Check your Category filter
- Refresh the page
- Ensure you're logged in with the correct account`,
      },
      {
        question: "How often do my statistics update?",
        answer: `Statistics update automatically when you load the dashboard or when listing statuses change.`,
      },
    ],
  },
];

function SellerDashboardFAQ() {
  // global counter so numbering continues across sections
  let questionIndex = 1;

  return (
    <div className="space-y-6 text-sm text-gray-700 dark:text-gray-300">
      {SELLER_DASHBOARD_SECTIONS.map((section) => (
        <section key={section.title} className="space-y-3">
          {/* section title: slightly larger than question size (1.35rem) */}
          <h2
            className="font-semibold text-gray-900 dark:text-gray-100"
            style={{ fontSize: "1.5rem" }}
          >
            {section.title}
          </h2>

          {section.items.map((item) => {
            const currentIndex = questionIndex++;
            return (
              <div
                key={item.question}
                className="pb-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
              >
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {currentIndex}. {item.question}
                </h3>
                <p className="mt-1 whitespace-pre-line">
                  {item.answer}
                </p>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

export default SellerDashboardFAQ;
