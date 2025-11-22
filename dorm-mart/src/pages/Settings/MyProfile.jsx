import { useEffect, useMemo, useRef, useState, useId } from "react";
import { useNavigate } from "react-router-dom";
import SettingsLayout from "./SettingsLayout";

const API_BASE = process.env.REACT_APP_API_BASE || "/api";

async function fetchSettingsProfile(apiBase = API_BASE) {
  const response = await fetch(`${apiBase}/profile/my_profile.php`, {
    method: "GET",
    credentials: "include",
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }
  console.log(data);
  if (!response.ok || !data?.success) {
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

async function saveProfileFields(payload, apiBase = API_BASE) {
  const response = await fetch(`${apiBase}/profile/update_profile.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "Unable to update profile.");
  }

  return data.profile ?? {};
}

async function uploadProfilePhoto(file, apiBase = API_BASE) {
  const formData = new FormData();
  formData.append("photo", file);

  const response = await fetch(`${apiBase}/profile/upload_profile_photo.php`, {
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
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1" aria-label={label || `Rating: ${normalized} out of 5`}>
        {stars}
      </div>
      <span className="text-sm font-semibold text-gray-600">{normalized.toFixed(1)}</span>
    </div>
  );
}

function ReviewRow({ review }) {
  const attachments = [review.image_1, review.image_2, review.image_3].filter(Boolean);
  const imageClass = "h-28 w-32 rounded-xl object-cover shadow flex-shrink-0";
  const reviewerUsername = review.reviewer_username || (review.reviewer_email ? review.reviewer_email.split("@")[0] : "");

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm transition hover:border-blue-200 hover:shadow">
      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-0.5">
            <p className="text-base font-semibold text-slate-900">{review.reviewer_name || "Anonymous"}</p>
            {review.reviewer_email ? (
              <p className="text-sm text-slate-500">{review.reviewer_email}</p>
            ) : (
              <p className="text-sm text-slate-400">No email provided</p>
            )}
          </div>
          <StarRating rating={review.rating} size={18} label={`${review.reviewer_name || "Reviewer"} rating`} />
        </div>
        <p className="text-sm font-semibold text-blue-700">{review.product_title}</p>
        <p className="text-sm leading-relaxed text-slate-700">{review.review}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
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
    <div className="space-y-2 rounded-2xl border border-slate-100 bg-white/60 p-4 shadow-sm">
      <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
        <span>{label}</span>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className={`text-xs font-medium text-rose-500 hover:text-rose-600 ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          Delete
        </button>
      </div>
      <input
        type="url"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={disabled}
          className={`rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-500 ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
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
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef(null);
  const blobUrlRef = useRef(null);
  const feedbackTimerRef = useRef(null);

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
      showFeedback("Profile photo updated");
    } catch (err) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setAvatarPreview(fallback);
      const message = err instanceof Error ? err.message : "Unable to update profile photo.";
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
    setIsSavingProfile(true);
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
      setIsSavingProfile(false);
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
    setIsSavingProfile(true);
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
      setIsSavingProfile(false);
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
      disabled: isSavingProfile,
    },
  ];

  return (
    <SettingsLayout>
      <div className="flex h-full w-full flex-col items-center overflow-y-auto bg-gradient-to-b from-white via-slate-50 to-blue-50/30 px-2 pb-3 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 sm:px-4 lg:px-10">
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-slate-500">Loading profile...</div>
        ) : error ? (
          <div className="flex h-full w-full items-center justify-center text-center text-red-600">{error}</div>
        ) : (
          <div className="flex w-full max-w-[1500px] flex-1 flex-col gap-8 overflow-visible min-h-0 xl:flex-row xl:gap-10">
            <section className="flex w-full flex-col gap-6 xl:max-w-[520px]">
              <div className="rounded-3xl border border-slate-100 bg-white/80 p-6 shadow">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    disabled={avatarUploading}
                    className={`relative flex h-32 w-32 items-center justify-center rounded-full border-4 border-white bg-slate-100 shadow-lg ring-4 ring-blue-100 transition hover:brightness-105 ${avatarUploading ? "cursor-not-allowed opacity-70" : ""}`}
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
                  <div className="space-y-1 text-center sm:text-left text-slate-900">
                    <p className="text-2xl font-serif font-semibold">{profile?.name}</p>
                    <p className="text-sm">@{profile?.username}</p>
                    <p className="text-sm">{profile?.email}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col items-center gap-1 text-center text-sm text-slate-500 sm:items-start sm:text-left">
                  <StarRating rating={ratingValue} size={24} label="Average rating" />
                  <span>Average rating across dorm transactions</span>
                </div>
              </div>

              <div className="flex flex-1 flex-col rounded-3xl border border-slate-100 bg-white/80 p-6 shadow">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">Public Details</h2>
                  {profile?.username && (
                    <button
                      type="button"
                      onClick={() => navigate(`/app/profile?username=${encodeURIComponent(profile.username)}&preview=true`)}
                      className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-500 transition-colors"
                    >
                      View Public Profile Display
                    </button>
                  )}
                </div>
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-slate-100 bg-white/70 p-4 shadow-sm">
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                      <span>Bio</span>
                      <button
                        type="button"
                        onClick={handleBioClear}
                        disabled={isSavingProfile}
                        className={`text-xs font-medium text-rose-500 hover:text-rose-600 ${isSavingProfile ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        Clear
                      </button>
                    </div>
                    <textarea
                      value={bio}
                      onChange={handleBioChange}
                      maxLength={200}
                      placeholder="Add a short description about yourself and what you sell."
                      className="mt-2 h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                    />
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>200 characters max</span>
                      <span>{bioRemaining}/200</span>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={handleBioSave}
                        disabled={isSavingProfile}
                        className={`rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-500 ${isSavingProfile ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        {isSavingProfile ? "Saving..." : "Save Bio"}
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

            <section className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white/90 p-6 shadow min-h-0">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Reviews</h2>
                  <p className="text-sm text-slate-500">{reviewList.length} recorded review{reviewList.length === 1 ? "" : "s"}</p>
                </div>
              </div>
              <div className="mt-4 flex-1 overflow-y-auto pr-1">
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
