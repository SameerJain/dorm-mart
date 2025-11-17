// src/pages/search/searchResults.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const API_BASE = (process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`).replace(/\/$/, "");

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function SearchResults() {
  const navigate = useNavigate();
  const query = useQuery();
  const location = useLocation();
  const lastSearchRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);

  // Derive includeDescription preference from URL or localStorage
  const includeDescriptionPref = useMemo(() => {
    const includeDescParam = query.get("desc") || query.get("includeDescription") || null;
    if (includeDescParam != null) {
      return includeDescParam === '1' || includeDescParam === 'true';
    }
    try {
      return localStorage.getItem('dm_include_desc') === '1';
    } catch (_) {
      return false;
    }
  }, [query]);

  const handleToggleIncludeDescription = useCallback(() => {
    const sp = new URLSearchParams(location.search || "");
    if (includeDescriptionPref) {
      sp.delete('desc');
      sp.delete('includeDescription');
      try { localStorage.setItem('dm_include_desc', '0'); } catch (_) {}
    } else {
      sp.set('desc', '1');
      try { localStorage.setItem('dm_include_desc', '1'); } catch (_) {}
    }
    navigate(`/app/listings?${sp.toString()}`);
  }, [includeDescriptionPref, location.search, navigate]);

  // Build a payload from the query string
  const payload = useMemo(() => {
    const q = query.get("q") || query.get("search") || null;
    const category = query.get("category") || null;
    const categoriesCsv = query.get("categories") || null;
    const sort = query.get("sort") || null; // e.g. 'new', 'price_asc', 'price_desc'
    const condition = query.get("condition") || null; // e.g. 'New', 'Used'
    const location = query.get("location") || null; // campus/location
    const minPrice = query.get("minPrice") || null;
    const maxPrice = query.get("maxPrice") || null;
    const status = query.get("status") || null; // e.g. 'AVAILABLE'
    const priceNegoParam = query.get("priceNego") || query.get("priceNegotiable") || null;
    const tradesParam = query.get("trades") || null;

    const p = {};
    if (q) p.q = q;
    if (category) p.category = category;
    if (categoriesCsv) p.categories = categoriesCsv.split(',').map(s => s.trim()).filter(Boolean);
    if (sort) p.sort = sort;
    if (condition) p.condition = condition;
    if (location) p.location = location;
    if (minPrice) p.minPrice = minPrice;
    if (maxPrice) p.maxPrice = maxPrice;
    if (status) p.status = status;
    if (includeDescriptionPref) p.includeDescription = true;
    // Pass boolean toggles through to backend so filters apply
    if (priceNegoParam && (priceNegoParam === '1' || String(priceNegoParam).toLowerCase() === 'true')) {
      // Backend accepts either priceNego or priceNegotiable
      p.priceNego = true;
    }
    if (tradesParam && (tradesParam === '1' || String(tradesParam).toLowerCase() === 'true')) {
      p.trades = true;
    }
    return p;
  }, [query, includeDescriptionPref]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch(`${API_BASE}/search/getSearchItems.php`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          credentials: "include",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        const normalized = arr.map((d, i) => {
          const id = d.id ?? d.product_id ?? i;
          const priceRaw = d.price ?? d.listing_price ?? null;
          const price = typeof priceRaw === "number"
            ? priceRaw
            : priceRaw != null
            ? parseFloat(String(priceRaw).replace(/[^0-9.]/g, "")) || 0
            : 0;

          const rawImg = d.image || d.image_url || d.photo || null;
          const img = rawImg
            ? `${API_BASE}/image.php?url=${encodeURIComponent(String(rawImg))}`
            : null;

          const seller = d.seller || d.seller_name || d.sold_by || (d.seller_id != null ? `Seller #${d.seller_id}` : "Unknown Seller");
          const createdAt = d.created_at || d.date_listed || null;
          const createdAtDate = createdAt ? new Date(createdAt) : null;
          const itemCondition = d.item_condition || d.condition || null;
          const itemLocation = d.item_location || d.meet_location || d.location || null;
          const status = d.status || (createdAtDate && !isNaN(createdAtDate) && (Date.now() - createdAtDate.getTime()) / 36e5 < 48 ? "JUST POSTED" : "AVAILABLE");

          return {
            id,
            title: d.title || d.product_title || "Untitled",
            price,
            img,
            seller,
            createdAt: createdAtDate,
            itemCondition,
            itemLocation,
            status,
          };
        });
        // Determine effective sort order
        // If user explicitly set sort in URL, honor it.
        // Otherwise, if there's no search query, default to newest -> oldest.
        const hasQuery = !!(payload?.q);
        const sortPref = (payload?.sort || "").toLowerCase();
        let sorted = normalized.slice();
        const getTs = (it) => (it?.createdAt instanceof Date && !isNaN(it.createdAt) ? it.createdAt.getTime() : 0);
        if (sortPref === 'new' || sortPref === 'newest') {
          sorted.sort((a, b) => getTs(b) - getTs(a));
        } else if (sortPref === 'old' || sortPref === 'oldest') {
          sorted.sort((a, b) => getTs(a) - getTs(b));
        } else if (!hasQuery) {
          // Default for empty search: newest first
          sorted.sort((a, b) => getTs(b) - getTs(a));
        }
        setItems(sorted);
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error("getSearchItems failed:", e);
          setError(e);
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [payload]);

  const titleText = useMemo(() => {
    const parts = [];
    if (payload.q) parts.push(`"${payload.q}"`);
    if (payload.category) parts.push(`${payload.category}`);
    return parts.length ? `Results for ${parts.join(" ")}` : "All Listings";
  }, [payload]);

  const formatDate = (d) => {
    if (!(d instanceof Date) || isNaN(d)) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="w-full border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-2 md:px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Back</button>
        <h1 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">{titleText}</h1>
        <div />
      </div>

      <div className="w-full px-2 md:px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-[260px,1fr] gap-4 items-start">
          {/* LEFT FILTERS */}
          <FiltersSidebar
            query={query}
            includeDescriptionPref={includeDescriptionPref}
            onToggleIncludeDescription={handleToggleIncludeDescription}
            navigate={navigate}
            lastSearchRef={lastSearchRef}
          />

          {/* RESULTS */}
          <section>
            {/* Loading / Error / Empty states */}
            {loading ? (
              <p className="text-center text-sm text-gray-400 dark:text-gray-500">Searching…</p>
            ) : error ? (
              <p className="text-center text-sm text-red-500 dark:text-red-400">Could not fetch search results.</p>
            ) : items.length === 0 ? (
              <p className="text-center text-sm text-gray-400 dark:text-gray-500">No items found.</p>
            ) : (
              <ul className="space-y-3">
                {items.map((it) => (
                  <li key={it.id}>
                    <button
                      onClick={() => navigate(`/app/viewProduct/${encodeURIComponent(it.id)}`)}
                      className="w-full text-left bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 shadow-sm hover:border-blue-200 dark:hover:border-blue-700 transition p-3"
                    >
                      <div className="grid grid-cols-[4.5rem,1fr,6.5rem] md:grid-cols-[6rem,1fr,8rem] gap-3 items-center">
                        {/* Photo */}
                        <div className="h-20 w-20 md:h-24 md:w-24 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                          {it.img ? (
                            <img src={it.img} alt={it.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">No image</div>
                          )}
                        </div>

                        {/* Middle details */}
                        <div className="flex flex-col gap-0.5 md:gap-1 pr-2">
                          <p className="text-sm md:text-base font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">{it.title}</p>
                          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                            {it.itemCondition ? <><span className="font-medium">Condition:</span> {it.itemCondition} · </> : null}
                            {it.itemLocation ? <><span className="font-medium">Location:</span> {it.itemLocation} · </> : null}
                            <span className="font-medium">Seller:</span> {it.seller}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{it.createdAt ? `Posted ${formatDate(it.createdAt)}` : null}</p>
                        </div>

                        {/* Right price + status */}
                        <div className="flex flex-col items-end gap-1">
                          <div className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-100">${it.price?.toFixed(2)}</div>
                          {it.status ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                              String(it.status).toUpperCase() === "JUST POSTED"
                                ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700"
                                : String(it.status).toUpperCase() === "SOLD"
                                ? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600"
                                : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700"
                            }`}>
                              {String(it.status).toUpperCase()}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// Sidebar component with filters and Apply button
function FiltersSidebar({ query, includeDescriptionPref, onToggleIncludeDescription, navigate, lastSearchRef }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [sortOrder, setSortOrder] = useState(""); // '', 'new', 'old'
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(5000);
  const [itemLocation, setItemLocation] = useState("");
  const [itemCondition, setItemCondition] = useState("");
  const [priceNegotiable, setPriceNegotiable] = useState(false);
  const [acceptingTrades, setAcceptingTrades] = useState(false);

  // Fetch categories once
  useEffect(() => {
    const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
    const API_BASE = (process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`).replace(/\/$/, "");
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/utility/get_categories.php`);
        if (r.ok) {
          const json = await r.json();
          if (Array.isArray(json)) setCategories(json);
        }
      } catch (_) {}
    })();
  }, []);

  // Hydrate state from URL params. Reset when search term changes.
  useEffect(() => {
    const searchTerm = query.get("q") || query.get("search") || "";
    const prev = lastSearchRef.current;
    lastSearchRef.current = searchTerm;

    // Always reflect current URL (which will be clean when user typed new search in nav)
    const spCats = query.get("categories");
    const catSingle = query.get("category");
    let cats = [];
    if (spCats) cats = spCats.split(",").map((s) => s.trim()).filter(Boolean);
    if (catSingle) cats = Array.from(new Set([...cats, catSingle]));
    setSelectedCategories(cats);

    const s = (query.get("sort") || "").toLowerCase();
    setSortOrder(
      s === "old" || s === "oldest" ? "old" :
      s === "new" || s === "newest" ? "new" :
      (s === "best" || s === "best_match" || s === "relevance") ? "best" :
      ""
    );

    const mn = parseFloat(query.get("minPrice"));
    const mx = parseFloat(query.get("maxPrice"));
    setMinPrice(Number.isFinite(mn) ? Math.max(0, Math.min(5000, mn)) : 0);
    setMaxPrice(Number.isFinite(mx) ? Math.max(0, Math.min(5000, mx)) : 5000);

    setItemLocation(query.get("location") || "");
    setItemCondition(query.get("condition") || "");
    const pn = query.get("priceNego") || query.get("priceNegotiable");
    setPriceNegotiable(pn === "1" || pn === "true");
    const tr = query.get("trades");
    setAcceptingTrades(tr === "1" || tr === "true");

    // If the search term changed, this will naturally reset because the new URL (from nav) lacks filter params
    // No extra action needed
  }, [query, lastSearchRef]);

  const toggleCategory = (c) => {
    setSelectedCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const apply = () => {
    const searchTerm = query.get("q") || query.get("search") || "";
    const sp = new URLSearchParams();
    if (searchTerm) sp.set("search", searchTerm);
    if (selectedCategories.length) sp.set("categories", selectedCategories.join(","));
    if (sortOrder === "new") sp.set("sort", "new");
    else if (sortOrder === "old") sp.set("sort", "old");
    else if (sortOrder === "best") sp.set("sort", "best");
    if (Number.isFinite(minPrice)) sp.set("minPrice", String(Math.max(0, Math.min(5000, minPrice))));
    if (Number.isFinite(maxPrice)) sp.set("maxPrice", String(Math.max(0, Math.min(5000, maxPrice))));
    if (itemLocation) sp.set("location", itemLocation);
    if (itemCondition) sp.set("condition", itemCondition);
    if (priceNegotiable) sp.set("priceNego", "1");
    if (acceptingTrades) sp.set("trades", "1");
    if (includeDescriptionPref) sp.set("desc", "1");
    navigate(`/app/listings?${sp.toString()}`);
  };

  return (
    <aside className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 md:sticky md:top-20">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Filters</h2>
        <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={includeDescriptionPref} onChange={onToggleIncludeDescription} />
          <span>Include description</span>
        </label>
      </div>

      {/* Categories */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Categories</p>
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
          {categories.length ? (
            categories.map((c) => (
              <label key={c} className={`text-xs inline-flex items-center gap-1 px-2 py-1 rounded-full border cursor-pointer ${selectedCategories.includes(c) ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}>
                <input type="checkbox" className="hidden" checked={selectedCategories.includes(c)} onChange={() => toggleCategory(c)} />
                <span>{c}</span>
              </label>
            ))
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">Loading…</span>
          )}
        </div>
      </div>

      {/* Sort */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Sort</p>
        <div className="flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-300">
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="sort" checked={sortOrder === 'new'} onChange={() => setSortOrder('new')} />
            <span>Newest → Oldest</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="sort" checked={sortOrder === 'old'} onChange={() => setSortOrder('old')} />
            <span>Oldest → Newest</span>
          </label>
        </div>
      </div>

      {/* Price */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Price Range ($0 – $5000)</p>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span>Min</span>
            <input type="number" min={0} max={5000} value={minPrice} onChange={(e) => setMinPrice(Math.max(0, Math.min(5000, parseInt(e.target.value, 10) || 0)))} className="w-20 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </div>
          <div className="flex items-center gap-2">
            <span>Max</span>
            <input type="number" min={0} max={5000} value={maxPrice} onChange={(e) => setMaxPrice(Math.max(0, Math.min(5000, parseInt(e.target.value, 10) || 0)))} className="w-20 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Item Location</p>
        <select value={itemLocation} onChange={(e) => setItemLocation(e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
          <option value="">Any</option>
          <option value="North Campus">North Campus</option>
          <option value="South Campus">South Campus</option>
          <option value="Ellicott">Ellicott</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Condition */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Item Condition</p>
        <select value={itemCondition} onChange={(e) => setItemCondition(e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
          <option value="">Any</option>
          <option value="Like New">Like New</option>
          <option value="Excellent">Excellent</option>
          <option value="Good">Good</option>
          <option value="Fair">Fair</option>
          <option value="For Parts">For Parts</option>
        </select>
      </div>

      {/* Toggles */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Options</p>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-2">
          <input type="checkbox" checked={priceNegotiable} onChange={(e) => setPriceNegotiable(e.target.checked)} />
          <span>Price Negotiable</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={acceptingTrades} onChange={(e) => setAcceptingTrades(e.target.checked)} />
          <span>Accepting Trades</span>
        </label>
      </div>

      <button onClick={apply} className="w-full px-3 py-2 rounded bg-blue-600 dark:bg-blue-700 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600">Apply</button>
    </aside>
  );
}

