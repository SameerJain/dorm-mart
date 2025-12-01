// src/components/QnAModal.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import HomeFAQ from "./HomeFAQ";
import ChatFAQ from "./ChatFAQ";
import SellerDashboardFAQ from "./SellerDashboardFAQ";

function FAQModal({ isOpen, onClose }) {
  const [activeView, setActiveView] = useState("home");
  const navigate = useNavigate();

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

  const handleOpenFaqsPage = () => {
    onClose?.();
    navigate("/app/faq");
  };

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
          p-5
          w-full max-w-6xl
          h-[70vh]
          border-2 border-gray-300 dark:border-gray-600
          flex flex-col
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* FAQ typography overrides */}
        <style>
          {`
            .faq-content {
              font-size: 1.1rem;
            }
            .faq-content h3 {
              font-size: 1.35rem;
            }
          `}
        </style>

        {/* header */}
        <div className="flex items-center justify-between mb-5 flex-none">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Frequently Asked Questions
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QnA modal"
            className="
              text-gray-500 hover:text-gray-700
              dark:text-gray-400 dark:hover:text-gray-200
              text-2xl leading-none
            "
          >
            ×
          </button>
        </div>

        {/* body */}
        <div className="flex gap-6 flex-1 min-h-0">
          {/* left sidebar */}
          <div
            className="
              flex flex-col gap-3
              w-48
              border-r border-gray-200 dark:border-gray-700
              pr-4
              flex-none
            "
          >
            <button
              type="button"
              onClick={() => setActiveView("home")}
              className={`
                w-full text-left px-4 py-2 text-base rounded-md border
                ${
                  activeView === "home"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                }
              `}
            >
              Home Page
            </button>

            <button
              type="button"
              onClick={() => setActiveView("chat")}
              className={`
                w-full text-left px-4 py-2 text-base rounded-md border
                ${
                  activeView === "chat"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                }
              `}
            >
              Chat Page
            </button>

            <button
              type="button"
              onClick={() => setActiveView("seller")}
              className={`
                w-full text-left px-4 py-2 text-base rounded-md border
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
          <div className="flex-1 min-h-0 flex flex-col">
            {/* fixed button row */}
            <div className="flex justify-end mb-3 flex-none">
              <button
                type="button"
                onClick={handleOpenFaqsPage}
                className="
                  px-3 py-1.5
                  rounded-md
                  text-sm
                  bg-blue-600 text-white
                  hover:bg-blue-700
                  dark:bg-blue-500 dark:hover:bg-blue-600
                "
              >
                Open FAQs Page
              </button>
            </div>

            {/* scrollable FAQ content with internal padding */}
            <div
              className="
                faq-content
                flex-1
                h-full
                overflow-y-auto
                px-4    /* horizontal padding from border/edge */
                pt-4    /* top padding so first text isn't too close */
                pb-2
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

export default FAQModal;
