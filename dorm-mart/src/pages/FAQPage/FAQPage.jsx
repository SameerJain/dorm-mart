// src/pages/FAQPage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import HomeFAQ from "./HomeFAQ";
import ChatFAQ from "./ChatFAQ";
import SellerDashboardFAQ from "./SellerDashboardFAQ";

function FAQPage() {
  const [activeView, setActiveView] = useState("home");
  const navigate = useNavigate();

  // Close FAQ page: go back to previous page
  const handleCloseFAQ = () => {
    navigate(-1);  // or navigate("/app") if you prefer a fixed route
  };

  let content;
  if (activeView === "home") {
    content = <HomeFAQ />;
  } else if (activeView === "chat") {
    content = <ChatFAQ />;
  } else if (activeView === "seller") {
    content = <SellerDashboardFAQ />;
  }

  return (
    <div className="w-full flex justify-center px-4 py-8">
      <div
        className="
          bg-white dark:bg-gray-800
          rounded-lg shadow-lg
          p-5
          w-full max-w-7xl
          border-2 border-gray-300 dark:border-gray-600
          flex flex-col
        "
      >
        {/* FAQ typography overrides (same as modal) */}
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
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Frequently Asked Questions
          </h2>
          <button
            type="button"
            onClick={handleCloseFAQ}
            aria-label="Go back"
            className="
              text-gray-500 hover:text-gray-700
              dark:text-gray-400 dark:hover:text-gray-200
              text-base leading-none
              px-3 py-1.5
              border border-gray-300 dark:border-gray-600
              rounded-md
            "
          >
            ← Back
          </button>
        </div>

        {/* body */}
        <div className="flex gap-6">
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

          {/* right content – page scrolls normally */}
          <div className="flex-1">
            <div className="faq-content px-4 pt-4 pb-2">
              {content}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FAQPage;
