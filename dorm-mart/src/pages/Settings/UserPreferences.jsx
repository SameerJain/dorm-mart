import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SettingsLayout from "./SettingsLayout";
import { useTheme } from "../../hooks/useTheme";

const NAV_BLUE = "#2563EB";

function UserPreferences() {
  const navigate = useNavigate();
  const { theme, updateTheme } = useTheme();
  const [promotionalEmails, setPromotionalEmails] = useState(false);
  const [revealContact, setRevealContact] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInterests, setSelectedInterests] = useState(["Electronics", "Books", "Clothing"]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const API_BASE = process.env.REACT_APP_API_BASE || "/api";

  const [availableCategories, setAvailableCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState(null);

  // Load categories from backend
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setCategoriesLoading(true);
        setCategoriesError(null);
        const res = await fetch(`${API_BASE}/utility/get_categories.php`);
        if (!res.ok) throw new Error('Failed to load categories');
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Invalid categories format');
        if (!cancelled) setAvailableCategories(data);
      } catch (e) {
        if (!cancelled) {
          console.error('Failed to load categories:', e);
          setCategoriesError(e.message);
        }
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [API_BASE]);

  // Enhanced interest management
  const handleInterestToggle = (interest) => {
    setIsLoading(true);
    setTimeout(() => {
      setSelectedInterests(prev => {
        if (prev.includes(interest)) {
          return prev.filter(item => item !== interest);
        }
        // Enforce maximum of 3 categories
        if (prev.length >= 3) {
          return prev; // Don't add if already at limit
        }
        return [...prev, interest];
      });
      setIsLoading(false);
    }, 200);
  };

  const handleInterestRemove = (interest) => {
    setIsLoading(true);
    setTimeout(() => {
      setSelectedInterests(prev => prev.filter(item => item !== interest));
      setIsLoading(false);
    }, 200);
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setShowSuggestions(query.length > 0);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Don't allow custom interests - only select from existing categories
    }
  };

  // Filter categories based on search
  const filteredCategories = availableCategories.filter(category =>
    category.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !selectedInterests.includes(category)
  );

  // Show/hide suggestions based on search
  useEffect(() => {
    if (searchQuery.length > 0) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [searchQuery]);

  // Hydrate from backend on mount (if authenticated)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/userPreferences.php`, { method: 'GET', credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json();
        if (!json || json.ok !== true || !json.data) return;
        const { promoEmails, revealContact, interests, theme } = json.data;
        if (cancelled) return;
        setPromotionalEmails(!!promoEmails);
        setRevealContact(!!revealContact);
        if (Array.isArray(interests)) setSelectedInterests(interests);
        // Don't call updateTheme() here - just sync the theme state
        // The useTheme hook will handle theme state, and auto-save will persist it
        // This prevents race condition where updateTheme() triggers saveTheme() which conflicts with auto-save
      } catch (e) {
        // ignore errors, keep defaults
        console.warn('UserPreferences: GET failed', e);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save to backend whenever relevant values change (debounced)
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        setIsSaving(true);
        const body = {
          promoEmails: promotionalEmails,
          revealContact,
          interests: selectedInterests,
          theme: theme,
        };
        await fetch(`${API_BASE}/userPreferences.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (e) {
        if (e.name !== 'AbortError') console.warn('UserPreferences: POST failed', e);
      } finally {
        setIsSaving(false);
      }
    }, 400);
    return () => { controller.abort(); clearTimeout(t); };
  }, [promotionalEmails, revealContact, selectedInterests, theme, API_BASE]);

  return (
    <SettingsLayout>
      <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-3">
        <h1 className="text-2xl font-serif font-semibold" style={{ color: NAV_BLUE }}>
          User Preferences
        </h1>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
          style={{ color: NAV_BLUE }}
          aria-label="Go back"
        >
          ← Back
        </button>
      </div>

      <div className="space-y-8">
        {/* Notification Settings */}
        <div className="rounded-lg border border-slate-200 dark:border-gray-600 p-6 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100 mb-4">Notification Settings</h2>
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="promotional-emails"
              checked={promotionalEmails}
              onChange={(e) => setPromotionalEmails(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <label htmlFor="promotional-emails" className="text-sm text-slate-700 dark:text-gray-300">
              I would like to receive emails regarding promotional content
            </label>
          </div>
        </div>

        {/* My Interests */}
        <div className="rounded-lg border border-slate-200 dark:border-gray-600 p-6 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100 mb-4">My Interests</h2>

          {/* Search Bar with Enhanced Functionality */}
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyPress={handleKeyPress}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>

          {/* Selected Interests with Enhanced UI */}
          {selectedInterests.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Selected Interests ({selectedInterests.length}/3)
                </p>
                <button
                  onClick={() => setSelectedInterests([])}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedInterests.map((interest, index) => (
                  <span
                    key={interest}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm transition-all duration-200 ${isLoading ? 'opacity-50' : 'opacity-100'
                      } bg-blue-100 text-blue-800 border border-blue-200`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {interest}
                    <button
                      onClick={() => handleInterestRemove(interest)}
                      className="ml-2 text-blue-600 hover:text-blue-800 transition-colors"
                      disabled={isLoading}
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Enhanced Suggestions Dropdown */}
          {showSuggestions && (
            <div className="mb-4">
              <div className="border border-gray-200 rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto">
                {filteredCategories.length > 0 ? (
                  <>
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                      <p className="text-xs font-medium text-gray-600">Suggested Categories</p>
                    </div>
                    <div className="p-2">
                      {filteredCategories.slice(0, 8).map((category) => (
                        <button
                          key={category}
                          onClick={() => {
                            handleInterestToggle(category);
                            setSearchQuery("");
                            setShowSuggestions(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 rounded-md transition-colors"
                        >
                          <span className="flex items-center">
                            <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            {category}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="px-3 py-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">No matching categories found</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Only predefined categories are available</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Popular Categories */}
          {!searchQuery && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Popular Categories</p>
              {categoriesLoading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading categories...</p>
              ) : categoriesError ? (
                <div className="space-y-2">
                  <p className="text-sm text-red-500 dark:text-red-400">Failed to load categories: {categoriesError}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Please refresh the page or check your connection.</p>
                </div>
              ) : availableCategories.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No categories available</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() => handleInterestToggle(category)}
                      disabled={selectedInterests.length >= 3 && !selectedInterests.includes(category)}
                      className={`px-3 py-1 text-sm rounded-full border transition-all duration-200 ${
                        selectedInterests.includes(category)
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700 cursor-not-allowed'
                          : selectedInterests.length >= 3
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      {selectedInterests.includes(category) ? '✓ ' : '+ '}{category}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* TODO: Uncomment when reveal_contact_info feature is implemented
        Seller Options */}
        {/* <div className="rounded-lg border border-slate-200 dark:border-gray-600 p-6 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100 mb-4">Seller Options</h2>
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="reveal-contact"
              checked={revealContact}
              onChange={(e) => setRevealContact(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <label htmlFor="reveal-contact" className="text-sm text-slate-700 dark:text-gray-300">
              I agree to have my email and phone number be revealed to a prospective buyer
            </label>
          </div>
        </div> */}

        {/* Theme */}
        <div className="rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Theme</h2>

          {/* Theme Toggle */}
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => updateTheme("light")}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${theme === "light"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                  }`}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">Light</span>
              </button>
              <button
                onClick={() => updateTheme("dark")}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${theme === "dark"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                  }`}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
                <span className="text-sm font-medium">Dark</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}

export default UserPreferences;
