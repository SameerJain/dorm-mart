import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MEET_LOCATION_OPTIONS, MEET_LOCATION_OTHER_VALUE } from '../../constants/meetLocations';

const API_BASE = (process.env.REACT_APP_API_BASE || 'api').replace(/\/?$/, '');

// Price limits - max matches ProductListingPage exactly, min is 0 to allow free items
const PRICE_LIMITS = {
    max: 9999.99,
    min: 0,
};

function SchedulePurchasePage() {
    const location = useLocation();
    const navigate = useNavigate();
    const navState = location.state && typeof location.state === 'object' ? location.state : null;

    // Redirect if navState is missing - form should only be accessible from chat
    useEffect(() => {
        if (!navState || !navState.productId || !navState.convId) {
            navigate('/app/chat');
        }
    }, [navState, navigate]);

    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');
    const [meetLocationChoice, setMeetLocationChoice] = useState('');
    const [customMeetLocation, setCustomMeetLocation] = useState('');
    const [meetingDate, setMeetingDate] = useState('');
    const [meetingHour, setMeetingHour] = useState('');
    const [meetingMinute, setMeetingMinute] = useState('');
    const [meetingAmPm, setMeetingAmPm] = useState('');
    const [dateTimeError, setDateTimeError] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
    
    // Prevent body scroll when close confirmation modal is open
    useEffect(() => {
        if (closeConfirmOpen) {
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
    }, [closeConfirmOpen]);
    
    // New fields for price negotiation and trades
    const [negotiatedPrice, setNegotiatedPrice] = useState('');
    const [isTrade, setIsTrade] = useState(false);
    const [tradeItemDescription, setTradeItemDescription] = useState('');
    const [selectedListing, setSelectedListing] = useState(null);

    useEffect(() => {
        const abort = new AbortController();
        async function loadListings() {
            setLoading(true);
            setError('');
            try {
                const res = await fetch(`${API_BASE}/seller-dashboard/manage_seller_listings.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    credentials: 'include',
                    signal: abort.signal,
                    body: JSON.stringify({}),
                });
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const data = await res.json();
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load listings');
                }
                const listingsData = Array.isArray(data.data) ? data.data : [];
                setListings(listingsData);
            } catch (e) {
                if (e.name !== 'AbortError') {
                    setError('Unable to load your listings right now.');
                }
            } finally {
                setLoading(false);
            }
        }

        loadListings();
        return () => abort.abort();
    }, []);


    // Update selectedListing when listings are loaded and navState.productId is available
    useEffect(() => {
        const finalListingId = navState?.productId ? String(navState.productId) : null;
        if (finalListingId && listings.length > 0) {
            const listing = listings.find(l => String(l.id) === finalListingId);
            if (listing) {
                // Normalize boolean values - handle both true/false and 1/0 from API
                const fullListing = {
                    ...listing,
                    priceNegotiable: listing.priceNegotiable === true || listing.priceNegotiable === 1 || listing.priceNegotiable === '1',
                    acceptTrades: listing.acceptTrades === true || listing.acceptTrades === 1 || listing.acceptTrades === '1',
                    meet_location: listing.meet_location || null,
                };
                setSelectedListing(fullListing);
            } else {
                setSelectedListing(null);
            }
            // Reset trade-related fields when listing changes
            setIsTrade(false);
            setTradeItemDescription('');
            setNegotiatedPrice('');
        } else {
            setSelectedListing(null);
        }
    }, [listings, navState]);

    // resetForm function removed - not currently used
    // const resetForm = () => {
    //     setSelectedListingId('');
    //     setSelectedConversationId('');
    //     setMeetLocationChoice('');
    //     setCustomMeetLocation('');
    //     setMeetingDate('');
    //     setMeetingHour('');
    //     setMeetingMinute('');
    //     setMeetingAmPm('');
    //     setDateTimeError('');
    //     setDescription('');
    // };

    // Convert 12-hour format to 24-hour format
    const convertTo24Hour = (hour, amPm) => {
        const hourNum = parseInt(hour);
        if (amPm === 'PM' && hourNum !== 12) {
            return hourNum + 12;
        } else if (amPm === 'AM' && hourNum === 12) {
            return 0;
        }
        return hourNum;
    };

    // Get current Eastern Time as a Date object
    const getEasternTime = () => {
        const now = new Date();
        // Get Eastern Time components
        const easternFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        const parts = easternFormatter.formatToParts(now);
        const year = parseInt(parts.find(p => p.type === 'year').value);
        const month = parseInt(parts.find(p => p.type === 'month').value) - 1; // JS months are 0-indexed
        const day = parseInt(parts.find(p => p.type === 'day').value);
        const hour = parseInt(parts.find(p => p.type === 'hour').value);
        const minute = parseInt(parts.find(p => p.type === 'minute').value);
        const second = parseInt(parts.find(p => p.type === 'second').value);
        
        // Create date representing Eastern Time (treating it as if it were local time)
        return new Date(year, month, day, hour, minute, second);
    };

    // Get today's date in Eastern Time (YYYY-MM-DD format for min attribute)
    const getTodayDate = () => {
        const easternNow = getEasternTime();
        const year = easternNow.getFullYear();
        const month = String(easternNow.getMonth() + 1).padStart(2, '0');
        const day = String(easternNow.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Get maximum date (3 months from now) in Eastern Time (YYYY-MM-DD format for max attribute)
    const getMaxDate = () => {
        const easternNow = getEasternTime();
        const threeMonthsFromNow = new Date(easternNow);
        threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
        const year = threeMonthsFromNow.getFullYear();
        const month = String(threeMonthsFromNow.getMonth() + 1).padStart(2, '0');
        const day = String(threeMonthsFromNow.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Validate date and time (using Eastern Time)
    const validateDateTime = () => {
        setDateTimeError('');
        
        if (!meetingDate || !meetingHour || !meetingMinute || !meetingAmPm) {
            setDateTimeError('Please complete all date and time fields.');
            return false;
        }

        // Get current Eastern Time components
        const easternNow = getEasternTime();
        const easternYear = easternNow.getFullYear();
        const easternMonth = easternNow.getMonth() + 1; // 1-12
        const easternDay = easternNow.getDate();
        const easternHour = easternNow.getHours();
        const easternMinute = easternNow.getMinutes();

        // Parse selected date (treat as Eastern Time)
        const [year, month, day] = meetingDate.split('-').map(Number);
        const selectedHour24 = convertTo24Hour(meetingHour, meetingAmPm);
        const selectedMinute = parseInt(meetingMinute);

        // Compare dates (both in Eastern Time)
        if (year < easternYear || 
            (year === easternYear && month < easternMonth) ||
            (year === easternYear && month === easternMonth && day < easternDay)) {
            setDateTimeError('Meeting date cannot be in the past.');
            return false;
        }

        // If date is today, check if time is in the future (Eastern Time)
        if (year === easternYear && month === easternMonth && day === easternDay) {
            // Compare time components directly (both in Eastern Time)
            if (selectedHour24 < easternHour || 
                (selectedHour24 === easternHour && selectedMinute <= easternMinute)) {
                setDateTimeError('Meeting time must be in the future.');
                return false;
            }
        }
        
        // Check if date/time is more than 3 months in the future
        // Create selected date/time in Eastern Time
        const selectedDateTime = new Date(year, month - 1, day, selectedHour24, selectedMinute, 0); // month is 1-indexed in input, 0-indexed in Date
        
        // Calculate 3 months from now (Eastern Time)
        const threeMonthsFromNow = new Date(easternNow);
        threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
        
        if (selectedDateTime > threeMonthsFromNow) {
            setDateTimeError('Meeting date cannot be more than 3 months in advance.');
            return false;
        }

        return true;
    };

    // Convert separate fields to ISO datetime string (treats input as Eastern Time, converts to UTC)
    const combineDateTime = () => {
        if (!meetingDate || !meetingHour || !meetingMinute || !meetingAmPm) {
            return null;
        }

        const hour24 = convertTo24Hour(meetingHour, meetingAmPm);
        
        // Parse date and create datetime (treat as Eastern Time)
        const [year, month, day] = meetingDate.split('-').map(Number);
        
        // Create date string in Eastern Time format
        const dateTimeString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour24).padStart(2, '0')}:${meetingMinute}:00`;
        
        // Options for formatting Eastern Time
        const easternTimeOptions = {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        
        // Helper function to check if UTC date matches desired Eastern Time
        const checkUtcDate = (utcOffset) => {
            const utcDate = new Date(`${dateTimeString}${utcOffset}`);
            const utcAsEastern = utcDate.toLocaleString('en-US', easternTimeOptions);
            const parts = utcAsEastern.match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+)/);
            if (parts) {
                const [, partMonth, partDay, partYear, partHour, partMinute] = parts.map(Number);
                if (partYear === year && partMonth === month && partDay === day && 
                    partHour === hour24 && partMinute === parseInt(meetingMinute)) {
                    return utcDate.toISOString();
                }
            }
            return null;
        };
        
        // Try EST (UTC-5) first
        const estResult = checkUtcDate('-05:00');
        if (estResult) return estResult;
        
        // Try EDT (UTC-4)
        const edtResult = checkUtcDate('-04:00');
        if (edtResult) return edtResult;
        
        // Fallback: use EST
        return new Date(`${dateTimeString}-05:00`).toISOString();
    };

    async function handleSubmit(e) {
        e.preventDefault();
        setFormError('');
        setFormSuccess('');
        setDateTimeError('');

        // Validate date and time first
        if (!validateDateTime()) {
            return;
        }

        const trimmedCustomLocation = customMeetLocation.trim();
        const finalMeetLocation = meetLocationChoice === MEET_LOCATION_OTHER_VALUE
            ? trimmedCustomLocation
            : meetLocationChoice;

        // Get values from navState (required since form is only accessible from chat)
        const finalListingId = navState?.productId ? String(navState.productId) : null;
        const finalConversationId = navState?.convId ? String(navState.convId) : null;
        
        if (!finalListingId || !finalConversationId || !finalMeetLocation) {
            setFormError('Please complete all required fields before submitting.');
            return;
        }

        // Validate trade item description if trade is selected
        if (isTrade && !tradeItemDescription.trim()) {
            setFormError('Please describe the item you are trading for.');
            return;
        }

        const meetingDateTimeISO = combineDateTime();
        if (!meetingDateTimeISO) {
            setFormError('Please provide a valid meeting date and time.');
            return;
        }

        // Validate that negotiated price is only provided if item is price negotiable
        if (negotiatedPrice.trim() && !selectedListing?.priceNegotiable) {
            setFormError('This item is not marked as price negotiable.');
            return;
        }

        // Validate that trade is only selected if item accepts trades
        if (isTrade && !selectedListing?.acceptTrades) {
            setFormError('This item does not accept trades.');
            return;
        }

        // Validate that price cannot be entered if trade is selected
        if (isTrade && negotiatedPrice.trim()) {
            setFormError('Cannot enter a price for a trade. Please clear the price field or uncheck the trade option.');
            return;
        }

        setIsSubmitting(true);
        try {
            const negotiatedPriceValue = negotiatedPrice.trim() ? parseFloat(negotiatedPrice) : null;
            if (negotiatedPriceValue !== null) {
                if (isNaN(negotiatedPriceValue) || !isFinite(negotiatedPriceValue)) {
                    setFormError('Please enter a valid price.');
                    setIsSubmitting(false);
                    return;
                }
                if (negotiatedPriceValue < 0) {
                    setFormError('Price cannot be negative.');
                    setIsSubmitting(false);
                    return;
                }
                if (negotiatedPriceValue > PRICE_LIMITS.max) {
                    setFormError(`Price must be $${PRICE_LIMITS.max.toFixed(2)} or less`);
                    setIsSubmitting(false);
                    return;
                }
            }

            const res = await fetch(`${API_BASE}/scheduled-purchases/create.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    inventory_product_id: Number(finalListingId),
                    conversation_id: Number(finalConversationId),
                    meet_location: finalMeetLocation,
                    meet_location_choice: meetLocationChoice,
                    custom_meet_location: meetLocationChoice === MEET_LOCATION_OTHER_VALUE ? trimmedCustomLocation : null,
                    meeting_at: meetingDateTimeISO,
                    description: description.trim() || null,
                    negotiated_price: negotiatedPriceValue,
                    is_trade: isTrade,
                    trade_item_description: isTrade ? tradeItemDescription.trim() : null,
                }),
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const payload = await res.json();
            if (!payload.success) {
                throw new Error(payload.error || 'Failed to create schedule');
            }

            // Redirect back to chat page, optionally to the specific conversation
            if (navState?.convId) {
                navigate(`/app/chat?conv=${navState.convId}`);
            } else {
                navigate('/app/chat');
            }
        } catch (err) {
            setFormError(err.message === 'Failed to create schedule' ? err.message : 'Could not create the schedule. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Schedule a Purchase</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-300">
                        Coordinate a meetup with a buyer you are chatting with. They will confirm on their side and share the
                        provided 4-character code at the exchange.
                    </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                                Meet Location <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={meetLocationChoice}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setMeetLocationChoice(value);
                                    if (value !== MEET_LOCATION_OTHER_VALUE) {
                                        setCustomMeetLocation('');
                                    }
                                }}
                                className={`w-full bg-white dark:bg-gray-900 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    selectedListing?.meet_location && meetLocationChoice === selectedListing.meet_location
                                        ? 'border-blue-500 dark:border-blue-400'
                                        : 'border-gray-300 dark:border-gray-700'
                                }`}
                            >
                                <option value="" disabled>Select An Option</option>
                                {MEET_LOCATION_OPTIONS.map((option) => {
                                    // Compare meet location - handle both predefined options and custom locations
                                    const itemLocation = selectedListing?.meet_location;
                                    const isItemLocation = itemLocation && 
                                        (option.value === itemLocation || 
                                         (option.value === MEET_LOCATION_OTHER_VALUE && 
                                          itemLocation !== 'North Campus' && 
                                          itemLocation !== 'South Campus' && 
                                          itemLocation !== 'Ellicott'));
                                    return (
                                        <option 
                                            key={option.value || 'unselected'} 
                                            value={option.value}
                                            style={isItemLocation ? { backgroundColor: '#dbeafe' } : {}}
                                        >
                                            {option.label}{isItemLocation ? ' (Listed on item form)' : ''}
                                        </option>
                                    );
                                })}
                            </select>
                            {meetLocationChoice === MEET_LOCATION_OTHER_VALUE && (
                                <input
                                    type="text"
                                    value={customMeetLocation}
                                    onChange={(e) => setCustomMeetLocation(e.target.value)}
                                    maxLength={255}
                                    placeholder="Enter meet location"
                                    className="mt-2 w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            )}
                            {selectedListing?.meet_location && (
                                (meetLocationChoice === selectedListing.meet_location || 
                                 (meetLocationChoice === MEET_LOCATION_OTHER_VALUE && 
                                  customMeetLocation.trim() === selectedListing.meet_location)) && (
                                    <p className="mt-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                                        ✓ This location matches the one listed on your item form
                                    </p>
                                )
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                                Meeting Date &amp; Time <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={meetingDate}
                                        onChange={(e) => {
                                            setMeetingDate(e.target.value);
                                            setDateTimeError('');
                                        }}
                                        min={getTodayDate()}
                                        max={getMaxDate()}
                                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Hour</label>
                                    <select
                                        value={meetingHour}
                                        onChange={(e) => {
                                            setMeetingHour(e.target.value);
                                            setDateTimeError('');
                                        }}
                                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">--</option>
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                                            <option key={hour} value={String(hour)}>
                                                {hour}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Minute</label>
                                    <select
                                        value={meetingMinute}
                                        onChange={(e) => {
                                            setMeetingMinute(e.target.value);
                                            setDateTimeError('');
                                        }}
                                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">--</option>
                                        {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => {
                                            const minuteStr = String(minute).padStart(2, '0');
                                            return (
                                                <option key={minuteStr} value={minuteStr}>
                                                    {minuteStr}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">AM/PM</label>
                                    <select
                                        value={meetingAmPm}
                                        onChange={(e) => {
                                            setMeetingAmPm(e.target.value);
                                            setDateTimeError('');
                                        }}
                                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">--</option>
                                        <option value="AM">AM</option>
                                        <option value="PM">PM</option>
                                    </select>
                                </div>
                            </div>
                            {dateTimeError && (
                                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{dateTimeError}</p>
                            )}
                        </div>

                        {/* Price negotiation field - only show if item is price negotiable */}
                        {selectedListing?.priceNegotiable && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                                    Negotiated Price (Optional)
                                </label>
                                {selectedListing?.price && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-medium">
                                        Listed price: ${Number(selectedListing.price).toFixed(2)}
                                    </p>
                                )}
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max={PRICE_LIMITS.max}
                                        value={negotiatedPrice}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '') {
                                                setNegotiatedPrice('');
                                                return;
                                            }
                                            const numValue = parseFloat(value);
                                            if (!isNaN(numValue) && numValue <= PRICE_LIMITS.max) {
                                                setNegotiatedPrice(value);
                                            }
                                        }}
                                        placeholder="Enter negotiated price"
                                        disabled={isTrade}
                                        className={`flex-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isTrade ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    />
                                    {selectedListing?.acceptTrades && (
                                        <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                                            <input
                                                type="checkbox"
                                                checked={isTrade}
                                                onChange={(e) => {
                                                    setIsTrade(e.target.checked);
                                                    if (e.target.checked) {
                                                        // Clear price when trade is selected
                                                        setNegotiatedPrice('');
                                                    } else {
                                                        setTradeItemDescription('');
                                                    }
                                                }}
                                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                                This is an item trade
                                            </span>
                                        </label>
                                    )}
                                </div>
                                {/* Warning message if negotiated price is higher than listed price */}
                                {negotiatedPrice.trim() && selectedListing?.price && (() => {
                                    const negotiatedPriceValue = parseFloat(negotiatedPrice);
                                    const listedPriceValue = parseFloat(selectedListing.price);
                                    if (!isNaN(negotiatedPriceValue) && !isNaN(listedPriceValue) && negotiatedPriceValue > listedPriceValue) {
                                        return (
                                            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                                                This is higher than the listed price
                                            </p>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        )}

                        {/* Trade toggle - show separately if item accepts trades but is NOT price negotiable */}
                        {selectedListing?.acceptTrades && !selectedListing?.priceNegotiable && (
                            <div>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isTrade}
                                                onChange={(e) => {
                                                    setIsTrade(e.target.checked);
                                                    if (e.target.checked) {
                                                        // Clear price when trade is selected
                                                        setNegotiatedPrice('');
                                                    } else {
                                                        setTradeItemDescription('');
                                                    }
                                                }}
                                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                            />
                                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                                                This is an item trade
                                            </span>
                                        </label>
                            </div>
                        )}

                        {/* Trade item description - only show if item accepts trades and trade is selected */}
                        {selectedListing?.acceptTrades && isTrade && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                                    Item You Are Trading For <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={tradeItemDescription}
                                    onChange={(e) => setTradeItemDescription(e.target.value)}
                                    rows={3}
                                    maxLength={100}
                                    placeholder="Describe the item you are trading..."
                                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                                    required={isTrade}
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {tradeItemDescription.length}/100 characters
                                </p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Description (Optional)</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                maxLength={1000}
                                placeholder="Add any additional details about the meeting..."
                                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {description.length}/1000 characters
                            </p>
                        </div>

                        {formError && (
                            <div className="text-sm text-red-600 dark:text-red-400">{formError}</div>
                        )}
                        {formSuccess && (
                            <div className="text-sm text-green-600 dark:text-green-400">{formSuccess}</div>
                        )}

                        <div className="pt-2 flex justify-between items-center">
                            <button
                                type="button"
                                onClick={() => setCloseConfirmOpen(true)}
                                className="inline-flex items-center px-4 py-2 border-2 border-red-500 text-red-600 dark:text-red-400 text-sm font-semibold rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                                Close
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                            >
                                {isSubmitting ? 'Scheduling...' : 'Schedule Purchase'}
                            </button>
                        </div>
                    </form>
                </div>

                {error && (
                    <div className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</div>
                )}

                {/* Close Confirmation Modal */}
                {closeConfirmOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setCloseConfirmOpen(false)}>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                            <div className="p-6">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Close This Form?</h3>
                                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                                    Are you sure you want to close? All information you've entered will be lost.
                                </p>
                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={() => setCloseConfirmOpen(false)}
                                        className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                    >
                                        No, Keep Editing
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (navState?.convId) {
                                                navigate(`/app/chat?conv=${navState.convId}`);
                                            } else {
                                                navigate('/app/chat');
                                            }
                                        }}
                                        className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700"
                                    >
                                        Yes, Close
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

export default SchedulePurchasePage;



