import { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const FALLBACK_AVATAR =
  "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80";

const SAMPLE_PRODUCTS = [
  {
    id: 1,
    title: "Minimalist Desk Lamp",
    price: 35,
    image: "https://images.unsplash.com/photo-1493666438817-866a91353ca9?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: 2,
    title: "Ergonomic Study Chair",
    price: 60,
    image: "https://images.unsplash.com/photo-1487017159836-4e23ece2e4cf?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: 3,
    title: "Dorm Essentials Bundle",
    price: 25,
    image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=400&q=80",
  },
];

const SAMPLE_REVIEWS = [
  {
    id: 101,
    reviewerName: "Emily H.",
    reviewerUsername: "emilyh",
    rating: 5,
    review:
      "Fantastic communication and super fast pickup coordination. Items were spotless and exactly as described.",
    productTitle: "Ergonomic Study Chair",
    createdAt: "2024-02-15",
    images: [
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=400&q=80",
      "https://images.unsplash.com/photo-1505691723518-36a5ac3be353?auto=format&fit=crop&w=400&q=80",
    ],
  },
  {
    id: 102,
    reviewerName: "Miles M.",
    reviewerUsername: "miles",
    rating: 4.5,
    review: "Appreciated the thorough walkthrough of the lamp before buying. Would happily buy again.",
    productTitle: "Minimalist Desk Lamp",
    createdAt: "2024-01-28",
    images: [],
  },
  {
    id: 103,
    reviewerName: "Priya S.",
    reviewerUsername: "priya",
    rating: 4,
    review:
      "Bundle saved me a ton of shopping time. Just note the storage bin has a tiny scratch, otherwise perfect.",
    productTitle: "Dorm Essentials Bundle",
    createdAt: "2023-12-02",
    images: ["https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=400&q=80"],
  },
];

const MOCK_PROFILE = {
  username: "jordan",
  name: "Jordan Atkinson",
  email: "jordan.atkinson@example.com",
  bio: "Fourth-year architecture student helping dorm-mates find quality used essentials.",
  instagram: "https://instagram.com/jordan.dorm",
  avgRating: 4.8,
  imageUrl: FALLBACK_AVATAR,
  activeListings: SAMPLE_PRODUCTS,
  reviews: SAMPLE_REVIEWS,
};

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

function ProductCard({ product }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <img src={product.image} alt={product.title} className="h-40 w-full rounded-t-2xl object-cover" />
      <div className="flex flex-col gap-2 p-4">
        <p className="text-base font-semibold text-slate-900">{product.title}</p>
        <p className="text-sm text-slate-500">${product.price.toFixed(2)}</p>
        <button
          type="button"
          className="mt-auto rounded-full border border-blue-600 px-4 py-1.5 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
        >
          View listing
        </button>
      </div>
    </div>
  );
}

function ReviewCard({ review }) {
  const reviewerLink = review.reviewerUsername
    ? `/app/profile?username=${encodeURIComponent(review.reviewerUsername)}`
    : null;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          {reviewerLink ? (
            <Link to={reviewerLink} className="text-base font-semibold text-slate-900 hover:text-blue-600">
              {review.reviewerName}
            </Link>
          ) : (
            <p className="text-base font-semibold text-slate-900">{review.reviewerName}</p>
          )}
          <p className="text-sm text-slate-500">{review.productTitle}</p>
        </div>
        <StarRating rating={review.rating} />
      </div>
      <p className="text-sm leading-relaxed text-slate-700">{review.review}</p>
      {review.images?.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {review.images.map((url, index) => (
            <img
              key={`${review.id}-img-${index}`}
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

  const profile = useMemo(() => {
    if (!usernameParam) return null;
    const normalized = usernameParam.toLowerCase();
    if (normalized === MOCK_PROFILE.username.toLowerCase()) {
      return MOCK_PROFILE;
    }
    return {
      ...MOCK_PROFILE,
      username: normalized,
      name: `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)} Doe`,
      email: `${normalized}@example.com`,
    };
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

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white via-slate-50 to-blue-50/30 px-3 py-6 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="flex flex-col items-center gap-4 md:flex-row">
              <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white shadow-lg">
                <img src={profile.imageUrl || FALLBACK_AVATAR} alt={profile.name} className="h-full w-full object-cover" />
              </div>
              <div className="text-center md:text-left">
                <h1 className="text-2xl font-serif font-semibold text-slate-900">{profile.name}</h1>
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
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 px-6 py-4 md:ml-auto">
              <StarRating rating={profile.avgRating} />
              <p className="text-xs uppercase tracking-wide text-slate-500">Average rating</p>
            </div>
          </div>
          {profile.bio && (
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-700">{profile.bio}</p>
          )}
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Active Listings</h2>
              <p className="text-sm text-slate-500">
                {profile.activeListings?.length || 0} item{profile.activeListings?.length === 1 ? "" : "s"} available
              </p>
            </div>
          </div>
          {profile.activeListings && profile.activeListings.length > 0 ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profile.activeListings.map((product) => (
                <ProductCard key={product.id} product={product} />
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
                {profile.reviews?.length || 0} review{profile.reviews?.length === 1 ? "" : "s"} received
              </p>
            </div>
          </div>
          {profile.reviews && profile.reviews.length > 0 ? (
            <div className="mt-4 flex flex-col gap-4">
              {profile.reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No reviews yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export default PublicProfilePage;
