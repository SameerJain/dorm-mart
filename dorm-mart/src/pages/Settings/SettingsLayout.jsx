import { NavLink } from "react-router-dom";
import { useState } from "react";

const NAV_BLUE = "#2563EB"; // exact hex of your nav bar

function SettingsLayout({ children }) {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const linkBase = "/app/setting";

  const links = [
    { label: "My Profile", to: `${linkBase}/my-profile` },
    { label: "User Preferences", to: `${linkBase}/user-preferences` },
    //{ label: "Security Options", to: `${linkBase}/security-options` },
    { label: "Change Password", to: `${linkBase}/change-password` },
  ];

  return (
    // Fill viewport height minus the nav (≈64px). Use *height* + child h-full.
    <div className="w-full flex flex-col bg-gray-50 dark:bg-gray-900" style={{ height: "calc(100vh - 64px)" }}>
      {/* Mobile hamburger menu button - only visible on mobile */}
      <div className="lg:hidden p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="text-lg font-medium">Settings</span>
        </button>
      </div>

      {/* Full-width grid that also stretches to full height */}
      <div className="grid flex-1 w-full grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 px-6 py-6 min-h-0">
        {/* Desktop Sidebar (hidden on mobile) */}
        <aside
          className="hidden lg:block h-full rounded-xl p-0 text-white shadow"
          style={{ backgroundColor: NAV_BLUE }}
        >
          <div className="px-4 py-3">
            <h2 className="text-xl font-serif font-semibold">Settings</h2>
          </div>
          <div className="h-px w-full" style={{ background: "rgba(255,255,255,0.25)" }} />
          <nav className="flex h-[calc(100%-56px-1px)] flex-col gap-1 overflow-auto p-2">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  [
                    // was: "rounded-lg px-3 py-2 text-sm transition"
                    "rounded-lg px-3 py-2 text-base transition font-medium leading-6",
                    "hover:underline",
                    isActive ? "bg-white/15" : "bg-transparent",
                  ].join(" ")
                }
                style={({ isActive }) => ({
                  color: "#ffffff",
                  ...(isActive ? { boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)" } : {}),
                })}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {showMobileMenu && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => setShowMobileMenu(false)}
            ></div>

            {/* Sidebar */}
            <aside
              className="relative w-64 h-full rounded-r-xl p-0 text-white shadow-lg"
              style={{ backgroundColor: NAV_BLUE }}
            >
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="text-xl font-serif font-semibold">Settings</h2>
                <button
                  onClick={() => setShowMobileMenu(false)}
                  className="text-white hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="h-px w-full" style={{ background: "rgba(255,255,255,0.25)" }} />
              <nav className="flex h-[calc(100%-56px-1px)] flex-col gap-1 overflow-auto p-2">
                {links.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    onClick={() => setShowMobileMenu(false)}
                    className={({ isActive }) =>
                      [
                        // was: "rounded-lg px-3 py-2 text-sm transition"
                        "rounded-lg px-3 py-2 text-base transition font-medium leading-6",
                        "hover:underline",
                        isActive ? "bg-white/15" : "bg-transparent",
                      ].join(" ")
                    }
                    style={({ isActive }) => ({
                      color: "#ffffff",
                      ...(isActive ? { boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)" } : {}),
                    })}
                  >
                    {l.label}
                  </NavLink>
                ))}
              </nav>
            </aside>
          </div>
        )}

        {/* Content (stretch to bottom) */}
        <main className="h-full rounded-xl bg-white dark:bg-gray-800 p-4 sm:p-6 shadow overflow-auto min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}

export default SettingsLayout;
