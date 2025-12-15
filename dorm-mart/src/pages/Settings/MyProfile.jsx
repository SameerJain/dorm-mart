import { useEffect, useMemo, useRef, useState, useId } from "react";
import { useNavigate } from "react-router-dom";
import SettingsLayout from "./SettingsLayout";
import { getApiBase, apiGet, apiPost } from "../../utils/api";

const NAV_BLUE = "#2563EB";

// File type restrictions (same as product listing and chat)
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

function isAllowedType(f) {
  // Prefer MIME, but fall back to extension if needed
  if (f.type && ALLOWED_MIME.has(f.type)) return true;

  const name = (f.name || "").toLowerCase();
  const ext = ALLOWED_EXTS.has(
    name.slice(name.lastIndexOf(".")) // includes dot
  );
  return ext;
}

async function fetchSettingsProfile() {
  const data = await apiGet('profile/my_profile.php');
  
  if (!data?.success) {
    throw new Error(data?.error || "Unable to load profile information.");
  }

  const reviews = Array.isArray(data.reviews) ? data.reviews : [];
  const profile = data.profile ?? {};

  return {
    name: profile.name || "",
    username: profile.username || "",
    email: profile.email || "",
    image_url: profile.image_url || "",
    bio: (profile.bio || "").slice(0, 200),
    instagram: profile.instagram || "",
    avg_rating: Number(profile.avg_rating ?? 0) || 0,
    review_count: profile.review_count ?? reviews.length,
    reviews,
  };
}

async function saveProfileFields(payload) {
  const data = await apiPost('profile/update_profile.php', payload);
  
  if (!data?.success) {
    throw new Error(data?.error || "Unable to update profile.");
  }

  return data.profile ?? {};
}

async function uploadProfilePhoto(file) {
  const formData = new FormData();
  formData.append("photo", file);

  // Use fetch directly for FormData (apiPost uses JSON.stringify)
  const response = await fetch(`${getApiBase()}/profile/upload_profile_photo.php`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok || !data?.success || !data.image_url) {
    throw new Error(data?.error || "Unable to upload profile photo.");
  }

  return data.image_url;
}

function StarIcon({ fillFraction, size = 28 }) {
  const gradientId = `${useId()}-grad`;
  const clampedFill = Math.max(0, Math.min(1, fillFraction));
  const offset = `${clampedFill * 100}%`;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-hidden="true"
      className="drop-shadow-sm"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset={offset} stopColor="#fbbf24" />
          <stop offset={offset} stopColor="#e5e7eb" />
          <stop offset="100%" stopColor="#e5e7eb" />
        </linearGradient>
      </defs>
      <path
        d="M12 .587l3.668 7.431 8.207 1.193-5.938 5.786 1.402 8.202L12 18.896l-7.339 4.303 1.402-8.202L.125 9.211l8.207-1.193z"
        fill={`url(#${gradientId})`}
        stroke="#fbbf24"
        strokeWidth="1"
      />
    </svg>
  );
}

function StarRating({ rating = 0, size = 28, label }) {
  const normalized = Math.max(0, Math.min(5, Number(rating) || 0));
  const stars = Array.from({ length: 5 }, (_, index) => {
    const fillFraction = Math.max(0, Math.min(1, normalized - index));
    return <StarIcon key={`${label || "rating"}-${index}`} fillFraction={fillFraction} size={size} />;
  });

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <div className="flex items-center gap-0.5 sm:gap-1" aria-label={label || `Rating: ${normalized} out of 5`}>
        {stars}
      </div>
      <span className="text-xs sm:text-sm font-semibold text-gray-600">{normalized.toFixed(1)}</span>
    </div>
  );
}

function ReviewRow({ review }) {
  const attachments = [review.image_1, review.image_2, review.image_3].filter(Boolean);
  const imageClass = "h-20 w-24 sm:h-28 sm:w-32 rounded-xl object-cover shadow flex-shrink-0";

  return (
    <article className="flex flex-col gap-3 sm:gap-4 rounded-none sm:rounded-2xl border-0 sm:border border-slate-200 bg-transparent sm:bg-white/80 p-3 sm:p-4 shadow-none sm:shadow-sm transition sm:hover:border-blue-200 sm:hover:shadow">
      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0 flex-1">
            <p className="text-sm sm:text-base font-semibold text-slate-900 break-words">{review.reviewer_name || "Anonymous"}</p>
            {review.reviewer_email ? (
              <p className="text-xs sm:text-sm text-slate-500 truncate" title={review.reviewer_email}>{review.reviewer_email}</p>
            ) : (
              <p className="text-xs sm:text-sm text-slate-400">No email provided</p>
            )}
          </div>
          <div className="flex-shrink-0">
            <StarRating rating={review.rating} size={16} label={`${review.reviewer_name || "Reviewer"} rating`} />
          </div>
        </div>
        <p className="text-xs sm:text-sm font-semibold text-blue-700 break-words">{review.product_title}</p>
        <p className="text-xs sm:text-sm leading-relaxed text-slate-700 break-words whitespace-pre-wrap">{review.review}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 border-t border-slate-100 pt-3">
        {attachments.length > 0 ? (
          attachments.map((image, index) => (
            <img
              key={index}
              src={image}
              alt={`Review attachment ${index + 1}`}
              className={imageClass}
            />
          ))
        ) : (
          <p className="text-xs italic text-slate-400">No images attached</p>
        )}
      </div>
    </article>
  );
}

