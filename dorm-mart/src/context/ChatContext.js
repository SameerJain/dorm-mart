import {
  createContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { 
    fetch_me,
    fetch_conversations,
    fetch_conversation,
    create_message,
    create_image_message,
    tick_fetch_new_messages,
    tick_fetch_unread_messages,
    tick_fetch_unread_notifications,
    envBool 
} from "./chat_context_utils";

export const ChatContext = createContext(null);

export function ChatProvider({ children }) {
    const NEW_MSG_POLL_MS = 1000;
    const UNREAD_MSG_POLL_MS = 5000;
    const UNREAD_NOTIFICATION_POLL_MS = 10000;
    const newMsgPollRef = useRef(null);
    const lastTsRefByConv = useRef({}); // { [convId]: last-message-ts }
    const unreadMsgPollRef = useRef(null);
    const unreadNotifPollRef = useRef(null);

    const location = useLocation();
    const isOnChatRoute = location.pathname.startsWith("/app/chat");

    const [myId, setMyId] = useState(null);
    const myIdRef = useRef(null);
    useEffect(() => { myIdRef.current = myId; }, [myId]);

    function removeConversationLocal(convId) {
        const id = Number(convId);
        if (!id) return;

        // Remove from conversation list
        setConversations((prev) => prev.filter((c) => c.conv_id !== id));

        // Remove its messages from memory
        setMessagesByConv((prev) => {
            if (!prev[id]) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
        });

        // Remove typing status for this conversation
        setTypingStatusByConv((prev) => {
            if (!prev[id]) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
        });

        // Drop last-ts tracking for this conv
        if (lastTsRefByConv.current[id]) {
            delete lastTsRefByConv.current[id];
        }

        // If we're currently viewing it, close the active conversation
        setActiveConvId((current) => (current === id ? null : current));
    }


    function projectConversationRow(row, currentUserId) {
        if (!row || !currentUserId) return null;
        const convId = Number(row.conv_id);
        const user1Id = Number(row.user1_id);
        const user2Id = Number(row.user2_id);
        if (!Number.isInteger(convId) || !Number.isInteger(user1Id) || !Number.isInteger(user2Id)) {
            return null;
        }
        const iAmUser1 = user1Id === currentUserId;
        const iAmUser2 = user2Id === currentUserId;
        if (!iAmUser1 && !iAmUser2) {
            return null;
        }
        const receiverId = iAmUser1 ? user2Id : user1Id;
        const rawName = iAmUser1 ? (row.user2_fname ?? '') : (row.user1_fname ?? '');
        const receiverName = rawName && rawName.trim() !== '' ? rawName : `User ${receiverId}`;
        const productTitle = row.product_title || null;
        const productId = row.product_id ? Number(row.product_id) : null;
        const productSellerId = row.product_seller_id ? Number(row.product_seller_id) : null;
        const productImageUrl = row.product_image_url || null;
        return {
            conv_id: convId,
            receiverId,
            receiverName,
            productTitle,
            productId,
            productSellerId,
            productImageUrl,
        };
    }

    const pendingConversationsRef = useRef([]);
    const conversationsRef = useRef([]);

    function upsertConversationRow(row) {
        const currentId = myIdRef.current;
        const entry = projectConversationRow(row, currentId);
        if (!entry) {
            if (!currentId) {
                const pending = pendingConversationsRef.current;
                const existing = pending.find((c) => Number(c?.conv_id) === Number(row?.conv_id));
                if (!existing) {
                    pending.push(row);
                }
            }
            return null;
        }
        setConversations((prev) => {
            const idx = prev.findIndex((c) => c.conv_id === entry.conv_id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = entry;
                return next;
            }
            return [...prev, entry];
        });
        return entry;
    }

    const lastNavConvRef = useRef(null);
    const refreshInFlightRef = useRef(false);
    const pendingConvFetchesRef = useRef(new Set()); // Track conversations waiting for myId

    // chat
    const [conversations, setConversations] = useState([]);
    const [activeConvId, setActiveConvId] = useState(null);
    const [messagesByConv, setMessagesByConv] = useState({});
    const [typingStatusByConv, setTypingStatusByConv] = useState({}); // { convId -> { is_typing, typing_user_first_name } }
    const [convError, setConvError] = useState(false);
    const [chatByConvError, setChatByConvError] = useState({});
    const [sendMsgError, setSendMsgError] = useState(false);


    function clearActiveConversation() {
        setActiveConvId(null); // stops new-message polling because the effect below bails when no activeConvId
    }

    // notification
    const [unreadMsgByConv, setUnreadMsgConv] = useState({});  // { conv_id -> count }
    const [unreadMsgTotal, setUnreadMsgTotal] = useState(0);     // sum of counts
    const [unreadNotificationsByProduct, setUnreadNotificationsByProduct] = useState({}); // { product_id -> { count, title } }
    const [unreadNotificationTotal, setUnreadNotificationTotal] = useState(0);
    
    function markAllNotificationsReadLocal() {
        // Clear all product notification entries and zero out the total
        setUnreadNotificationsByProduct({});
        setUnreadNotificationTotal(0);
    }

    function markNotificationReadLocal(productId) {
        const key = String(productId);
        setUnreadNotificationsByProduct((prev) => {
            if (!prev || !Object.prototype.hasOwnProperty.call(prev, key)) {
                return prev;
            }

            const info = prev[key];
            const dec = Number(info?.count ?? 0);

            const next = { ...prev };
            delete next[key];

            if (dec > 0) {
                setUnreadNotificationTotal((total) =>
                    Math.max(0, (Number(total) || 0) - dec)
                );
            }

            return next;
        });
    }

    const loadConversations = async (signal, userIdOverride) => {
        try {
            const res = await fetch_conversations(signal);
            if (!res.success) {
                throw new Error("Failed to load conversations");
            }
            const currentUserId = userIdOverride ?? myIdRef.current;
            if (!currentUserId) return;
            const view = (res.conversations || [])
                .map((c) => projectConversationRow(c, currentUserId))
                .filter(Boolean);

            setConversations(view);
        } catch (err) {
            setConvError(true);
        }
    };

    // on context load, fetch all conversations
    useEffect(() => {
        const controller = new AbortController();

        (async () => {
            try {
                setConvError(false);
                const me = await fetch_me(controller.signal);
                setMyId(me.user_id);
                await loadConversations(controller.signal, me.user_id);
            } catch (err) {
                setConvError(true);
            }
        })();

        return () => controller.abort();
    }, []);

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    useEffect(() => {
        if (!myId) return;
        if (!pendingConversationsRef.current.length) return;
        const queued = pendingConversationsRef.current.splice(0, pendingConversationsRef.current.length);
        queued.forEach((row) => {
            upsertConversationRow(row);
        });
    }, [myId]);

    // Retry pending conversation fetches when myId becomes available
    useEffect(() => {
        if (!myId) return;
        const pending = Array.from(pendingConvFetchesRef.current);
        if (pending.length === 0) return;
        
        // Clear the pending set and retry each conversation
        pendingConvFetchesRef.current.clear();
        pending.forEach((convId) => {
            fetchConversation(convId);
        });
    }, [myId]);

    useEffect(() => {
        if (!location.pathname.startsWith("/app/chat")) {
            lastNavConvRef.current = null;
            return;
        }

        // Guard: Only auto-load conversations when myId is available
        if (!myId) {
            return;
        }

        let convId = null;
        const navState = location.state && typeof location.state === 'object' ? location.state : null;

        if (navState && navState.convId != null) {
            convId = Number(navState.convId);
        }

        if (convId == null && location.search) {
            try {
                const params = new URLSearchParams(location.search);
                const queryConv = params.get('conv');
                if (queryConv) convId = Number(queryConv);
            } catch (_) {
                // ignore malformed query string
            }
        }

        if (convId == null && navState && navState.receiverId != null) {
            const receiverId = Number(navState.receiverId);
            if (!Number.isNaN(receiverId)) {
                const match = conversations.find((c) => c.receiverId === receiverId);
                if (match) convId = match.conv_id;
            }
        }

        if (convId && !Number.isNaN(convId) && convId > 0) {
            if (lastNavConvRef.current !== convId) {
                lastNavConvRef.current = convId;
                fetchConversation(convId);
            }
        }
    }, [location, conversations, myId]);

    // when a chat is selected
    async function fetchConversation(convId) {
        setActiveConvId(convId);
        setChatByConvError((m) => ({...m, [convId]: false}));

        // Check if myId is available before proceeding
        const currentMyId = myIdRef.current;
        if (!currentMyId) {
            // Queue this conversation for retry once myId is loaded
            pendingConvFetchesRef.current.add(convId);
            return;
        }

        const controller = new AbortController();
        try {
            const res = await fetch_conversation(convId, controller.signal)
            if (!res.success) {
                throw new Error("Failed to load conversations");
            }

            const raw = res.messages || [];
            const myIdNum = Number(currentMyId);
            if (!Number.isInteger(myIdNum) || myIdNum <= 0) {
                throw new Error("Invalid user ID");
            }
            
            const normalized = raw.map((m) => {
                const metadata = (() => {
                    if (!m.metadata) return null;
                    if (typeof m.metadata === "object") return m.metadata;
                    try {
                        return JSON.parse(m.metadata);
                    } catch {
                        return null;
                    }
                })();
                const senderIdNum = Number(m.sender_id);
                if (!Number.isInteger(senderIdNum) || senderIdNum <= 0) {
                    // Invalid sender_id, default to "them" for safety
                    return {
                        message_id: m.message_id,
                        sender: "them",
                        content: m.content,
                        image_url: m.image_url,
                        ts: Date.parse(m.created_at),
                        metadata,
                    };
                }
                return {
                    message_id: m.message_id,
                    sender: senderIdNum === myIdNum ? "me" : "them",
                    content: m.content,
                    image_url: m.image_url,
                    ts: Date.parse(m.created_at),
                    metadata,
                }
            });

            setMessagesByConv((prev) => ({...prev, [convId]: normalized}));            
            lastTsRefByConv.current[convId] = normalized.length
            ? Math.max(...normalized.map((m) => Number(m.ts) || 0))
            : 0;

            clearUnreadMsgFor(convId);
            
            // Remove from pending set on success
            pendingConvFetchesRef.current.delete(convId);

        } catch(err) {
            if (err.name !== "AbortError") {
                setChatByConvError((m) => ({...m, [convId]: true}));
                // Remove from pending set on error (will be retried if myId becomes available)
                pendingConvFetchesRef.current.delete(convId);
            }
        }
    }

    // allow a second arg with an image File
    async function createMessage(draft) {
        setSendMsgError(false);

        const content = (draft ?? "").trim();
        if (!content || !activeConvId || !myIdRef.current) return;

        const convo = conversations.find((c) => c.conv_id === activeConvId);
        if (!convo) return;

        try {
            const res = await create_message({
                senderId: myIdRef.current,
                receiverId: convo.receiverId,
                convId: activeConvId,
                content,                 // text only
                signal: undefined,
            });

            const saved = res.message;
            const newMsg = {
                message_id: saved.message_id,
                sender: "me",
                content: saved.content,
                ts: Date.parse(saved.created_at),
            };

            setMessagesByConv((prev) => {
                const list = prev[activeConvId] ? [...prev[activeConvId], newMsg] : [newMsg];
                return { ...prev, [activeConvId]: list };
            });
        } catch (err) {
            setSendMsgError(true);
        }
    }


    async function createImageMessage(draft, file) {
        setSendMsgError(false);

        if (!file || !activeConvId || !myIdRef.current) return;

        const caption = (draft ?? "").trim();  // optional; backend can allow empty caption

        const convo = conversations.find((c) => c.conv_id === activeConvId);
        if (!convo) return;

        try {
            const res = await create_image_message({
                receiverId: convo.receiverId,
                convId: activeConvId,
                content: caption,                   // caption (can be empty string)
                image: file,                        // native File object
                signal: undefined,
            });

            const saved = res.message;
            const newMsg = {
                message_id: saved.message_id,
                sender: "me",
                content: saved.content ?? "",       // caption if any
                ts: Date.parse(saved.created_at),
                image_url: saved.image_url,         // backend should return this
            };

            setMessagesByConv((prev) => {
                const list = prev[activeConvId] ? [...prev[activeConvId], newMsg] : [newMsg];
                return { ...prev, [activeConvId]: list };
            });
        } catch (err) {
            setSendMsgError(true);
        }
    }

        // tick for fetching new messages
    useEffect(() => {
        // helper to stop any existing interval
        const stopPolling = () => {
            if (newMsgPollRef.current) {
            clearInterval(newMsgPollRef.current);
            newMsgPollRef.current = null;
            }
        };

        // whenever deps change, clear old interval first
        stopPolling();

        // if not in chat, or no active conversation, or no user ID, do nothing
        if (!isOnChatRoute || !activeConvId || !myIdRef.current) {
            return;
        }

        const shouldPollNow = () => document.visibilityState === "visible";

        // keep a handle to the current in-flight request so we can cancel it properly
        const inFlightRef = { ctrl: null }; // { ctrl: AbortController | null }

        const tick = async () => {
            if (!shouldPollNow()) return;

            const currentMyId = myIdRef.current;
            if (!currentMyId) return;

            // cancel any previous unfinished request before starting a new one
            if (inFlightRef.ctrl) {
            inFlightRef.ctrl.abort();
            }

            const controller = new AbortController();
            inFlightRef.ctrl = controller;

            try {
            const sinceSec = Math.floor((lastTsRefByConv.current[activeConvId] || 0) / 1000);
            const result = await tick_fetch_new_messages(
                activeConvId,
                currentMyId,
                sinceSec,
                controller.signal
            );

            const incoming = result?.messages ?? [];
            const typingStatus = result?.typingStatus ?? { is_typing: false, typing_user_first_name: null };

            // Update typing status for this conversation (always update, even if no new messages)
            setTypingStatusByConv((prev) => ({
                ...prev,
                [activeConvId]: typingStatus
            }));

            if (!incoming.length) return;

            setMessagesByConv((prev) => {
                const existing = prev[activeConvId] ?? [];
                const seen = new Set(existing.map((m) => m.message_id));
                const merged = existing.concat(
                incoming.filter((m) => !seen.has(m.message_id))
                );
                return { ...prev, [activeConvId]: merged };
            });

            clearUnreadMsgFor(activeConvId);

            const maxTs = Math.max(...incoming.map((m) => Number(m.ts) || 0));
            lastTsRefByConv.current[activeConvId] = Math.max(
                lastTsRefByConv.current[activeConvId] || 0,
                maxTs
            );
            } catch (e) {
            if (e.name !== "AbortError") {
                console.error("tick_fetch_new_messages error:", e);
            }
            } finally {
            // IMPORTANT: do NOT abort here — aborting after completion
            // makes Chrome mark the request as (canceled) in the Network tab.
            inFlightRef.ctrl = null; // clear handle; request is done
            }
        };

        // run once immediately
        tick();
        newMsgPollRef.current = setInterval(tick, NEW_MSG_POLL_MS);

        return () => {
            // cleanup on unmount / dependency change
            stopPolling();
            if (inFlightRef.ctrl) {
            inFlightRef.ctrl.abort();
            }
        };
    }, [activeConvId, isOnChatRoute, myId]);


    function clearUnreadMsgFor(convId) {
    setUnreadMsgConv((prev) => {
        const prevCnt = Number(prev[convId]) || 0;   // normalize
        if (prevCnt === 0) return prev;              // nothing to clear

        const next = { ...prev };
        delete next[convId];                         // drop this convo’s badge

        setUnreadMsgTotal((t) => Math.max(0, (Number(t) || 0) - prevCnt)); // keep total in sync
        return next;
        });
    };

    // tick for fetching unread messages
    useEffect(() => {
        // clear any previous unread interval
        const stopPolling = () => {
            if (unreadMsgPollRef.current) {
            clearInterval(unreadMsgPollRef.current);   // stop the repeating timer
            unreadMsgPollRef.current = null;           // mark “no active interval”
            }
        };
        stopPolling();

        const notificationOn = envBool(process.env.REACT_APP_CHAT_NOTIFICATION_ON, true);
        if (!notificationOn) return;
        if (!myId) return;
        
        const shouldPollNow = () => document.visibilityState === "visible";

        const tick = async () => {
            if (!shouldPollNow()) return;
            const controller = new AbortController();
            try {
                const { unreads, total } = await tick_fetch_unread_messages(controller.signal);
                setUnreadMsgConv(unreads);
                setUnreadMsgTotal(total);

                const currentConvs = conversationsRef.current;
                const convIds = new Set(currentConvs.map((c) => c.conv_id));
                const missing = Object.keys(unreads || {})
                    .map((id) => Number(id))
                    .filter((id) => id && !convIds.has(id));

                if (missing.length && !refreshInFlightRef.current) {
                    refreshInFlightRef.current = true;
                    try {
                        await loadConversations();
                    } finally {
                        refreshInFlightRef.current = false;
                    }
                }
            } catch (e) {
               stopPolling();
            } finally {
                controller.abort();
            }
        };

        tick();
        unreadMsgPollRef.current = setInterval(tick, UNREAD_MSG_POLL_MS);
        return stopPolling;
    }, [UNREAD_MSG_POLL_MS, myId]);

    // tick for fetching unread notifications (non-chat)
    useEffect(() => {
        // clear any previous notification interval
        const stopPolling = () => {
            if (unreadNotifPollRef.current) {
                clearInterval(unreadNotifPollRef.current);
                unreadNotifPollRef.current = null;
            }
        };
        stopPolling();

        const notificationOn = envBool(process.env.REACT_APP_CHAT_NOTIFICATION_ON, true);

        if (!notificationOn) return;
        if (!myId) return;

        const shouldPollNow = () => document.visibilityState === "visible";

        const tick = async () => {
            if (!shouldPollNow()) return;
            const controller = new AbortController(); // per-tick controller
            try {
                const { unreads, total } = await tick_fetch_unread_notifications(controller.signal);
                setUnreadNotificationsByProduct(unreads || {});
                setUnreadNotificationTotal(Number(total) || 0);
            } catch (e) {
                // on hard error, stop polling to avoid hammering the backend
                stopPolling();
            } finally {
                controller.abort(); // ensure request is fully canceled after completion
            }
        };

        tick(); // initial fetch
        unreadNotifPollRef.current = setInterval(tick, UNREAD_NOTIFICATION_POLL_MS);

        return stopPolling;
    }, [UNREAD_NOTIFICATION_POLL_MS, myId]);


    const messages = useMemo(() => messagesByConv[activeConvId] || [], [messagesByConv, activeConvId]);

    const value = {
        // chat state
        conversations,
        activeConvId,
        messages,
        messagesByConv, // Expose to check loading state
        typingStatusByConv, // Typing status per conversation
        convError,
        chatByConvError,
        sendMsgError,
        // unread state
        unreadMsgByConv,
        unreadMsgTotal,
        unreadNotificationTotal,
        unreadNotificationsByProduct,
        // user info
        myId,
        // actions
        fetchConversation,
        createMessage,
        createImageMessage,
        clearActiveConversation,
        registerConversation: upsertConversationRow,
        markAllNotificationsReadLocal,
        markNotificationReadLocal,
        removeConversationLocal,
        // config (optional: useful for tests or dynamic tuning)
        _config: { POLL_MS: NEW_MSG_POLL_MS, UNREAD_MSG_POLL_MS },
  };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
