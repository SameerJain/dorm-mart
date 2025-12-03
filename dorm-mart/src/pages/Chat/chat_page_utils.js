export default function fmtTime(ts) {
  const d = new Date(ts);     // if ts is seconds, use new Date(ts * 1000)
  const now = new Date();

  // Compare calendar dates in the user's local time zone
  const sameLocalDate = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  // 1) Today → just time with AM/PM (local)
  if (sameLocalDate(d, now)) {
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true, // includes AM/PM
    });
  }

  // 2) Yesterday → "yesterday HH:MM AM/PM" (local)
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameLocalDate(d, yesterday)) {
    const time = d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return `yesterday ${time}`;
  }

  // 3) Otherwise → full date + time with AM/PM (local)
  return d.toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}