function EditableLinkRow({ label, placeholder, value, onChange, onSave, onClear, disabled = false }) {
  return (
    <div className="space-y-2 rounded-none sm:rounded-2xl border-0 sm:border border-slate-100 bg-transparent sm:bg-white/60 p-3 sm:p-4 shadow-none sm:shadow-sm">
      <div className="flex items-center justify-between text-xs sm:text-sm font-semibold text-slate-700">
        <span>{label}</span>
        <button
          type="button"
          onClick={(e) => {
            if (disabled) return;
            e.preventDefault();
            e.stopPropagation();
            onClear();
          }}
          disabled={disabled}
          className={`text-xs font-medium text-rose-500 hover:text-rose-600 touch-manipulation py-1 px-2 ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          Delete
        </button>
      </div>
      <input
        type="url"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
      />
      <div className="flex justify-end">
        <button
          type="button"
          id={`save-${label.toLowerCase().replace(/\s+/g, '-')}-button`}
          onClick={(e) => {
            if (disabled) return;
            e.preventDefault();
            e.stopPropagation();
            onSave();
          }}
          disabled={disabled}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          className={`rounded-full bg-blue-600 px-4 py-2 sm:py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-500 active:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 touch-manipulation ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          {disabled ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function MyProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [bio, setBio] = useState("");
  const [instagram, setInstagram] = useState("");
  const [feedback, setFeedback] = useState({ message: "", tone: "success" });
  const [avatarError, setAvatarError] = useState("");
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [isSavingInstagram, setIsSavingInstagram] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef(null);
  const blobUrlRef = useRef(null);
  const feedbackTimerRef = useRef(null);
  const buttonClickRef = useRef(false);

  const updateProfileState = (partial) => {
    setProfile((prev) => (prev ? { ...prev, ...partial } : prev));
  };

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        const data = await fetchSettingsProfile();
        if (!isMounted) return;
        setProfile(data);
        setAvatarPreview(data.image_url || "");
        setBio((data.bio || "").slice(0, 200));
        setInstagram(data.instagram || "");
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : "Unable to load profile information. Please try again later.";
        setError(message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadProfile();
    return () => {
      isMounted = false;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const showFeedback = (message, tone = "success") => {
    setFeedback({ message, tone });
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = setTimeout(() => setFeedback({ message: "", tone: "success" }), 2400);
  };

  const handleFieldSave = (label) => {
    showFeedback(`${label} saved locally`);
  };

  const handleFieldClear = (label, setter) => {
    setter("");
    showFeedback(`${label} cleared`);
  };

  const ratingValue = useMemo(() => {
    if (!profile) return 0;
    const parsed = Number(profile.avg_rating);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [profile]);

  const handleAvatarClick = () => {
    if (avatarUploading) return;
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clear any previous errors
    setAvatarError("");

    // Validate file size
    if (file.size > MAX_BYTES) {
      const errorMsg = "Image is too large. Maximum file size is 2 MB.";
      setAvatarError(errorMsg);
      showFeedback(errorMsg, "error");
      event.target.value = null; // Clear the input
      return;
    }

    // Validate file type
    if (!isAllowedType(file)) {
      const errorMsg = "Only JPG/JPEG, PNG, and WEBP images are allowed.";
      setAvatarError(errorMsg);
      showFeedback(errorMsg, "error");
      event.target.value = null; // Clear the input
      return;
    }

    const fallback = profile?.image_url || "";
    const nextUrl = URL.createObjectURL(file);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }
    blobUrlRef.current = nextUrl;
    setAvatarPreview(nextUrl);
    setAvatarUploading(true);

    try {
      const uploadedUrl = await uploadProfilePhoto(file);
      const updated = await saveProfileFields({ profile_photo: uploadedUrl });
      const finalUrl = updated.image_url || uploadedUrl;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setAvatarPreview(finalUrl);
      updateProfileState({ image_url: finalUrl });
      setAvatarError(""); // Clear any errors on success
      showFeedback("Profile photo updated");
    } catch (err) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setAvatarPreview(fallback);
      const message = err instanceof Error ? err.message : "Unable to update profile photo.";
      setAvatarError(message);
      showFeedback(message, "error");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleBioChange = (event) => {
    const next = event.target.value.slice(0, 200);
    setBio(next);
  };

  const persistBio = async (value, successMessage) => {
    const previousBio = bio;
    setBio(value);
    setIsSavingBio(true);
    try {
      const updated = await saveProfileFields({ bio: value });
      const sanitized = (updated.bio ?? value ?? "").slice(0, 200);
      setBio(sanitized);
      updateProfileState({ bio: sanitized });
      showFeedback(successMessage);
    } catch (err) {
      setBio(previousBio);
      const message = err instanceof Error ? err.message : "Unable to update bio.";
      showFeedback(message, "error");
    } finally {
      setIsSavingBio(false);
    }
  };

  const isValidInstagramUrl = (value) => {
    if (!value) return true;
    try {
      const url = new URL(value.trim());
      const hostname = url.hostname.replace(/^www\./i, "").toLowerCase();
      if (!hostname.endsWith("instagram.com")) {
        return false;
      }
      return url.pathname.length > 1; // ensure something after domain
    } catch (_err) {
      return false;
    }
  };

  const persistInstagram = async (value, successMessage) => {
    const previous = instagram;
    const trimmed = value.trim();
    if (trimmed.length > 150) {
      showFeedback("Instagram link must be 150 characters or fewer.", "error");
      return;
    }
    if (!isValidInstagramUrl(trimmed)) {
      showFeedback("Please enter a valid Instagram profile link.", "error");
      return;
    }
    setInstagram(trimmed);
    setIsSavingInstagram(true);
    try {
      const updated = await saveProfileFields({ instagram: trimmed });
      const sanitized = updated.instagram ?? trimmed ?? "";
      setInstagram(sanitized);
      updateProfileState({ instagram: sanitized });
      showFeedback(successMessage);
    } catch (err) {
      setInstagram(previous);
      const message = err instanceof Error ? err.message : "Unable to update Instagram link.";
      showFeedback(message, "error");
    } finally {
      setIsSavingInstagram(false);
    }
  };

  const handleBioSave = () => persistBio(bio, "Bio saved");
  const handleBioClear = () => persistBio("", "Bio cleared");
  const handleInstagramSave = () => persistInstagram(instagram, "Instagram saved");
  const handleInstagramClear = () => persistInstagram("", "Instagram deleted");

  const reviewList = profile?.reviews ?? [];
  const bioRemaining = 200 - bio.length;
  const socialFields = [
    {
      label: "Instagram",
      value: instagram,
      setter: (next) => setInstagram(next.slice(0, 150)),
      placeholder: "https://instagram.com/yourhandle",
      onSave: handleInstagramSave,
      onClear: handleInstagramClear,
      disabled: isSavingInstagram,
    },
  ];

  return (
    <SettingsLayout>
      <style>{`
        @media (max-width: 639px) {
          .mobile-scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .mobile-scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        }
      `}</style>
      <div 
        className="flex h-full w-full flex-col items-center overflow-y-auto overflow-x-hidden bg-gradient-to-b from-white via-slate-50 to-blue-50/30 px-3 pb-4 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 sm:px-4 lg:px-10 mobile-scrollbar-hide"
      >
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-slate-500">Loading profile...</div>
        ) : error ? (
          <div className="flex h-full w-full items-center justify-center text-center text-red-600">{error}</div>
        ) : (
          <div className="flex w-full max-w-[1500px] flex-1 flex-col gap-6 sm:gap-8 overflow-visible min-h-0 xl:flex-row xl:gap-10">
            <section className="flex w-full flex-col gap-4 sm:gap-6 xl:max-w-[520px]">
              <div className="rounded-none sm:rounded-3xl border-0 sm:border border-slate-100 bg-transparent sm:bg-white/80 p-4 sm:p-6 shadow-none sm:shadow">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6 min-w-0">
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    disabled={avatarUploading}
                    className={`relative flex h-24 w-24 sm:h-32 sm:w-32 items-center justify-center rounded-full border-4 border-white bg-slate-100 shadow-lg ring-2 sm:ring-4 ring-blue-100 transition hover:brightness-105 flex-shrink-0 ${avatarUploading ? "cursor-not-allowed opacity-70" : ""}`}
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Profile" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-slate-500">Upload photo</span>
                    )}
                    <span className="absolute bottom-1.5 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white shadow">
                      {avatarUploading ? "Uploading..." : "Edit"}
                    </span>
                  </button>
                  <div className="space-y-1 text-center sm:text-left text-slate-900 min-w-0 max-w-full overflow-hidden flex-1">
                    <p className="text-xl sm:text-2xl font-serif font-semibold truncate block">{profile?.name}</p>
                    <p className="text-xs sm:text-sm break-all">@{profile?.username}</p>
                    <p className="text-xs sm:text-sm truncate" title={profile?.email}>{profile?.email}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col items-center gap-1 text-center text-xs sm:text-sm text-slate-500 sm:items-start sm:text-left">
                  <StarRating rating={ratingValue} size={20} label="Average rating" />
                  <span className="px-2 sm:px-0">Average rating across dorm transactions</span>
                </div>
                {avatarError && (
                  <div className="mt-4 rounded-lg bg-rose-50 dark:bg-rose-900/30 border-2 border-rose-200 dark:border-rose-700 p-3">
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm font-medium text-rose-800 dark:text-rose-200">{avatarError}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col rounded-none sm:rounded-3xl border-0 sm:border border-slate-100 bg-transparent sm:bg-white/80 p-4 sm:p-6 shadow-none sm:shadow">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">Public Details</h2>
                  {profile?.username && (
                    <button
                      type="button"
                      onClick={(e) => {
                        if (buttonClickRef.current) return;
                        buttonClickRef.current = true;
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/app/profile?username=${encodeURIComponent(profile.username)}&preview=true`);
                        setTimeout(() => { buttonClickRef.current = false; }, 300);
                      }}
                      className="rounded-full bg-blue-600 px-4 py-2 sm:py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-500 transition-colors touch-manipulation"
                    >
                      View Public Profile Display
                    </button>
                  )}
                </div>
                <div className="mt-4 space-y-3 sm:space-y-4">
                  <div className="rounded-none sm:rounded-2xl border-0 sm:border border-slate-100 bg-transparent sm:bg-white/70 p-3 sm:p-4 shadow-none sm:shadow-sm">
                    <div className="flex items-center justify-between text-xs sm:text-sm font-semibold text-slate-700">
                      <span>Bio</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          if (buttonClickRef.current || isSavingBio) return;
                          buttonClickRef.current = true;
                          e.preventDefault();
                          e.stopPropagation();
                          handleBioClear();
                          setTimeout(() => { buttonClickRef.current = false; }, 300);
                        }}
                        disabled={isSavingBio}
                        className={`text-xs font-medium text-rose-500 hover:text-rose-600 touch-manipulation py-1 px-2 ${isSavingBio ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        Clear
                      </button>
                    </div>
                    <textarea
                      value={bio}
                      onChange={handleBioChange}
                      maxLength={200}
                      placeholder="Add a short description about yourself and what you sell."
                      className="mt-2 h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                    />
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>200 characters max</span>
                      <span>{bioRemaining}/200</span>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        id="save-bio-button"
                        onClick={(e) => {
                          if (buttonClickRef.current || isSavingBio) return;
                          buttonClickRef.current = true;
                          e.preventDefault();
                          e.stopPropagation();
                          handleBioSave();
                          setTimeout(() => { buttonClickRef.current = false; }, 300);
                        }}
                        disabled={isSavingBio}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        className={`rounded-full bg-blue-600 px-4 py-2 sm:py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-500 active:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 touch-manipulation ${isSavingBio ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        {isSavingBio ? "Saving..." : "Save Bio"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {socialFields.map((field) => (
                      <EditableLinkRow
                        key={field.label}
                        label={field.label}
                        placeholder={field.placeholder}
                        value={field.value}
                        onChange={(event) => field.setter(event.target.value)}
                        onSave={field.onSave ?? (() => handleFieldSave(field.label))}
                        onClear={field.onClear ?? (() => handleFieldClear(field.label, field.setter))}
                        disabled={Boolean(field.disabled)}
                      />
                    ))}
                  </div>
                </div>
                {feedback.message && (
                  <p
                    className={`mt-4 text-sm font-medium ${
                      feedback.tone === "error" ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {feedback.message}
                  </p>
                )}
              </div>
            </section>

            <section className="flex flex-1 flex-col overflow-visible xl:overflow-hidden rounded-none sm:rounded-3xl border-0 sm:border border-slate-100 bg-transparent sm:bg-white/90 p-4 sm:p-6 shadow-none sm:shadow xl:min-h-0">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Reviews</h2>
                  <p className="text-xs sm:text-sm text-slate-500">{reviewList.length} recorded review{reviewList.length === 1 ? "" : "s"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/app/setting/buyer-reviews")}
                  className="rounded-full bg-blue-600 px-4 py-2 sm:py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-500 transition-colors touch-manipulation"
                >
                  View how sellers have rated you
                </button>
              </div>
              <div className="mt-4 flex-1 xl:overflow-y-auto xl:pr-1">
                {reviewList.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">No reviews yet.</div>
                ) : (
                  <div className="flex flex-col gap-4 pb-4">
                    {reviewList.map((review, index) => (
                      <ReviewRow key={review.review_id || review.reviewer_email || index} review={review} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}

export default MyProfilePage;
