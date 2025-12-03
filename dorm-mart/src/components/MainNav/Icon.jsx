import { Link } from "react-router-dom";

function Icon({ to, src, alt, badge, onClick, liRef, children }) {
  const showBadge = Number(badge) > 0;

  return (
    // liRef lets parent attach a ref (e.g., for click-outside logic)
    <li ref={liRef} className="relative">
      {/* onClick lets the parent control behavior (like toggling a dropdown) */}
      <Link to={to} className="relative inline-block" onClick={onClick}>
        <img
          src={src}
          alt={alt}
          className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 lg:h-10 lg:w-10"
        />
        {showBadge && (
          <span
            className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs leading-5 text-center ring-2 ring-white"
            aria-label={`${badge} unread`}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </Link>

      {/* children lets you attach a dropdown underneath the icon */}
      {children}
    </li>
  );
}

export default Icon;
