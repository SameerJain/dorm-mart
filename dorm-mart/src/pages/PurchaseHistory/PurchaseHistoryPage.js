import PurchasedItem from "../../components/Products/PurchasedItem";
import { Outlet } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";

async function fetchPurchasedItems(filters, signal) {
  const BASE = process.env.REACT_APP_API_BASE || "/api";
  const r = await fetch(
    `${BASE}/purchase-history/purchase_history.php`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      body: JSON.stringify(filters),
      signal: signal,
    }
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

function PurchaseHistoryPage() {
  const [purchasedItems, setPurchasedItems] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(false);

  // Filter states
  const [selectedSort, setSelectedSort] = useState('Newest First');
  const [dateRange, setDateRange] = useState('All Time');

  useEffect(() => {
    setIsFetching(true);
    const controller = new AbortController();

    async function loadPurchasedItems() {
      try {
        const filters = {
          dateRange,
          sort: selectedSort,
        };
        const res = await fetchPurchasedItems(filters, controller.signal);
        setError(false);
        setPurchasedItems(res.data || []);

        setTimeout(() => {
          setIsFetching(false);
        }, 500);
      } catch (err) {
        setIsFetching(false);
        setError(true);
        if (err.name === "AbortError") return;
        console.error(err);
      }
    }
    loadPurchasedItems();
    return () => controller.abort();
  }, [dateRange, selectedSort]);

  // Sort items
  const getSortedItems = () => {
    const filtered = purchasedItems;
    switch (selectedSort) {
      case 'Newest First':
        return [...filtered].sort((a, b) => {
          const dateA = new Date(a.transacted_at || 0);
          const dateB = new Date(b.transacted_at || 0);
          return dateB - dateA;
        });
      case 'Oldest First':
        return [...filtered].sort((a, b) => {
          const dateA = new Date(a.transacted_at || 0);
          const dateB = new Date(b.transacted_at || 0);
          return dateA - dateB;
        });
      case 'Price: Low to High':
        return [...filtered].sort((a, b) => {
          const priceA = a.price || 0;
          const priceB = b.price || 0;
          return priceA - priceB;
        });
      case 'Price: High to Low':
        return [...filtered].sort((a, b) => {
          const priceA = a.price || 0;
          const priceB = b.price || 0;
          return priceB - priceA;
        });
      default:
        return filtered;
    }
  };

  const sortedItems = getSortedItems();

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Filter/Sort Row */}
        <div className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <div className="flex items-center w-full sm:w-auto">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Date Range</label>
                <div className="relative ml-1 flex-1 sm:flex-none">
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="w-full bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-10 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
                  >
                    <option value="All Time">All Time</option>
                    <option value="Last 30 Days">Last 30 Days</option>
                    <option value="Last 3 Months">Last 3 Months</option>
                    <option value="Last Year">Last Year</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex items-center w-full sm:w-auto">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Sort By</label>
                <div className="relative ml-1 flex-1 sm:flex-none">
                  <select
                    value={selectedSort}
                    onChange={(e) => setSelectedSort(e.target.value)}
                    className="w-full bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-10 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
                  >
                    <option value="Newest First">Newest First</option>
                    <option value="Oldest First">Oldest First</option>
                    <option value="Price: Low to High">Price: Low to High</option>
                    <option value="Price: High to Low">Price: High to Low</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6">
            Purchase History
          </h2>

          {isFetching && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400 text-lg">Loading purchase history...</p>
            </div>
          )}

          {!error && !isFetching && sortedItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 text-lg">No purchase history found.</p>
            </div>
          )}

          {error && sortedItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-red-500 dark:text-red-400 text-lg">Failed to retrieve purchase history.</p>
            </div>
          )}

          {/* List of items */}
          {!isFetching && sortedItems.length > 0 && (
            <ul className="grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1 lg:grid-cols-2">
              {sortedItems.map((item, index) => (
                <PurchasedItem
                  key={item.item_id || index}
                  id={item.item_id}
                  title={item.title}
                  seller={item.sold_by}
                  date={item.transacted_at}
                  image={item.image_url}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
      <Outlet />
    </>
  );
}

export default PurchaseHistoryPage;
