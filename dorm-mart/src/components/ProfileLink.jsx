import { Link } from "react-router-dom";

const INVALID_PATTERNS = [/unknown/i, /^seller\s*#/i];

function normalizeCandidate(value) {
  if (!value) return "";
  const str = String(value).trim();
  if (!str) return "";
  if (INVALID_PATTERNS.some((rx) => rx.test(str))) {
    return "";
  }
  if (str.includes("@")) {
    const [before] = str.split("@");
    return before.trim();
  }
  return str.replace(/\s+/g, "").replace(/[^a-zA-Z0-9._-]/g, "");
}

export function buildProfileUsername({ username, email, fallback } = {}) {
  return (
    normalizeCandidate(username) ||
    normalizeCandidate(email) ||
    normalizeCandidate(fallback)
  );
}

export function buildProfilePath(options) {
  const username = buildProfileUsername(
    typeof options === "string" ? { fallback: options } : options
  );
  if (!username) return null;
  return `/app/profile?username=${encodeURIComponent(username)}`;
}

export default function ProfileLink({
  username,
  email,
  fallback,
  children,
  className = "",
  hoverClass = "hover:text-blue-600",
  ...rest
}) {
  const path = buildProfilePath({ username, email, fallback });
  if (!path) {
    return <span className={className}>{children}</span>;
  }
  const combinedClass = [className, hoverClass, "transition-colors"]
    .filter(Boolean)
    .join(" ");
  return (
    <Link to={path} className={combinedClass} {...rest}>
      {children}
    </Link>
  );
}
