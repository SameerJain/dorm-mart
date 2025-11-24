const BASE =  process.env.REACT_APP_API_BASE || "/api";

export async function fetch_me(signal) {
  const r = await fetch(`${BASE}/auth/me.php`, {
    method: 'GET',
    credentials: 'include', // send cookies (PHP session) with the request
    headers: { 'Accept': 'application/json' },
    signal // allows aborting the request if the component unmounts
  });
  if (!r.ok) throw new Error(`not authenticated`);
  return r.json();
}

export async function fetch_conversations(signal) {
  // returns: { success: true, conversations: [{ conv_id, user_1, user_2, ... }] }
  const r = await fetch(`${BASE}/chat/fetch_conversations.php`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
    signal,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function fetch_conversation(convId, signal) {
  // returns: { success: true, messages: [{ message_id, sender_id, content, created_at, ... }] }
  const r = await fetch(`${BASE}/chat/fetch_conversation.php?conv_id=${convId}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include", // session-based auth
    signal,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function fetch_new_messages(activeConvId, ts, signal) {
  const r = await fetch(`${BASE}/chat/fetch_new_messages.php?conv_id=${activeConvId}&ts=${ts}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include", // session-based auth
    signal,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function tick_fetch_new_messages(activeConvId, myId, sinceSec, signal) {
  const res = await fetch_new_messages(activeConvId, sinceSec, signal);
  const raw = res?.messages ?? [];
  const typingStatus = res?.typing_status || { is_typing: false, typing_user_first_name: null };

  const myIdNum = Number(myId);
  if (!Number.isInteger(myIdNum) || myIdNum <= 0) {
    console.error('Invalid myId in tick_fetch_new_messages:', myId);
    return { messages: [], typingStatus };
  }

  // Always return typing status, even if no new messages
  if (!raw.length) {
    return { messages: [], typingStatus };
  }

  const messages = raw.map((m) => {
    const senderIdNum = Number(m.sender_id);
    const metadata = (() => {
      if (!m.metadata) return null;
      if (typeof m.metadata === "object") return m.metadata;
      try { return JSON.parse(m.metadata); } catch { return null; }
    })();

    // be lenient about key names coming from backend
    const imageUrl = m.image_url ?? m.imagePath ?? m.image_path ?? null;

    // base shape
    const base = {
      message_id: m.message_id,
      sender: Number.isInteger(senderIdNum) && senderIdNum > 0
        ? (senderIdNum === myIdNum ? "me" : "them")
        : "them",
      content: m.content ?? "",
      ts: Date.parse(m.created_at),
      metadata,
    };

    // only add the flag/field if present
    if (imageUrl) base.image_url = imageUrl;

    return base;
  });

  return { messages, typingStatus };
}

export async function fetch_unread_messages(signal) {
  const r = await fetch(`${BASE}/chat/fetch_unread_messages.php`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include", // session-based auth
    signal,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function tick_fetch_unread_messages(signal) {
  const res = await fetch_unread_messages(signal);
  const raw = res.unreads ?? [];

  // build { conv_id -> count }
  const unreads = {};
  let total = 0;
  for (const u of raw) {
      const cid = Number(u.conv_id);
      const cnt = Number(u.unread_count) || 0;
      if (cid > 0 && cnt > 0) {
        unreads[cid] = cnt;
        total += cnt;
      }
  }
  return { unreads, total };
}

export async function fetch_unread_notifications(signal) {
    const r = await fetch(`${BASE}/wishlist/fetch_unread_notifications.php`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include", // session-based auth
    signal,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function tick_fetch_unread_notifications(signal) {
  const res = await fetch_unread_notifications(signal);
  const raw = res.unreads ?? [];

  // build { product_id -> { count, title } }
  const unreads = {};
  let total = 0;

  for (const u of raw) {
    const pid = Number(u.product_id);
    const title = u.title ?? "";
    const image_url = u.image_url ?? "";
    const cnt = Number(u.unread_count) || 0;

    if (pid > 0 && cnt > 0) {
      unreads[pid] = { count: cnt, title, image_url };
      total += cnt;
    }
  }

  return { unreads, total };
}


export async function create_message({ receiverId, convId, content, signal }) {
  const body = {
    receiver_id: receiverId,
    content
  };
  if (convId) {
    body.conv_id = convId;
  }
  const r = await fetch(`${BASE}/chat/create_message.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", // tells PHP we're sending JSON
      "Accept": "application/json"
    },
    credentials: "include",               // sends PHP session cookie if your server uses it
    body: JSON.stringify(body),
    signal                                // lets you cancel if needed
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();                        // expect JSON back from PHP
}

// Image-message endpoint (multipart/form-data)
export async function create_image_message({ receiverId, convId, content, image, signal }) {
  const form = new FormData();                       // browser handles multipart boundary
  form.append("receiver_id", String(receiverId));    // PHP: $_POST['receiver_id']
  if (convId) form.append("conv_id", String(convId));
  form.append("content", content ?? "");             // optional caption
  form.append("image", image, image.name);           // PHP: $_FILES['image']

  const r = await fetch(`${BASE}/chat/create_image_message.php`, {
    method: "POST",
    body: form,                                      // DO NOT set Content-Type manually
    credentials: "include",
    signal,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();                                    // expects { success, message: { ... , image_url } }
}


export function envBool(value, fallback = false) {
  if (value == null) return fallback;
  const v = String(value).trim().toLowerCase();
  // Accept common truthy/falsey spellings
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}