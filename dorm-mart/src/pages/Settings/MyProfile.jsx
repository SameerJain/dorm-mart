import { useEffect, useMemo, useRef, useState, useId } from "react";
import SettingsLayout from "./SettingsLayout";

const MOCK_PROFILE_RESPONSE = {
  image_url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80",
  name: "Jordan Atkinson",
  username: "jordan.a",
  email: "jordan.atkinson@example.com",
  avg_rating: "4.5",
  bio: "Third-year student reselling gently used dorm essentials. Happy to meet on North Campus!",
  instagram: "https://instagram.com/jordan.dorm",
  twitter: "https://twitter.com/jordan_dorm",
  facebook: "",
  reviews: [
    {
      reviewer_name: "Emily H.",
      reviewer_email: "emilyh@example.com",
      product_title: "Eco Ceramic Mug",
      review:
        "Jordan packed the mug really well and it arrived without a single scratch. Shipping updates were timely, too!",
      image_1: "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=400&q=80",
      image_2: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80",
      image_3: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80",
      rating: "5",
    },
    {
      reviewer_name: "Tyrese Q.",
      reviewer_email: "tyrese.q@example.com",
      product_title: "Steam Iron",
      review:
        "Item was gently used exactly as described. Took a little longer to meet up but communication stayed friendly.",
      image_1: "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=400&q=80",
      image_2: "",
      image_3: "",
      rating: "4",
    },
    {
      reviewer_name: "Kai Berg",
      reviewer_email: "kaib@example.com",
      product_title: "LED Desk Lamp",
      review:
        "Appreciated the extra care taken to show the lamp working before purchase. Would definitely buy again.",
      image_1: "",
      image_2: "",
      image_3: "",
      rating: "4.5",
    },
  ],
};

// Placeholder API call name to be swapped with the real backend integration later.
async function fetchSettingsProfile() {
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_PROFILE_RESPONSE), 500);
  });
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

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm transition hover:border-blue-200 hover:shadow">
      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-base font-semibold text-slate-900">{review.reviewer_name || "Anonymous"}</p>
            <p className="text-sm text-slate-500">{review.reviewer_email || "No email provided"}</p>
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

function EditableLinkRow({ label, placeholder, value, onChange, onSave, onClear }) {
  return (
    <div className="space-y-2 rounded-2xl border border-slate-100 bg-white/60 p-4 shadow-sm">
      <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
        <span>{label}</span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-rose-500 hover:text-rose-600"
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
          className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-500"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function MyProfilePage() {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [bio, setBio] = useState("");
  const [instagram, setInstagram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [facebook, setFacebook] = useState("");
  const [feedback, setFeedback] = useState("");
  const fileInputRef = useRef(null);
  const blobUrlRef = useRef(null);
  const feedbackTimerRef = useRef(null);

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
        setTwitter(data.twitter || "");
        setFacebook(data.facebook || "");
      } catch (err) {
        if (!isMounted) return;
        setError("Unable to load profile information. Please try again later.");
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

  const showFeedback = (message) => {
    setFeedback(message);
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = setTimeout(() => setFeedback(""), 2400);
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
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const nextUrl = URL.createObjectURL(file);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }
    blobUrlRef.current = nextUrl;
    setAvatarPreview(nextUrl);
  };

  const handleBioChange = (event) => {
    const next = event.target.value.slice(0, 200);
    setBio(next);
  };

  const reviewList = profile?.reviews ?? [];
  const bioRemaining = 200 - bio.length;
  const socialFields = [
    {
      label: "Instagram",
      value: instagram,
      setter: setInstagram,
      placeholder: "https://instagram.com/yourhandle",
    },
    {
      label: "Twitter / X",
      value: twitter,
      setter: setTwitter,
      placeholder: "https://twitter.com/yourhandle",
    },
    {
      label: "Facebook",
      value: facebook,
      setter: setFacebook,
      placeholder: "https://facebook.com/yourprofile",
    },
  ];

  return (
    <SettingsLayout>
      <div className="flex h-full flex-col items-center overflow-hidden bg-gradient-to-b from-white via-slate-50 to-blue-50/30 px-2 pb-3 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 sm:px-4 lg:px-10">
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-slate-500">Loading profile…</div>
        ) : error ? (
          <div className="flex h-full w-full items-center justify-center text-center text-red-600">{error}</div>
        ) : (
          <div className="flex h-full w-full max-w-[1500px] flex-1 gap-10 overflow-hidden">
            <section className="flex w-full max-w-lg flex-shrink-0 flex-col gap-6 lg:max-w-xl xl:max-w-[520px]">
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
                    className="relative flex h-32 w-32 items-center justify-center rounded-full border-4 border-white bg-slate-100 shadow-lg ring-4 ring-blue-100 transition hover:brightness-105"
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Profile" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-slate-500">Upload photo</span>
                    )}
                    <span className="absolute bottom-1.5 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white shadow">Edit</span>
                  </button>
                  <div className="space-y-1 text-center sm:text-left">
                    <p className="text-2xl font-serif font-semibold text-slate-900">{profile?.name}</p>
                    <p className="text-sm text-slate-500">@{profile?.username}</p>
                    <p className="text-sm text-slate-500">{profile?.email}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col items-center gap-1 text-center text-sm text-slate-500 sm:items-start sm:text-left">
                  <StarRating rating={ratingValue} size={24} label="Average rating" />
                  <span>Average rating across dorm transactions</span>
                </div>
              </div>

              <div className="flex flex-1 flex-col rounded-3xl border border-slate-100 bg-white/80 p-6 shadow">
                <h2 className="text-lg font-semibold text-slate-900">Public Details</h2>
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-slate-100 bg-white/70 p-4 shadow-sm">
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                      <span>Bio</span>
                      <button
                        type="button"
                        onClick={() => handleFieldClear("Bio", setBio)}
                        className="text-xs font-medium text-rose-500 hover:text-rose-600"
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
                        onClick={() => handleFieldSave("Bio")}
                        className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-500"
                      >
                        Save Bio
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
                        onSave={() => handleFieldSave(field.label)}
                        onClear={() => handleFieldClear(field.label, field.setter)}
                      />
                    ))}
                  </div>
                </div>
                {feedback && (
                  <p className="mt-4 text-sm font-medium text-emerald-600">{feedback}</p>
                )}
              </div>
            </section>

            <section className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white/90 p-6 shadow">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Reviews</h2>
                  <p className="text-sm text-slate-500">{reviewList.length} recorded review{reviewList.length === 1 ? "" : "s"}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-blue-700 transition hover:border-blue-400 hover:bg-blue-50"
                >
                  Download summary
                </button>
              </div>
              <div className="mt-4 flex-1 overflow-y-auto pr-1">
                {reviewList.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">No reviews yet.</div>
                ) : (
                  <div className="flex flex-col gap-4 pb-4">
                    {reviewList.map((review, index) => (
                      <ReviewRow key={`${review.reviewer_email}-${index}`} review={review} />
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
