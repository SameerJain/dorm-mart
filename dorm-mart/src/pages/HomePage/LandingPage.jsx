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

  // rotating statement in blue
  const rotatingLines = [
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
    if (!interests.length) {
      return { itemsByInterest: {}, exploreItems: allItems };
    }

    const byInterest = {};
    interests.forEach((c) => (byInterest[c] = []));
    const used = new Set();

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
        used.add(item.id);
      }
    });

    // Sort each interest bucket: primary tag (category) first, then by newest date
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
      byInterest[cat].sort(cmp(cat));
    });

    return {
      itemsByInterest: byInterest,
      exploreItems: allItems.filter((it) => !used.has(it.id)),
    };
  }, [allItems, interests]);

  const isLoading = loadingUser || loadingItems;

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
            <span className="text-sm text-gray-400 dark:text-gray-500 italic">
              No interests set
            </span>
          )}
        </div>
      </div>

      {/* HERO + METRICS */}
      <div className="w-full px-1 sm:px-2 md:px-3 pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr,0.65fr] gap-3">
          {/* hero */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 shadow-sm px-4 py-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
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
              <div className="hidden sm:flex">
                <button
                  onClick={() => navigate("/app/product-listing/new")}
                  className="px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-700 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition"
                >
                  List an item
                </button>
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              <button className="px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium border border-blue-100 dark:border-blue-700">
                For you
              </button>
              <button
                onClick={() => openExternalRoute(`${PUBLIC_BASE}/#/app/listings?sort=new`)}
                className="px-4 py-1.5 rounded-full bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium border border-gray-100 dark:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200"
              >
                Newest
              </button>
              <button
                onClick={() => openExternalRoute(`${PUBLIC_BASE}/#/app/listings?maxPrice=20`)}
                className="px-4 py-1.5 rounded-full bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium border border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Under $20
              </button>
              <button
                onClick={() => openExternalRoute(`${PUBLIC_BASE}/#/app/listings?minPrice=100`)}
                className="px-4 py-1.5 rounded-full bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium border border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Luxury
              </button>
            </div>
          </div>

          {/* metrics */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 px-4 py-4 flex flex-col gap-4">
                          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 tracking-tight">
              Today’s snapshot
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-100/70 dark:border-blue-800/70 px-3 py-3">
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">New listings</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 leading-none">+8</p>
                <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">in last 24h</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-100/70 dark:border-blue-800/70 px-3 py-3">
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">Near you</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 leading-none">12</p>
                <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">North Campus</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-100/70 dark:border-blue-800/70 px-3 py-3">
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">Interested</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 leading-none">
                  {interests.length ? interests.length : "0"}
                </p>
                <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">categories</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="w-full flex-1 px-1 sm:px-2 md:px-3 py-5 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-[0.22fr,1fr,0.22fr] gap-3 items-start">
          {/* LEFT */}
          <aside className="hidden lg:flex flex-col gap-3 sticky top-20">
            <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200/70 dark:border-gray-700/70 shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Quick filters
              </p>
              <div className="flex flex-wrap gap-2">
                {(allCategories.length ? allCategories : ["Electronics","Kitchen","Furniture","Dorm Essentials"]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() =>
                      openExternalRoute(`${PUBLIC_BASE}/#/app/listings?category=${encodeURIComponent(cat)}`)
                    }
                    className="px-4 py-1.5 rounded-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm border border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-800 p-4">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">
                Tips
              </p>
              <p className="text-sm text-blue-500 dark:text-blue-400">
                Items posted in the last 48h show “NEW”. Check these first.
              </p>
            </div>
          </aside>

          {/* CENTER */}
          <main className="flex flex-col gap-6 min-w-0">
            {/* For you */}
            {interests.length ? (
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
                            catItems.map((item) => (
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
            ) : null}

            {/* Explore */}
            <section className="space-y-4">
              <header>
                <h3 className="text-base font-semibold text-blue-600 dark:text-blue-400">
                  {interests.length ? "Explore more" : "Recommended for you"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {interests.length
                    ? "Other listings on Dorm Mart."
                    : "Popular items from UB students."}
                </p>
              </header>

              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 overflow-x-hidden min-w-0">
                {exploreItems.map((item, idx) => (
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

          {/* RIGHT */}
          <aside className="hidden lg:flex flex-col gap-3 sticky top-20">
            <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200/70 dark:border-gray-700/70 shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Trending now
              </p>
              <ul className="space-y-2">
                <li className="flex items-center justify-between gap-2">
                  <button
                    onClick={() =>
                      openExternalRoute(`${PUBLIC_BASE}/#/app/listings?category=Electronics`)
                    }
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Electronics
                  </button>
                  <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                    5 new
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <button
                    onClick={() =>
                      openExternalRoute(`${PUBLIC_BASE}/#/app/listings?category=Kitchen`)
                    }
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Kitchen
                  </button>
                  <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                    2 new
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <button
                    onClick={() =>
                      openExternalRoute(
                        `${PUBLIC_BASE}/#/app/listings?category=Dorm%20Essentials`
                      )
                    }
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Dorm essentials
                  </button>
                  <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                    hot
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-800 p-4">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">
                Your campus
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                North Campus is most active 3–6pm. Post then for faster replies.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
