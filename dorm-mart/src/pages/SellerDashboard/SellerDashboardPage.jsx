import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { withFallbackImage } from '../../utils/imageFallback';
import ReviewModal from '../Reviews/ReviewModal';
import StarRating from '../Reviews/StarRating';
import ProfileLink from '../../components/ProfileLink';

const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const API_BASE = (process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`).replace(/\/$/, "");

function SellerDashboardPage() {
    const navigate = useNavigate();
    const [selectedStatus, setSelectedStatus] = useState('All Status');
    const [selectedSort, setSelectedSort] = useState('Newest First');
    const [selectedCategory, setSelectedCategory] = useState('All Categories');
    const [listings, setListings] = useState([]); // Will hold product listings from backend
    const [loading, setLoading] = useState(false); // Loading state for API calls
    // Delete confirmation modal state
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState(null);

    // Set Status modal state
    const [statusOpen, setStatusOpen] = useState(false);
    const [pendingStatusId, setPendingStatusId] = useState(null);
    const [pendingStatusValue, setPendingStatusValue] = useState('Active');

    // Review modal state
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [selectedReview, setSelectedReview] = useState(null);
    const [selectedReviewProduct, setSelectedReviewProduct] = useState(null);
    const [productReviews, setProductReviews] = useState({}); // Map of productId -> review data

    // Summary metrics state - will be calculated from listings data
    const [summaryMetrics, setSummaryMetrics] = useState({
        activeListings: 0,
        pendingSales: 0,
        itemsSold: 0,
        savedDrafts: 0,
        totalViews: 0
    });

    const handleCreateNewListing = () => {
        navigate('/app/product-listing/new');
    };

    const openViewProduct = (id) => {
        if (!id) return;
        navigate(`/app/viewProduct/${id}`);
    };

    // Calculate summary metrics from listings data (using item_status)
    const calculateSummaryMetrics = (listingsData) => {
        const metrics = {
            activeListings: 0,
            pendingSales: 0,
            itemsSold: 0,
            savedDrafts: 0,
            totalViews: 0
        };

        listingsData.forEach(listing => {
            const st = String(listing.status || '').toLowerCase();
            if (st === 'active') metrics.activeListings++;
            if (st === 'pending') metrics.pendingSales++;
            if (st === 'sold') metrics.itemsSold++;
            if (st === 'draft') metrics.savedDrafts++;

            // Total views - for now set to 0, will be calculated from backend when view tracking is implemented
            // metrics.totalViews += listing.views || 0;
        });

        return metrics;
    };

    const fetchListings = useCallback(async () => {
        setLoading(true);
        try {
            const BASE = (process.env.REACT_APP_API_BASE || "api");
            // TODO: Create manage_seller_listings.php endpoint similar to fetch-transacted-items.php
            // This will query transacted_items WHERE seller_user_id = current_user_id
            const response = await fetch(`${BASE}/seller-dashboard/manage_seller_listings.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({}) // May need user_id or session token
            });

            if (!response.ok) {
                // Try to parse error response
                let errorResult;
                try {
                    errorResult = await response.json();
                } catch (e) {
                    errorResult = { error: `HTTP ${response.status}` };
                }
                console.error('API Error Response:', errorResult);
                throw new Error(errorResult.error || `HTTP ${response.status}`);
            }
            const result = await response.json();

            console.log('Seller dashboard API response:', result); // Debug log

            if (result.success) {
                // Ensure result.data is an array
                const dataArray = Array.isArray(result.data) ? result.data : [];
                console.log('Fetched listings count:', dataArray.length); // Debug log
                
                // Transform backend data to match frontend expectations
                const transformedListings = dataArray.map(item => {
                    const rawImg = item.image_url || item.image || null;
                    const proxied = rawImg
                        ? `${API_BASE}/image.php?url=${encodeURIComponent(String(rawImg))}`
                        : null;
                    return {
                        id: item.id,
                        title: item.title,
                        price: item.price || 0,
                        status: item.status || 'Active',
                        createdAt: item.created_at,
                        image: proxied,
                        seller_user_id: item.seller_user_id,
                        buyer_user_id: item.buyer_user_id,
                        wishlisted: item.wishlisted,
                        categories: Array.isArray(item.categories) ? item.categories : [],
                        has_accepted_scheduled_purchase: item.has_accepted_scheduled_purchase === true || item.has_accepted_scheduled_purchase === 1
                    };
                });
                setListings(transformedListings);

                // Debug: Log items with accepted scheduled purchases
                const itemsWithAccepted = transformedListings.filter(l => l.has_accepted_scheduled_purchase);
                if (itemsWithAccepted.length > 0) {
                    console.log('Items with accepted scheduled purchases:', itemsWithAccepted);
                }

                // Calculate and set summary metrics
                const metrics = calculateSummaryMetrics(transformedListings);
                setSummaryMetrics(metrics);
            } else {
                console.error('Unexpected API response format:', result);
                setListings([]);
                setSummaryMetrics({
                    activeListings: 0,
                    pendingSales: 0,
                    itemsSold: 0,
                    savedDrafts: 0,
                    totalViews: 0
                });
            }
        } catch (error) {
            console.error('Error fetching listings:', error);
            setListings([]);
            setSummaryMetrics({
                activeListings: 0,
                pendingSales: 0,
                itemsSold: 0,
                savedDrafts: 0,
                totalViews: 0
            });
        } finally {
            setLoading(false);
        }
    }, []);

    // Load listings on component mount
    useEffect(() => {
        fetchListings();
    }, [fetchListings]);

    // Fetch reviews for sold items
    useEffect(() => {
        const fetchReviews = async () => {
            const soldListings = listings.filter(l => String(l.status || '').toLowerCase() === 'sold');
            const reviewMap = {};

            for (const listing of soldListings) {
                try {
                    const response = await fetch(
                        `${API_BASE}/reviews/get_product_reviews.php?product_id=${listing.id}`,
                        {
                            method: 'GET',
                            credentials: 'include',
                        }
                    );

                    if (response.ok) {
                        const result = await response.json();
                        if (result.success && result.reviews && result.reviews.length > 0) {
                            // Store the first review (assuming one review per product per buyer)
                            reviewMap[listing.id] = result.reviews[0];
                        }
                    }
                } catch (error) {
                    console.error(`Error fetching reviews for product ${listing.id}:`, error);
                }
            }

            setProductReviews(reviewMap);
        };

        if (listings.length > 0) {
            fetchReviews();
        }
    }, [listings]);

    const handleViewReview = (productId, productTitle) => {
        const review = productReviews[productId];
        if (review) {
            setSelectedReview(review);
            setSelectedReviewProduct({ id: productId, title: productTitle });
            setReviewModalOpen(true);
        }
    };

    const handleCloseReviewModal = () => {
        setReviewModalOpen(false);
        setSelectedReview(null);
        setSelectedReviewProduct(null);
    };

    const handleDelete = async (id) => {
        try {
            const BASE = (process.env.REACT_APP_API_BASE || "api");
            const res = await fetch(`${BASE}/seller-dashboard/delete_listing.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ id })
            });
            const result = await res.json();
            if (!res.ok || !result.success) {
                throw new Error(result.error || `Delete failed (${res.status})`);
            }

            // Remove from local state and recompute metrics
            const nextListings = listings.filter(l => l.id !== id);
            setListings(nextListings);
            const metrics = calculateSummaryMetrics(nextListings);
            setSummaryMetrics(metrics);
            setConfirmOpen(false);
            setPendingDeleteId(null);
        } catch (e) {
            // minimal alert
            console.error('Delete error:', e);
            alert('Failed to delete listing.');
        }
    };

    const openDeleteConfirm = (id) => {
        setPendingDeleteId(id);
        setConfirmOpen(true);
    };
    const closeDeleteConfirm = () => {
        setConfirmOpen(false);
        setPendingDeleteId(null);
    };

    // Function to filter listings based on selected status
    // Note: Current transacted_items table doesn't have status column
    // This will work when status column is added to the database
    const getFilteredListings = () => {
        const statusFilter = String(selectedStatus || 'All Status');
        const catFilter = String(selectedCategory || 'All Categories');
        return listings.filter(l => {
            const st = String(l.status || '').toLowerCase();
            const okStatus = (statusFilter === 'All Status') ? true : (st === statusFilter.toLowerCase());
            const cats = Array.isArray(l.categories) ? l.categories : [];
            const okCat = (catFilter === 'All Categories') ? true : cats.includes(catFilter);
            return okStatus && okCat;
        });
    };

    // Function to sort listings based on selected sort option
    const getSortedListings = () => {
        const filtered = getFilteredListings();
        switch (selectedSort) {
            case 'Newest First':
                return [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            case 'Oldest First':
                return [...filtered].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            case 'Price: Low to High':
                return [...filtered].sort((a, b) => a.price - b.price);
            case 'Price: High to Low':
                return [...filtered].sort((a, b) => b.price - a.price);
            default:
                return filtered;
        }
    };


    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Filter/Sort Row */}
            <div className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                        <div className="flex items-center w-full sm:w-auto">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Status</label>
                            <div className="relative ml-1 flex-1 sm:flex-none">
                                <select
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                    className="w-full bg-white border-2 border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
                                >
                                    <option value="All Status">All Status</option>
                                    <option value="Active">Active</option>
                                    <option value="Draft">Draft</option>
                                    <option value="Sold">Sold</option>
                                    <option value="Removed">Removed</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center w-full sm:w-auto">
                            <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Category</label>
                            <div className="relative ml-1 flex-1 sm:flex-none">
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="w-full bg-white border-2 border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
                                >
                                    <option>All Categories</option>
                                    {Array.from(new Set(listings.flatMap(l => Array.isArray(l.categories) ? l.categories : []))).map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center w-full sm:w-auto">
                            <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Sort By</label>
                            <div className="relative ml-1 flex-1 sm:flex-none">
                                <select
                                    value={selectedSort}
                                    onChange={(e) => setSelectedSort(e.target.value)}
                                    className="w-full bg-white border-2 border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
                                >
                                    <option value="Newest First">Newest First (Date Only)</option>
                                    <option value="Oldest First">Oldest First (Date Only)</option>
                                    <option value="Price: Low to High">Price: Low to High</option>
                                    <option value="Price: High to Low">Price: High to Low</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            {/* Summary Box */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="bg-blue-600 rounded-lg p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    {/* Statistics Title */}
                    <div className="text-white">
                        <h3 className="text-2xl font-bold">Statistics</h3>
                    </div>

                    {/* Metrics - Original Layout on Desktop, Grid on Mobile */}
                    <div className="flex flex-wrap md:flex-nowrap items-center gap-4 md:gap-12 md:flex-1 md:justify-center">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-white">{summaryMetrics.activeListings}</div>
                            <div className="text-sm text-blue-100">Active Listings</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-white">{summaryMetrics.pendingSales}</div>
                            <div className="text-sm text-blue-100">Pending Sales</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-white">{summaryMetrics.itemsSold}</div>
                            <div className="text-sm text-blue-100">Items Sold</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-white">{summaryMetrics.savedDrafts}</div>
                            <div className="text-sm text-blue-100">Saved Drafts</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-white">{summaryMetrics.totalViews}</div>
                            <div className="text-sm text-blue-100">Total Views</div>
                        </div>
                    </div>

                    {/* Create New Listing Button */}
                    <button
                        onClick={handleCreateNewListing}
                        className="w-full md:w-auto bg-white hover:bg-gray-50 text-blue-600 px-8 py-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-3 border-2 border-blue-600 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create New Listing
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6">My Listings</h2>

                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-500 dark:text-gray-400 text-lg">Loading listings...</p>
                    </div>
                ) : getSortedListings().length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500 dark:text-gray-400 text-lg">No products posted yet.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* TODO: Replace with actual listing cards */}
                        {getSortedListings().map((listing) => (
                            <div key={listing.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4 sm:p-6">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div className="flex items-center space-x-3 sm:space-x-4">
                                        <button
                                            type="button"
                                            onClick={() => openViewProduct(listing.id)}
                                            className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden hover:ring-2 hover:ring-blue-300 transition"
                                            aria-label={`Open ${listing.title}`}
                                        >
                                            <img src={withFallbackImage(listing.image)} alt={listing.title} className="w-full h-full object-cover" />
                                        </button>
                                        <div className="min-w-0 flex-1">
                                            <button
                                                type="button"
                                                onClick={() => openViewProduct(listing.id)}
                                                className="text-left text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 truncate hover:underline"
                                            >
                                                {listing.title}
                                            </button>
                                            {listing.price > 0 && <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">${listing.price}</p>}
                                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                                {listing.sold_by ? (
                                                    <>
                                                        Sold by{" "}
                                                        <ProfileLink
                                                            fallback={listing.sold_by}
                                                            className="font-medium text-gray-700 dark:text-gray-200"
                                                            hoverClass="hover:text-blue-600"
                                                        >
                                                            {listing.sold_by}
                                                        </ProfileLink>
                                                    </>
                                                ) : (
                                                    "Posted"
                                                )}{" "}
                                                - {new Date(listing.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end space-y-1">
                                        <div className="flex items-center justify-between sm:justify-end space-x-3">
                                            {(() => {
                                                const st = String(listing.status || '').toLowerCase();
                                                let cls = 'bg-gray-100 text-gray-800';
                                                if (st === 'active') cls = 'bg-green-100 text-green-800';
                                                else if (st === 'pending') cls = 'bg-orange-100 text-orange-800';
                                                else if (st === 'draft') cls = 'bg-yellow-100 text-yellow-800';
                                                else if (st === 'sold') cls = 'bg-blue-100 text-blue-800';
                                                return (
                                                    <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${cls}`}>
                                                        {String(listing.status)}
                                                    </span>
                                                );
                                            })()}

                                            <button
                                                onClick={() => { setPendingStatusId(listing.id); setPendingStatusValue(listing.status || 'Active'); setStatusOpen(true); }}
                                                disabled={listing.has_accepted_scheduled_purchase === true}
                                                className={`font-medium text-sm sm:text-base ${
                                                    listing.has_accepted_scheduled_purchase === true
                                                        ? 'text-gray-400 cursor-not-allowed'
                                                        : 'text-gray-700 hover:text-gray-900'
                                                }`}
                                                title={listing.has_accepted_scheduled_purchase === true ? 'Items with an active Scheduled Purchase cannot be modified' : ''}
                                            >
                                                Set Status
                                            </button>

                                            <button
                                                onClick={() => navigate(`/app/product-listing/edit/${listing.id}`)}
                                                disabled={listing.has_accepted_scheduled_purchase === true}
                                                className={`font-medium text-sm sm:text-base ${
                                                    listing.has_accepted_scheduled_purchase === true
                                                        ? 'text-gray-400 cursor-not-allowed'
                                                        : 'text-blue-600 hover:text-blue-800'
                                                }`}
                                                title={listing.has_accepted_scheduled_purchase === true ? 'Items with an active Scheduled Purchase cannot be modified' : ''}
                                            >
                                                Edit
                                            </button>

                                            <button
                                                onClick={() => openDeleteConfirm(listing.id)}
                                                disabled={listing.has_accepted_scheduled_purchase === true}
                                                className={`font-medium text-sm sm:text-base ${
                                                    listing.has_accepted_scheduled_purchase === true
                                                        ? 'text-gray-400 cursor-not-allowed'
                                                        : 'text-red-600 hover:text-red-800'
                                                }`}
                                                title={listing.has_accepted_scheduled_purchase === true ? 'Items with an active Scheduled Purchase cannot be modified' : ''}
                                            >
                                                Delete
                                            </button>

                                            {/* View Review Button - only show if review exists */}
                                            {productReviews[listing.id] && (
                                                <button
                                                    onClick={() => handleViewReview(listing.id, listing.title)}
                                                    className="font-medium text-sm sm:text-base text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
                                                >
                                                    View Review
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                                Wishlisted: {String(listing.wishlisted)}
                                            </p>
                                            {productReviews[listing.id] && (
                                                <div className="flex items-center gap-1">
                                                    <StarRating rating={productReviews[listing.id].rating} readOnly={true} size={16} />
                                                    <span className="text-xs text-gray-600 dark:text-gray-400">
                                                        {productReviews[listing.id].rating.toFixed(1)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        ))}
                    </div>
                )}
        </div>

        {/* Delete Confirmation Modal */}
        {confirmOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
                <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
                    <div className="px-6 pt-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Are you sure you want to delete?</h2>
                        <p className="mt-2 text-gray-600 dark:text-gray-300">This action cannot be undone.</p>
                    </div>
                    <div className="px-6 py-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={closeDeleteConfirm}
                            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => pendingDeleteId && handleDelete(pendingDeleteId)}
                            className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Set Status Modal */}
        {statusOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
                <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
                    <div className="px-6 pt-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Set Status</h2>
                        <div className="mt-4">
                            <select
                                value={pendingStatusValue}
                                onChange={(e) => setPendingStatusValue(e.target.value)}
                                className="w-full bg-white border-2 border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option>Active</option>
                                <option>Pending</option>
                                <option>Draft</option>
                                <option>Sold</option>
                            </select>
                        </div>
                    </div>
                    <div className="px-6 py-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => { setStatusOpen(false); setPendingStatusId(null); }}
                            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    const BASE = (process.env.REACT_APP_API_BASE || "api");
                                    const res = await fetch(`${BASE}/seller-dashboard/set_item_status.php`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                                        credentials: 'include',
                                        body: JSON.stringify({ id: pendingStatusId, status: pendingStatusValue })
                                    });
                                    const result = await res.json();
                                    if (!res.ok || !result.success) throw new Error(result.error || `Status update failed (${res.status})`);

                                    const next = listings.map(l => l.id === pendingStatusId ? { ...l, status: pendingStatusValue } : l);
                                    setListings(next);
                                    const metrics = calculateSummaryMetrics(next);
                                    setSummaryMetrics(metrics);
                                    setStatusOpen(false);
                                    setPendingStatusId(null);
                                } catch (e) {
                                    console.error('Set status error:', e);
                                    alert('Failed to set status.');
                                }
                            }}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Review Modal for viewing reviews */}
        {selectedReview && selectedReviewProduct && (
            <ReviewModal
                isOpen={reviewModalOpen}
                onClose={handleCloseReviewModal}
                mode="view"
                productId={selectedReviewProduct.id}
                productTitle={selectedReviewProduct.title}
                existingReview={selectedReview}
            />
        )}
        </div>
    );
}

export default SellerDashboardPage;
