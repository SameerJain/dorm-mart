import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = (process.env.REACT_APP_API_BASE || 'api').replace(/\/?$/, '');

function OngoingPurchasesPage() {
    const navigate = useNavigate();
    const [buyerRequests, setBuyerRequests] = useState([]);
    const [sellerRequests, setSellerRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [actionMessage, setActionMessage] = useState('');
    const [actionError, setActionError] = useState('');
    const [busyRequestId, setBusyRequestId] = useState(0);
    const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
    const [pendingCancelRequestId, setPendingCancelRequestId] = useState(0);

    // Prevent body scroll when cancel confirmation modal is open
    useEffect(() => {
        if (cancelConfirmOpen) {
            const scrollY = window.scrollY;
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
        } else {
            const scrollY = document.body.style.top;
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            if (scrollY) {
                window.scrollTo(0, parseInt(scrollY || '0') * -1);
            }
        }
        return () => {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
        };
    }, [cancelConfirmOpen]);

    useEffect(() => {
        const abort = new AbortController();
        async function load() {
            setLoading(true);
            setError('');
            try {
                // Load both buyer and seller requests
                const [buyerRes, sellerRes] = await Promise.all([
                    fetch(`${API_BASE}/scheduled-purchases/list_buyer.php`, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' },
                        credentials: 'include',
                        signal: abort.signal,
                    }),
                    fetch(`${API_BASE}/scheduled-purchases/list_seller.php`, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' },
                        credentials: 'include',
                        signal: abort.signal,
                    })
                ]);

                if (!buyerRes.ok || !sellerRes.ok) {
                    throw new Error(`HTTP ${buyerRes.status} or ${sellerRes.status}`);
                }

                const buyerPayload = await buyerRes.json();
                const sellerPayload = await sellerRes.json();

                if (!buyerPayload.success || !sellerPayload.success) {
                    throw new Error(buyerPayload.error || sellerPayload.error || 'Failed to load ongoing purchases');
                }

                setBuyerRequests(Array.isArray(buyerPayload.data) ? buyerPayload.data : []);
                setSellerRequests(Array.isArray(sellerPayload.data) ? sellerPayload.data : []);
            } catch (e) {
                if (e.name !== 'AbortError') {
                    setError('Unable to load your scheduled purchases right now.');
                }
            } finally {
                setLoading(false);
            }
        }

        load();
        return () => abort.abort();
    }, []);

    async function refresh() {
        setLoading(true);
        setError('');
        try {
            const [buyerRes, sellerRes] = await Promise.all([
                fetch(`${API_BASE}/scheduled-purchases/list_buyer.php`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include',
                }),
                fetch(`${API_BASE}/scheduled-purchases/list_seller.php`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include',
                })
            ]);

            if (!buyerRes.ok || !sellerRes.ok) {
                throw new Error('HTTP error');
            }

            const buyerPayload = await buyerRes.json();
            const sellerPayload = await sellerRes.json();

            if (!buyerPayload.success || !sellerPayload.success) {
                throw new Error('Failed to refresh');
            }

            setBuyerRequests(Array.isArray(buyerPayload.data) ? buyerPayload.data : []);
            setSellerRequests(Array.isArray(sellerPayload.data) ? sellerPayload.data : []);
        } catch (e) {
            setError('Unable to refresh scheduled purchases.');
        } finally {
            setLoading(false);
        }
    }

    async function handleAction(requestId, action) {
        setBusyRequestId(requestId);
        setActionMessage('');
        setActionError('');
        try {
            const res = await fetch(`${API_BASE}/scheduled-purchases/respond.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    request_id: requestId,
                    action,
                }),
            });
            if (!res.ok) {
                const msg = action === 'accept' ? 'Failed to accept request' : 'Failed to decline request';
                throw new Error(msg);
            }
            const payload = await res.json();
            if (!payload.success) {
                throw new Error(payload.error || 'Action failed');
            }

            const updated = payload.data;
            // Update in buyer requests - preserve has_completed_confirm
            setBuyerRequests((prev) => prev.map((req) => {
                if (req.request_id !== requestId) return req;
                return {
                    ...req,
                    status: updated.status || req.status,
                    buyer_response_at: updated.buyer_response_at || new Date().toISOString(),
                    meeting_at: updated.meeting_at || req.meeting_at,
                    meet_location: updated.meet_location || req.meet_location,
                    verification_code: updated.verification_code || req.verification_code,
                    has_completed_confirm: req.has_completed_confirm, // Preserve completed status
                };
            }));
            // Also refresh seller requests to get updated status
            const sellerRes = await fetch(`${API_BASE}/scheduled-purchases/list_seller.php`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include',
            });
            if (sellerRes.ok) {
                const sellerPayload = await sellerRes.json();
                if (sellerPayload.success) {
                    setSellerRequests(Array.isArray(sellerPayload.data) ? sellerPayload.data : []);
                }
            }
            setActionMessage(action === 'accept' ? 'Purchase accepted. Be sure to share the verification code when you meet.' : 'Purchase declined.');
        } catch (e) {
            setActionError(e.message || 'Something went wrong.');
        } finally {
            setBusyRequestId(0);
        }
    }

    // Helper function to determine if a purchase is active or past
    const isActivePurchase = (req) => {
        const now = new Date();
        const meetingDate = req.meeting_at ? new Date(req.meeting_at) : null;
        const isPastDate = meetingDate && meetingDate < now;
        const isTerminalStatus = ['declined', 'cancelled'].includes(req.status);
        const isCompleted = req.has_completed_confirm === true;
        return !isPastDate && !isTerminalStatus && !isCompleted;
    };

    // Group all purchases by item (inventory_product_id)
    const groupedByItem = useMemo(() => {
        // Combine all requests with perspective tracking
        const allRequests = [
            ...buyerRequests.map(req => ({ ...req, perspective: 'buyer' })),
            ...sellerRequests.map(req => ({ ...req, perspective: 'seller' }))
        ];

        // Group by inventory_product_id
        const grouped = {};
        allRequests.forEach(req => {
            const productId = req.inventory_product_id;
            if (!grouped[productId]) {
                grouped[productId] = {
                    item: req.item || { title: 'Unknown Item' },
                    productId: productId,
                    purchases: []
                };
            }
            grouped[productId].purchases.push(req);
        });

        // Sort purchases within each group by created_at (most recent first)
        Object.values(grouped).forEach(group => {
            group.purchases.sort((a, b) => {
                const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
                const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
                return dateB - dateA;
            });
        });

        // Convert to array and sort by most recent purchase date
        return Object.values(grouped).sort((a, b) => {
            const dateA = a.purchases[0]?.created_at ? new Date(a.purchases[0].created_at) : new Date(0);
            const dateB = b.purchases[0]?.created_at ? new Date(b.purchases[0].created_at) : new Date(0);
            return dateB - dateA;
        });
    }, [buyerRequests, sellerRequests]);

    // Helper function to get status badge styling
    const getStatusBadge = (status, isCompleted = false) => {
        const baseClasses = 'px-2 py-1 text-xs font-semibold rounded';
        if (isCompleted) {
            return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300`;
        }
        switch (status) {
            case 'pending':
                return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300`;
            case 'accepted':
                return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300`;
            case 'declined':
                return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300`;
            case 'cancelled':
                return `${baseClasses} bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 line-through`;
            default:
                return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300`;
        }
    };

    // Helper function to render cost/trade information
    const renderCostTradeInfo = (req, isCancelled, isDeclined, isCompleted) => {
        const isTerminal = isCancelled || isDeclined;
        
        if (req.is_trade && req.trade_item_description) {
            return (
                <div className={`${isTerminal ? 'bg-red-100 dark:bg-red-900/50 border-red-500' : isCompleted ? 'bg-gray-100 dark:bg-gray-800/50 border-gray-400 dark:border-gray-600' : 'bg-amber-50 dark:bg-amber-900/30 border-amber-400 dark:border-amber-700'} border-4 rounded-lg p-2 my-1.5 shadow-lg`}>
                    <div className="flex items-center gap-1.5 mb-1">
                        <svg className={`w-5 h-5 ${isTerminal ? 'text-red-700 dark:text-red-200' : isCompleted ? 'text-gray-600 dark:text-gray-400' : 'text-amber-600 dark:text-amber-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        <span className={`text-sm font-bold uppercase tracking-wide ${isTerminal ? 'text-red-700 dark:text-red-200' : isCompleted ? 'text-gray-600 dark:text-gray-400' : 'text-amber-700 dark:text-amber-200'}`}>TRADE</span>
                    </div>
                    <p className={`text-sm font-semibold ${isTerminal ? 'text-red-800 dark:text-red-100' : isCompleted ? 'text-gray-700 dark:text-gray-300' : 'text-amber-800 dark:text-amber-100'}`}>{req.trade_item_description}</p>
                </div>
            );
        } else if (req.negotiated_price !== null && req.negotiated_price !== undefined) {
            return (
                <div className={`${isTerminal ? 'bg-red-500 dark:bg-red-600' : isCompleted ? 'bg-gray-500 dark:bg-gray-600' : 'bg-emerald-600 dark:bg-emerald-700'} border-4 ${isTerminal ? 'border-red-400' : isCompleted ? 'border-gray-400 dark:border-gray-500' : 'border-emerald-500'} rounded-lg p-2 my-1.5 shadow-lg`}>
                    <div className="flex items-center gap-1.5 mb-1">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-bold uppercase tracking-wide text-white">Negotiated Price</span>
                    </div>
                    <p className="text-2xl font-bold text-white">${Number(req.negotiated_price).toFixed(2)}</p>
                </div>
            );
        } else if (req.item?.listing_price !== null && req.item?.listing_price !== undefined) {
            return (
                <div className={`${isTerminal ? 'bg-red-500 dark:bg-red-600' : isCompleted ? 'bg-gray-500 dark:bg-gray-600' : 'bg-blue-600 dark:bg-blue-700'} border-4 ${isTerminal ? 'border-red-400' : isCompleted ? 'border-gray-400 dark:border-gray-500' : 'border-blue-500'} rounded-lg p-2 my-1.5 shadow-lg`}>
                    <div className="flex items-center gap-1.5 mb-1">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-bold uppercase tracking-wide text-white">Listed Price</span>
                    </div>
                    <p className="text-2xl font-bold text-white">${Number(req.item.listing_price).toFixed(2)}</p>
                </div>
            );
        }
        return null;
    };

    // Helper function to render cancellation info
    const renderCancellationInfo = (req) => {
        if (req.status === 'cancelled') {
            let canceledByName = 'Unknown';
            if (req.canceled_by) {
                const firstName = req.canceled_by.first_name || '';
                const lastName = req.canceled_by.last_name || '';
                const fullName = `${firstName} ${lastName}`.trim();
                canceledByName = fullName || `User ${req.canceled_by.user_id}`;
            }
            return (
                <div className="bg-red-50 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-700 rounded-lg p-1.5 mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <svg className="w-4 h-4 text-red-600 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-sm font-bold text-red-700 dark:text-red-200">CANCELLED</span>
                        <span className="text-sm text-red-600 dark:text-red-300">by {canceledByName}</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    // Helper function to render completed info
    const renderCompletedInfo = (req) => {
        if (req.has_completed_confirm === true) {
            return (
                <div className="bg-gray-50 dark:bg-gray-800/50 border-2 border-gray-400 dark:border-gray-600 rounded-lg p-1.5 mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">COMPLETED</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    // Helper function to render next steps info for accepted purchases
    const renderNextStepsInfo = (req) => {
        if (req.status === 'accepted' && req.has_completed_confirm !== true) {
            return (
                <div className="bg-orange-50 dark:bg-orange-900/30 border-2 border-orange-400 dark:border-orange-600 rounded-lg p-2 mb-1.5">
                    <div className="flex items-start gap-1.5">
                        <svg className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-0.5">Next Steps</p>
                            <p className="text-sm text-orange-700 dark:text-orange-300">
                                Meet in-person at this agreed upon time and location to complete the exchange. Remember to use the verification code to verify identities!
                            </p>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };


    // Component to render a purchase card
    const PurchaseCard = ({ req, perspective }) => {
        const isBuyer = perspective === 'buyer';
        const meetingDate = req.meeting_at ? new Date(req.meeting_at).toLocaleString() : 'Not provided';
        const code = req.verification_code || '----';
        const canRespond = req.status === 'pending' && isBuyer;
        const isCancelled = req.status === 'cancelled';
        const isDeclined = req.status === 'declined';
        const isCompleted = req.has_completed_confirm === true;
        const isInactive = isCancelled || isDeclined || isCompleted;
        const isAccepted = req.status === 'accepted';
        const canCancel = (req.status === 'pending' || req.status === 'accepted') && !isInactive;
        // const canUseActionButtons = isAccepted && !isCompleted; // Only enabled for accepted status and not completed - Commented out: Report an Issue feature not fully implemented yet

        // Color scheme based on perspective - override with red if cancelled/declined, gray if completed
        const cardBorderColor = isCancelled || isDeclined
            ? 'border-red-500 dark:border-red-600' 
            : isCompleted
            ? 'border-gray-400 dark:border-gray-600'
            : (isBuyer ? 'border-green-500 dark:border-green-600' : 'border-blue-500 dark:border-blue-600');
        const cardBgColor = isCancelled || isDeclined
            ? 'bg-red-50 dark:bg-red-900/20' 
            : isCompleted
            ? 'bg-gray-50 dark:bg-gray-800/50'
            : (isBuyer ? 'bg-green-50 dark:bg-green-900/20' : 'bg-blue-50 dark:bg-blue-900/20');
        const badgeColor = isCancelled || isDeclined
            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
            : isCompleted
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            : (isBuyer ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300');
        
        // Location and meeting time color schemes - use solid colors with white text
        // For inactive (cancelled/declined), use duller/muted red colors
        // For completed, use muted gray colors
        const locationBg = isCancelled || isDeclined
            ? 'bg-red-400 dark:bg-red-500' 
            : isCompleted
            ? 'bg-gray-400 dark:bg-gray-600'
            : (isBuyer ? 'bg-blue-600 dark:bg-blue-700' : 'bg-indigo-600 dark:bg-indigo-700');
        const locationText = 'text-white';
        const locationTextBold = 'text-white';
        
        const meetingBg = isCancelled || isDeclined
            ? 'bg-red-400 dark:bg-red-500' 
            : isCompleted
            ? 'bg-gray-400 dark:bg-gray-600'
            : (isBuyer ? 'bg-teal-600 dark:bg-teal-700' : 'bg-purple-600 dark:bg-purple-700');
        const meetingText = 'text-white';
        const meetingTextBold = 'text-white';

        return (
            <div className={`${cardBgColor} border-2 ${cardBorderColor} rounded-lg p-2 shadow-sm ${isInactive ? 'opacity-75' : ''}`}>
                <div className="flex flex-col gap-1.5">
                    {/* Header with perspective badge and status */}
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded ${badgeColor}`}>
                                You are the {isBuyer ? 'Buyer' : 'Seller'}
                            </span>
                            <span className={getStatusBadge(req.status, isCompleted)}>
                                {isCompleted ? 'Completed' : req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                            </span>
                        </div>
                        <div className={`text-sm ${isCancelled || isDeclined ? 'text-red-600 dark:text-red-300' : isCompleted ? 'text-gray-600 dark:text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            {isBuyer ? 'Requested' : 'Created'} {req.created_at ? new Date(req.created_at).toLocaleString() : ''}
                            {req.buyer_response_at && (
                                <div>{isBuyer ? 'You responded' : 'Buyer responded'} {new Date(req.buyer_response_at).toLocaleString()}</div>
                            )}
                        </div>
                    </div>

                    {/* Completed info */}
                    {renderCompletedInfo(req)}
                    
                    {/* Cancellation/Declined info */}
                    {renderCancellationInfo(req)}
                    {isDeclined && !isCancelled && (
                        <div className="bg-red-50 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-700 rounded-lg p-1.5 mb-1.5">
                            <div className="flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-red-600 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span className="text-sm font-bold text-red-700 dark:text-red-200">DECLINED</span>
                            </div>
                        </div>
                    )}

                    {/* Next Steps info for accepted purchases */}
                    {renderNextStepsInfo(req)}

                    {/* Other party */}
                    <div>
                        <p className={`text-sm ${isCancelled || isDeclined ? 'text-red-700 dark:text-red-200' : isCompleted ? 'text-gray-600 dark:text-gray-400' : 'text-gray-600 dark:text-gray-300'}`}>
                            {isBuyer ? 'Seller' : 'Buyer'}: {isBuyer 
                                ? `${req.seller?.first_name || ''} ${req.seller?.last_name || ''}`.trim() 
                                : `${req.buyer?.first_name || ''} ${req.buyer?.last_name || ''}`.trim()}
                        </p>
                    </div>

                    {/* Cost/Trade Information */}
                    {renderCostTradeInfo(req, isCancelled, isDeclined, isCompleted)}

                    {/* Location and Meeting Time */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 my-1.5">
                        <div className={`${locationBg} rounded-lg p-2 shadow-md`}>
                            <div className="flex items-center gap-1.5 mb-1">
                                <svg className={`w-4 h-4 ${locationText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className={`text-xs font-semibold uppercase tracking-wide ${locationText}`}>Location</span>
                            </div>
                            <p className={`text-base font-bold ${locationTextBold}`}>{req.meet_location || 'Not provided'}</p>
                        </div>
                        <div className={`${meetingBg} rounded-lg p-2 shadow-md`}>
                            <div className="flex items-center gap-1.5 mb-1">
                                <svg className={`w-4 h-4 ${meetingText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className={`text-xs font-semibold uppercase tracking-wide ${meetingText}`}>Meeting Time</span>
                            </div>
                            <p className={`text-base font-bold ${meetingTextBold}`}>{meetingDate}</p>
                        </div>
                    </div>

                    {/* Description */}
                    {req.description && (
                        <div className={`text-sm break-words ${isCancelled || isDeclined ? 'text-red-700 dark:text-red-200' : isCompleted ? 'text-gray-600 dark:text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>
                            <span className="font-semibold">Description:</span> {req.description}
                        </div>
                    )}

                    {/* Verification Code */}
                    <div className={`text-sm ${isCancelled || isDeclined ? 'text-red-700 dark:text-red-200' : isCompleted ? 'text-gray-600 dark:text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>
                        <span className="font-semibold">Verification Code:</span>{' '}
                        <span className={`font-mono text-base ${isCancelled || isDeclined ? 'text-red-600 dark:text-red-300' : isCompleted ? 'text-gray-500 dark:text-gray-500' : (req.status === 'accepted' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400')}`}>{code}</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-1.5 justify-end">
                        {canRespond && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleAction(req.request_id, 'decline')}
                                    disabled={busyRequestId === req.request_id}
                                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60"
                                >
                                    {busyRequestId === req.request_id && actionError ? 'Retry Decline' : 'Decline'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleAction(req.request_id, 'accept')}
                                    disabled={busyRequestId === req.request_id}
                                    className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                                >
                                    {busyRequestId === req.request_id && !actionError ? 'Processing...' : 'Accept'}
                                </button>
                            </>
                        )}
                        
                        {/* Always visible action buttons - disabled if not accepted */}
                        {/* Report an Issue button - Commented out: Feature not fully implemented yet
                        <button
                            type="button"
                            onClick={() => navigate(`/app/scheduled-purchases/report-issue/${req.request_id}`)}
                            disabled={!canUseActionButtons}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg border border-yellow-500 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 ${!canUseActionButtons ? 'opacity-30 cursor-not-allowed' : ''}`}
                        >
                            Report an Issue
                        </button>
                        */}
                        
                        {/* Cancel button */}
                        {canCancel && (
                            <button
                                type="button"
                                onClick={() => {
                                    setPendingCancelRequestId(req.request_id);
                                    setCancelConfirmOpen(true);
                                    setActionError('');
                                }}
                                disabled={busyRequestId === req.request_id}
                                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                        )}

                        {/* Review button for completed purchases (buyer only) */}
                        {isBuyer && isCompleted && req.inventory_product_id && (
                            <button
                                type="button"
                                onClick={() => {
                                    navigate(`/app/purchase-history?review=${encodeURIComponent(req.inventory_product_id)}`);
                                }}
                                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600"
                            >
                                Leave a Review
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Render item group with all its scheduled purchases
    const renderItemGroup = (itemGroup) => {
        if (!itemGroup || itemGroup.purchases.length === 0) return null;
        
        return (
            <div key={itemGroup.productId} className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    {itemGroup.item.title || 'Unknown Item'}
                </h3>
                <div className="space-y-3">
                    {itemGroup.purchases.map((req) => (
                        <PurchaseCard 
                            key={`${req.perspective}-${req.request_id}`} 
                            req={req} 
                            perspective={req.perspective} 
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Ongoing Purchases</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-300">
                        Review scheduled meetup requests.
                    </p>
                </div>

                {actionMessage && (
                    <div className="mb-4 text-sm text-green-600 dark:text-green-400">{actionMessage}</div>
                )}
                {actionError && (
                    <div className="mb-4 text-sm text-red-600 dark:text-red-400">{actionError}</div>
                )}

                {loading ? (
                    <div className="text-gray-600 dark:text-gray-300">Loading scheduled purchases...</div>
                ) : groupedByItem.length === 0 ? (
                    <div className="text-gray-600 dark:text-gray-400">You have no scheduled purchases yet.</div>
                ) : (
                    <div className="space-y-6">
                        {groupedByItem.map(itemGroup => renderItemGroup(itemGroup))}
                    </div>
                )}

                {error && (
                    <div className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</div>
                )}

                {/* Cancel Confirmation Modal */}
                {cancelConfirmOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
                        setCancelConfirmOpen(false);
                        setPendingCancelRequestId(0);
                    }}>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                            <div className="p-6">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                    Cancel Scheduled Purchase?
                                </h3>
                                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                                    Are you sure you want to cancel? This action cannot be undone.
                                </p>
                                {actionError && (
                                    <p className="text-sm text-red-600 dark:text-red-400 mb-4">{actionError}</p>
                                )}
                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={() => {
                                            setCancelConfirmOpen(false);
                                            setPendingCancelRequestId(0);
                                            setActionError('');
                                        }}
                                        disabled={busyRequestId === pendingCancelRequestId}
                                        className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                                    >
                                        No, Keep It
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!pendingCancelRequestId) return;
                                            setBusyRequestId(pendingCancelRequestId);
                                            setActionError('');
                                            try {
                                                const res = await fetch(`${API_BASE}/scheduled-purchases/cancel.php`, {
                                                    method: 'POST',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                        'Accept': 'application/json',
                                                    },
                                                    credentials: 'include',
                                                    body: JSON.stringify({
                                                        request_id: pendingCancelRequestId,
                                                    }),
                                                });
                                                if (!res.ok) {
                                                    throw new Error('Failed to cancel request');
                                                }
                                                const payload = await res.json();
                                                if (!payload.success) {
                                                    throw new Error(payload.error || 'Failed to cancel');
                                                }
                                                setCancelConfirmOpen(false);
                                                setPendingCancelRequestId(0);
                                                await refresh();
                                                setActionMessage('Purchase request cancelled successfully.');
                                            } catch (e) {
                                                setActionError(e.message || 'Something went wrong.');
                                            } finally {
                                                setBusyRequestId(0);
                                            }
                                        }}
                                        disabled={busyRequestId === pendingCancelRequestId}
                                        className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                                    >
                                        {busyRequestId === pendingCancelRequestId ? 'Cancelling...' : 'Yes, Cancel'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default OngoingPurchasesPage;
