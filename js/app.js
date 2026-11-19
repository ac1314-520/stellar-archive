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
  const BASE_SERIES = window.STELLAR_SERIES;
  const BASE_SERIES_ORDER = window.STELLAR_SERIES_ORDER;
  const SERIES = Object.assign({}, BASE_SERIES);
  let SERIES_ORDER = BASE_SERIES_ORDER.slice();
  const findSeries = (key) => SERIES[key] || null;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const DB_NAME = "stellar-archive-v1";
  const DB_STORE = "plates";
  const FAV_KEY = "stellar-archive:favourites:v1";
  const AI_CONFIG_KEY = "stellar-archive:ai-config:v1";
  const AI_SESSION_KEY = "stellar-archive:ai-session:v1";
  const CUSTOM_SERIES_KEY = "stellar-archive:custom-series:v1";
  const MAX_UPLOAD_BATCH = 30;
  const OTHER_SERIES_KEY = "other";
  const COLOUR_FAMILIES = [
    { key: "rose", name: "ROSE TONES", cn: "柔粉收藏", hue: 348, accent: "#e8b1bd", accentDim: "#98727b", collection: "色彩归档", collectionEn: "CHROMA", intro: "用一层柔粉，把还没归属的喜欢先收好。" },
    { key: "gold", name: "GOLD TONES", cn: "暖金收藏", hue: 42, accent: "#dfbf8b", accentDim: "#957b55", collection: "色彩归档", collectionEn: "CHROMA", intro: "像一小片暖光，落在尚未命名的藏品上。" },
    { key: "moss", name: "MOSS TONES", cn: "苔绿收藏", hue: 92, accent: "#bdca9d", accentDim: "#7d875f", collection: "色彩归档", collectionEn: "CHROMA", intro: "把森林的颜色，留给还没有归处的它。" },
    { key: "mist", name: "MIST TONES", cn: "雾蓝收藏", hue: 198, accent: "#aacddb", accentDim: "#6c8791", collection: "色彩归档", collectionEn: "CHROMA", intro: "雾一样的蓝，也值得拥有自己的位置。" },
    { key: "violet", name: "VIOLET TONES", cn: "夜紫收藏", hue: 266, accent: "#c6b2dc", accentDim: "#7f7194", collection: "色彩归档", collectionEn: "CHROMA", intro: "夜色里的一点紫，是最后一份未命名的礼物。" },
    { key: "berry", name: "BERRY TONES", cn: "莓紫收藏", hue: 315, accent: "#d6a7c9", accentDim: "#8d6a83", collection: "色彩归档", collectionEn: "CHROMA", intro: "酸甜的颜色，先替它留一个位置。" },
  ];
  const ACT_SIZE = 10;
  const ACT_TITLES = [
    "雪落之前",
    "松间来信",
    "金色回声",
    "月下漫游",
    "冬青愿望",
    "暖灯小聚",
    "星屑入梦",
    "长夜晚安",
    "白昼微光",
    "炉火旁",
    "雪松低语",
    "银色清晨",
    "槲寄生下",
    "初雪信箱",
    "星夜归人",
    "零点钟声",
    "新年将至",
    "冬青小径",
    "银河邮差",
    "极夜回声",
  ];

  function buildAiPrompt(context = {}) {
    const known = SERIES_ORDER.map((key) => {
      const meta = SERIES[key];
      return `${meta.name}／${meta.cn || meta.name}`;
    }).join("、");
    const localGuess = context.localLabel
      ? `本地引擎初步校准：${context.localLabel}。`
      : "本地引擎没有可用线索。";
    const filename = context.filename ? `上传文件名为：${context.filename}。` : "";
    return `你是泡泡玛特及潮玩藏品的视觉鉴定师。请仔细看这张照片，识别其中的角色、IP 与系列。
${localGuess}${filename}
请独立复核本地结果，必要时使用可用的联网搜索工具核对角色/IP 与系列；不要因为本地初判而迁就它。AI 复核结果优先于本地结果。

已知分类（英文／中文）：
${known}

规则：
1. 如果能确定是上面某个分类，series 必须填完全一致的英文分类名，new_series 为 false。
2. 如果确定是泡泡玛特 IP，但它不在上面列表，或者它根本不是泡泡玛特、而是其他品牌/潮玩，不要硬套已知系列。请为它提出一个可复用的新分类，new_series 为 true，并填写 series（全大写英文，尽量简洁，例如 SANRIO、DISNEY、OTHER ART TOYS）、series_cn（中文名）和 is_popmart（true/false）。
3. 新分类要能收纳同系列的其他照片，不要为单张照片造一个无法复用的名字。
4. 如果完全无法辨认角色，series 返回 "UNKNOWN"，new_series 为 false。

请只返回一个 JSON 对象，不要 Markdown、不要解释：
{
  "series": "已知分类名或新分类英文名或 UNKNOWN",
  "series_cn": "新分类中文名；已知分类可留空",
  "new_series": false,
  "is_popmart": true,
  "character": "角色/款式名，不确定可填空字符串",
  "title": "2 到 6 个中文字的圣诞或冬夜主题藏品名，不要照抄系列名",
  "confidence": 0.0 到 1.0 之间的数字,
  "reason": "一句话说明依据，20 字以内"
}`;
  }

  const AI_PRESETS = {
    local: {
      label: "本地轻量识别",
      base: "",
      model: "",
      hint: "按文件名、主色与画面特征归类，不联网。",
    },
    deepseek: {
      label: "DeepSeek · 视觉 + 联网",
      base: "https://api.deepseek.com",
      model: "deepseek-flash",
      hint: "DeepSeek V4.1 Flash 支持图像理解；识别时会自动开启 deepseek_web_search 联网核对。",
      webSearch: true,
    },
    doubao: {
      label: "豆包 Seed Vision",
      base: "https://ark.cn-beijing.volces.com/api/v3",
      model: "doubao-seed-2-0-lite-260215",
      hint: "火山方舟视觉模型。Base 固定用 /api/v3；模型填已开通的完整 Model ID，或 ep- 开头的 Endpoint ID。404 通常是模型未开通或 ID 不正确。",
    },
    siliconflow: {
      label: "硅基流动",
      base: "https://api.siliconflow.cn/v1",
      model: "Qwen/Qwen2.5-VL-32B-Instruct",
      hint: "OpenAI 兼容接口，可选择平台提供免费额度的视觉模型。",
    },
    openrouter: {
      label: "OpenRouter",
      base: "https://openrouter.ai/api/v1",
      model: "qwen/qwen2.5-vl-32b-instruct:free",
      hint: "OpenRouter 上有可用的免费视觉模型，具体可用性以模型列表为准。",
    },
    custom: {
      label: "自定义视觉 API",
      base: "",
      model: "",
      hint: "任何兼容 OpenAI Chat Completions 的视觉模型接口。",
    },
  };

  const state = {
    route: null,
    demo: [],
    customItems: [],
    items: [],
    filteredItems: [],
    acts: [],
    currentAct: 0,
    actItems: [],
    actsBuiltFor: "",
    orbit: {
      paused: false,
      angle: 0,
      offset: 0,
      targetOffset: 0,
      lastTime: 0,
      raf: 0,
      active: false,
      dragging: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      startOffset: 0,
      moved: false,
      suppressClick: false,
      layout: null,
      cards: [],
      changeToken: 0,
      prefetchedActs: new Set(),
    },
    ai: {
      provider: "local",
      base: "",
      model: "",
      key: "",
      remember: false,
      configured: false,
      verified: false,
      lastError: "",
      lastCallAt: 0,
      calls: 0,
    },
    customSeries: [],
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
    loadAiSettings();
    loadCustomSeries();

    state.demo = Array.isArray(window.STELLAR_DATA) ? window.STELLAR_DATA.slice() : [];

    try {
      await loadCustomRecords();
    } catch (error) {
      console.warn("Could not read local archive:", error);
    }

    refreshDataViews();
    createStarDust();
    if (window.StellarParticleTree && el.treeParticles) {
      state.particleTree = new window.StellarParticleTree(el.treeParticles);
      state.particleTree.setPaused(state.orbit.paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }
    updatePreloader(0, Math.max(1, state.actItems.length), "正在布置第一幕");

    const initialRoute = getInitialRoute();
    navigate(initialRoute, { push: false, initial: true });

    // A deep link into a room should not wait for the salon's photographs.
    if (initialRoute !== "tree") {
      window.setTimeout(() => hidePreloader(), 850);
    }

    window.setTimeout(() => {
      if (!state.preloaderHidden) {
        hidePreloader();
        showToast("照片还在布展，可以先逛藏品馆。");
      }
    }, 14000);

    startOrbitLoop();

    try {
      await Promise.all([
        preloadCurrentAct(),
        document.fonts?.ready || Promise.resolve(),
        wait(450),
      ]);
    } catch (error) {
      console.warn("First act preload:", error);
    }
    hidePreloader(true);
    state.orbit.active = state.route === "tree";
    state.particleTree?.setActive(state.route === "tree");
    updateOrbitLayout();
    if (!state.items.length) {
      showToast("还没有藏品。去识藏室放入第一张照片吧。");
    }
  }

  function cacheElements() {
    const ids = [
      "preloader", "loadBar", "loadPercent", "loadTotal", "loadStatus",
      "topbar", "navCount", "treeView", "treeStage", "photoOrbit", "treeRing",
      "treeSculpture", "treeShield", "treeParticles", "starDust",
      "heroCount", "heroSeriesCount", "photoTip", "photoTipNo", "photoTipName", "photoTipSeries",
      "actRailDots", "actRailCurrent", "actRailTotal", "actRailTitle",
      "actCounter", "actTitle", "mobileActCurrent", "mobileActTotal", "actAnnouncement",
      "collectionView", "collectionGrid", "emptyState", "emptyReset",
      "resultCount", "collectionCount", "collectionSeries", "collectionRare",
      "seriesFilters", "rarityFilters", "filterFavourite", "favCount",
      "activeFilters", "searchInput", "sortSelect", "resetFilters",
      "atelierView", "dropzone", "fileInput", "browseBtn", "demoIdentifyBtn",
      "scanPanel", "scanGrid", "scanBar", "scanProgressLabel", "scanCaption",
      "identifyResults", "resultGrid", "clearResults", "confirmImport", "importCount",
      "atelierLog", "atelierLogEmpty", "atelierLogStrip", "customPhotoCount", "clearCustomBtn",
      "atelierSeriesList", "openAiSettings", "aiStatusText",
      "aiDrawer", "aiDrawerVeil", "aiDrawerClose", "aiForm", "aiProvider", "aiFields",
      "aiKey", "aiKeyToggle", "aiBase", "aiModel", "aiRemember", "aiProviderLinks",
      "aiSave", "aiTest", "aiDisable", "aiFormStatus",
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
    el.aiDrawer.inert = true;
    el.aiDrawer.setAttribute("inert", "");
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

    document.addEventListener("click", (event) => {
      const orbitAction = event.target.closest("[data-orbit-action]");
      if (orbitAction) {
        if (orbitAction.dataset.orbitAction === "toggle") toggleOrbit();
        return;
      }
      const actAction = event.target.closest("[data-act-action]");
      if (actAction) {
        shiftAct(actAction.dataset.actAction === "prev" ? -1 : 1);
      }
    });

    bindOrbitEvents();
    bindAiDrawerEvents();

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

    window.addEventListener("resize", () => {
      updateOrbitLayout();
      updateOrbitUI();
      state.particleTree?.resize();
    });
    window.addEventListener("orientationchange", () => {
      window.setTimeout(updateOrbitLayout, 250);
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
      state.orbit.active = true;
      state.particleTree?.setPaused(state.orbit.paused);
      state.particleTree?.setActive(true);
      window.requestAnimationFrame(() => {
        updateOrbitLayout();
        updateOrbitFrame(performance.now());
      });
    } else {
      state.orbit.active = false;
      state.particleTree?.setActive(false);
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
    if (el.loadStatus) el.loadStatus.textContent = "第一幕布展完成";
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
     the salon · eight acts, a crisp photograph orbit
     ══════════════════════════════════════════════════════════════════════ */

  function createStarDust() {
    if (!el.starDust) return;
    const count = window.matchMedia("(max-width: 760px)").matches ? 18 : 34;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
      const speck = document.createElement("i");
      const size = Math.random() < 0.2 ? 3 : 1 + Math.random() * 1.6;
      speck.style.left = `${Math.random() * 100}%`;
      speck.style.top = `${30 + Math.random() * 64}%`;
      speck.style.width = `${size}px`;
      speck.style.height = `${size}px`;
      speck.style.setProperty("--dust-duration", `${11 + Math.random() * 17}s`);
      speck.style.setProperty("--dust-delay", `${-Math.random() * 24}s`);
      speck.style.setProperty("--dust-opacity", `${0.12 + Math.random() * 0.3}`);
      speck.style.setProperty("--dust-x", `${(Math.random() - 0.5) * 70}px`);
      fragment.appendChild(speck);
    }
    el.starDust.replaceChildren(fragment);
  }

  function buildActs() {
    const ordered = shuffle(state.items.slice());
    const acts = [];
    for (let i = 0; i < ordered.length; i += ACT_SIZE) {
      acts.push({
        title: ACT_TITLES[acts.length] || `第 ${acts.length + 1} 幕`,
        items: ordered.slice(i, i + ACT_SIZE),
      });
    }
    state.acts = acts;
    state.currentAct = clamp(state.currentAct, 0, Math.max(0, acts.length - 1));
    state.actItems = acts[state.currentAct]?.items || [];
    state.actsBuiltFor = state.items.map((item) => item.id).join("|");
  }

  function ensureOrbitCards() {
    if (state.orbit.cards.length && el.photoOrbit.children.length === state.orbit.cards.length) {
      return;
    }
    const fragment = document.createDocumentFragment();
    const cards = [];
    for (let i = 0; i < ACT_SIZE; i += 1) {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "orbit-card";
      slot.dataset.slot = String(i);
      slot.style.opacity = "0";
      slot.innerHTML = `
        <span class="orbit-card__inner">
          <span class="orbit-card__media">
            <img alt="" draggable="false" decoding="async">
            <span class="orbit-card__number"></span>
            <span class="orbit-card__caption">
              <span class="orbit-card__series"></span>
              <span class="orbit-card__title"></span>
            </span>
          </span>
        </span>`;
      fragment.appendChild(slot);
      cards.push({
        el: slot,
        img: $("img", slot),
        number: $(".orbit-card__number", slot),
        series: $(".orbit-card__series", slot),
        title: $(".orbit-card__title", slot),
        baseT: i / ACT_SIZE + (Math.random() - 0.5) * 0.014,
        phase: Math.random() * Math.PI * 2,
        item: null,
      });
    }
    el.photoOrbit.replaceChildren(fragment);
    state.orbit.cards = cards;
  }

  function updateActChrome() {
    const total = Math.max(1, state.acts.length);
    const actNumber = String(state.currentAct + 1).padStart(2, "0");
    const totalNumber = String(total).padStart(2, "0");
    const title = state.acts[state.currentAct]?.title || "雪落之前";
    if (el.actRailCurrent) el.actRailCurrent.textContent = actNumber;
    if (el.actRailTotal) el.actRailTotal.textContent = totalNumber;
    if (el.actRailTitle) el.actRailTitle.textContent = title;
    if (el.actCounter) el.actCounter.textContent = actNumber;
    if (el.actTitle) el.actTitle.textContent = title;
    if (el.mobileActCurrent) el.mobileActCurrent.textContent = actNumber;
    if (el.mobileActTotal) el.mobileActTotal.textContent = totalNumber;
    const dockTotal = $("#actDockTotal");
    if (dockTotal) dockTotal.textContent = `/ ${totalNumber} 幕`;
    if (el.actRailDots) {
      const dots = state.acts.map((act, index) => `
        <button class="act-rail__dot${index === state.currentAct ? " is-active" : ""}" type="button" data-act-index="${index}" aria-label="查看第 ${index + 1} 幕：${escapeHTML(act.title)}" aria-pressed="${index === state.currentAct}"></button>
      `).join("");
      el.actRailDots.innerHTML = dots;
    }
    if (el.actAnnouncement) {
      el.actAnnouncement.textContent = `第 ${state.currentAct + 1} 幕，${title}，${state.actItems.length} 件藏品`;
    }
  }

  function applyActImages() {
    ensureOrbitCards();
    const act = state.acts[state.currentAct];
    state.actItems = act?.items || [];
    state.orbit.cards.forEach((card, index) => {
      const item = state.actItems[index];
      if (!item) {
        card.item = null;
        card.el.hidden = true;
        card.el.dataset.id = "";
        return;
      }
      card.el.hidden = false;
      card.item = item;
      card.el.dataset.id = item.id;
      card.el.setAttribute("aria-label", `欣赏 ${item.series} ${item.title}`);
      const heroSrc = heroImageFor(item);
      card.img.onerror = () => {
        card.img.onerror = null;
        if (heroSrc !== item.src) card.img.src = item.src;
      };
      card.img.src = heroSrc;
      card.img.alt = `${item.series} ${item.title}`;
      card.number.textContent = item.no;
      card.series.textContent = item.series;
      card.title.textContent = item.title;
    });
    updateActChrome();
  }

  function preloadActImages(items = state.actItems, onProgress) {
    return new Promise((resolve) => {
      if (!items.length) {
        onProgress?.(0, 0);
        resolve();
        return;
      }
      let done = 0;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const timer = window.setTimeout(finish, 12000);
      items.forEach((item) => {
        const image = new Image();
        const mark = () => {
          done += 1;
          onProgress?.(done, items.length);
          if (done >= items.length) {
            window.clearTimeout(timer);
            finish();
          }
        };
        image.onload = mark;
        image.onerror = () => {
          if (heroImageFor(item) !== item.src && image.src !== item.src) {
            image.onload = mark;
            image.onerror = mark;
            image.src = item.src;
            return;
          }
          mark();
        };
        image.src = heroImageFor(item);
      });
    });
  }

  async function preloadCurrentAct() {
    const total = state.actItems.length;
    if (!total) return;
    updatePreloader(0, total, "正在布置第一幕");
    await preloadActImages(state.actItems, (loaded, count) => {
      updatePreloader(loaded, count, loaded >= count ? "第一幕布展完成" : "正在挂上藏品");
    });
  }

  function heroImageFor(item) {
    if (!item) return "";
    if (item.sample && /^\d{3}$/.test(item.no)) {
      return `assets/photos/card/${item.no}.webp`;
    }
    return item.src;
  }

  function gridImageFor(item) {
    if (!item) return "";
    if (item.sample && /^\d{3}$/.test(item.no)) {
      return `assets/photos/card/${item.no}.webp`;
    }
    return item.thumb || item.src || "";
  }

  async function renderAct(index, options = {}) {
    if (!state.acts.length) return;
    const target = ((index % state.acts.length) + state.acts.length) % state.acts.length;
    if (target === state.currentAct && options.initial) {
      applyActImages();
      return;
    }
    if (state.orbit.transitioning) return;
    state.orbit.transitioning = true;
    state.orbit.changeToken += 1;
    const token = state.orbit.changeToken;
    el.photoOrbit.classList.add("is-changing");
    const previous = state.currentAct;
    state.currentAct = target;
    const items = state.acts[target]?.items || [];
    let progress = 0;
    try {
      await preloadActImages(items, (loaded, total) => {
        progress = total ? loaded / total : 1;
        if (loaded === total) updateActChrome();
      });
    } catch {}
    if (token !== state.orbit.changeToken) return;
    if (!options.keepState) applyActImages();
    else state.actItems = items;
    if (progress < 1) updateActChrome();
    // Let the new images settle for a frame before fading the orbit back in.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    el.photoOrbit.classList.remove("is-changing");
    state.orbit.transitioning = false;
    updateActChrome();
    if (previous !== state.currentAct) {
      el.srLive.textContent = `第 ${state.currentAct + 1} 幕，${state.acts[state.currentAct].title}`;
    }
  }

  function shiftAct(direction) {
    if (!state.acts.length || state.orbit.transitioning) return;
    renderAct(state.currentAct + direction);
  }

  function toggleOrbit() {
    state.orbit.paused = !state.orbit.paused;
    updateOrbitUI();
  }

  function updateOrbitUI() {
    const paused = state.orbit.paused;
    $$("[data-orbit-label]").forEach((label) => {
      label.textContent = paused ? "继续环游" : "暂停环游";
    });
    $$("[data-orbit-icon]").forEach((icon) => {
      icon.textContent = paused ? "▶" : "Ⅱ";
    });
    $$("[data-orbit-action='toggle']").forEach((button) => {
      button.setAttribute("aria-pressed", paused ? "true" : "false");
      const mobileLabel = $("[data-orbit-label]", button);
      if (mobileLabel && window.matchMedia("(max-width: 760px)").matches) {
        mobileLabel.textContent = paused ? "继续" : "暂停";
      }
    });
    if (el.treeRing) el.treeRing.style.animationPlayState = paused ? "paused" : "running";
    state.particleTree?.setPaused(paused);
  }

  function updateOrbitLayout() {
    if (!el.treeStage || !el.treeSculpture) return;
    const stage = el.treeStage.getBoundingClientRect();
    const tree = el.treeSculpture.getBoundingClientRect();
    if (!stage.width || !tree.width) return;
    const mobile = stage.width <= 760;
    const cx = tree.left - stage.left + tree.width / 2;
    const pathTop = tree.top - stage.top + tree.height * 0.055;
    const pathHeight = tree.height * 0.89;
    const amplitude = mobile
      ? Math.min(tree.width * 0.56, stage.width * 0.3)
      : Math.min(tree.width * 0.52, stage.width * 0.24);
    state.orbit.layout = {
      cx,
      cy: pathTop + pathHeight / 2,
      pathTop,
      pathHeight,
      amplitude,
      width: stage.width,
      height: stage.height,
      treeW: tree.width,
      treeH: tree.height,
      mobile,
    };
    if (el.treeShield) {
      const shieldWidth = tree.width * 0.74;
      const shieldHeight = tree.height * 0.9;
      el.treeShield.style.left = `${tree.left - stage.left + (tree.width - shieldWidth) / 2}px`;
      el.treeShield.style.top = `${tree.top - stage.top + tree.height * 0.04}px`;
      el.treeShield.style.width = `${shieldWidth}px`;
      el.treeShield.style.height = `${shieldHeight}px`;
    }
    updateOrbitFrame(performance.now());
  }

  function updateOrbitFrame(now) {
    if (!state.orbit.layout || !state.orbit.cards.length) return;
    if (!state.orbit.active) return;
    const layout = state.orbit.layout;
    if (!state.orbit.lastTime) state.orbit.lastTime = now;
    const dt = Math.min(0.05, Math.max(0, (now - state.orbit.lastTime) / 1000));
    state.orbit.lastTime = now;
    if (!state.orbit.paused && !state.orbit.dragging) {
      // A slow, continuous ribbon. A whole S takes about 70 seconds.
      state.orbit.angle += dt * 0.014;
    }
    state.orbit.offset += (state.orbit.targetOffset - state.orbit.offset) * 0.075;
    const totalOffset = state.orbit.angle + state.orbit.offset;
    state.orbit.cards.forEach((card) => {
      if (card.el.hidden) return;
      let t = (card.baseT + totalOffset) % 1;
      if (t < 0) t += 1;
      // A serpentine over the tree: right at the crown, left through the
      // middle, right again, then left at the hem. Cards grow from small at
      // the top to large at the bottom as they travel the curve.
      const x = layout.cx + Math.cos(t * Math.PI * 2.5) * layout.amplitude;
      const y = layout.pathTop + t * layout.pathHeight;
      const scale = 0.58 + t * 0.58;
      const edgeFade = clamp(Math.min(t, 1 - t) / 0.055, 0, 1);
      const opacity = (0.56 + t * 0.44) * edgeFade;
      const tilt = Math.sin(t * Math.PI * 2.5 + 0.35) * 3.2;
      card.el.style.opacity = opacity.toFixed(3);
      card.el.style.pointerEvents = opacity < 0.18 ? "none" : "auto";
      card.el.style.zIndex = String(40 + Math.round(t * 120));
      card.el.style.transform = `translate3d(calc(${x.toFixed(2)}px - 50%), calc(${y.toFixed(2)}px - 50%), 0) scale(${scale.toFixed(3)}) rotate(${tilt.toFixed(2)}deg)`;
    });
  }

  function startOrbitLoop() {
    if (state.orbit.raf) return;
    const tick = (now) => {
      state.orbit.raf = requestAnimationFrame(tick);
      if (!state.orbit.active) return;
      if (document.hidden) return;
      updateOrbitFrame(now);
    };
    state.orbit.raf = requestAnimationFrame(tick);
  }

  function bindOrbitEvents() {
    const stage = el.treeStage;
    if (!stage) return;

    stage.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.target.closest("[data-orbit-ui]")) return;
      state.orbit.dragging = true;
      state.orbit.moved = false;
      state.orbit.pointerId = event.pointerId;
      state.orbit.startX = event.clientX;
      state.orbit.startY = event.clientY;
      state.orbit.startOffset = state.orbit.targetOffset;
      state.orbit.suppressClick = false;
      stage.classList.add("is-dragging");
    });

    stage.addEventListener("pointermove", (event) => {
      if (!state.orbit.dragging || event.pointerId !== state.orbit.pointerId) return;
      const dx = event.clientX - state.orbit.startX;
      const dy = event.clientY - state.orbit.startY;
      if (!state.orbit.moved && Math.abs(dx) + Math.abs(dy) > 6) {
        state.orbit.moved = true;
        try { stage.setPointerCapture(event.pointerId); } catch {}
      }
      if (!state.orbit.moved) return;
      event.preventDefault();
      state.orbit.targetOffset = state.orbit.startOffset + dx * 0.0018;
      state.orbit.suppressClick = true;
      updateOrbitFrame(performance.now());
    });

    const endDrag = (event) => {
      if (!state.orbit.dragging) return;
      state.orbit.dragging = false;
      state.orbit.pointerId = null;
      stage.classList.remove("is-dragging");
      try { stage.releasePointerCapture?.(event.pointerId); } catch {}
      if (state.orbit.moved) {
        window.setTimeout(() => {
          state.orbit.suppressClick = false;
        }, 120);
      }
    };
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);
    stage.addEventListener("pointerleave", (event) => {
      if (state.orbit.dragging && event.buttons === 0) endDrag(event);
    });

    el.photoOrbit.addEventListener("click", (event) => {
      if (state.orbit.suppressClick) {
        event.preventDefault();
        return;
      }
      const card = event.target.closest(".orbit-card");
      if (!card || !card.dataset.id) return;
      const item = state.actItems.find((candidate) => candidate.id === card.dataset.id);
      if (!item) return;
      const rect = card.getBoundingClientRect();
      hidePhotoTip();
      openViewer(item, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width }, state.actItems);
    });

    el.photoOrbit.addEventListener("pointerover", (event) => {
      if (event.pointerType === "touch") return;
      const card = event.target.closest(".orbit-card");
      if (card) showPhotoTipForCard(card, event.clientX, event.clientY);
    });
    el.photoOrbit.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      if (event.target.closest(".orbit-card")) {
        positionPhotoTip(event.clientX, event.clientY);
      }
    });
    el.photoOrbit.addEventListener("pointerout", (event) => {
      const card = event.target.closest(".orbit-card");
      if (!card) return;
      const next = event.relatedTarget?.closest?.(".orbit-card");
      if (next !== card) hidePhotoTip();
    });

    el.actRailDots?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-act-index]");
      if (!button) return;
      renderAct(Number(button.dataset.actIndex));
    });

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      state.orbit.paused = true;
    }
    updateOrbitUI();
  }

  function showPhotoTipForCard(card, x, y) {
    const item = state.actItems.find((candidate) => candidate.id === card.dataset.id);
    if (!item) return;
    el.photoTipNo.textContent = `NO. ${item.no}`;
    el.photoTipName.textContent = item.title;
    el.photoTipSeries.textContent = item.series;
    el.photoTip.classList.add("is-visible");
    positionPhotoTip(x, y);
  }

  function positionPhotoTip(x, y) {
    const width = el.photoTip.offsetWidth || 230;
    const height = el.photoTip.offsetHeight || 32;
    const left = Math.min(window.innerWidth - width - 14, Math.max(12, x + 18));
    const top = Math.min(window.innerHeight - height - 14, Math.max(12, y + 18));
    el.photoTip.style.left = `${left}px`;
    el.photoTip.style.top = `${top}px`;
  }

  function hidePhotoTip() {
    el.photoTip.classList.remove("is-visible");
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
    const meta = findSeries(record.seriesKey) || SERIES[OTHER_SERIES_KEY] || SERIES.molly;
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

  /* ══════════════════════════════════════════════════════════════════════
     series registry · built-in IPs + categories created by the archive
     ══════════════════════════════════════════════════════════════════════ */

  function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function flattenSeriesName(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9\u4e00-\u9fff]+/g, "");
  }

  function resolveSeriesName(value) {
    const raw = flattenSeriesName(value);
    if (!raw || raw === "UNKNOWN" || raw === "未知") return null;
    for (const key of SERIES_ORDER) {
      const meta = SERIES[key];
      const terms = [meta.key, meta.name, meta.cn, ...(meta.keywords || [])].map(flattenSeriesName).filter(Boolean);
      if (terms.includes(raw)) return meta;
    }
    // Accept a model's slightly decorated but still unambiguous name, such as
    // "LABUBU / THE MONSTERS". Never match the generic OTHER catch-all.
    const contained = SERIES_ORDER
      .map((key) => SERIES[key])
      .filter((meta) => meta.key !== OTHER_SERIES_KEY)
      .filter((meta) => {
        const flat = flattenSeriesName(meta.name);
        return flat.length >= 4 && raw.includes(flat);
      })
      .sort((a, b) => b.name.length - a.name.length);
    return contained[0] || null;
  }

  function shadeHex(hex, factor) {
    const clean = String(hex || "").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(clean)) return "#847768";
    const parts = [0, 2, 4].map((offset) => clamp(Math.round(parseInt(clean.slice(offset, offset + 2), 16) * factor), 0, 255));
    return `#${parts.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
  }

  function uniqueSeriesKey(name) {
    const base = String(name || "")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .toLowerCase();
    let root = base || `new${hashString(String(name)).toString(36)}`;
    let key = root;
    let index = 2;
    while (SERIES[key]) {
      key = `${root}${index}`;
      index += 1;
    }
    return key;
  }

  function makeCustomSeriesMeta(input = {}) {
    const displayName = String(input.name || input.series || "NEW SERIES").trim().slice(0, 32) || "NEW SERIES";
    const palette = ["#e8b1bd", "#dfbf8b", "#bdca9d", "#aacddb", "#c6b2dc", "#d6a7c9", "#d7b18f", "#9ec6bd", "#c8c2a5"];
    const hues = [348, 42, 92, 198, 266, 315, 34, 170, 80];
    const hash = hashString(displayName.toUpperCase()) % palette.length;
    const accent = /^#[0-9a-f]{6}$/i.test(String(input.accent || "")) ? input.accent : palette[hash];
    const key = uniqueSeriesKey(displayName);
    const cn = String(input.cn || input.seriesCn || input.series_cn || displayName).trim().slice(0, 20) || displayName;
    const collection = String(input.collection || "自由归档").trim().slice(0, 20) || "自由归档";
    const collectionEn = String(input.collectionEn || "FREE ARCHIVE").trim().slice(0, 28) || "FREE ARCHIVE";
    return {
      key,
      name: displayName.toUpperCase(),
      cn,
      collection,
      collectionEn,
      accent,
      accentDim: shadeHex(accent, 0.64),
      hue: Number.isFinite(Number(input.hue)) ? Number(input.hue) : hues[hash],
      keywords: Array.from(new Set([displayName, cn, displayName.toLowerCase()].filter(Boolean))),
      intro: String(input.intro || "由识藏室为还没有归处的藏品建立的分类。").slice(0, 90),
      custom: true,
      aiCreated: Boolean(input.aiCreated),
      isPopmart: input.isPopmart !== false,
      createdAt: input.createdAt || Date.now(),
    };
  }

  function persistCustomSeries() {
    try {
      window.localStorage.setItem(CUSTOM_SERIES_KEY, JSON.stringify(state.customSeries.map((meta) => ({
        key: meta.key,
        name: meta.name,
        cn: meta.cn,
        collection: meta.collection,
        collectionEn: meta.collectionEn,
        accent: meta.accent,
        hue: meta.hue,
        intro: meta.intro,
        isPopmart: meta.isPopmart,
        aiCreated: meta.aiCreated,
        createdAt: meta.createdAt,
      }))));
    } catch {
      showToast("浏览器没有允许保存新分类。");
    }
  }

  function loadCustomSeries() {
    let saved = [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(CUSTOM_SERIES_KEY) || "[]");
      if (Array.isArray(parsed)) saved = parsed;
    } catch {
      saved = [];
    }
    for (const record of saved) {
      if (!record || !record.name) continue;
      const existing = resolveSeriesName(record.name) || resolveSeriesName(record.cn);
      if (existing) continue;
      const meta = makeCustomSeriesMeta({
        ...record,
        name: record.name,
        cn: record.cn || record.name,
        aiCreated: record.aiCreated,
        isPopmart: record.isPopmart,
      });
      // Keep the stored key stable if it is free; otherwise uniqueSeriesKey has
      // already given us a safe alternative.
      if (record.key && !SERIES[record.key] && /^[a-z0-9-]+$/.test(record.key)) {
        meta.key = record.key;
      }
      SERIES[meta.key] = meta;
      SERIES_ORDER.push(meta.key);
      state.customSeries.push(meta);
    }
  }

  function refreshSeriesSurfaces() {
    renderFilters();
    renderAtelierSeriesList();
    updateCounts();
  }

  function createCustomSeries(input = {}) {
    const inputName = String(input.name || input.series || "").trim();
    if (!inputName) return null;
    const existing = resolveSeriesName(inputName) || resolveSeriesName(input.cn || input.series_cn);
    if (existing) return existing;
    const meta = makeCustomSeriesMeta({ ...input, name: inputName, aiCreated: Boolean(input.aiCreated) });
    SERIES[meta.key] = meta;
    SERIES_ORDER.push(meta.key);
    state.customSeries.push(meta);
    persistCustomSeries();
    refreshSeriesSurfaces();
    return meta;
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
    buildActs();
    ensureOrbitCards();
    applyActImages();
    updateCounts();
    renderFilters();
    renderAtelierSeriesList();
    renderCollection();
    renderAtelierLog();
    window.requestAnimationFrame(updateOrbitLayout);
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
    const rare = state.items.filter((item) => item.rarity === "隐藏款" || item.rarity === "限定款").length;
    el.navCount.textContent = total;
    el.heroCount.textContent = total;
    el.heroSeriesCount.textContent = SERIES_ORDER.length;
    el.collectionCount.textContent = total;
    el.collectionSeries.textContent = SERIES_ORDER.length;
    el.collectionRare.textContent = rare;
    el.resultCount.textContent = state.filteredItems.length;
    el.favCount.textContent = state.favourites.size;
    const seriesLabel = document.getElementById("seriesTotalLabel");
    if (seriesLabel) seriesLabel.textContent = `SERIES · ${SERIES_ORDER.length}`;
    const atelierSeriesTotal = document.getElementById("atelierSeriesTotal");
    if (atelierSeriesTotal) atelierSeriesTotal.textContent = `${SERIES_ORDER.length} SERIES`;
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
      const count = counts[key] || 0;
      seriesButtons.push(`
        <button class="filter-option${count ? "" : " filter-option--empty"}${meta.custom ? " filter-option--custom" : ""}" type="button" data-series-filter="${key}" style="--accent:${meta.accent}" aria-pressed="false" title="${count ? `${escapeHTML(meta.name)} · ${escapeHTML(meta.cn)}` : "还没有藏品；导入后会自动归入这个分类"}">
          <span class="filter-option__dot" aria-hidden="true"></span>
          <span class="filter-option__label">${escapeHTML(meta.name)}</span>
          <span class="filter-option__cn">${escapeHTML(meta.cn)}</span>
          <span class="filter-option__count">${count || "待"}</span>
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
      return `<span class="mini-series__item${meta.custom ? " is-custom" : ""}" style="--accent:${meta.accent}" title="${escapeHTML(meta.cn)}">
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
                <img src="${escapeHTML(gridImageFor(item))}" alt="${escapeHTML(item.series)} ${escapeHTML(item.title)}，${item.sample ? "示例藏品照片" : "私人藏品照片"}" loading="lazy" decoding="async" width="500" height="625">
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
    state.orbit.active = false;
    state.particleTree?.setActive(false);

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
    if (state.route === "tree") {
      state.orbit.active = true;
      state.orbit.lastTime = performance.now();
      state.particleTree?.setPaused(state.orbit.paused);
      state.particleTree?.setActive(true);
    }
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
  }

  /* ══════════════════════════════════════════════════════════════════════
     atelier · upload + local classification
     ══════════════════════════════════════════════════════════════════════ */

  /* ── AI settings drawer ─────────────────────────────────────────────── */

  function loadAiSettings() {
    let stored = null;
    try {
      stored = JSON.parse(window.localStorage.getItem(AI_CONFIG_KEY) || "null");
    } catch {}
    if (!stored) {
      try {
        stored = JSON.parse(window.sessionStorage.getItem(AI_SESSION_KEY) || "null");
      } catch {}
    }
    if (stored && typeof stored === "object") {
      const provider = AI_PRESETS[stored.provider] ? stored.provider : "local";
      state.ai = {
        provider,
        base: typeof stored.base === "string" ? stored.base : "",
        model: typeof stored.model === "string" ? stored.model : "",
        key: typeof stored.key === "string" ? stored.key : "",
        remember: Boolean(stored.remember),
        configured: provider !== "local" && Boolean(stored.key && (stored.model || stored.base)),
        verified: false,
        lastError: "",
        lastCallAt: 0,
        calls: 0,
      };
    }
    updateAiStatus();
  }

  function persistAiSettings() {
    const payload = {
      provider: state.ai.provider,
      base: state.ai.base,
      model: state.ai.model,
      key: state.ai.key,
      remember: state.ai.remember,
    };
    try {
      window.localStorage.removeItem(AI_CONFIG_KEY);
      window.sessionStorage.removeItem(AI_SESSION_KEY);
      if (state.ai.provider === "local" || !state.ai.key) return;
      const target = state.ai.remember ? window.localStorage : window.sessionStorage;
      target.setItem(state.ai.remember ? AI_CONFIG_KEY : AI_SESSION_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn("Could not persist AI config:", error);
    }
  }

  function updateAiStatus() {
    if (!el.aiStatusText) return;
    const configured = state.ai.configured;
    const failed = configured && Boolean(state.ai.lastError);
    const verified = configured && state.ai.verified && !failed;
    const label = configured ? AI_PRESETS[state.ai.provider]?.label || "AI" : "本地识别";
    el.aiStatusText.textContent = !configured
      ? "本地识别"
      : failed
        ? `${label} · 调用失败`
        : verified
          ? `${label} · 已验证`
          : `${label} · 已配置`;
    el.openAiSettings?.classList.toggle("is-on", verified);
    el.openAiSettings?.classList.toggle("is-pending", configured && !verified && !failed);
    el.openAiSettings?.classList.toggle("is-error", failed);
    if (el.openAiSettings) {
      el.openAiSettings.setAttribute(
        "aria-label",
        configured ? `${label}${verified ? "已验证" : failed ? "调用失败" : "已配置，尚未验证"}，打开设置` : "接入 AI 识别",
      );
      el.openAiSettings.title = state.ai.lastError || el.aiStatusText.textContent;
      const em = $("em", el.openAiSettings);
      if (em) em.textContent = configured ? "设置" : "接入 AI";
    }
  }

  function applyAiProviderPreset(provider, options = {}) {
    const preset = AI_PRESETS[provider] || AI_PRESETS.local;
    if (!options.keepValues) {
      el.aiBase.value = preset.base || "";
      el.aiModel.value = preset.model || "";
    }
    el.aiFields.classList.toggle("is-local", provider === "local");
    el.aiBase.placeholder = provider === "custom" ? "https://your-api.example.com/v1" : preset.base || "https://...";
    el.aiModel.placeholder = provider === "custom" ? "你的模型 ID" : preset.model || "模型或推理接入点 ID";
    el.aiFormStatus.textContent = preset.hint || "";
  }

  function openAiDrawer() {
    if (!el.aiDrawer) return;
    el.aiDrawer.inert = false;
    el.aiDrawer.removeAttribute("inert");
    el.aiDrawer.classList.add("is-open");
    el.aiDrawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("ai-open");
    el.aiProvider.value = state.ai.provider;
    el.aiKey.value = state.ai.key;
    el.aiBase.value = state.ai.base;
    el.aiModel.value = state.ai.model;
    el.aiRemember.checked = state.ai.remember;
    applyAiProviderPreset(state.ai.provider, { keepValues: true });
    el.aiFormStatus.textContent = state.ai.configured
      ? state.ai.lastError
        ? `上次调用失败：${state.ai.lastError}`
        : state.ai.verified
          ? "已通过真实调用验证；上传照片时会再次调用 AI。"
          : "已配置但尚未验证。点击「测试连接」会真实调用一次接口。"
      : "填入 API Key 后保存；保存时会真实调用一次接口验证，不会只显示“已接入”。";
    window.setTimeout(() => el.aiProvider.focus({ preventScroll: true }), 100);
  }

  function closeAiDrawer() {
    if (!el.aiDrawer) return;
    el.aiDrawer.classList.remove("is-open");
    el.aiDrawer.inert = true;
    el.aiDrawer.setAttribute("inert", "");
    el.aiDrawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("ai-open");
  }

  function saveAiSettingsFromForm(providerOverride) {
    const provider = providerOverride || el.aiProvider.value;
    const preset = AI_PRESETS[provider] || AI_PRESETS.local;
    const key = provider === "local" ? "" : el.aiKey.value.trim();
    const base = provider === "local" ? "" : (el.aiBase.value.trim() || preset.base || "");
    const model = provider === "local" ? "" : (el.aiModel.value.trim() || preset.model || "");
    if (provider !== "local" && !key) {
      el.aiFormStatus.textContent = "还需要填入 API Key。";
      el.aiKey.focus();
      return false;
    }
    if (provider !== "local" && (!base || !model)) {
      el.aiFormStatus.textContent = "还需要填写 Base URL 与模型 ID（豆包等服务商会自动预填）。";
      (base ? el.aiModel : el.aiBase).focus();
      return false;
    }
    state.ai = {
      ...state.ai,
      provider,
      base,
      model,
      key,
      remember: el.aiRemember.checked,
      configured: provider !== "local" && Boolean(key && (model || base)),
      verified: false,
      lastError: "",
    };
    persistAiSettings();
    updateAiStatus();
    if (provider === "local") {
      el.aiFormStatus.textContent = "已切回本地识别，未保存任何 Key。";
    } else {
      el.aiFormStatus.textContent = `已启用 ${preset.label}，上传照片时会调用视觉模型。`;
    }
    return true;
  }

  function bindAiDrawerEvents() {
    el.openAiSettings?.addEventListener("click", openAiDrawer);
    el.aiDrawerClose?.addEventListener("click", closeAiDrawer);
    el.aiDrawerVeil?.addEventListener("click", closeAiDrawer);

    el.aiProvider?.addEventListener("change", () => {
      const provider = el.aiProvider.value;
      applyAiProviderPreset(provider);
      el.aiFormStatus.textContent = AI_PRESETS[provider]?.hint || "";
    });

    el.aiKeyToggle?.addEventListener("click", () => {
      const showing = el.aiKey.type === "text";
      el.aiKey.type = showing ? "password" : "text";
      el.aiKeyToggle.textContent = showing ? "显示" : "隐藏";
    });

    el.aiForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!saveAiSettingsFromForm()) return;
      if (state.ai.provider === "local") {
        window.setTimeout(closeAiDrawer, 300);
        showToast("已切回本地识别");
        return;
      }
      el.aiSave.disabled = true;
      el.aiFormStatus.textContent = "正在真实调用接口验证（不是只保存配置）…";
      const result = await testAiConnection();
      el.aiSave.disabled = false;
      if (!result.ok) {
        el.aiFormStatus.textContent = `真实调用失败：${result.error}`;
        showToast(`AI 真实调用失败：${result.error}`);
        return;
      }
      el.aiFormStatus.textContent = "真实视觉调用成功，接口已返回响应。识图时还会再调用一次。";
      showToast(`AI 视觉接口已验证 · ${AI_PRESETS[state.ai.provider].label}`);
      window.setTimeout(closeAiDrawer, 800);
    });

    el.aiTest?.addEventListener("click", async () => {
      if (!saveAiSettingsFromForm()) return;
      if (state.ai.provider === "local") {
        el.aiFormStatus.textContent = "当前是本地识别，无需调用 API。";
        return;
      }
      el.aiTest.disabled = true;
      el.aiFormStatus.textContent = "正在真实调用接口验证…";
      const result = await testAiConnection();
      el.aiTest.disabled = false;
      el.aiFormStatus.textContent = result.ok
        ? "真实视觉调用成功，已收到模型响应。"
        : `真实视觉调用失败：${result.error}`;
    });

    el.aiDisable?.addEventListener("click", () => {
      el.aiProvider.value = "local";
      applyAiProviderPreset("local");
      saveAiSettingsFromForm("local");
      showToast("已切回本地识别。");
      window.setTimeout(closeAiDrawer, 300);
    });

    el.aiDrawer?.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAiDrawer();
        el.openAiSettings?.focus({ preventScroll: true });
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = $$("button, input, select, a[href]", el.aiDrawer)
        .filter((node) => !node.disabled && node.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    applyAiProviderPreset(state.ai.provider, { keepValues: true });
    updateAiStatus();
  }

  async function imageToDataUrl(previewUrl, maxWidth = 900) {
    const image = await loadImage(previewUrl);
    const ratio = Math.min(1, maxWidth / image.naturalWidth);
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.86);
  }

  function normalizeAiSeries(value) {
    const meta = resolveSeriesName(value);
    return meta ? meta.key : null;
  }

  function aiEndpoint() {
    let base = (state.ai.base || AI_PRESETS[state.ai.provider]?.base || "").trim().replace(/\/+$/, "");
    if (!base) throw new Error("AI 接口的 Base URL 为空");
    if (state.ai.provider === "doubao") {
      // The Ark OpenAI-compatible root is /api/v3. Help pasted host-only or
      // /api URLs converge to the same endpoint instead of producing a 404.
      if (/^https?:\/\/[^/]+$/i.test(base)) base += "/api/v3";
      else if (/\/api\/?$/i.test(base)) base = base.replace(/\/api\/?$/i, "/api/v3");
      else if (/\/v3$/i.test(base) && !/\/api\/v3$/i.test(base)) base = base.replace(/\/v3$/i, "/api/v3");
    }
    if (/\/chat\/completions\/?$/i.test(base)) return base.replace(/\/+$/, "");
    return `${base}/chat/completions`;
  }

  async function postAiChat(payload, timeoutMs = 40000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(aiEndpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.ai.key}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      if (!response.ok) {
        let detail = "";
        try {
          const body = await response.json();
          detail = body?.error?.message || body?.message || "";
        } catch {}
        let hint = "";
        if (state.ai.provider === "doubao") {
          if (response.status === 404) {
            hint = "；404 通常表示模型未开通或 Model ID / Endpoint ID 不正确。请到火山方舟控制台「开通管理」确认模型已开通，并复制完整 Model ID（或 ep- 开头的 Endpoint ID）；Base URL 应为 https://ark.cn-beijing.volces.com/api/v3";
          } else if (response.status === 401 || response.status === 403) {
            hint = "；请确认 API Key 属于当前火山方舟项目，并已开通该视觉模型";
          }
        } else if (state.ai.provider === "deepseek" && response.status === 404) {
          hint = "；请确认模型为 deepseek-flash（或当前账号可用的视觉模型），并用 https://api.deepseek.com 作为 Base URL";
        } else if (state.ai.provider === "deepseek" && (response.status === 400 || response.status === 422)) {
          hint = "；DeepSeek 拒绝了这次图像/工具请求。项目会自动再试一次不带联网工具的纯视觉请求；若仍失败，请确认账号与模型支持图片输入";
        }
        throw new Error(`AI 接口返回 ${response.status}${detail ? `：${detail.slice(0, 120)}` : ""}${hint}`);
      }
      return response;
    } catch (error) {
      window.clearTimeout(timer);
      if (error?.name === "AbortError") throw new Error("AI 接口超时");
      if (String(error?.message || "").startsWith("AI 接口返回")) throw error;
      throw new Error("AI 接口连接失败（可能是跨域、网络或服务商地址问题）");
    }
  }

  function makeVisionTestImage() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const bg = ctx.createLinearGradient(0, 0, 256, 256);
    bg.addColorStop(0, "#101d16");
    bg.addColorStop(1, "#29121b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#e8c493";
    ctx.beginPath();
    ctx.arc(128, 120, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7f2839";
    ctx.beginPath();
    ctx.arc(128, 120, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,244,221,.9)";
    ctx.fillRect(122, 12, 12, 55);
    return canvas.toDataURL("image/jpeg", 0.82);
  }

  async function testAiConnection() {
    if (!state.ai.configured || state.ai.provider === "local") {
      return { ok: false, error: "还没有配置 AI 接口" };
    }
    const model = state.ai.model || AI_PRESETS[state.ai.provider]?.model;
    if (!model) return { ok: false, error: "模型 ID 为空" };
    try {
      const response = await postAiChat({
        model,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "这是接口与看图能力的连通性测试。请看图并只回复 OK。" },
            { type: "image_url", image_url: { url: makeVisionTestImage() } },
          ],
        }],
        temperature: 0,
        max_tokens: 24,
      }, 30000);
      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      if (text == null) throw new Error("接口返回成功，但没有 choices 内容");
      state.ai.verified = true;
      state.ai.lastError = "";
      state.ai.lastCallAt = Date.now();
      state.ai.calls += 1;
      updateAiStatus();
      return { ok: true, sample: String(Array.isArray(text) ? text.map((p) => p?.text || "").join("") : text).slice(0, 60) };
    } catch (error) {
      const message = error?.message || "接口调用失败";
      state.ai.verified = false;
      state.ai.lastError = message;
      updateAiStatus();
      return { ok: false, error: message };
    }
  }

  async function classifyWithAi(previewUrl, context = {}) {
    if (!state.ai.configured || state.ai.provider === "local" || !state.ai.key) return null;
    const model = state.ai.model || AI_PRESETS[state.ai.provider]?.model;
    if (!model) throw new Error("AI 接口的模型为空");
    const dataUrl = await imageToDataUrl(previewUrl);
    const useWebSearch = state.ai.provider === "deepseek";
    const prompt = buildAiPrompt(context);
    const payload = {
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 620,
    };
    let webSearchUsed = useWebSearch;
    if (useWebSearch) {
      // Chat Completions uses the server-tool type only; the `name` field is
      // for the Messages protocol and may be rejected by stricter gateways.
      payload.tools = [{ type: "deepseek_web_search" }];
    }
    // If the search request or its answer cannot be parsed, retry once with a
    // pure vision request. A working image call should never be lost because
    // the optional web-search path failed.
    const attempts = useWebSearch ? [true, false] : [false];
    let parsed = null;
    let lastError = null;
    for (const includeTools of attempts) {
      const requestBody = { ...payload };
      if (!includeTools) delete requestBody.tools;
      try {
        const response = await postAiChat(requestBody, includeTools ? 60000 : 40000);
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        const text = Array.isArray(content)
          ? content.map((part) => (typeof part === "string" ? part : part?.text || "")).join("")
          : String(content || "");
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("AI 调用成功，但返回内容不是 JSON");
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          throw new Error("AI 返回 JSON 解析失败");
        }
        webSearchUsed = includeTools && useWebSearch;
        state.ai.verified = true;
        state.ai.lastError = "";
        state.ai.lastCallAt = Date.now();
        state.ai.calls += 1;
        updateAiStatus();
        break;
      } catch (error) {
        lastError = error;
        state.ai.lastError = error?.message || "AI 调用失败";
        updateAiStatus();
      }
    }
    if (!parsed) throw lastError || new Error("AI 调用失败");
    const known = resolveSeriesName(parsed.series);
    const rawName = String(parsed.series || "").trim();
    const unknownName = !rawName || /^(UNKNOWN|未知|N\/A|无)$/i.test(rawName);
    let newSeries = null;
    if (!known && !unknownName) {
      // The AI is explicitly authorized to open a new, reusable category when
      // the plate is not one of the built-in Pop Mart families.
      newSeries = {
        name: rawName,
        cn: typeof parsed.series_cn === "string" ? parsed.series_cn.trim().slice(0, 20) : "",
        collection: "自由归档",
        collectionEn: "FREE ARCHIVE",
        isPopmart: parsed.is_popmart !== false,
        aiCreated: true,
        intro: typeof parsed.reason === "string" && parsed.reason.trim()
          ? `由 AI 识藏建立：${parsed.reason.trim().slice(0, 40)}`
          : "由识藏室为还没有归处的藏品建立的分类。",
      };
    }
    if (!known && !newSeries) return null;
    return {
      seriesKey: known ? known.key : null,
      newSeries,
      isPopmart: parsed.is_popmart !== false,
      webSearchUsed,
      title: typeof parsed.title === "string" ? parsed.title.trim().slice(0, 12) : "",
      character: typeof parsed.character === "string" ? parsed.character.trim().slice(0, 32) : "",
      reason: typeof parsed.reason === "string" ? parsed.reason.trim().slice(0, 60) : "",
      confidence: clamp(Number(parsed.confidence) || 0.8, 0.35, 1),
    };
  }

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
          const response = await fetch(heroImageFor(item));
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
      const meta = findSeries(select.value) || SERIES[OTHER_SERIES_KEY] || SERIES.molly;
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
    el.scanCaption.textContent = state.ai.configured
      ? "先做本地校准，再交给 AI 复核…"
      : "正在读取轮廓、配色与系列特征…";
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
    let aiFailures = 0;
    let aiFailureMessage = "";
    for (let i = 0; i < batch.length; i += 1) {
      const file = batch[i];
      const thumbEl = el.scanGrid.querySelector(`[data-scan-index="${i}"]`);
      thumbEl?.classList.add("is-scanning");
      el.scanCaption.textContent = state.ai.configured
        ? `第 ${i + 1} 张 · 本地校准中…`
        : `正在分析第 ${i + 1} 张照片…`;
      await wait(state.ai.configured ? 80 : 190);
      try {
        const result = await analyseUpload(file, previewUrls[i], ({ phase, label }) => {
          if (phase === "local") {
            el.scanCaption.textContent = `第 ${i + 1} 张 · 本地校准：${label}${state.ai.configured ? " · 准备 AI 复核…" : ""}`;
          } else if (phase === "ai") {
            const web = state.ai.provider === "deepseek" ? "联网检索复核" : "AI 复核";
            el.scanCaption.textContent = `第 ${i + 1} 张 · ${label} ${web}中…`;
          }
        });
        results.push(result);
        if (result.aiAttempted && !result.aiUsed) {
          aiFailures += 1;
          if (!aiFailureMessage) aiFailureMessage = result.aiError || "接口未返回结果";
        }
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
    if (aiFailures) {
      showToast(`AI 识别失败 ${aiFailures} 张，已使用本地识别${aiFailureMessage ? `：${aiFailureMessage}` : ""}`);
    } else if (failed) {
      showToast(`${results.length} 张照片已识别，${failed} 张无法读取。`);
    }
  }

  async function analyseUpload(file, previewUrl, onStage) {
    const image = await loadImage(previewUrl);
    const features = analysePixels(image);
    features.extraSeed = file.size || 0;
    const localMatch = classifyByName(file.name) || classifyBrandHint(file.name) || classifyByColour(features);
    const localMeta = localMatch.meta;
    const localLabel = localMeta
      ? `${localMeta.name} · ${localMeta.cn}`
      : localMatch.customSeries
        ? `${localMatch.customSeries.name} · ${localMatch.customSeries.cn}`
        : "无法判断";
    onStage?.({ phase: "local", label: localLabel });

    let aiResult = null;
    let aiAttempted = false;
    let aiError = "";
    if (state.ai.configured) {
      aiAttempted = true;
      onStage?.({ phase: "ai", label: AI_PRESETS[state.ai.provider].label });
      try {
        aiResult = await classifyWithAi(previewUrl, { localLabel, filename: file.name });
        if (!aiResult) aiError = "模型没有辨认出系列";
      } catch (error) {
        aiError = error?.message || "AI 接口失败";
        state.ai.lastError = aiError;
        updateAiStatus();
      }
    }

    let aiMeta = null;
    if (aiResult?.newSeries) {
      let newSeries = { ...aiResult.newSeries };
      // The requested rule: if the AI confirms this is not a Pop Mart series,
      // derive the new category from the uploaded file name when it contains
      // a meaningful name; otherwise use the AI's proposed category.
      if (aiResult.isPopmart === false) {
        const filenameCategory = categoryFromFilename(file.name);
        if (filenameCategory) {
          newSeries = {
            ...newSeries,
            name: filenameCategory.name,
            cn: newSeries.cn || filenameCategory.cn,
            collection: "图片名称归档",
            collectionEn: "FILE ARCHIVE",
            intro: `根据图片文件名「${filenameCategory.name}」建立的非泡泡玛特分类。`,
          };
        }
      }
      aiMeta = createCustomSeries({ ...newSeries, aiCreated: true });
    } else if (aiResult?.seriesKey) {
      aiMeta = findSeries(aiResult.seriesKey);
    }
    let resolvedLocalMeta = localMeta;
    if (!aiMeta && !resolvedLocalMeta && localMatch.customSeries) {
      resolvedLocalMeta = createCustomSeries({ ...localMatch.customSeries, aiCreated: false });
    }
    const meta = aiMeta || resolvedLocalMeta || findSeries(OTHER_SERIES_KEY) || SERIES.molly;
    const thumbBlob = await resizeToBlob(image, 500, 625, 0.84);
    const fullBlob = await resizeToBlob(image, 1400, 1750, 0.88);
    if (!thumbBlob || !fullBlob) throw new Error("Could not encode image");
    const localTitle = makeTitle(file.name, meta, features);
    const title = aiResult?.title || localTitle;
    const aiUsed = Boolean(aiMeta);
    const providerLabel = aiUsed ? AI_PRESETS[state.ai.provider].label : "";
    const engineShort = !aiUsed
      ? "本地"
      : state.ai.provider === "deepseek"
        ? "DeepSeek"
        : state.ai.provider === "doubao"
          ? "豆包 AI"
          : state.ai.provider === "siliconflow"
            ? "硅基 AI"
            : state.ai.provider === "openrouter"
              ? "OpenRouter"
              : "AI";
    return {
      file,
      previewUrl,
      thumbBlob,
      fullBlob,
      seriesKey: meta.key,
      manual: false,
      confidence: aiUsed ? aiResult.confidence : localMatch.confidence,
      title,
      width: image.naturalWidth,
      height: image.naturalHeight,
      createdAt: Date.now(),
      demo: false,
      aiAttempted,
      aiUsed,
      aiResponded: Boolean(aiResult),
      aiError: aiAttempted && !aiUsed ? (aiError || "模型没有辨认出系列") : aiError,
      engine: aiUsed ? providerLabel : (localMatch.customSeries ? "本地主色新分类" : "本地识别"),
      engineShort,
      aiReason: aiResult?.reason || "",
      aiWebSearch: Boolean(aiResult?.webSearchUsed),
      localGuess: localLabel,
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

  const LOCAL_BRAND_HINTS = [
    {
      tokens: ["sanrio", "hellokitty", "hello kitty", "三丽鸥", "凯蒂猫"],
      name: "SANRIO",
      cn: "三丽鸥",
      accent: "#f3b6c8",
      hue: 345,
      intro: "本地按文件名识别出的联名收藏。",
    },
    {
      tokens: ["disney", "mickey", "迪士尼", "米奇", "米妮"],
      name: "DISNEY",
      cn: "迪士尼",
      accent: "#9dc7e8",
      hue: 210,
      intro: "本地按文件名识别出的联名收藏。",
    },
    {
      tokens: ["sonnyangel", "sonny angel", "丘比天使"],
      name: "SONNY ANGEL",
      cn: "丘比天使",
      accent: "#e6d0b1",
      hue: 35,
      intro: "本地按文件名识别出的潮玩分类。",
    },
    {
      tokens: ["bearbrick", "be@rbrick", "积木熊"],
      name: "BE@RBRICK",
      cn: "积木熊",
      accent: "#d9c2a2",
      hue: 34,
      intro: "本地按文件名识别出的潮玩分类。",
    },
  ];

  function classifyBrandHint(filename) {
    const normalized = String(filename || "").toLowerCase().replace(/[-_\s.]/g, "");
    if (!normalized) return null;
    for (const hint of LOCAL_BRAND_HINTS) {
      if (!hint.name) continue;
      const matched = hint.tokens.some((token) => normalized.includes(token.toLowerCase().replace(/[-_\s.]/g, "")));
      if (!matched) continue;
      return {
        meta: null,
        customSeries: {
          name: hint.name,
          cn: hint.cn,
          collection: "联名档案",
          collectionEn: "COLLAB ARCHIVE",
          accent: hint.accent,
          hue: hint.hue,
          intro: hint.intro,
          isPopmart: false,
        },
        confidence: 0.76,
        fromName: true,
      };
    }
    return null;
  }

  function classifyByColour(features) {
    // No filename or brand clue: do not pretend a colour match is a certain
    // artist IP. The local engine opens a reusable colour family instead, and
    // the AI can later replace it with a more precise brand/category.
    const family = COLOUR_FAMILIES.reduce((closest, candidate) => (
      hueDistance(features.hue, candidate.hue) < hueDistance(features.hue, closest.hue)
        ? candidate
        : closest
    ), COLOUR_FAMILIES[0]);
    return {
      meta: null,
      customSeries: {
        name: family.name,
        cn: family.cn,
        collection: family.collection,
        collectionEn: family.collectionEn,
        accent: family.accent,
        hue: family.hue,
        intro: family.intro,
        isPopmart: false,
      },
      confidence: clamp(0.46 + features.saturation * 0.09, 0.46, 0.58),
      fromName: false,
      localFallback: true,
    };
  }

  function hueDistance(a, b) {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
  }

  function categoryFromFilename(filename) {
    let base = String(filename || "").replace(/\.[^.]+$/, "");
    base = base.replace(/(img|dsc|dscn|pxl|screenshot|image|photo|微信图片|wx[ _-]?camera|mmexport|wechat|截屏)/gi, " ");
    base = base.replace(/[\s_-]*\(?\d{2,}\)?$/g, " ").trim();
    base = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    if (base.length < 2 || !/[a-zA-Z\u4e00-\u9fff]/.test(base)) return null;
    if (/^(image|photo|screenshot|微信图片|截屏)$/i.test(base)) return null;
    return { name: base.toUpperCase().slice(0, 32), cn: base.slice(0, 20) };
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
      const meta = findSeries(result.seriesKey) || SERIES[OTHER_SERIES_KEY] || SERIES.molly;
      return `
        <article class="result-card" style="animation-delay:${index * 45}ms">
          <div class="result-card__image"><img src="${result.previewUrl}" alt="待入藏照片 ${index + 1}"></div>
          <div class="result-card__body">
            <div class="result-card__topline">
              <span class="result-card__series-label">${escapeHTML(meta.name)} · ${escapeHTML(meta.cn)}</span>
              <span class="result-card__confidence">${result.manual ? "手动确认" : `${escapeHTML(result.engineShort || "本地")} ${Math.round(result.confidence * 100)}%`}</span>
            </div>
            <p class="result-card__title">${escapeHTML(result.title)}</p>
            <p class="result-card__trace">${
              result.aiAttempted
                ? result.aiUsed
                  ? `本地：${escapeHTML(result.localGuess || "未判断")} → ${result.aiWebSearch ? "DeepSeek 联网" : escapeHTML(result.engineShort || "AI")}复核：${escapeHTML(meta.name)}`
                  : result.aiResponded
                    ? `本地：${escapeHTML(result.localGuess || "未判断")} → AI 未给出可用分类，已回退本地`
                    : `本地：${escapeHTML(result.localGuess || "未判断")} → AI 调用失败：${escapeHTML((result.aiError || "未知错误").slice(0, 110))}，已回退本地`
                : `本地：${escapeHTML(result.localGuess || "未判断")}${state.ai.configured ? "" : "（未启用 AI）"}`
            }</p>
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
      const meta = findSeries(result.seriesKey) || SERIES[OTHER_SERIES_KEY] || SERIES.molly;
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
        aiEngine: result.aiUsed ? result.engine : "",
        aiReason: result.aiReason || "",
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
    navigate("collection");
    el.collectionView.scrollTop = 0;
    showToast(`已入藏 ${inserted} 件新藏品，星树已重新编排。`);
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
