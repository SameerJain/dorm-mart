import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import chatIcon from '../../assets/icons/icons8-chat-96.png'
import userIcon from '../../assets/icons/icons8-user-icon-96.png'
import notificationIcon from '../../assets/icons/icons8-notification-96.png'
import settingIcon from '../../assets/icons/icons8-setting-96.png'
import marketIcon from '../../assets/icons/icons8-market-96.png';
import searchIcon from '../../assets/icons/icons8-search-96.png';
import homeIcon from '../../assets/icons/icons8-home-96.png';
import questionIcon from '../../assets/icons/icons8-question-mark-96.png';
import Icon from './Icon'
import { ChatContext } from "../../context/ChatContext";
import { useContext } from 'react';

// Main navigation bar component with search, notifications, chat, and menu dropdowns
function MainNav() {
    const [showDropdown, setShowDropdown] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [showMobileMarketDropdown, setShowMobileMarketDropdown] = useState(false);
    const navigate = useNavigate();
    const dropdownRef = useRef(null);
    const mobileMenuRef = useRef(null);
    const location = useLocation();

    const ctx = useContext(ChatContext);
    const { unreadMsgTotal, unreadNotificationTotal } = ctx;

    // helper: close mobile menu + market submenu together
    const closeMobileMenuAndMarket = () => {
      setShowMobileMenu(false);
      setShowMobileMarketDropdown(false);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
            if (
                mobileMenuRef.current &&
                !mobileMenuRef.current.contains(event.target)
            ) {
                closeMobileMenuAndMarket();
            }
        };

        if (showDropdown || showMobileMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
        
    }, [showDropdown, showMobileMenu, showMobileMarketDropdown]);

    const handlePurchaseHistory = () => {
        navigate("/app/purchase-history");
    };

    const handleSellerDashboard = () => {
        navigate("/app/seller-dashboard");
    };

    const handleOngoingPurchases = () => {
        navigate("/app/seller-dashboard/ongoing-purchases");
    };

    const handleWishlist = () => {
        navigate("/app/wishlist");
    };

    // Search state + handlers
    const [searchText, setSearchText] = useState("");
    const inputRef = useRef(null);

    const handleSearchSubmit = (value) => {
        const term = (value || "").trim();
        let includeDesc = false;
        try {
            const spCurrent = new URLSearchParams(location.search || "");
            const qDesc = spCurrent.get('desc') || spCurrent.get('includeDescription');
            if (qDesc && (qDesc === '1' || qDesc === 'true')) {
                includeDesc = true;
            } else {
                includeDesc = (localStorage.getItem('dm_include_desc') === '1');
            }
        } catch (_) {}

        const sp = new URLSearchParams();
        if (term) sp.set('search', term);
        if (includeDesc) sp.set('desc', '1');
        const qs = sp.toString();
        navigate(qs ? `/app/listings?${qs}` : "/app/listings");
    };

    return (
        <nav className="bg-blue-600 text-slate-100 dark:bg-gray-800 dark:text-gray-100">
            <div className="mx-auto flex items-center gap-1 sm:gap-2 md:gap-4 p-2 md:p-3">
                {/* Dorm Mart logo - visible on desktop only */}
                <button
                    onClick={() => navigate("/app")}
                    className="hidden md:block ml-1 sm:ml-2 md:ml-4 text-xl sm:text-2xl md:text-3xl lg:text-4xl font-serif font-semibold cursor-pointer hover:scale-105 hover:opacity-90 hover:drop-shadow-lg transition-all duration-200 bg-transparent border-none p-0 text-slate-100 whitespace-nowrap flex-shrink-0"
                >
                    Dorm Mart
                </button>
                <div className="flex-1 mx-1 sm:mx-2 md:mx-3 lg:mx-5 min-w-0">
                    <div className="flex h-10 sm:h-11 md:h-15 items-center overflow-hidden rounded-full bg-white shadow-inner">
                        <input
                            type="text"
                            placeholder="Search by item name, category, or description.."
                            value={searchText}
                            ref={inputRef}
                            maxLength={50}
                            onChange={(e) => setSearchText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSearchSubmit(searchText);
                              }
                            }}
                            className="h-full w-full px-2 sm:px-3 text-sm md:text-base text-slate-900 placeholder-slate-400 focus:outline-none min-w-0"
                        />

                        {searchText ? (
                            <button
                              type="button"
                              onClick={() => {
                                  setSearchText("");
                                  inputRef.current?.focus();
                              }}
                              aria-label="Clear search"
                              className="px-3 h-full text-slate-500 hover:text-slate-700"
                            >
                              ×
                            </button>
                        ) : null}

                        <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleSearchSubmit(searchText);
                            }}
                            className="flex h-full w-10 sm:w-12 md:w-16 lg:w-20 items-center justify-center border-l border-slate-200 border-black flex-shrink-0"
                        >
                            <img
                              src={searchIcon}
                              alt=""
                              className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8"
                            />
                        </button>
                    </div>
                </div>

                {/* Desktop navigation - hidden on mobile */}
                <ul className="mr-1 sm:mr-2 hidden md:flex items-center gap-1 sm:gap-2 md:gap-3 lg:gap-4 flex-shrink-0">
                    <Icon to="/app/notification" src={notificationIcon} alt="Notification" badge={unreadNotificationTotal} />
                    <Icon to="/app/chat" src={chatIcon} alt="Chat" badge={unreadMsgTotal} />

                    {/* Hamburger menu icon for desktop - replaces marketplace icon */}
                    <li className="relative" ref={dropdownRef}>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                setShowDropdown((prev) => !prev);
                            }}
                            className="flex items-center justify-center p-2 rounded-lg"
                            aria-label="Menu"
                        >
                            <svg
                                className="w-9 h-9 md:w-10 md:h-10 lg:w-11 lg:h-11 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        {showDropdown && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg py-2 z-50">
                              <button
                                onClick={() => { handleSellerDashboard(); setShowDropdown(false); }}
                                className="w-full text-left px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                              >
                                Seller Dashboard
                              </button>
                              <button
                                onClick={() => { handleWishlist(); setShowDropdown(false); }}
                                className="w-full text-left px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                              >
                                My Wishlist
                              </button>
                              <button
                                onClick={() => { handleOngoingPurchases(); setShowDropdown(false); }}
                                className="w-full text-left px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                              >
                                Ongoing Purchases
                              </button>
                              <button
                                onClick={() => { handlePurchaseHistory(); setShowDropdown(false); }}
                                className="w-full text-left px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                              >
                                Purchase History
                              </button>
                              <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                              <button
                                onClick={() => { navigate("/app/setting"); setShowDropdown(false); }}
                                className="w-full text-left px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                              >
                                Settings
                              </button>
                            </div>
                        )}
                    </li>
                </ul>

                {/* Mobile hamburger menu - visible only on mobile */}
                <div className="mr-2 md:hidden relative" ref={mobileMenuRef}>
                    <button
                        onClick={() => {
                          setShowMobileMenu((prev) => {
                            const next = !prev;
                            if (!next) {
                              // when closing, also close market dropdown
                              setShowMobileMarketDropdown(false);
                            }
                            return next;
                          });
                        }}
                        className="flex flex-col justify-center items-center w-8 h-8 gap-1.5"
                        aria-label="Menu"
                    >
                        <span className="w-6 h-0.5 bg-white"></span>
                        <span className="w-6 h-0.5 bg-white"></span>
                        <span className="w-6 h-0.5 bg-white"></span>
                    </button>

                    {showMobileMenu && (
                        <div className="absolute right-0 mt-2 w-56 bg-blue-600 rounded-lg shadow-lg py-2 z-50 border-2 border-blue-400">
                            <button
                                onClick={() => {
                                    navigate("/app");
                                    closeMobileMenuAndMarket();
                                }}
                                className="w-full text-left px-4 py-3 text-white hover:bg-blue-700 transition-colors flex items-center gap-3"
                            >
                                <img src={homeIcon} alt="" className="h-6 w-6" />
                                <span>Home</span>
                            </button>
                            <button
                                onClick={() => {
                                    navigate("/app/notification");
                                    closeMobileMenuAndMarket();
                                }}
                                className="w-full text-left px-4 py-3 text-white hover:bg-blue-700 transition-colors flex items-center gap-3"
                            >
                                <span className="relative inline-block">
                                    <img src={notificationIcon} alt="" className="h-6 w-6" />
                                    {unreadNotificationTotal > 0 && (
                                        <span
                                            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] leading-[18px] text-center"
                                            aria-label={`${unreadNotificationTotal} unread notifications`}
                                        >
                                            {unreadNotificationTotal > 99 ? "99+" : unreadNotificationTotal}
                                        </span>
                                    )}
                                </span>
                                <span>Notification</span>
                            </button>

                            <button
                                onClick={() => {
                                    navigate("/app/chat");
                                    closeMobileMenuAndMarket();
                                }}
                                className="w-full text-left px-4 py-3 text-white hover:bg-blue-700 transition-colors flex items-center gap-3"
                            >
                                <span className="relative inline-block">
                                    <img src={chatIcon} alt="" className="h-6 w-6" />
                                    {unreadMsgTotal > 0 && (
                                      <span
                                          className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] leading-[18px] text-center"
                                          aria-label={`${unreadMsgTotal} unread`}
                                      >
                                          {unreadMsgTotal > 99 ? "99+" : unreadMsgTotal}
                                      </span>
                                    )}
                                </span>
                                <span>Chat</span>
                            </button>

                            {/* "Market" dropdown (mobile) */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowMobileMarketDropdown((prev) => !prev)}
                                    className="w-full text-left px-4 py-3 text-white hover:bg-blue-700 transition-colors flex items-center justify-between gap-3"
                                >
                                    <span className="flex items-center gap-3">
                                        <img src={marketIcon} alt="" className="h-6 w-6" />
                                        <span>Market</span>
                                    </span>
                                    <span className={`transform transition-transform ${showMobileMarketDropdown ? "rotate-90" : ""}`}>
                                        ▶
                                    </span>
                                </button>

                                {showMobileMarketDropdown && (
                                    <div className="mt-1 mx-2 bg-blue-500 rounded-md shadow-inner">
                                        <button
                                            onClick={() => {
                                                handleSellerDashboard();
                                                closeMobileMenuAndMarket();
                                            }}
                                            className="w-full text-left px-4 py-2 text-white hover:bg-blue-700 transition-colors rounded-t-md"
                                        >
                                            Seller Dashboard
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleWishlist();
                                                closeMobileMenuAndMarket();
                                            }}
                                            className="w-full text-left px-4 py-2 text-white hover:bg-blue-700 transition-colors"
                                        >
                                            My Wishlist
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleOngoingPurchases();
                                                closeMobileMenuAndMarket();
                                            }}
                                            className="w-full text-left px-4 py-2 text-white hover:bg-blue-700 transition-colors"
                                        >
                                            Ongoing Purchases
                                        </button>
                                        <button
                                            onClick={() => {
                                                handlePurchaseHistory();
                                                closeMobileMenuAndMarket();
                                            }}
                                            className="w-full text-left px-4 py-2 text-white hover:bg-blue-700 transition-colors rounded-b-md"
                                        >
                                            Purchase History
                                        </button>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => {
                                    navigate("/app/setting");
                                    closeMobileMenuAndMarket();
                                }}
                                className="w-full text-left px-4 py-3 text-white hover:bg-blue-700 transition-colors flex items-center gap-3"
                            >
                                <img src={settingIcon} alt="" className="h-6 w-6" />
                                <span>Settings</span>
                            </button>

                            <button
                                onClick={() => {
                                navigate("/app/faq");
                                closeMobileMenuAndMarket();
                                }}
                                className="w-full text-left px-4 py-3 text-white hover:bg-blue-700 transition-colors flex items-center gap-3"
                            >
                                <img src={questionIcon} alt="" className="h-6 w-6" />
                                <span>FAQ</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}

export default MainNav;
