/* ═══════════════════════════════════════════════════════════════════════
   STELLAR ARCHIVE · application
   The little mechanics behind a room full of tiny, cherished things.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHTML = window.STELLAR_ESCAPE;
  const formatDate = window.STELLAR_FORMAT_DATE;
  const findSeries = window.STELLAR_SERIES_FIND;
  const SERIES = window.STELLAR_SERIES;
  const SERIES_ORDER = window.STELLAR_SERIES_ORDER;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const DB_NAME = "stellar-archive-v1";
  const DB_STORE = "plates";
  const FAV_KEY = "stellar-archive:favourites:v1";
  const MAX_TREE_PLATES = 200;
  const MAX_UPLOAD_BATCH = 30;

  const state = {
    route: null,
    demo: [],
    customItems: [],
    items: [],
    treeItems: [],
    filteredItems: [],
    tree: null,
    treeReady: false,
    treeBuilding: false,
    treeDirty: false,
    treeFocus: null,
    treePaused: false,
    filters: { series: "all", rarity: "all", favourite: false },
    query: "",
    sort: "number",
    favourites: new Set(),
    objectUrls: new Set(),
    customSequence: 0,
    viewer: {
      open: false,
      list: [],
      index: 0,
      item: null,
      dragging: false,
      rotX: 0,
      rotY: -7,
      velX: 0,
      velY: 0,
      spinning: false,
      zoom: 1,
      enteredAt: 0,
      lastFocus: null,
      imageToken: 0,
      startX: 0,
      startY: 0,
      startRotX: 0,
      startRotY: 0,
      lastMoveX: 0,
      raf: 0,
      lastTime: 0,
    },
    pendingResults: [],
    uploadBusy: false,
    preloaderStart: performance.now(),
    preloaderHidden: false,
    db: null,
    dbFailed: false,
  };

  const el = {};

  /* ══════════════════════════════════════════════════════════════════════
     boot
     ══════════════════════════════════════════════════════════════════════ */

  async function boot() {
    cacheElements();
    bindStaticEvents();
    loadFavourites();

    state.demo = Array.isArray(window.STELLAR_DATA) ? window.STELLAR_DATA.slice() : [];

    try {
      await loadCustomRecords();
    } catch (error) {
      console.warn("Could not read local archive:", error);
    }

    state.treeItems = chooseTreeItems();
    refreshDataViews();
    updatePreloader(0, Math.max(1, state.treeItems.length), "正在整理星枝");

    const initialRoute = getInitialRoute();
    navigate(initialRoute, { push: false, initial: true });

    // A deep link into the collection should not make the visitor wait behind
    // the tree's curtain. The tree can finish dressing itself in the background.
    if (initialRoute !== "tree") {
      window.setTimeout(() => hidePreloader(), 750);
    }

    window.setTimeout(() => {
      if (!state.preloaderHidden) {
        hidePreloader();
        showToast("星树点灯时间有点久，可以先逛逛藏品馆。");
      }
    }, 18000);

    if (!window.THREE) {
      showTreeFallback("当前浏览器无法启用 3D 星树，但藏品馆依然可以进入。");
      hidePreloader();
      return;
    }

    if (!state.treeItems.length) {
      showTreeFallback("还没有可展示的藏品。去识藏室放入第一张照片吧。");
      hidePreloader();
      return;
    }

    await initTreeScene();
  }

  function cacheElements() {
    const ids = [
      "preloader", "loadBar", "loadPercent", "loadTotal", "loadStatus",
      "topbar", "navCount", "treeView", "treeCanvas", "treeFallback",
      "heroCount", "heroSeriesCount", "treeSeriesList", "clearTreeFocus",
      "photoTip", "photoTipNo", "photoTipName", "photoTipSeries",
      "orbitToggle", "orbitIcon", "resetView", "zoomIn", "zoomOut",
      "collectionView", "collectionGrid", "emptyState", "emptyReset",
      "resultCount", "collectionCount", "collectionSeries", "collectionRare",
      "seriesFilters", "rarityFilters", "filterFavourite", "favCount",
      "activeFilters", "searchInput", "sortSelect", "resetFilters",
      "atelierView", "dropzone", "fileInput", "browseBtn", "demoIdentifyBtn",
      "scanPanel", "scanGrid", "scanBar", "scanProgressLabel", "scanCaption",
      "identifyResults", "resultGrid", "clearResults", "confirmImport", "importCount",
      "atelierLog", "atelierLogEmpty", "atelierLogStrip", "customPhotoCount", "clearCustomBtn",
      "atelierSeriesList",
      "viewer", "viewerBackdrop", "viewerClose", "viewerNo", "viewerTitle",
      "viewerTitleEn", "viewerSeries", "viewerRarity", "viewerStory",
      "viewerCollection", "viewerId", "viewerDate", "viewerConfidence",
      "viewerNote", "viewerSample", "viewerFav", "viewerFavLabel", "viewerIndex",
      "viewerTotal", "viewerProgressBar", "viewerPlateNo", "viewerBackNo",
      "viewerImage", "viewerSkeleton", "viewerStage", "viewerReflection", "artCard",
      "artRotor", "artCardMat", "viewerFloat", "viewerPrev", "viewerNext",
      "viewerAngle", "viewerZoomIn", "viewerZoomOut", "viewerZoomLabel",
      "viewerSpin", "viewerInfo", "toastStack", "srLive",
    ];
    ids.forEach((id) => {
      el[id] = document.getElementById(id);
    });
    el.artCardMat = $(".art-card__mat", el.artCard);
    el.viewerFloat = $(".viewer__float", el.viewer);
    el.views = $$(".view");
    el.topnavItems = $$(".topnav__item");
    el.routeTargets = $$("[data-route]");
    el.loadTotal = document.getElementById("loadTotal");
    el.scrollViews = [el.collectionView, el.atelierView];
    el.viewer.inert = true;
    el.viewer.setAttribute("inert", "");
  }

  function bindStaticEvents() {
    document.addEventListener("click", (event) => {
      const routeTarget = event.target.closest("[data-route]");
      if (routeTarget) {
        event.preventDefault();
        navigate(routeTarget.dataset.route);
        return;
      }
      const scrollTopButton = event.target.closest("[data-scroll-top]");
      if (scrollTopButton) {
        activeScrollView()?.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

    el.orbitToggle.addEventListener("click", () => {
      state.treePaused = !state.treePaused;
      state.tree?.setPaused(state.treePaused);
      updateOrbitButton();
    });

    el.resetView.addEventListener("click", () => {
      state.tree?.resetView();
      state.treeFocus = null;
      state.tree?.setFocus(null);
      updateTreeFocusUI();
      showToast("已回到最初的观看位置。");
    });

    el.zoomIn.addEventListener("click", () => state.tree?.zoomIn());
    el.zoomOut.addEventListener("click", () => state.tree?.zoomOut());

    el.treeSeriesList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-tree-series]");
      if (!button) return;
      const key = button.dataset.treeSeries;
      state.treeFocus = state.treeFocus === key ? null : key;
      state.tree?.setFocus(state.treeFocus);
      updateTreeFocusUI();
    });

    el.clearTreeFocus.addEventListener("click", () => {
      state.treeFocus = null;
      state.tree?.setFocus(null);
      updateTreeFocusUI();
    });

    el.seriesFilters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-series-filter]");
      if (!button) return;
      state.filters.series = button.dataset.seriesFilter;
      updateFilterUI();
      renderCollection();
    });

    el.rarityFilters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-rarity-filter]");
      if (!button) return;
      state.filters.rarity = button.dataset.rarityFilter;
      updateFilterUI();
      renderCollection();
    });

    el.filterFavourite.addEventListener("click", () => {
      state.filters.favourite = !state.filters.favourite;
      updateFilterUI();
      renderCollection();
    });

    el.activeFilters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-filter]");
      if (!button) return;
      const type = button.dataset.removeFilter;
      if (type === "series") state.filters.series = "all";
      if (type === "rarity") state.filters.rarity = "all";
      if (type === "favourite") state.filters.favourite = false;
      if (type === "query") {
        state.query = "";
        el.searchInput.value = "";
      }
      updateFilterUI();
      renderCollection();
    });

    let searchTimer = 0;
    el.searchInput.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        state.query = el.searchInput.value.trim();
        renderCollection();
      }, 120);
    });

    el.sortSelect.addEventListener("change", () => {
      state.sort = el.sortSelect.value;
      renderCollection();
    });

    el.resetFilters.addEventListener("click", resetAllFilters);
    el.emptyReset.addEventListener("click", resetAllFilters);

    el.collectionGrid.addEventListener("click", (event) => {
      const favButton = event.target.closest("[data-fav-id]");
      if (favButton) {
        event.preventDefault();
        event.stopPropagation();
        toggleFavourite(favButton.dataset.favId);
        return;
      }
      const openButton = event.target.closest("[data-open-id]");
      if (!openButton) return;
      const item = state.items.find((candidate) => candidate.id === openButton.dataset.openId);
      if (!item) return;
      const frame = $(".plate__frame", openButton);
      const rect = frame ? frame.getBoundingClientRect() : openButton.getBoundingClientRect();
      openViewer(item, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width }, state.filteredItems);
    });

    window.addEventListener("popstate", () => {
      const route = getInitialRoute();
      if (route !== state.route) navigate(route, { push: false, fromHistory: true });
    });
    window.addEventListener("hashchange", () => {
      const route = getInitialRoute();
      if (route !== state.route) navigate(route, { push: false, fromHistory: true });
    });

    el.scrollViews.forEach((view) => {
      view.addEventListener("scroll", updateTopbarState, { passive: true });
    });

    document.addEventListener("keydown", onGlobalKeydown);
    bindViewerEvents();
    bindAtelierEvents();
    window.addEventListener("beforeunload", () => {
      for (const url of state.objectUrls) {
        try { URL.revokeObjectURL(url); } catch {}
      }
    });
  }

  function activeScrollView() {
    if (state.route === "collection") return el.collectionView;
    if (state.route === "atelier") return el.atelierView;
    return null;
  }

  function updateTopbarState() {
    const view = activeScrollView();
    el.topbar.classList.toggle("is-scrolled", Boolean(view && view.scrollTop > 18));
  }

  /* ══════════════════════════════════════════════════════════════════════
     routing & preloader
     ══════════════════════════════════════════════════════════════════════ */

  function getInitialRoute() {
    const hash = window.location.hash.replace(/^#\/?/, "").split("/")[0];
    return ["tree", "collection", "atelier"].includes(hash) ? hash : "tree";
  }

  function navigate(route, options = {}) {
    const valid = ["tree", "collection", "atelier"];
    const target = valid.includes(route) ? route : "tree";
    const { push = true, initial = false, fromHistory = false } = options;

    if (push && !fromHistory && window.location.hash !== `#${target}`) {
      window.history.pushState({ route: target }, "", `#${target}`);
    } else if (initial && !window.location.hash) {
      window.history.replaceState({ route: target }, "", `#${target}`);
    }

    if (state.viewer.open) closeViewer({ restoreFocus: false });
    const changed = state.route !== target;
    state.route = target;
    document.body.dataset.view = target;

    for (const view of el.views) {
      const active = view.dataset.view === target;
      view.hidden = !active;
      view.classList.toggle("is-active", active);
      if (active && changed) {
        view.classList.remove("is-entering");
        // force a style flush so the entrance animation can be retriggered
        void view.offsetWidth;
        view.classList.add("is-entering");
        window.setTimeout(() => view.classList.remove("is-entering"), 900);
      }
    }

    el.topnavItems.forEach((item) => {
      item.classList.toggle("is-active", item.dataset.route === target);
    });

    if (target === "tree") {
      el.topbar.classList.remove("is-scrolled");
      if (state.tree && state.treeReady) state.tree.setActive(true);
      if (state.treeDirty && !state.treeBuilding) rebuildTreeScene();
    } else {
      state.tree?.setActive(false);
      updateTopbarState();
      if (target === "collection") {
        renderCollection();
      }
      if (target === "atelier") {
        renderAtelierLog();
      }
    }

    const label = target === "tree" ? "星树" : target === "collection" ? "藏品馆" : "识藏室";
    el.srLive.textContent = `已进入${label}`;

    if (changed) {
      window.scrollTo({ top: 0, behavior: "auto" });
      if (activeScrollView()) activeScrollView().scrollTop = 0;
    }
  }

  async function initTreeScene() {
    if (state.treeBuilding) return;
    state.treeBuilding = true;
    state.treeDirty = false;
    try {
      const tree = new window.StellarTree(el.treeCanvas, {
        onProgress: (loaded, total, status) => {
          updatePreloader(loaded, total, status);
        },
        onHover: handleTreeHover,
        onSelect: (item, point) => {
          if (!item) return;
          openViewer(item, { x: point.x, y: point.y, width: 130 }, state.treeItems);
        },
        onReset: () => updateTreeFocusUI(),
        onError: (message) => {
          showTreeFallback(message || "星树暂时无法点亮，客厅的灯还亮着。");
          hidePreloader();
        },
      });
      state.tree = tree;
      await tree.load(state.treeItems);
      if (!tree.ready) {
        showTreeFallback("照片没有顺利挂上星树，请刷新页面重试。");
        hidePreloader();
        return;
      }
      state.treeReady = true;
      state.treeDirty = false;
      state.treePaused = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      tree.setPaused(state.treePaused);
      if (state.treeFocus) tree.setFocus(state.treeFocus);
      updateOrbitButton();
      hidePreloader(true);
      if (state.route === "tree") tree.setActive(true);
    } catch (error) {
      console.error("Tree initialisation failed:", error);
      showTreeFallback("当前浏览器无法启用 3D 星树，但藏品馆依然可以进入。");
      hidePreloader();
    } finally {
      state.treeBuilding = false;
    }
  }

  async function rebuildTreeScene() {
    if (state.treeBuilding || !state.tree) return;
    state.treeItems = chooseTreeItems();
    state.treeBuilding = true;
    state.treeDirty = false;
    state.tree.setActive(false);
    showToast("藏品有更新，正在重新点亮星树…");
    try {
      await state.tree.load(state.treeItems);
      if (!state.tree.ready) {
        showTreeFallback("照片没有顺利挂上星树，请刷新页面重试。");
        return;
      }
      state.treeReady = true;
      if (state.treeFocus) state.tree.setFocus(state.treeFocus);
      if (state.route === "tree") state.tree.setActive(true);
    } catch (error) {
      console.error(error);
      showTreeFallback("星树暂时无法点亮，请稍后再试。");
    } finally {
      state.treeBuilding = false;
    }
  }

  function showTreeFallback(message) {
    el.treeFallback.hidden = false;
    const p = $("p", el.treeFallback);
    if (p && message) p.textContent = message;
  }

  function updatePreloader(loaded, total, status) {
    const safeTotal = Math.max(1, total || 1);
    const percent = Math.min(100, Math.round((loaded / safeTotal) * 100));
    if (el.loadPercent) el.loadPercent.textContent = String(percent).padStart(2, "0");
    if (el.loadTotal) el.loadTotal.textContent = String(total || 0);
    if (el.loadBar) el.loadBar.style.width = `${percent}%`;
    if (status && el.loadStatus) el.loadStatus.textContent = status;
  }

  function hidePreloader(afterReady = false) {
    if (state.preloaderHidden) return;
    state.preloaderHidden = true;
    if (el.loadPercent) el.loadPercent.textContent = "100";
    if (el.loadBar) el.loadBar.style.width = "100%";
    if (el.loadStatus) el.loadStatus.textContent = "星树已经点亮";
    document.body.classList.add("is-ready");
    window.setTimeout(() => {
      if (el.loadBar) el.loadBar.style.width = "100%";
      el.preloader.classList.add("is-done");
      el.preloader.setAttribute("aria-hidden", "true");
      window.setTimeout(() => {
        if (!afterReady) el.preloader.style.display = "none";
      }, 1200);
    }, 280);
  }

  /* ══════════════════════════════════════════════════════════════════════
     data · custom IndexedDB archive
     ══════════════════════════════════════════════════════════════════════ */

  function openArchiveDB() {
    if (state.db) return Promise.resolve(state.db);
    if (state.dbFailed || !("indexedDB" in window)) {
      return Promise.reject(new Error("IndexedDB unavailable"));
    }
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => {
        state.db = request.result;
        resolve(state.db);
      };
      request.onerror = () => {
        state.dbFailed = true;
        reject(request.error || new Error("Could not open local archive"));
      };
    });
  }

  async function readAllRecords() {
    const db = await openArchiveDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const store = tx.objectStore(DB_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function writeRecord(record) {
    const db = await openArchiveDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function clearAllRecords() {
    const db = await openArchiveDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function loadCustomRecords() {
    let records;
    try {
      records = await readAllRecords();
    } catch (error) {
      console.warn(error);
      return;
    }
    records.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    state.customItems = records.map(recordToItem).filter(Boolean);
    state.customSequence = Math.max(
      state.customItems.length,
      ...state.customItems.map((item) => {
        const match = /^C(\d+)$/.exec(item.no || "");
        return match ? Number(match[1]) : 0;
      }),
      0
    );
  }

  function recordToItem(record) {
    if (!record || !record.thumbBlob || !record.fullBlob) return null;
    const meta = findSeries(record.seriesKey) || SERIES.molly;
    const thumb = URL.createObjectURL(record.thumbBlob);
    const src = URL.createObjectURL(record.fullBlob);
    state.objectUrls.add(thumb);
    state.objectUrls.add(src);
    return {
      id: record.id,
      no: record.no || "C001",
      seriesKey: record.seriesKey || meta.key,
      series: meta.name,
      seriesCn: meta.cn,
      collection: meta.collection,
      collectionEn: meta.collectionEn,
      character: meta.name,
      title: record.title || "冬日新藏",
      titleEn: "NEW ACQUISITION",
      story: record.story || `${meta.intro} 它刚刚从你的相册，来到圣诞星树下。`,
      rarity: record.rarity || "新入藏",
      date: record.date || formatDate(),
      accent: meta.accent,
      confidence: record.confidence == null ? null : Number(record.confidence),
      manual: Boolean(record.manual),
      sample: false,
      thumb,
      src,
      addedAt: record.addedAt || Date.now(),
    };
  }

  function chooseTreeItems() {
    const custom = state.customItems.slice(0, MAX_TREE_PLATES);
    if (custom.length >= MAX_TREE_PLATES) return shuffle(custom.slice(0, MAX_TREE_PLATES));
    const need = MAX_TREE_PLATES - custom.length;
    const demoPart = state.demo.slice(0, need);
    return shuffle(custom.concat(demoPart));
  }

  function shuffle(items) {
    const result = items.slice();
    let seed = 0x51f15e;
    for (let i = result.length - 1; i > 0; i -= 1) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      const j = Math.abs(seed) % (i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function loadFavourites() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(FAV_KEY) || "[]");
      if (Array.isArray(parsed)) state.favourites = new Set(parsed.filter((id) => typeof id === "string"));
    } catch {
      state.favourites = new Set();
    }
  }

  function saveFavourites() {
    try {
      window.localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(state.favourites)));
    } catch {
      showToast("浏览器没有允许保存珍藏状态。");
    }
  }

  function pruneFavourites() {
    const ids = new Set(state.items.map((item) => item.id));
    let changed = false;
    for (const id of state.favourites) {
      if (!ids.has(id)) {
        state.favourites.delete(id);
        changed = true;
      }
    }
    if (changed) saveFavourites();
  }

  /* ══════════════════════════════════════════════════════════════════════
     shared data views
     ══════════════════════════════════════════════════════════════════════ */

  function refreshDataViews() {
    state.items = state.customItems.concat(state.demo);
    state.filteredItems = state.items.slice();
    pruneFavourites();
    state.treeItems = chooseTreeItems();
    updateCounts();
    renderTreeSeriesRail();
    renderFilters();
    renderAtelierSeriesList();
    renderCollection();
    renderAtelierLog();
    updateTreeFocusUI();
  }

  function seriesCounts() {
    const counts = {};
    SERIES_ORDER.forEach((key) => { counts[key] = 0; });
    for (const item of state.items) {
      if (counts[item.seriesKey] == null) counts[item.seriesKey] = 0;
      counts[item.seriesKey] += 1;
    }
    return counts;
  }

  function updateCounts() {
    const total = state.items.length;
    const series = new Set(state.items.map((item) => item.seriesKey));
    const rare = state.items.filter((item) => item.rarity === "隐藏款" || item.rarity === "限定款").length;
    el.navCount.textContent = total;
    el.heroCount.textContent = total;
    el.heroSeriesCount.textContent = series.size || SERIES_ORDER.length;
    el.collectionCount.textContent = total;
    el.collectionSeries.textContent = series.size || SERIES_ORDER.length;
    el.collectionRare.textContent = rare;
    el.resultCount.textContent = state.filteredItems.length;
    el.favCount.textContent = state.favourites.size;
  }

  function renderTreeSeriesRail() {
    const counts = seriesCounts();
    el.treeSeriesList.innerHTML = SERIES_ORDER.map((key) => {
      const meta = SERIES[key];
      return `
        <button class="series-item" type="button" data-tree-series="${key}" style="--accent:${meta.accent}" aria-pressed="false">
          <span class="series-item__dot" aria-hidden="true"></span>
          <span class="series-item__name">${escapeHTML(meta.name)}</span>
          <span class="series-item__cn">${escapeHTML(meta.cn)}</span>
          <span class="series-item__count">${counts[key] || 0}</span>
        </button>`;
    }).join("");
    updateTreeFocusUI();
  }

  function updateTreeFocusUI() {
    $$("[data-tree-series]", el.treeSeriesList).forEach((button) => {
      const active = button.dataset.treeSeries === state.treeFocus;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    el.clearTreeFocus.hidden = !state.treeFocus;
  }

  function renderFilters() {
    const counts = seriesCounts();
    const seriesButtons = [
      `<button class="filter-option" type="button" data-series-filter="all" aria-pressed="false">
        <span class="filter-option__dot" style="--accent:var(--gold)" aria-hidden="true"></span>
        <span class="filter-option__label">全部系列</span>
        <span class="filter-option__cn">全</span>
        <span class="filter-option__count">${state.items.length}</span>
      </button>`,
    ];
    for (const key of SERIES_ORDER) {
      const meta = SERIES[key];
      seriesButtons.push(`
        <button class="filter-option" type="button" data-series-filter="${key}" style="--accent:${meta.accent}" aria-pressed="false">
          <span class="filter-option__dot" aria-hidden="true"></span>
          <span class="filter-option__label">${escapeHTML(meta.name)}</span>
          <span class="filter-option__cn">${escapeHTML(meta.cn)}</span>
          <span class="filter-option__count">${counts[key] || 0}</span>
        </button>`);
    }
    el.seriesFilters.innerHTML = seriesButtons.join("");

    const regular = state.items.filter((item) => item.rarity === "常规款").length;
    const limited = state.items.filter((item) => item.rarity === "限定款").length;
    const hidden = state.items.filter((item) => item.rarity === "隐藏款").length;
    const rarityData = [
      ["all", "全部版本", `${state.items.length}`],
      ["常规款", "常规款", `${regular}`],
      ["限定款", "限定款", `${limited}`],
      ["隐藏款", "隐藏款", `${hidden}`],
    ];
    el.rarityFilters.innerHTML = rarityData.map(([value, label, count]) => `
      <button class="filter-option" type="button" data-rarity-filter="${value}" aria-pressed="false">
        <span class="filter-option__dot" aria-hidden="true"></span>
        <span class="filter-option__label">${escapeHTML(label)}</span>
        <span class="filter-option__count">${count}</span>
      </button>`).join("");

    updateFilterUI();
  }

  function updateFilterUI() {
    $$("[data-series-filter]", el.seriesFilters).forEach((button) => {
      const active = button.dataset.seriesFilter === state.filters.series;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    $$("[data-rarity-filter]", el.rarityFilters).forEach((button) => {
      const active = button.dataset.rarityFilter === state.filters.rarity;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    el.filterFavourite.classList.toggle("is-active", state.filters.favourite);
    el.filterFavourite.setAttribute("aria-pressed", state.filters.favourite ? "true" : "false");
    el.favCount.textContent = state.favourites.size;
    el.collectionGrid?.querySelectorAll("[data-fav-id]").forEach((button) => {
      const active = state.favourites.has(button.dataset.favId);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function renderAtelierSeriesList() {
    const counts = seriesCounts();
    el.atelierSeriesList.innerHTML = SERIES_ORDER.map((key) => {
      const meta = SERIES[key];
      return `<span class="mini-series__item" style="--accent:${meta.accent}">
        <i aria-hidden="true"></i><span>${escapeHTML(meta.name)}</span><b>${counts[key] || 0}</b>
      </span>`;
    }).join("");
  }

  /* ══════════════════════════════════════════════════════════════════════
     collection
     ══════════════════════════════════════════════════════════════════════ */

  function itemMatches(item) {
    if (state.filters.series !== "all" && item.seriesKey !== state.filters.series) return false;
    if (state.filters.rarity !== "all" && item.rarity !== state.filters.rarity) return false;
    if (state.filters.favourite && !state.favourites.has(item.id)) return false;
    if (!state.query) return true;
    const haystack = [
      item.title,
      item.titleEn,
      item.series,
      item.seriesCn,
      item.collection,
      item.collectionEn,
      item.id,
      item.no,
      item.character,
    ].join(" ").toLowerCase();
    return haystack.includes(state.query.toLowerCase());
  }

  function sortItems(items) {
    const result = items.slice();
    if (state.sort === "series") {
      return result.sort((a, b) => {
        const ai = SERIES_ORDER.indexOf(a.seriesKey);
        const bi = SERIES_ORDER.indexOf(b.seriesKey);
        if (ai !== bi) return ai - bi;
        return String(a.no).localeCompare(String(b.no), "zh-Hans-CN");
      });
    }
    if (state.sort === "title") {
      return result.sort((a, b) => String(a.title).localeCompare(String(b.title), "zh-Hans-CN"));
    }
    if (state.sort === "date") {
      return result.sort((a, b) => {
        const aUser = a.sample === false ? 1 : 0;
        const bUser = b.sample === false ? 1 : 0;
        if (aUser !== bUser) return bUser - aUser;
        return String(b.addedAt || b.date).localeCompare(String(a.addedAt || a.date));
      });
    }
    return result.sort((a, b) => {
      // The visitor's own plates sit at the front of the catalogue.
      const aUser = a.sample === false ? 1 : 0;
      const bUser = b.sample === false ? 1 : 0;
      if (aUser !== bUser) return bUser - aUser;
      return String(a.no).localeCompare(String(b.no), "zh-Hans-CN", { numeric: true });
    });
  }

  function renderCollection() {
    const filtered = state.items.filter(itemMatches);
    state.filteredItems = sortItems(filtered);
    el.resultCount.textContent = state.filteredItems.length;
    el.collectionGrid.innerHTML = state.filteredItems.map((item, index) => {
      const favourite = state.favourites.has(item.id);
      const special = item.rarity === "隐藏款" || item.rarity === "限定款";
      return `
        <article class="plate${favourite ? " plate--favourite" : ""}" data-id="${escapeHTML(item.id)}" style="--delay:${Math.min(index, 18) * 26}ms">
          <button class="plate__open" type="button" data-open-id="${escapeHTML(item.id)}" aria-label="欣赏 ${escapeHTML(item.series)} ${escapeHTML(item.title)}">
            <div class="plate__frame">
              <div class="plate__image">
                <img src="${escapeHTML(item.thumb)}" alt="${escapeHTML(item.series)} ${escapeHTML(item.title)}，${item.sample ? "示例藏品照片" : "私人藏品照片"}" loading="${index < 8 ? "eager" : "lazy"}" decoding="async" width="300" height="375">
                ${item.sample ? '<span class="plate__sample">SAMPLE · 样张</span>' : ""}
                <span class="plate__index">${escapeHTML(item.no)}</span>
                <span class="plate__hover"><span>赏</span><em>VIEW PLATE</em></span>
              </div>
            </div>
            <div class="plate__label">
              <div class="plate__label-main">
                <span class="plate__series">${escapeHTML(item.series)} · ${escapeHTML(item.collection)}</span>
                <span class="plate__title">${escapeHTML(item.title)}</span>
              </div>
              <div class="plate__label-side">
                ${special ? `<span class="plate__rarity">${escapeHTML(item.rarity)}</span>` : ""}
                <span class="plate__arrow" aria-hidden="true">↗</span>
              </div>
            </div>
          </button>
          <button class="plate__fav${favourite ? " is-active" : ""}" type="button" data-fav-id="${escapeHTML(item.id)}" aria-label="${favourite ? "取消珍藏" : "收入珍藏"}：${escapeHTML(item.title)}" aria-pressed="${favourite ? "true" : "false"}">✦</button>
        </article>`;
    }).join("");

    el.emptyState.hidden = state.filteredItems.length !== 0;
    el.collectionGrid.hidden = state.filteredItems.length === 0;
    renderActiveFilterChips();
    updateFilterUI();
    updateCounts();
  }

  function renderActiveFilterChips() {
    const chips = [];
    if (state.filters.series !== "all") {
      const meta = findSeries(state.filters.series);
      chips.push({ type: "series", label: `系列 · ${meta ? meta.name : state.filters.series}` });
    }
    if (state.filters.rarity !== "all") {
      chips.push({ type: "rarity", label: `版本 · ${state.filters.rarity}` });
    }
    if (state.filters.favourite) chips.push({ type: "favourite", label: "我的珍藏" });
    if (state.query) chips.push({ type: "query", label: `搜索 · ${state.query}` });
    el.activeFilters.hidden = chips.length === 0;
    el.activeFilters.innerHTML = chips.map((chip) => `
      <span class="active-filter-chip">${escapeHTML(chip.label)}
        <button type="button" data-remove-filter="${chip.type}" aria-label="移除筛选 ${escapeHTML(chip.label)}">×</button>
      </span>`).join("");
  }

  function resetAllFilters() {
    state.filters.series = "all";
    state.filters.rarity = "all";
    state.filters.favourite = false;
    state.query = "";
    el.searchInput.value = "";
    updateFilterUI();
    renderCollection();
  }

  function toggleFavourite(id) {
    const item = state.items.find((candidate) => candidate.id === id);
    if (!item) return;
    if (state.favourites.has(id)) {
      state.favourites.delete(id);
      showToast(`已从珍藏中移出《${item.title}》`);
    } else {
      state.favourites.add(id);
      showToast(`已把《${item.title}》收入珍藏`);
    }
    saveFavourites();
    updateFavouriteUI(id);
  }

  function updateFavouriteUI(id) {
    const favourite = state.favourites.has(id);
    el.favCount.textContent = state.favourites.size;
    el.collectionGrid.querySelectorAll(`[data-fav-id="${cssEscape(id)}"]`).forEach((button) => {
      button.classList.toggle("is-active", favourite);
      button.setAttribute("aria-pressed", favourite ? "true" : "false");
      const item = state.items.find((candidate) => candidate.id === id);
      button.setAttribute("aria-label", `${favourite ? "取消珍藏" : "收入珍藏"}：${item ? item.title : ""}`);
    });
    if (state.viewer.open && state.viewer.item?.id === id) {
      el.viewerFav.setAttribute("aria-pressed", favourite ? "true" : "false");
      el.viewerFavLabel.textContent = favourite ? "已收入珍藏" : "收入珍藏";
    }
    if (state.filters.favourite) renderCollection();
  }

  function cssEscape(value) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  /* ══════════════════════════════════════════════════════════════════════
     tree controls & tooltip
     ══════════════════════════════════════════════════════════════════════ */

  function updateOrbitButton() {
    el.orbitToggle.classList.toggle("is-paused", state.treePaused);
    el.orbitToggle.setAttribute("aria-pressed", state.treePaused ? "true" : "false");
    el.orbitIcon.textContent = state.treePaused ? "▶" : "Ⅱ";
    const label = $(".dock-btn__label", el.orbitToggle);
    if (label) label.textContent = state.treePaused ? "继续环游" : "暂停环游";
  }

  function handleTreeHover(item, x, y) {
    if (!item) {
      el.photoTip.classList.remove("is-visible");
      return;
    }
    el.photoTipNo.textContent = `NO. ${item.no}`;
    el.photoTipName.textContent = item.title;
    el.photoTipSeries.textContent = item.series;
    el.photoTip.classList.add("is-visible");
    const width = el.photoTip.offsetWidth || 230;
    const height = el.photoTip.offsetHeight || 32;
    const left = Math.min(window.innerWidth - width - 14, Math.max(12, x + 18));
    const top = Math.min(window.innerHeight - height - 14, Math.max(12, y + 18));
    el.photoTip.style.left = `${left}px`;
    el.photoTip.style.top = `${top}px`;
  }

  /* ══════════════════════════════════════════════════════════════════════
     viewer
     ══════════════════════════════════════════════════════════════════════ */

  function openViewer(item, origin, preferredList) {
    if (!item) return;
    let list = Array.isArray(preferredList) && preferredList.length ? preferredList.slice() : state.filteredItems.slice();
    if (!list.length) list = state.items.slice();
    let index = list.findIndex((candidate) => candidate.id === item.id);
    if (index < 0) {
      list = state.items.slice();
      index = list.findIndex((candidate) => candidate.id === item.id);
    }
    if (index < 0) return;

    const viewer = state.viewer;
    viewer.open = true;
    viewer.list = list;
    viewer.index = index;
    viewer.lastFocus = document.activeElement;
    viewer.enteredAt = performance.now();
    viewer.zoom = 1;
    viewer.spinning = false;
    viewer.rotX = 0;
    viewer.rotY = -7;
    viewer.velX = 0;
    viewer.velY = 0;
    viewer.lastTime = performance.now();

    el.viewer.inert = false;
    el.viewer.removeAttribute("inert");
    el.viewer.classList.add("is-open");
    el.viewer.setAttribute("aria-hidden", "false");
    document.body.classList.add("viewer-open");
    state.tree?.setActive(false);

    renderViewerItem(index, { resetRotation: true });
    animateViewerEntry(origin);
    el.viewerSpin.setAttribute("aria-pressed", "false");
    el.viewerSpin.textContent = "自动旋赏";
    startViewerLoop();
    window.setTimeout(() => el.viewerClose.focus({ preventScroll: true }), 80);
    el.srLive.textContent = `正在欣赏 ${item.title}`;
  }

  function animateViewerEntry(origin) {
    const float = el.viewerFloat;
    float.style.transition = "none";
    float.style.transform = "none";
    float.style.opacity = "0";
    const card = el.artCard.getBoundingClientRect();
    const targetX = card.left + card.width / 2;
    const targetY = card.top + card.height / 2;
    const startX = origin && Number.isFinite(origin.x) ? origin.x : targetX;
    const startY = origin && Number.isFinite(origin.y) ? origin.y : targetY + 100;
    const startWidth = origin && origin.width ? origin.width : card.width * 0.4;
    const scale = Math.min(0.74, Math.max(0.22, startWidth / card.width));

    requestAnimationFrame(() => {
      float.style.transform = `translate3d(${startX - targetX}px, ${startY - targetY}px, 0) scale(${scale})`;
      float.style.opacity = "0.16";
      requestAnimationFrame(() => {
        float.style.transition = "transform 0.95s var(--ease), opacity 0.7s var(--ease)";
        float.style.transform = "translate3d(0, 0, 0) scale(1)";
        float.style.opacity = "1";
        window.setTimeout(() => {
          if (!state.viewer.open) return;
          float.style.transition = "";
          float.style.transform = `scale(${state.viewer.zoom})`;
        }, 1030);
      });
    });
  }

  function renderViewerItem(index, options = {}) {
    const viewer = state.viewer;
    const list = viewer.list;
    if (!list.length) return;
    const item = list[(index + list.length) % list.length];
    viewer.index = (index + list.length) % list.length;
    viewer.item = item;
    viewer.imageToken += 1;
    const token = viewer.imageToken;

    el.viewer.classList.add("is-switching");
    el.artCardMat.classList.remove("loaded");
    el.viewerImage.classList.remove("is-loaded");

    setViewerText(item);
    setViewerImage(item, token);

    el.viewerIndex.textContent = String(viewer.index + 1).padStart(3, "0");
    el.viewerTotal.textContent = String(list.length).padStart(3, "0");
    el.viewerProgressBar.style.width = `${((viewer.index + 1) / list.length) * 100}%`;
    el.viewerNo.textContent = `PLATE ${item.no}`;
    el.viewerPlateNo.textContent = item.no;
    el.viewerBackNo.textContent = `NO. ${item.no}`;
    el.viewerPrev.disabled = list.length < 2;
    el.viewerNext.disabled = list.length < 2;
    el.viewerFav.setAttribute("aria-pressed", state.favourites.has(item.id) ? "true" : "false");
    el.viewerFavLabel.textContent = state.favourites.has(item.id) ? "已收入珍藏" : "收入珍藏";
    el.viewerInfo.scrollTop = 0;

    if (options.resetRotation) {
      viewer.rotX = 0;
      viewer.rotY = -7;
      viewer.velX = 0;
      viewer.velY = 0;
      applyViewerRotation(false);
    } else {
      viewer.rotX = 0;
      viewer.rotY = -5;
      viewer.velX = 0;
      viewer.velY = 0;
      applyViewerRotation(true);
    }
    el.viewerZoomLabel.textContent = "100%";
    window.setTimeout(() => el.viewer.classList.remove("is-switching"), 260);
    window.setTimeout(() => {
      if (token === viewer.imageToken) el.viewer.classList.remove("is-switching");
    }, 500);
  }

  function setViewerText(item) {
    const meta = findSeries(item.seriesKey) || {};
    el.viewerTitle.textContent = item.title;
    el.viewerTitleEn.textContent = item.titleEn || "";
    el.viewerSeries.textContent = `${item.series}${item.sample ? " · SAMPLE" : ""}`;
    el.viewerRarity.textContent = item.rarity;
    el.viewerStory.textContent = item.story || meta.intro || "";
    el.viewerCollection.textContent = `${item.collection || meta.collection || ""}${item.collectionEn ? ` · ${item.collectionEn}` : ""}`;
    el.viewerId.textContent = item.id;
    el.viewerDate.textContent = item.date;
    el.viewerConfidence.textContent = item.manual
      ? "手动归档"
      : item.confidence != null
        ? `${(Number(item.confidence) * 100).toFixed(1)}%`
        : "—";
    el.viewerSample.textContent = item.sample ? "SAMPLE PLATE · 示例占位样张" : "PRIVATE COLLECTION · 私人藏品";
    el.viewerNote.textContent = item.sample
      ? "这是为了让星树先亮起来而制作的样张；可在识藏室换成你的真实照片。"
      : "照片只保存在这台设备的浏览器里，不会上传到任何服务器。";
    if (meta.accent) el.viewer.style.setProperty("--viewer-accent", meta.accent);
  }

  function setViewerImage(item, token) {
    const thumb = item.thumb || item.src;
    const full = item.src || item.thumb;
    el.viewerBackdrop.style.backgroundImage = `url("${thumb}")`;
    el.viewerReflection.style.backgroundImage = `url("${thumb}")`;

    const thumbImage = new Image();
    thumbImage.onload = () => {
      if (token !== state.viewer.imageToken) return;
      el.viewerImage.src = thumbImage.src;
      el.viewerImage.alt = `${item.series} ${item.title}，藏品照片`;
      el.artCardMat.classList.add("loaded");
      el.viewerImage.classList.add("is-loaded");
      el.viewerSkeleton.hidden = true;
    };
    thumbImage.onerror = () => {
      if (token !== state.viewer.imageToken) return;
      el.viewerSkeleton.hidden = false;
    };
    thumbImage.src = thumb;
    el.viewerSkeleton.hidden = false;

    if (full !== thumb) {
      const fullImage = new Image();
      fullImage.onload = () => {
        if (token !== state.viewer.imageToken) return;
        el.viewerImage.src = fullImage.src;
        el.viewerImage.alt = `${item.series} ${item.title}，藏品照片`;
        el.viewerBackdrop.style.backgroundImage = `url("${fullImage.src}")`;
        el.viewerReflection.style.backgroundImage = `url("${fullImage.src}")`;
        el.artCardMat.classList.add("loaded");
        el.viewerImage.classList.add("is-loaded");
        el.viewerSkeleton.hidden = true;
      };
      fullImage.src = full;
    }
  }

  function applyViewerRotation(inertia) {
    const viewer = state.viewer;
    el.artRotor.style.transition = viewer.dragging ? "none" : inertia ? "" : "none";
    el.artRotor.style.transform = `rotateX(${viewer.rotX.toFixed(2)}deg) rotateY(${viewer.rotY.toFixed(2)}deg)`;
    const angle = ((viewer.rotY % 360) + 360) % 360;
    el.viewerAngle.textContent = `${Math.round(angle)}°`;
  }

  function startViewerLoop() {
    cancelAnimationFrame(state.viewer.raf);
    state.viewer.lastTime = performance.now();
    const tick = (now) => {
      const viewer = state.viewer;
      if (!viewer.open) return;
      const dt = Math.min(0.05, (now - viewer.lastTime) / 1000);
      viewer.lastTime = now;
      if (!viewer.dragging) {
        if (viewer.spinning) {
          viewer.rotY += dt * 30;
          viewer.rotX += (0 - viewer.rotX) * 0.035;
          applyViewerRotation(true);
        } else if (Math.abs(viewer.velY) > 0.02 || Math.abs(viewer.velX) > 0.02) {
          viewer.rotY += viewer.velY;
          viewer.rotX = clamp(viewer.rotX + viewer.velX, -24, 24);
          viewer.velY *= 0.955;
          viewer.velX *= 0.93;
          viewer.rotX += (0 - viewer.rotX) * 0.028;
          applyViewerRotation(true);
        }
      }
      viewer.raf = requestAnimationFrame(tick);
    };
    state.viewer.raf = requestAnimationFrame(tick);
  }

  function navigateViewer(direction) {
    const viewer = state.viewer;
    if (!viewer.open || viewer.list.length < 2) return;
    renderViewerItem(viewer.index + direction);
  }

  function setViewerZoom(value) {
    const viewer = state.viewer;
    viewer.zoom = clamp(value, 0.76, 1.46);
    const float = el.viewerFloat;
    float.style.transition = "transform 0.32s var(--ease)";
    float.style.transform = `scale(${viewer.zoom})`;
    el.viewerZoomLabel.textContent = `${Math.round(viewer.zoom * 100)}%`;
  }

  function toggleViewerSpin() {
    const viewer = state.viewer;
    viewer.spinning = !viewer.spinning;
    if (viewer.spinning) {
      viewer.velX = 0;
      viewer.velY = 0;
    }
    el.viewerSpin.setAttribute("aria-pressed", viewer.spinning ? "true" : "false");
    el.viewerSpin.textContent = viewer.spinning ? "停止旋赏" : "自动旋赏";
  }

  function closeViewer(options = {}) {
    const viewer = state.viewer;
    if (!viewer.open) return;
    const { restoreFocus = true } = options;
    viewer.open = false;
    viewer.spinning = false;
    cancelAnimationFrame(viewer.raf);
    el.viewer.classList.remove("is-open");
    el.viewer.setAttribute("aria-hidden", "true");
    el.viewer.inert = true;
    el.viewer.setAttribute("inert", "");
    document.body.classList.remove("viewer-open");
    el.viewerFloat.style.transition = "";
    el.viewerFloat.style.transform = "";
    el.viewerFloat.style.opacity = "";
    el.photoTip.classList.remove("is-visible");
    if (restoreFocus && viewer.lastFocus && document.contains(viewer.lastFocus)) {
      try { viewer.lastFocus.focus({ preventScroll: true }); } catch {}
    }
    if (state.route === "tree" && state.treeReady) state.tree.setActive(true);
  }

  function bindViewerEvents() {
    el.viewerClose.addEventListener("click", () => closeViewer());
    el.viewerPrev.addEventListener("click", () => navigateViewer(-1));
    el.viewerNext.addEventListener("click", () => navigateViewer(1));
    el.viewerSpin.addEventListener("click", toggleViewerSpin);
    el.viewerZoomIn.addEventListener("click", () => setViewerZoom(state.viewer.zoom + 0.1));
    el.viewerZoomOut.addEventListener("click", () => setViewerZoom(state.viewer.zoom - 0.1));
    el.viewerFav.addEventListener("click", () => {
      if (state.viewer.item) toggleFavourite(state.viewer.item.id);
    });

    // A deliberate close only: dragging the photograph can end over the
    // backdrop, and an accidental close would interrupt the 360° inspection.
    el.viewerStage.addEventListener("wheel", (event) => {
      if (!state.viewer.open) return;
      event.preventDefault();
      if (performance.now() - state.viewer.enteredAt < 650) return;
      setViewerZoom(state.viewer.zoom - Math.sign(event.deltaY) * 0.07);
    }, { passive: false });

    el.artRotor.addEventListener("pointerdown", (event) => {
      if (!state.viewer.open) return;
      state.viewer.dragging = true;
      state.viewer.startX = event.clientX;
      state.viewer.startY = event.clientY;
      state.viewer.startRotX = state.viewer.rotX;
      state.viewer.startRotY = state.viewer.rotY;
      state.viewer.lastMoveX = event.clientX;
      state.viewer.velX = 0;
      state.viewer.velY = 0;
      state.viewer.lastTime = performance.now();
      el.artRotor.classList.add("is-dragging");
      el.artRotor.style.transition = "none";
      try { el.artRotor.setPointerCapture(event.pointerId); } catch {}
      event.preventDefault();
    });

    el.artRotor.addEventListener("pointermove", (event) => {
      const viewer = state.viewer;
      if (!viewer.dragging) return;
      const dx = event.clientX - viewer.startX;
      const dy = event.clientY - viewer.startY;
      viewer.rotY = viewer.startRotY + dx * 0.43;
      viewer.rotX = clamp(viewer.startRotX - dy * 0.17, -24, 24);
      viewer.velY = (event.clientX - viewer.lastMoveX) * 0.026;
      viewer.velX = -dy * 0.0005;
      viewer.lastMoveX = event.clientX;
      const glare = $(".art-card__glare", el.artCard);
      if (glare) {
        const tilt = clamp((event.clientX - viewer.startX) / 260, -1, 1);
        glare.style.transform = `translateX(${tilt * 32}%)`;
      }
      applyViewerRotation(false);
    });

    const endCardDrag = (event) => {
      const viewer = state.viewer;
      if (!viewer.dragging) return;
      viewer.dragging = false;
      el.artRotor.classList.remove("is-dragging");
      try { el.artRotor.releasePointerCapture?.(event.pointerId); } catch {}
      applyViewerRotation(true);
    };
    el.artRotor.addEventListener("pointerup", endCardDrag);
    el.artRotor.addEventListener("pointercancel", endCardDrag);
    el.artRotor.addEventListener("pointerleave", (event) => {
      if (state.viewer.dragging && event.buttons === 0) endCardDrag(event);
    });

  }

  function onGlobalKeydown(event) {
    // The curatorial view is a modal: its keys must work even after a pointer
    // interaction has moved focus out of the dialog.
    if (state.viewer.open) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeViewer();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateViewer(-1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateViewer(1);
        return;
      }
      if (event.key === "Tab") {
        const focusable = $$("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])", el.viewer)
          .filter((node) => !node.disabled && node.getClientRects().length && !node.hasAttribute("hidden"));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !el.viewer.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !el.viewer.contains(active))) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }

    const target = event.target;
    const isTyping = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
    if (isTyping) return;
    if (event.key === "/" && state.route === "collection") {
      event.preventDefault();
      el.searchInput.focus();
    }
    if (event.key === "Escape" && state.route === "collection" && (state.query || state.filters.series !== "all" || state.filters.rarity !== "all" || state.filters.favourite)) {
      resetAllFilters();
    }
    if (event.key === " " && state.route === "tree" && !el.treeFallback.hidden) {
      // leave the fallback buttons reachable; no interception needed
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     atelier · upload + local classification
     ══════════════════════════════════════════════════════════════════════ */

  function bindAtelierEvents() {
    el.browseBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      el.fileInput.click();
    });
    el.dropzone.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      el.fileInput.click();
    });
    el.dropzone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        el.fileInput.click();
      }
    });
    el.fileInput.addEventListener("change", () => {
      const files = Array.from(el.fileInput.files || []);
      el.fileInput.value = "";
      if (files.length) handleFiles(files);
    });

    let dragDepth = 0;
    el.dropzone.addEventListener("dragenter", (event) => {
      event.preventDefault();
      dragDepth += 1;
      el.dropzone.classList.add("is-dragover");
    });
    el.dropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    });
    el.dropzone.addEventListener("dragleave", (event) => {
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) el.dropzone.classList.remove("is-dragover");
    });
    el.dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      dragDepth = 0;
      el.dropzone.classList.remove("is-dragover");
      const files = Array.from(event.dataTransfer?.files || []);
      if (files.length) handleFiles(files);
    });
    window.addEventListener("dragover", (event) => event.preventDefault());
    window.addEventListener("drop", (event) => event.preventDefault());

    el.demoIdentifyBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (state.uploadBusy) return;
      el.demoIdentifyBtn.disabled = true;
      try {
        const picks = [state.demo[2], state.demo[84], state.demo[164]].filter(Boolean);
        const files = [];
        for (const item of picks) {
          const response = await fetch(item.thumb);
          if (!response.ok) continue;
          const blob = await response.blob();
          files.push(new File([blob], `${item.seriesKey}-sample.webp`, { type: blob.type || "image/webp" }));
        }
        if (files.length) {
          await handleFiles(files, { demo: true });
          showToast("已放入示例样张，可直接体验识别与入藏。");
        } else {
          showToast("示例样张暂时读不到，请直接选择你的照片。");
        }
      } catch (error) {
        console.warn(error);
        showToast("示例样张暂时读不到，请直接选择你的照片。");
      } finally {
        el.demoIdentifyBtn.disabled = false;
      }
    });

    el.clearResults.addEventListener("click", cancelPendingUpload);
    el.resultGrid.addEventListener("change", (event) => {
      const select = event.target.closest("[data-result-series]");
      if (!select) return;
      const index = Number(select.dataset.resultSeries);
      const result = state.pendingResults[index];
      if (!result) return;
      result.seriesKey = select.value;
      result.manual = true;
      result.confidence = 1;
      const card = select.closest(".result-card");
      const meta = findSeries(select.value) || SERIES.molly;
      const label = $(".result-card__series-label", card);
      const confidence = $(".result-card__confidence", card);
      const track = $(".result-card__confidence-track b", card);
      if (label) label.textContent = `${meta.name} · ${meta.cn}`;
      if (confidence) confidence.textContent = "手动确认";
      if (track) track.style.width = "100%";
    });

    el.confirmImport.addEventListener("click", confirmImport);
    el.clearCustomBtn.addEventListener("click", clearCustomMirror);
  }

  async function handleFiles(files, options = {}) {
    if (state.uploadBusy) {
      showToast("上一批照片还在整理，请稍等一下。");
      return;
    }
    const imageFiles = files.filter(isImageFile);
    if (!imageFiles.length) {
      showToast("没有找到可读取的图片文件。");
      return;
    }
    if (imageFiles.length > MAX_UPLOAD_BATCH) {
      showToast(`一次最多识藏 ${MAX_UPLOAD_BATCH} 张，先为你整理前 ${MAX_UPLOAD_BATCH} 张。`);
    }
    const batch = imageFiles.slice(0, MAX_UPLOAD_BATCH);
    state.uploadBusy = true;
    cancelPendingUpload({ silent: true });
    state.pendingResults = [];
    el.dropzone.hidden = true;
    el.identifyResults.hidden = true;
    el.scanPanel.hidden = false;
    el.scanGrid.innerHTML = "";
    el.scanProgressLabel.textContent = `0 / ${batch.length}`;
    el.scanBar.style.width = "0%";
    el.scanCaption.textContent = "正在读取轮廓、配色与系列特征…";
    el.confirmImport.disabled = true;

    const previewUrls = [];
    const thumbs = batch.map((file, index) => {
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
      return { file, url, index };
    });

    el.scanGrid.innerHTML = thumbs.map((entry) => `
      <div class="scan-thumb" data-scan-index="${entry.index}">
        <img src="${entry.url}" alt="">
      </div>`).join("");

    const results = [];
    let failed = 0;
    for (let i = 0; i < batch.length; i += 1) {
      const file = batch[i];
      const thumbEl = el.scanGrid.querySelector(`[data-scan-index="${i}"]`);
      thumbEl?.classList.add("is-scanning");
      el.scanCaption.textContent = `正在分析第 ${i + 1} 张照片…`;
      await wait(190);
      try {
        const result = await analyseUpload(file, previewUrls[i]);
        results.push(result);
      } catch (error) {
        failed += 1;
        console.warn("Could not read upload", file?.name, error);
      }
      thumbEl?.classList.remove("is-scanning");
      thumbEl?.classList.add("is-done");
      if (thumbEl && results.length) {
        const check = document.createElement("span");
        check.className = "scan-thumb__check";
        check.textContent = "✓";
        thumbEl.appendChild(check);
      }
      el.scanProgressLabel.textContent = `${i + 1} / ${batch.length}`;
      el.scanBar.style.width = `${((i + 1) / batch.length) * 100}%`;
      el.scanCaption.textContent = `已识读 ${i + 1} / ${batch.length} 张，正在生成馆藏档案…`;
    }

    for (const url of previewUrls) {
      // Keep only the previews represented by a result; the rest can go.
      if (!results.some((result) => result.previewUrl === url)) {
        try { URL.revokeObjectURL(url); } catch {}
      }
    }

    await wait(450);
    state.uploadBusy = false;
    el.scanPanel.hidden = true;

    if (!results.length) {
      resetAtelierUI();
      showToast(failed ? "这些照片暂时无法读取，请换 JPG 或 PNG 试试。" : "还没有识别结果。");
      return;
    }

    state.pendingResults = results;
    renderIdentifyResults();
    el.identifyResults.hidden = false;
    el.confirmImport.disabled = false;
    if (failed) showToast(`${results.length} 张照片已识别，${failed} 张无法读取。`);
  }

  async function analyseUpload(file, previewUrl) {
    const image = await loadImage(previewUrl);
    const features = analysePixels(image);
    features.extraSeed = file.size || 0;
    const match = classifyByName(file.name) || classifyByColour(features);
    const meta = match.meta;
    const thumbBlob = await resizeToBlob(image, 320, 400, 0.82);
    const fullBlob = await resizeToBlob(image, 1400, 1750, 0.88);
    if (!thumbBlob || !fullBlob) throw new Error("Could not encode image");
    const title = makeTitle(file.name, meta, features);
    return {
      file,
      previewUrl,
      thumbBlob,
      fullBlob,
      seriesKey: meta.key,
      manual: false,
      confidence: match.confidence,
      title,
      width: image.naturalWidth,
      height: image.naturalHeight,
      createdAt: Date.now(),
      demo: false,
    };
  }

  function isImageFile(file) {
    if (!file) return false;
    if (file.type && file.type.startsWith("image/")) return true;
    return /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name || "");
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Image decode failed"));
      image.src = url;
    });
  }

  function analysePixels(image) {
    const size = 56;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    // Read the central area where the figure usually is, avoiding too much
    // background colour in the final classification.
    const sw = image.naturalWidth * 0.74;
    const sh = image.naturalHeight * 0.78;
    const sx = (image.naturalWidth - sw) / 2;
    const sy = (image.naturalHeight - sh) / 2;
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, size, size);
    let data;
    try {
      data = ctx.getImageData(0, 0, size, size).data;
    } catch {
      return { hue: 0, saturation: 0, lightness: 0.5 };
    }
    const bins = new Array(36).fill(0);
    let totalWeight = 0;
    let sumS = 0;
    let sumL = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      const d = max - min;
      const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      if (l < 0.06 || l > 0.96 || s < 0.08) continue;
      let h = 0;
      if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
      }
      const weight = s * (1 - Math.abs(l - 0.46) * 0.9);
      if (weight <= 0) continue;
      bins[Math.floor(h / 10) % 36] += weight;
      totalWeight += weight;
      sumS += s * weight;
      sumL += l * weight;
    }
    if (totalWeight < 0.6) {
      return { hue: 0, saturation: 0, lightness: 0.5 };
    }
    let peak = 0;
    for (let i = 1; i < bins.length; i += 1) if (bins[i] > bins[peak]) peak = i;
    // Circular weighted mean around the densest hue region.
    let x = 0;
    let y = 0;
    for (let i = 0; i < bins.length; i += 1) {
      const dist = Math.min(Math.abs(i - peak), 36 - Math.abs(i - peak));
      if (dist > 3) continue;
      const angle = (i * 10 + 5) * Math.PI / 180;
      x += Math.cos(angle) * bins[i];
      y += Math.sin(angle) * bins[i];
    }
    let hue = Math.atan2(y, x) * 180 / Math.PI;
    if (hue < 0) hue += 360;
    return { hue, saturation: sumS / totalWeight, lightness: sumL / totalWeight };
  }

  function classifyByName(filename) {
    const normalized = String(filename || "").toLowerCase().replace(/[-_\s.]/g, "");
    if (!normalized) return null;
    for (const key of SERIES_ORDER) {
      const meta = SERIES[key];
      if (meta.keywords.some((keyword) => normalized.includes(keyword.toLowerCase().replace(/[-_\s.]/g, "")))) {
        return { meta, confidence: 0.982, fromName: true };
      }
    }
    return null;
  }

  function classifyByColour(features) {
    let best = SERIES_ORDER[0];
    let bestScore = -1;
    for (const key of SERIES_ORDER) {
      const meta = SERIES[key];
      const distance = hueDistance(features.hue, meta.hue);
      const closeness = 1 - distance / 180;
      const score = closeness * (0.65 + features.saturation * 0.35);
      if (score > bestScore) {
        bestScore = score;
        best = key;
      }
    }
    const confidence = clamp(0.49 + bestScore * 0.35, 0.49, 0.86);
    return { meta: SERIES[best], confidence, fromName: false };
  }

  function hueDistance(a, b) {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
  }

  function makeTitle(filename, meta, features) {
    const cleaned = String(filename || "")
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const compactName = cleaned.replace(/\s/g, "").toLowerCase();
    const namedSeries = SERIES_ORDER.some((key) => compactName.includes(key));
    const generic =
      !cleaned ||
      namedSeries ||
      /^[a-z0-9 ]+$/i.test(cleaned) ||
      /^(img|image|dsc|photo|微信图片|wechat|screenshot|截屏|pxl|mmexport|wx_camera)/i.test(compactName);
    const pool = [
      "初雪来客", "冬夜来信", "星枝新藏", "松间拾光", "月下偶遇",
      "雪落有声", "铃铛私语", "暖灯小住", "圣诞前夜", "银河邮差",
      "冬青愿望", "微光旅人", "白昼星屑", "炉火微光", "极夜回声",
    ];
    const seed = (cleaned + meta.key + Math.round(features.hue) + Math.round(features.saturation * 100) + (features.extraSeed || 0))
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    if (!generic && cleaned.length <= 18 && cleaned.length >= 2) {
      return cleaned;
    }
    return pool[Math.abs(seed) % pool.length];
  }

  function resizeToBlob(image, maxWidth, maxHeight, quality) {
    const ratio = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, width, height);
    return new Promise((resolve) => {
      try {
        canvas.toBlob((blob) => resolve(blob), "image/webp", quality);
      } catch {
        resolve(null);
      }
    });
  }

  function renderIdentifyResults() {
    el.resultGrid.innerHTML = state.pendingResults.map((result, index) => {
      const meta = findSeries(result.seriesKey) || SERIES.molly;
      return `
        <article class="result-card" style="animation-delay:${index * 45}ms">
          <div class="result-card__image"><img src="${result.previewUrl}" alt="待入藏照片 ${index + 1}"></div>
          <div class="result-card__body">
            <div class="result-card__topline">
              <span class="result-card__series-label">${escapeHTML(meta.name)} · ${escapeHTML(meta.cn)}</span>
              <span class="result-card__confidence">${result.manual ? "手动确认" : `AI ${Math.round(result.confidence * 100)}%`}</span>
            </div>
            <p class="result-card__title">${escapeHTML(result.title)}</p>
            <div class="result-card__select-wrap">
              <span>归入系列</span>
              <select data-result-series="${index}" aria-label="为第 ${index + 1} 张照片选择系列">
                ${SERIES_ORDER.map((key) => `<option value="${key}"${key === result.seriesKey ? " selected" : ""}>${SERIES[key].name} · ${SERIES[key].cn}</option>`).join("")}
              </select>
              <svg class="result-card__chevron" viewBox="0 0 12 8" aria-hidden="true"><path d="m1 1.5 5 5 5-5"/></svg>
            </div>
            <div class="result-card__confidence-track"><b style="width:${Math.round(result.confidence * 100)}%"></b></div>
          </div>
        </article>`;
    }).join("");
    el.importCount.textContent = String(state.pendingResults.length);
  }

  async function confirmImport() {
    if (!state.pendingResults.length || el.confirmImport.disabled) return;
    el.confirmImport.disabled = true;
    const originalLabel = el.confirmImport.querySelector("span")?.textContent;
    const labelNode = el.confirmImport.querySelector("span");
    if (labelNode) labelNode.textContent = "正在入藏";
    const today = formatDate();
    let inserted = 0;

    for (const [index, result] of state.pendingResults.entries()) {
      const meta = findSeries(result.seriesKey) || SERIES.molly;
      state.customSequence += 1;
      const id = `MY-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 6)}`;
      const no = `C${String(state.customSequence).padStart(3, "0")}`;
      const addedAt = Date.now() + index;
      const item = {
        id,
        no,
        seriesKey: meta.key,
        series: meta.name,
        seriesCn: meta.cn,
        collection: meta.collection,
        collectionEn: meta.collectionEn,
        character: meta.name,
        title: result.title,
        titleEn: "NEW ACQUISITION",
        story: `${meta.intro} 它刚刚从你的相册，来到圣诞星树下。`,
        rarity: "新入藏",
        date: today,
        accent: meta.accent,
        confidence: result.confidence,
        manual: result.manual,
        sample: false,
        thumb: "",
        src: "",
        addedAt,
      };
      const record = {
        id,
        no,
        seriesKey: meta.key,
        title: item.title,
        story: item.story,
        rarity: item.rarity,
        date: item.date,
        confidence: result.confidence,
        manual: result.manual,
        addedAt,
        thumbBlob: result.thumbBlob,
        fullBlob: result.fullBlob,
        width: result.width,
        height: result.height,
      };
      try {
        await writeRecord(record);
        const thumbUrl = URL.createObjectURL(result.thumbBlob);
        const fullUrl = URL.createObjectURL(result.fullBlob);
        state.objectUrls.add(thumbUrl);
        state.objectUrls.add(fullUrl);
        item.thumb = thumbUrl;
        item.src = fullUrl;
        state.customItems.unshift(item);
        inserted += 1;
      } catch (error) {
        console.warn("Could not persist plate:", error);
      }
    }

    if (!inserted) {
      el.confirmImport.disabled = false;
      if (labelNode) labelNode.textContent = originalLabel || "确认入藏";
      showToast("本地存储暂时不可用，照片没有入藏。");
      return;
    }

    resetAtelierUI({ keepCustom: true });
    refreshDataViews();
    state.treeDirty = true;
    navigate("collection");
    el.collectionView.scrollTop = 0;
    showToast(`已入藏 ${inserted} 件新藏品，星树将在下次进入时重新点亮。`);
    el.confirmImport.disabled = false;
    if (labelNode) labelNode.textContent = "确认入藏";
  }

  function cancelPendingUpload(options = {}) {
    const { silent = false } = options;
    for (const result of state.pendingResults) {
      if (result.previewUrl) {
        try { URL.revokeObjectURL(result.previewUrl); } catch {}
      }
    }
    state.pendingResults = [];
    state.uploadBusy = false;
    el.identifyResults.hidden = true;
    el.scanPanel.hidden = true;
    el.dropzone.hidden = false;
    el.scanGrid.innerHTML = "";
    el.resultGrid.innerHTML = "";
    el.confirmImport.disabled = true;
    el.importCount.textContent = "0";
    if (!silent) showToast("已取消这批照片。");
  }

  function resetAtelierUI(options = {}) {
    const { keepCustom = false } = options;
    for (const result of state.pendingResults) {
      if (result.previewUrl) {
        try { URL.revokeObjectURL(result.previewUrl); } catch {}
      }
    }
    state.pendingResults = [];
    state.uploadBusy = false;
    el.identifyResults.hidden = true;
    el.scanPanel.hidden = true;
    el.dropzone.hidden = false;
    el.scanGrid.innerHTML = "";
    el.resultGrid.innerHTML = "";
    el.confirmImport.disabled = true;
    el.importCount.textContent = "0";
    el.scanBar.style.width = "0%";
    el.scanProgressLabel.textContent = "0 / 0";
    if (!keepCustom) el.scanCaption.textContent = "正在读取轮廓、配色与系列特征…";
  }

  function renderAtelierLog() {
    const custom = state.customItems;
    el.customPhotoCount.textContent = `${custom.length} 张本地照片`;
    el.atelierLogEmpty.hidden = custom.length > 0;
    el.atelierLogStrip.hidden = custom.length === 0;
    el.clearCustomBtn.hidden = custom.length === 0;
    el.atelierLogStrip.innerHTML = custom.slice(0, 18).map((item) => `
      <div class="log-thumb" title="${escapeHTML(item.title)} · ${escapeHTML(item.series)}">
        <img src="${escapeHTML(item.thumb)}" alt="${escapeHTML(item.title)}" loading="lazy">
        <span>${escapeHTML(item.no)}</span>
      </div>`).join("");
  }

  async function clearCustomMirror() {
    if (!state.customItems.length) return;
    const confirmed = window.confirm("清空你导入的所有本地照片与识藏记录？这不会影响内置示例样张。");
    if (!confirmed) return;
    try {
      await clearAllRecords();
    } catch (error) {
      console.warn(error);
      showToast("本地照片清空失败，请稍后重试。");
      return;
    }
    for (const item of state.customItems) {
      for (const url of [item.thumb, item.src]) {
        if (url && state.objectUrls.has(url)) {
          try { URL.revokeObjectURL(url); } catch {}
          state.objectUrls.delete(url);
        }
      }
      state.favourites.delete(item.id);
    }
    state.customItems = [];
    state.customSequence = 0;
    saveFavourites();
    refreshDataViews();
    state.treeDirty = true;
    showToast("已清空你导入的本地照片。");
  }

  /* ══════════════════════════════════════════════════════════════════════
     toasts
     ══════════════════════════════════════════════════════════════════════ */

  function showToast(message) {
    if (!message) return;
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    el.toastStack.appendChild(node);
    while (el.toastStack.children.length > 3) el.toastStack.firstElementChild.remove();
    window.setTimeout(() => {
      node.classList.add("is-out");
      window.setTimeout(() => node.remove(), 400);
    }, 3300);
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  // A small escape hatch for browser automation, diagnostics and future tweaks.
  window.STELLAR_APP = {
    state,
    navigate,
    openViewer,
    closeViewer,
    refresh: refreshDataViews,
    get elements() { return el; },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
