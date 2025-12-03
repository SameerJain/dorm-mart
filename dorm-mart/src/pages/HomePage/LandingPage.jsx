// src/pages/HomePage/LandingPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ItemCardNew from "../../components/ItemCardNew";
import keyboard from "../../assets/product-images/keyboard.jpg";
import mouse from "../../assets/product-images/wireless-mouse.jpg";
import { withFallbackImage } from "../../utils/imageFallback";

const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const API_BASE = (process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`).replace(/\/$/, "");
const carpetUrl = `${PUBLIC_BASE}/assets/product-images/smallcarpet.png`;

const FALLBACK_ITEMS = [
  {
    id: 1,
    title: "Wireless Keyboard",
    price: 40,
    img: keyboard,
    tags: ["Electronics", "Accessories"],
    seller: "Ava P.",
    sellerUsername: "ava",
    sellerEmail: "ava@example.com",
    rating: 4.8,
    location: "North Campus",
    status: "JUST POSTED",
    category: "Electronics",
  },
  {
    id: 2,
    title: "Small Carpet (5x7)", 
    price: 25,
    img: carpetUrl,
    tags: ["Furniture", "Decor"],
    seller: "Mark D.",
    sellerUsername: "markd",
    sellerEmail: "mark@example.com",
    rating: 4.4,
    location: "Ellicott",
    status: "AVAILABLE",
    category: "Home & Dorm",
  },
  {
    id: 3,
    title: "Wireless Mouse",
    price: 30,
    img: mouse,
    tags: ["Electronics", "Accessories"],
    seller: "Sara T.",
    sellerUsername: "sarat",
    sellerEmail: "sara@example.com",
    rating: 4.9,
    location: "South Campus",
    status: "PRICE DROP",
    category: "Electronics",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [interests, setInterests] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [wishlistedIds, setWishlistedIds] = useState(new Set());
  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [errorUser, setErrorUser] = useState(false);
  const [errorItems, setErrorItems] = useState(false);
  const [activeTab, setActiveTab] = useState("forYou");
  const MIN_EXPLORE_ITEMS = 30;
  const computeExploreLimit = () => {
    if (typeof window === "undefined") return MIN_EXPLORE_ITEMS;
    const width = window.innerWidth;
    if (width >= 1536) return 42; // 6 columns x 7 rows
    if (width >= 1280) return 36; // 6 columns x 6 rows
    if (width >= 1024) return 32; // 4 columns x 8 rows
    if (width >= 768) return 30; // 3 columns x 10 rows
    return MIN_EXPLORE_ITEMS; // keep mobile at 30+ scrollable items
  };
  const [exploreLimit, setExploreLimit] = useState(computeExploreLimit);

  // rotating statement in blue - mobile only shows "Happy Shopping!"
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const rotatingLines = isMobile 
    ? ["Happy Shopping!"]
    : [
        "Welcome to Dorm Mart!",
        "Happy Shopping!",
      ];
  const [bannerIdx, setBannerIdx] = useState(0);

  // correct URLs
  const LIST_ITEM_URL = "/dorm-mart/#/app/product-listing/new";
  const MANAGE_INTERESTS_URL = "/dorm-mart/#/app/setting/user-preferences";

  const openExternalRoute = (url) => {
    window.location.href = url;
  };

  // rotate banner
  useEffect(() => {
    const id = setInterval(
      () => setBannerIdx((p) => (p + 1) % rotatingLines.length),
      4000
    );
    return () => clearInterval(id);
  }, [rotatingLines.length]);

  // keep tab aligned with interest availability
  useEffect(() => {
    if (!interests.length) {
      setActiveTab("explore");
    }
  }, [interests.length]);

  // fetch user
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoadingUser(true);
        const r = await fetch(`${API_BASE}/me.php`, {
          signal: controller.signal,
          credentials: "include",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();

        let cats = [];
        if (Array.isArray(data?.interested_categories)) {
          cats = data.interested_categories.filter(Boolean).slice(0, 3);
        } else {
          const c1 = data?.interested_category_1 || null;
          const c2 = data?.interested_category_2 || null;
          const c3 = data?.interested_category_3 || null;
          cats = [c1, c2, c3].filter(Boolean);
        }

        setUser(data || null);
        setInterests(cats);
        setErrorUser(false);
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error("me.php failed:", e);
          setUser(null);
          setInterests([]);
          setErrorUser(true);
        }
      } finally {
        setLoadingUser(false);
      }
    })();
    return () => controller.abort();
  }, []);

  // track viewport to respect the 3-row explore limit
  useEffect(() => {
    const handler = () => setExploreLimit(computeExploreLimit());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // fetch items
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoadingItems(true);
        const r = await fetch(`${API_BASE}/landingListings.php`, {
          signal: controller.signal,
          credentials: "include",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();

        const normalized = (Array.isArray(data) ? data : []).map((d, i) => {
          const priceNum =
            typeof d.price === "number"
              ? d.price
              : parseFloat(`${d.price}`.replace(/[^0-9.]/g, "")) || 0;

          const rawImg = d.image || d.image_url || null;
          const img = rawImg
            ? `${API_BASE}/image.php?url=${encodeURIComponent(rawImg)}`
            : null;

          const createdAt = d.created_at ? new Date(d.created_at) : null;
          let status = d.status || null;
          if (!status && createdAt instanceof Date && !isNaN(createdAt)) {
            const hours = (Date.now() - createdAt.getTime()) / 36e5;
            status = hours < 48 ? "JUST POSTED" : "AVAILABLE";
          }

          const tags = Array.isArray(d.tags)
            ? d.tags
            : typeof d.tags === "string"
            ? d.tags.split(",").map((t) => t.trim()).filter(Boolean)
            : [];

          const category = d.category || (tags.length ? tags[0] : "General");
          const sellerEmail = d.email || d.seller_email || null;
          const sellerUsername = d.seller_username || (sellerEmail ? sellerEmail.split("@")[0] : null);

          return {
            id: d.id ?? i,
            title: d.title ?? "Untitled",
            price: priceNum,
            img: withFallbackImage(img),
            tags,
            status: status || "AVAILABLE",
            category,
            createdAtTs:
              createdAt instanceof Date && !isNaN(createdAt)
                ? createdAt.getTime()
                : 0,
            // still keeping seller/location/rating in case we need later
            seller: d.seller || d.sold_by || d.seller_name || "Unknown Seller",
            sellerUsername,
            sellerEmail,
            rating: typeof d.rating === "number" ? d.rating : 4.7,
            location: d.location || d.campus || "North Campus",
          };
        });

        setAllItems(normalized.length ? normalized : FALLBACK_ITEMS);
        setErrorItems(false);
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error("landingListings.php failed:", e);
          setErrorItems(true);
          setAllItems(FALLBACK_ITEMS);
        }
      } finally {
        setLoadingItems(false);
      }
    })();
    return () => controller.abort();
  }, []);

  // fetch categories for quick filters
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/utility/get_active_categories.php`, { signal: controller.signal });
        if (!r.ok) return;
        const data = await r.json();
        if (Array.isArray(data)) setAllCategories(data);
      } catch (e) {
        // ignore
      }
    })();
    return () => controller.abort();
  }, []);

  // fetch wishlist items to determine which items are wishlisted
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/wishlist/get_wishlist.php`, {
          signal: controller.signal,
          credentials: "include",
        });
        if (!r.ok) return;
        const json = await r.json();
        if (json.success && Array.isArray(json.data)) {
          const ids = new Set(json.data.map((item) => item.product_id));
          setWishlistedIds(ids);
        }
      } catch (e) {
        // ignore - wishlist status is optional
      }
    })();
    return () => controller.abort();
  }, []);

  // dedupe into interests and explore
  const { itemsByInterest, exploreItems } = useMemo(() => {
    const MAX_TOTAL_ITEMS = 50;
    const exploreCap = Math.min(
      MAX_TOTAL_ITEMS,
      Math.max(MIN_EXPLORE_ITEMS, exploreLimit)
    );
    const shuffleArray = (arr) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    if (!interests.length) {
      // No interests: randomize across everything so older items still surface
      const shuffled = shuffleArray(allItems);
      return { itemsByInterest: {}, exploreItems: shuffled.slice(0, exploreCap) };
    }

    const byInterest = {};
    interests.forEach((c) => (byInterest[c] = []));

    allItems.forEach((item) => {
      const itemCat = (item.category || "").toLowerCase();
      const itemTags = Array.isArray(item.tags)
        ? item.tags.map((t) => t.toLowerCase())
        : [];

      let best = null;
      for (const ic of interests) {
        const icLower = ic.toLowerCase();
        const tagIdx = itemTags.indexOf(icLower);
        const isTagMatch = tagIdx !== -1;
        const isCatMatch = itemCat === icLower;

        if (isTagMatch) {
          if (!best || best.kind !== "tag" || tagIdx < best.tagIdx) {
            best = { ic, kind: "tag", tagIdx };
          }
        } else if (isCatMatch) {
          if (!best) {
            best = { ic, kind: "category" };
          }
        }
      }

      if (best) {
        byInterest[best.ic].push(item);
      }
    });

    // Sort each interest bucket: primary tag (category) first, then by newest date, then keep top 10 visible
    const used = new Set();
    const cmp = (cat) => (a, b) => {
      const catLower = (cat || "").toLowerCase();
      const aPrimary = Array.isArray(a.tags) && a.tags[0]
        ? String(a.tags[0]).toLowerCase() === catLower
        : false;
      const bPrimary = Array.isArray(b.tags) && b.tags[0]
        ? String(b.tags[0]).toLowerCase() === catLower
        : false;
      if (aPrimary !== bPrimary) return aPrimary ? -1 : 1;
      const at = typeof a.createdAtTs === "number" ? a.createdAtTs : 0;
      const bt = typeof b.createdAtTs === "number" ? b.createdAtTs : 0;
      return bt - at; // newer first
    };

    Object.keys(byInterest).forEach((cat) => {
      const sorted = byInterest[cat].sort(cmp(cat));
      const visible = sorted.slice(0, 10);
      byInterest[cat] = visible;
      visible.forEach((item) => used.add(item.id));
    });

    // Get explore items (randomized) and keep at least the requested explore minimum
    const allExploreItems = shuffleArray(
      allItems.filter((it) => !used.has(it.id))
    );
    const limitedExploreItems = allExploreItems.slice(
      0,
      Math.min(exploreCap, allExploreItems.length)
    );

    return {
      itemsByInterest: byInterest,
      exploreItems: limitedExploreItems,
    };
  }, [allItems, interests, exploreLimit]);

  const isLoading = loadingUser || loadingItems;
  const quickFilterCategories = useMemo(() => {
    if (allCategories.length) return allCategories;
    const derived = Array.from(
      new Set(
        allItems
          .flatMap((item) => [
            item.category,
            ...(Array.isArray(item.tags) ? item.tags : []),
          ])
          .filter(Boolean)
          .map((c) => String(c))
      )
    );
    return derived.length
      ? derived
      : ["Electronics", "Kitchen", "Furniture", "Dorm Essentials"];
  }, [allCategories, allItems]);

  const randomizedExploreItems = useMemo(() => {
    const arr = [...exploreItems];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [exploreItems]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      {/* TOP BAR with rotating statement and interests on right */}
      <div className="w-full border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-1 sm:px-2 md:px-3 py-3 flex items-center justify-between gap-3">
        {/* rotating blue chip */}
        <div className="flex-1 mr-3">
          <div className="inline-flex items-center gap-2 bg-blue-100/60 dark:bg-blue-900/30 px-4 py-1.5 rounded-full border border-blue-200 dark:border-blue-700 min-h-[36px]">
            <span className="h-2 w-2 rounded-full bg-blue-500 dark:bg-blue-400 inline-block"></span>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300 transition-all duration-500 ease-in-out">
              {rotatingLines[bannerIdx]}
            </p>
          </div>
        </div>

        {/* Mobile Filter Button */}
        <button
          onClick={() => navigate('/app/listings')}
          className="lg:hidden flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          aria-label="Open filters"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <span className="text-sm font-medium">Filters</span>
        </button>

        {/* interest chips */}
        <div className="flex gap-2 flex-wrap justify-end">
          {interests.length ? (
            interests.map((cat) => (
              <button
                key={cat}
                onClick={() =>
                  openExternalRoute(
                    `${PUBLIC_BASE}/#/app/listings?category=${encodeURIComponent(cat)}`
                  )
                }
                className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-4 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
              >
                {cat}
              </button>
            ))
          ) : (
            <button
              onClick={() => navigate("/app/setting/user-preferences")}
              className="inline-flex items-center rounded-full bg-blue-600 text-white px-4 py-1.5 text-sm font-medium shadow hover:bg-blue-700 transition"
            >
              Set Interested Categories
            </button>
          )}
        </div>
      </div>

      {/* HERO */}
      <div className="w-full px-1 sm:px-2 md:px-3 pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-[0.32fr,1fr] gap-3 items-stretch">
          {/* Quick Search */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 shadow-sm p-4 flex flex-col gap-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Quick Search
            </p>
            <div className="flex flex-wrap gap-2 max-h-[7.5rem] overflow-y-auto pr-1">
              {quickFilterCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() =>
                    openExternalRoute(`${PUBLIC_BASE}/#/app/listings?category=${encodeURIComponent(cat)}`)
                  }
                  className="px-4 py-1.5 rounded-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm border border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Personalized Feed */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 shadow-sm px-4 py-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="uppercase text-xs md:text-sm text-gray-400 dark:text-gray-500 tracking-[0.35em] mb-1">
                  personalized feed
                </p>
                <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Items from categories you actually picked
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Real UB students • on-campus meetups • no shipping
                </p>
              </div>
              <div className="hidden sm:flex items-start">
                <button
                  onClick={() => navigate("/app/product-listing/new")}
                  className="px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-700 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition whitespace-nowrap"
                >
                  List an item
                </button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-start gap-3 mt-1">
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-full p-1 w-fit">
                <button
                  onClick={() => setActiveTab("forYou")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                    activeTab === "forYou"
                      ? "bg-blue-600 text-white shadow"
                      : "text-gray-700 dark:text-gray-200"
                  }`}
                  title={
                    interests.length
                      ? undefined
                      : "You need to set your interested categories to access a for you page"
                  }
                  disabled={!interests.length}
                >
                  For You
                </button>
                <button
                  onClick={() => setActiveTab("explore")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                    activeTab === "explore"
                      ? "bg-blue-600 text-white shadow"
                      : "text-gray-700 dark:text-gray-200"
                  }`}
                >
                  Explore More
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 text-left">
                Switch views: personalized feed or a fresh randomized mix.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="w-full flex-1 px-1 sm:px-2 md:px-3 py-5 pb-10">
        <div className="grid grid-cols-1 gap-3 items-start">
          {/* CENTER */}
          <main className="flex flex-col gap-6 min-w-0">
            {/* For you */}
            {activeTab === "forYou" ? (
              interests.length ? (
                <section className="space-y-4">
                  <header className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-blue-600 dark:text-blue-400">
                        For you
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Based on your categories
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/app/setting/user-preferences')}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Manage interests
                    </button>
                  </header>

                  <div className="space-y-5">
                    {interests.map((cat) => {
                      const catItems = itemsByInterest[cat] || [];
                      return (
                        <div key={cat} className="space-y-3">
                          <h4 className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200">
                            {cat}
                          </h4>
                          <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-blue-700 w-full max-w-full min-w-0">
                            {catItems.length ? (
                              catItems.slice(0, 10).map((item) => (
                                <div
                                  key={item.id}
                                  className="flex-shrink-0"
                                >
                                  <ItemCardNew
                                    id={item.id}
                                    title={item.title}
                                    price={item.price}
                                    tags={item.tags}
                                    image={item.img || undefined}
                                    status={item.status}
                                    seller={item.seller}
                                    sellerUsername={item.sellerUsername}
                                    sellerEmail={item.sellerEmail}
                                    isWishlisted={wishlistedIds.has(item.id)}
                                    fixedWidth={true}
                                  />
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                                No items in this category yet.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 p-4">
                  <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">
                    Add interested categories to see your personalized feed.
                  </p>
                  <button
                    onClick={() => navigate("/app/setting/user-preferences")}
                    className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
                  >
                    Set interested categories
                  </button>
                </div>
              )
            ) : null}

            {/* Explore */}
            {activeTab === "explore" ? (
              <section className="space-y-4">
                <header>
                  <h3 className="text-base font-semibold text-blue-600 dark:text-blue-400">
                    Explore more
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Randomized picks from across campus.
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Showing at least 30 items so you can browse deeper.
                  </p>
                </header>

                <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(210px,1fr))] overflow-x-hidden min-w-0">
                  {randomizedExploreItems.map((item, idx) => (
                    <ItemCardNew
                      key={item.id ?? idx}
                      id={item.id}
                      title={item.title}
                      price={item.price}
                      tags={item.tags}
                      image={item.img || undefined}
                      status={item.status}
                      seller={item.seller}
                      sellerUsername={item.sellerUsername}
                      sellerEmail={item.sellerEmail}
                      isWishlisted={wishlistedIds.has(item.id)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {/* status */}
            <div className="space-y-1">
              {isLoading ? (
                <p className="text-center text-sm text-gray-400 dark:text-gray-500">
                  Loading your feed…
                </p>
              ) : null}
              {errorUser ? (
                <p className="text-center text-sm text-red-500">
                  Couldn’t load your preferences — showing general items.
                </p>
              ) : null}
              {errorItems ? (
                <p className="text-center text-sm text-red-500">
                  Couldn’t load latest listings. Showing sample items.
                </p>
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
