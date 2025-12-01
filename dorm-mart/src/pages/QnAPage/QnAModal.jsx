// src/components/QnAModal.jsx
import React, { useState } from "react";
import HomeFAQ from "./HomeFAQ";
import ChatFAQ from "./ChatFAQ";
import SellerDashboardFAQ from "./SellerDashboardFAQ";

function QnAModal({ isOpen, onClose }) {
  const [activeView, setActiveView] = useState("home");

  if (!isOpen) {
    return null;
  }

  let content;
  if (activeView === "home") {
    content = <HomeFAQ />;
  } else if (activeView === "chat") {
    content = <ChatFAQ />;
  } else if (activeView === "seller") {
    content = <SellerDashboardFAQ />;
  }

  return (
    <div
      className="
        fixed inset-0 z-50
        flex items-center justify-center
      "
      onClick={onClose}
    >
      <div
        className="
          bg-white dark:bg-gray-800
          rounded-lg shadow-lg
          p-4
          w-full max-w-4xl
          h-[70vh]
          border-2 border-gray-300 dark:border-gray-600  /* bolder border */
          flex flex-col
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* FAQ typography overrides */}
        <style>
          {`
            .faq-content {
              font-size: 1rem;           /* increase overall FAQ font size */
            }
            .faq-content h3 {
              font-size: 1.125rem;       /* make questions larger than answers */
            }
          `}
        </style>

        {/* header */}
        <div className="flex items-center justify-between mb-4 flex-none">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Frequently Asked Questions
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QnA modal"
            className="
              text-gray-500 hover:text-gray-700
              dark:text-gray-400 dark:hover:text-gray-200
              text-xl leading-none
            "
          >
            ×
          </button>
        </div>

        {/* body */}
        <div className="flex gap-4 flex-1 min-h-0">
          {/* left sidebar */}
          <div
            className="
              flex flex-col gap-2
              w-40
              border-r border-gray-200 dark:border-gray-700
              pr-3
              flex-none
            "
          >
            <button
              type="button"
              onClick={() => setActiveView("home")}
              className={`
                w-full text-left px-3 py-1 text-sm rounded-md border
                ${
                  activeView === "home"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                }
              `}
            >
              Home
            </button>

            <button
              type="button"
              onClick={() => setActiveView("chat")}
              className={`
                w-full text-left px-3 py-1 text-sm rounded-md border
                ${
                  activeView === "chat"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                }
              `}
            >
              Chat
            </button>

            <button
              type="button"
              onClick={() => setActiveView("seller")}
              className={`
                w-full text-left px-3 py-1 text-sm rounded-md border
                ${
                  activeView === "seller"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                }
              `}
            >
              Seller Dashboard
            </button>
          </div>

          {/* right content */}
          <div className="flex-1 min-h-0">
            <div
              className="
                faq-content
                h-full
                overflow-y-auto
                pr-1
              "
            >
              {content}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QnAModal;
