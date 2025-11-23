import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BuyerReviewsModal from "./BuyerReviewsModal";

const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const API_BASE = (process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`).replace(/\/$/, "");
const FALLBACK_AVATAR = `${PUBLIC_BASE}/data/test-images/No_image_available.svg.png`;

const useQuery = () => {
  const location = useLocation();
  return useMemo(() => new URLSearchParams(location.search), [location.search]);
};

function StarRating({ rating = 0 }) {
  const normalized = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <div className="flex items-center gap-1 text-sm font-medium text-slate-600">
      {Array.from({ length: 5 }).map((_, index) => {
        const fill = Math.max(0, Math.min(1, normalized - index));
        return (
          <span key={index} className="text-amber-400">
            {fill >= 1 ? "★" : fill > 0 ? "⯨" : "☆"}
          </span>
        );
      })}
      <span>{normalized.toFixed(1)}</span>
    </div>
  );
}

function ProductCard({ product, onView }) {
  const hasProductLink = Boolean(product.product_id);
  return (
    <div className="flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <img src={product.image_url || FALLBACK_AVATAR} alt={product.title} className="h-40 w-full rounded-t-2xl object-cover" />
      <div className="flex flex-col gap-2 p-4">
        <p className="text-base font-semibold text-slate-900">{product.title}</p>
        <p className="text-sm text-slate-500">${Number(product.price || 0).toFixed(2)}</p>
        <button
          type="button"
          onClick={hasProductLink ? onView : undefined}
          disabled={!hasProductLink}
          className="mt-auto rounded-full border border-blue-600 px-4 py-1.5 text-sm font-medium text-blue-600 transition hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          View listing
        </button>
      </div>
    </div>
  );
}

function ReviewCard({ review }) {
  const attachments = [review.image_1, review.image_2, review.image_3].filter(Boolean);

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <p className="text-base font-semibold text-slate-900">{review.reviewer_name}</p>
          <p className="text-sm text-slate-500">{review.product_title}</p>
        </div>
        <StarRating rating={review.rating} />
      </div>
      <p className="text-sm leading-relaxed text-slate-700">{review.review}</p>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {attachments.map((url, index) => (
            <img
              key={`${review.review_id || index}-img-${index}`}
              src={url}
              alt={`Review attachment ${index + 1}`}
              className="h-28 w-32 rounded-xl object-cover shadow"
            />
          ))}
        </div>
      )}
    </article>
  );
}

function PublicProfilePage() {
  const navigate = useNavigate();
  const query = useQuery();
  const usernameParam = query.get("username")?.trim();
  const isPreview = query.get("preview") === "true";
  const [profileData, setProfileData] = useState(null);
  const [listings, setListings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [buyerReviewsModalOpen, setBuyerReviewsModalOpen] = useState(false);

  useEffect(() => {
    if (!usernameParam) {
      setProfileData(null);
      setListings([]);
      setReviews([]);
      setError("");
      return;
    }

    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(
          `${API_BASE}/profile/public_profile.php?username=${encodeURIComponent(usernameParam)}`,
          { signal: controller.signal, credentials: "include" }
        );
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || "Unable to load profile.");
        }
        setProfileData(json.profile ?? null);
        setListings(Array.isArray(json.listings) ? json.listings : []);
        setReviews(Array.isArray(json.reviews) ? json.reviews : []);
      } catch (err) {
        if (err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Unable to load profile.";
        setError(message);
        setProfileData(null);
        setListings([]);
        setReviews([]);
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [usernameParam]);

  if (!usernameParam) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow">
          <h1 className="text-lg font-semibold text-slate-900">Profile Lookup</h1>
          <p className="mt-2 text-sm text-slate-600">Please provide a username to view a public profile.</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-4 rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center">
        <p className="text-sm text-slate-600">Loading profile…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-8 shadow">
          <h1 className="text-lg font-semibold text-rose-600">Unable to load profile</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-4 rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow">
          <h1 className="text-lg font-semibold text-slate-900">Profile not found</h1>
          <p className="mt-2 text-sm text-slate-600">We couldn't find a user with that username.</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-4 rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const profile = {
    name: profileData.name || profileData.username || usernameParam,
    username: profileData.username || usernameParam,
    email: profileData.email || "",
    bio: profileData.bio || "",
    instagram: profileData.instagram || "",
    avgRating: profileData.avg_rating ?? 0,
    reviewCount: profileData.review_count ?? reviews.length,
    imageUrl: profileData.image_url || FALLBACK_AVATAR,
    userId: profileData.user_id,
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white via-slate-50 to-blue-50/30 px-3 py-6 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-blue-600 shadow-sm transition hover:bg-blue-50"
          >
            ← Back
          </button>
        </div>
        {isPreview && (
          <div className="mb-3 p-4 bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-200 dark:border-yellow-700 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <div className="flex-1">
                <p className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-1">Public Profile Preview</p>
                <p className="text-base text-yellow-700 dark:text-yellow-300 mb-3">You're viewing your profile as others see it. This helps you see how your profile appears to potential buyers to help you make any adjustments.</p>
                <button
                  onClick={() => navigate('/app/setting/my-profile')}
                  className="rounded-full font-medium px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm"
                >
                  Edit Profile
                </button>
              </div>
            </div>
          </div>
        )}
        <header className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm overflow-hidden">
          <div className="flex flex-col gap-6 md:flex-row md:items-center min-w-0">
            <div className="flex flex-col items-center gap-4 md:flex-row min-w-0 flex-1">
              <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white shadow-lg flex-shrink-0">
                <img src={profile.imageUrl} alt={profile.name} className="h-full w-full object-cover" />
              </div>
              <div className="text-center md:text-left min-w-0 max-w-full overflow-hidden flex-1">
                <h1 className="text-2xl font-serif font-semibold text-slate-900 truncate block">{profile.name}</h1>
                <p className="text-sm text-slate-500">@{profile.username}</p>
                <p className="text-sm text-slate-500">{profile.email}</p>
                {profile.instagram && (
                  <a
                    href={profile.instagram}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                  >
                    Instagram profile →
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 px-6 py-4 md:ml-auto flex-shrink-0">
              {profile.reviewCount === 0 ? (
                <p className="text-sm text-slate-500">No reviews yet</p>
              ) : (
                <>
                  <StarRating rating={profile.avgRating} />
                  <p className="text-xs uppercase tracking-wide text-slate-500">{profile.reviewCount} review(s)</p>
                </>
              )}
            </div>
          </div>
          {profile.bio && <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-700 line-clamp-3">{profile.bio}</p>}
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Active Listings</h2>
              <p className="text-sm text-slate-500">
                {listings.length} item{listings.length === 1 ? "" : "s"} available
              </p>
            </div>
          </div>
          {listings.length > 0 ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((product) => (
                <ProductCard
                  key={product.product_id}
                  product={product}
                  onView={() => navigate(`/app/viewProduct/${product.product_id}`)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No active listings at this time.</p>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Reviews</h2>
              <p className="text-sm text-slate-500">
                {reviews.length} review{reviews.length === 1 ? "" : "s"} received
              </p>
            </div>
            {profile.userId && (
              <button
                type="button"
                onClick={() => setBuyerReviewsModalOpen(true)}
                className="rounded-full border border-blue-600 bg-white px-4 py-1.5 text-sm font-medium text-blue-600 transition hover:bg-blue-50 dark:bg-gray-800 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-gray-700"
              >
                View Buyer Reviews
              </button>
            )}
          </div>
          {reviews.length > 0 ? (
            <div className="mt-4 flex flex-col gap-4">
              {reviews.map((review) => (
                <ReviewCard key={review.review_id} review={review} />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No reviews yet.</p>
          )}
        </section>

        {/* Buyer Reviews Modal */}
        {profile.userId && (
          <BuyerReviewsModal
            isOpen={buyerReviewsModalOpen}
            onClose={() => setBuyerReviewsModalOpen(false)}
            buyerUserId={profile.userId}
          />
        )}
      </div>
    </div>
  );
}

export default PublicProfilePage;
