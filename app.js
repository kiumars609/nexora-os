/* =========================
   Nexora OS - app.js (FULL, FIXED)
   - Boot + Power + Sleep/Off
   - Central settings + localStorage
   - Real clock + wifi/controller status
   - Unified Focus Manager (contexts)
   - Games library: data JSON + render + filters/sort/search
   - Game details: play/options/install/uninstall
   - Media placeholders
   - Accessibility: aria-selected, aria-live updates
   ========================= */

(() => {
  // -------------------- Helpers --------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const now = () => Date.now();

  const STORAGE = {
    sound: "nexora_sound_enabled",
    volume: "nexora_volume",
    clock24: "nexora_use24h",
    reduceMotion: "nexora_reduce_motion",
    contrast: "nexora_high_contrast",
    wifi: "nexora_wifi_on",
    controller: "nexora_controller_on",
    theme: "nexora_theme",
    games: "nexora_games_state",
    quickResume: "nexora_quick_resume",
    xp: "nexora_xp",
    achievements: "nexora_achievements",
  };

  function loadBool(key, def) {
    try {
      const v = localStorage.getItem(key);
      if (v === "1") return true;
      if (v === "0") return false;
      return def;
    } catch (_) {
      return def;
    }
  }
  function saveBool(key, val) {
    try {
      localStorage.setItem(key, val ? "1" : "0");
    } catch (_) {}
  }
  function loadNum(key, def) {
    try {
      const v = localStorage.getItem(key);
      const n = Number(v);
      return Number.isFinite(n) ? n : def;
    } catch (_) {
      return def;
    }
  }
  function saveNum(key, val) {
    try {
      localStorage.setItem(key, String(val));
    } catch (_) {}
  }
  function loadJson(key, def) {
    try {
      const v = localStorage.getItem(key);
      if (!v) return def;
      return JSON.parse(v);
    } catch (_) {
      return def;
    }
  }
  function saveJson(key, obj) {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
    } catch (_) {}
  }

  function isTypingContext() {
    const a = document.activeElement;
    if (!a) return false;
    const tag = (a.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (a.isContentEditable) return true;
    return false;
  }

  // -------------------- DOM --------------------
  const screens = $$(".screen");
  const navItems = $$(".nav-item");

  const timeEl = $("#timeEl");
  const sndStatus = $("#sndStatus");
  const wifiStatus = $("#wifiStatus");
  const controllerStatus = $("#controllerStatus");

  const toastEl = $("#toast");

  // Boot
  const bootScreen = $("#bootScreen");
  const bootBarFill = $("#bootBarFill");
  const bootPercent = $("#bootPercent");

  // Loading overlay
  const loadingOverlay = $("#loadingOverlay");
  const loadingTitle = $("#loadingTitle");
  const loadingSub = $("#loadingSub");

  // Sleep/Off overlays (if exist)
  const sleepOverlay = $("#sleepOverlay");
  const offOverlay = $("#offOverlay");

  // Power menu
  const powerOverlay = $("#powerOverlay");
  const powerOptions = $("#powerOptions");

  // Games screen
  const gamesGrid = $("#gamesGrid");
  const filterBtn = $("#filterBtn");
  const sortBtn = $("#sortBtn");
  const applyFiltersBtn = $("#applyFiltersBtn");
  const filterValue = $("#filterValue");
  const sortValue = $("#sortValue");
  const searchInput = $("#searchInput");

  // Details screen
  const detailsTitle = $("#detailsTitle");
  const detailsSub = $("#detailsSub");
  const detailsCover = $("#detailsCover");
  const detailsGenre = $("#detailsGenre");
  const detailsSize = $("#detailsSize");
  const detailsLastPlayed = $("#detailsLastPlayed");
  const playBtn = $("#playBtn");
  const optionsBtn = $("#optionsBtn");

  // Now Playing / In-Game
  const nowPlayingTitle = $("#nowPlayingTitle");
  const nowPlayingSub = $("#nowPlayingSub");
  const resumeBtn = $("#resumeBtn");
  const quitBtn = $("#quitBtn");

  const inGameTitle = $("#inGameTitle");
  const inGameSub = $("#inGameSub");
  const openNowPlayingBtn = $("#openNowPlayingBtn");
  const quitFromGameBtn = $("#quitFromGameBtn");

  // System Screen
  const clock12Btn = $("#clock12Btn");
  const clock24Btn = $("#clock24Btn");
  const clockValue = $("#clockValue");

  const soundOnBtn = $("#soundOnBtn");
  const soundOffBtn = $("#soundOffBtn");
  const soundValue = $("#soundValue");

  const volumeSlider = $("#volumeSlider");
  const volumeValue = $("#volumeValue");

  const motionOffBtn = $("#motionOffBtn");
  const motionOnBtn = $("#motionOnBtn");
  const reduceMotionValue = $("#reduceMotionValue");

  const contrastOffBtn = $("#contrastOffBtn");
  const contrastOnBtn = $("#contrastOnBtn");
  const contrastValue = $("#contrastValue");

  const themeValue = $("#themeValue");
  const themeDarkBtn = $("#themeDarkBtn");
  const themeIceBtn = $("#themeIceBtn");
  const themeNeonBtn = $("#themeNeonBtn");

  // -------------------- Central State --------------------
  const state = {
    booting: true,
    powerMenuOpen: false,
    sleeping: false,
    poweredOff: false,

    currentScreen: "home",
    currentTab: "home",
    historyStack: [],

    focus: {
      context: "home", // home | nav | games | media | system | details | nowPlaying | inGame | power
      index: 0,
    },

    settings: {
      soundEnabled: loadBool(STORAGE.sound, true),
      volume: clamp(loadNum(STORAGE.volume, 70), 0, 100),
      clock24: loadBool(STORAGE.clock24, false),
      reduceMotion: loadBool(STORAGE.reduceMotion, false),
      highContrast: loadBool(STORAGE.contrast, false),
      theme: loadJson(STORAGE.theme, "dark") || "dark",
    },

    wifiOn: loadBool(STORAGE.wifi, true),
    controllerOn: loadBool(STORAGE.controller, true),

    games: [],
    gamesUI: {
      filter: "all", // all | installed
      sort: "recent", // recent | az
      search: "",
      lastGridFocus: 0,
    },

    quickResume: loadJson(STORAGE.quickResume, []), // [{id, ts}]
    xp: clamp(loadNum(STORAGE.xp, 0), 0, 999999),
    achievements: loadJson(STORAGE.achievements, {}),
    runningGameId: null,
  };

  // -------------------- Toast --------------------
  let toastTimer = null;
  function showToast(msg = "OK") {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 950);
  }

  // -------------------- Sound Engine (volume + enabled) --------------------
  let audioCtx = null;
  function getAudioCtx() {
    if (audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  }

  function beep({ freq = 520, dur = 0.05, vol = 0.06, type = "sine" } = {}) {
    if (!state.settings.soundEnabled) return;
    const ctx = getAudioCtx();
    if (!ctx) return;

    const t0 = ctx.currentTime + 0.001;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const finalVol = (clamp(state.settings.volume, 0, 100) / 100) * vol;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, finalVol),
      t0 + 0.01
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  const uiSound = {
    move: () => beep({ freq: 520, dur: 0.04, vol: 0.05 }),
    ok: () => beep({ freq: 740, dur: 0.05, vol: 0.07 }),
    back: () => beep({ freq: 340, dur: 0.055, vol: 0.07 }),
    error: () => beep({ freq: 220, dur: 0.07, vol: 0.08, type: "square" }),
    launch: () => beep({ freq: 260, dur: 0.09, vol: 0.08, type: "triangle" }),
    quit: () => beep({ freq: 160, dur: 0.1, vol: 0.09, type: "triangle" }),
  };

  // -------------------- Apply Settings (DOM) --------------------
  function applyReduceMotion() {
    document.body.classList.toggle(
      "reduce-motion",
      !!state.settings.reduceMotion
    );
    if (reduceMotionValue)
      reduceMotionValue.textContent = state.settings.reduceMotion
        ? "ON"
        : "OFF";
    motionOffBtn?.classList.toggle("primary", !state.settings.reduceMotion);
    motionOnBtn?.classList.toggle("primary", !!state.settings.reduceMotion);
    saveBool(STORAGE.reduceMotion, !!state.settings.reduceMotion);
  }

  function applyHighContrast() {
    document.body.classList.toggle(
      "high-contrast",
      !!state.settings.highContrast
    );
    if (contrastValue)
      contrastValue.textContent = state.settings.highContrast ? "ON" : "OFF";
    contrastOffBtn?.classList.toggle("primary", !state.settings.highContrast);
    contrastOnBtn?.classList.toggle("primary", !!state.settings.highContrast);
    saveBool(STORAGE.contrast, !!state.settings.highContrast);
  }

  function applyClockFormat() {
    if (clockValue)
      clockValue.textContent = state.settings.clock24 ? "24H" : "12H";
    clock12Btn?.classList.toggle("primary", !state.settings.clock24);
    clock24Btn?.classList.toggle("primary", !!state.settings.clock24);
    saveBool(STORAGE.clock24, !!state.settings.clock24);
    syncClock();
  }

  function applySoundUI() {
    if (soundValue)
      soundValue.textContent = state.settings.soundEnabled ? "ON" : "OFF";
    soundOnBtn?.classList.toggle("primary", !!state.settings.soundEnabled);
    soundOffBtn?.classList.toggle("primary", !state.settings.soundEnabled);

    if (sndStatus) {
      sndStatus.textContent = `SND: ${
        state.settings.soundEnabled ? "ON" : "OFF"
      }`;
      sndStatus.classList.toggle("is-off", !state.settings.soundEnabled);
      sndStatus.title = `Toggle sound (M) • ${
        state.settings.soundEnabled ? "ON" : "OFF"
      }`;
    }

    saveBool(STORAGE.sound, !!state.settings.soundEnabled);
  }

  function applyVolumeUI() {
    if (volumeSlider) volumeSlider.value = String(state.settings.volume);
    if (volumeValue) volumeValue.textContent = `${state.settings.volume}%`;
    saveNum(STORAGE.volume, state.settings.volume);
  }

  function applyTheme() {
    document.body.classList.remove("theme-dark", "theme-ice", "theme-neon");
    const t = state.settings.theme || "dark";
    document.body.classList.add(`theme-${t}`);

    // pulse (premium apply feel)
    document.body.classList.remove("theme-pulse");
    void document.body.offsetWidth;
    document.body.classList.add("theme-pulse");
    setTimeout(() => document.body.classList.remove("theme-pulse"), 700);

    saveJson(STORAGE.theme, t);

    if (themeValue) themeValue.textContent = t[0].toUpperCase() + t.slice(1);
    themeDarkBtn?.classList.toggle("primary", t === "dark");
    themeIceBtn?.classList.toggle("primary", t === "ice");
    themeNeonBtn?.classList.toggle("primary", t === "neon");
  }

  function setSoundEnabled(v) {
    state.settings.soundEnabled = !!v;
    applySoundUI();
    showToast(`Sound: ${state.settings.soundEnabled ? "ON" : "OFF"}`);
  }
  function toggleSound() {
    setSoundEnabled(!state.settings.soundEnabled);
  }

  function setVolume(v) {
    const n = clamp(Number(v), 0, 100);
    state.settings.volume = n;
    applyVolumeUI();
  }

  function setClockFormat(clock24) {
    state.settings.clock24 = !!clock24;
    applyClockFormat();
    showToast(`Clock: ${state.settings.clock24 ? "24H" : "12H"}`);
  }

  function setReduceMotion(v) {
    state.settings.reduceMotion = !!v;
    applyReduceMotion();
    showToast(`Reduce Motion: ${state.settings.reduceMotion ? "ON" : "OFF"}`);
  }

  function setHighContrast(v) {
    state.settings.highContrast = !!v;
    applyHighContrast();
    showToast(`Contrast: ${state.settings.highContrast ? "ON" : "OFF"}`);
  }

  function setTheme(next) {
    state.settings.theme = String(next || "dark");
    applyTheme();
    showToast(`Theme: ${state.settings.theme.toUpperCase()}`);
  }

  // -------------------- Wi-Fi / Controller --------------------
  function syncWifiUI() {
    if (!wifiStatus) return;
    wifiStatus.style.opacity = state.wifiOn ? "1" : "0.35";
    wifiStatus.title = `Wi-Fi: ${state.wifiOn ? "ON" : "OFF"} (W)`;
    wifiStatus.setAttribute("aria-label", wifiStatus.title);
    saveBool(STORAGE.wifi, state.wifiOn);
  }
  function syncControllerUI() {
    if (!controllerStatus) return;
    controllerStatus.style.opacity = state.controllerOn ? "1" : "0.35";
    controllerStatus.title = `Controller: ${
      state.controllerOn ? "Connected" : "Disconnected"
    } (C)`;
    controllerStatus.setAttribute("aria-label", controllerStatus.title);
    saveBool(STORAGE.controller, state.controllerOn);
  }
  function toggleWifi() {
    state.wifiOn = !state.wifiOn;
    syncWifiUI();
    showToast(`Wi-Fi: ${state.wifiOn ? "ON" : "OFF"}`);
  }
  function toggleController() {
    state.controllerOn = !state.controllerOn;
    syncControllerUI();
    showToast(
      `Controller: ${state.controllerOn ? "Connected" : "Disconnected"}`
    );
  }

  // -------------------- Real Clock --------------------
  function formatTime(d) {
    const opts = {
      hour: "2-digit",
      minute: "2-digit",
      hour12: !state.settings.clock24,
    };
    return d.toLocaleTimeString(undefined, opts);
  }

  function syncClock() {
    if (!timeEl) return;
    timeEl.textContent = formatTime(new Date());
  }

  // update every 30s (snappy)
  setInterval(syncClock, 30000);

  // -------------------- Boot Sequence --------------------
  function showBoot() {
    if (!bootScreen) return;
    bootScreen.classList.add("is-active");
    bootScreen.setAttribute("aria-hidden", "false");
  }
  function hideBoot() {
    if (!bootScreen) return;
    bootScreen.classList.remove("is-active");
    bootScreen.setAttribute("aria-hidden", "true");
  }

  function runBootSequence() {
    showBoot();
    state.booting = true;
    uiSound.launch();

    let p = 0;
    const tick = () => {
      const add = Math.random() * 12 + 6;
      p = Math.min(100, Math.floor(p + add));

      if (bootBarFill) bootBarFill.style.width = `${p}%`;
      if (bootPercent) bootPercent.textContent = `${p}%`;

      if (p >= 100) {
        setTimeout(() => {
          hideBoot();
          state.booting = false;
          setActiveScreen("home", { pushHistory: false });
          onEnterHome();
        }, 450);
        return;
      }
      setTimeout(tick, 180 + Math.random() * 160);
    };

    setTimeout(tick, 260);
  }

  // -------------------- Loading Overlay --------------------
  function showOverlay(title = "Loading", sub = "Please wait.") {
    if (!loadingOverlay) return;
    loadingTitle && (loadingTitle.textContent = title);
    loadingSub && (loadingSub.textContent = sub);
    loadingOverlay.classList.add("is-active");
    loadingOverlay.setAttribute("aria-hidden", "false");
  }

  function hideOverlay() {
    if (!loadingOverlay) return;
    loadingOverlay.classList.remove("is-active");
    loadingOverlay.setAttribute("aria-hidden", "true");
  }

  // -------------------- Routing / Screens --------------------
  function screenNameOf(el) {
    if (!el) return null;
    if (el.classList.contains("home-screen")) return "home";
    if (el.classList.contains("games-screen")) return "games";
    if (el.classList.contains("media-screen")) return "media";
    if (el.classList.contains("system-screen")) return "system";
    if (el.classList.contains("game-details-screen")) return "game-details";
    if (el.classList.contains("now-playing-screen")) return "now-playing";
    if (el.classList.contains("in-game-screen")) return "in-game";
    return null;
  }

  function setActiveTab(tab) {
    state.currentTab = tab;
    navItems.forEach((n) => {
      const isActive = n.dataset.screen === tab;
      n.classList.toggle("active", isActive);
      n.setAttribute("aria-current", isActive ? "page" : "false");
    });
  }

  function setActiveScreen(name, { pushHistory = true } = {}) {
    if (!name) return;
    if (state.booting || state.powerMenuOpen || state.poweredOff) return;

    const prev = state.currentScreen;
    if (pushHistory && prev && prev !== name) {
      state.historyStack.push(prev);
      // avoid unlimited growth
      if (state.historyStack.length > 30) state.historyStack.shift();
    }

    state.currentScreen = name;

    screens.forEach((s) => {
      const sName = screenNameOf(s);
      s.classList.toggle("is-active", sName === name);
      s.setAttribute("aria-hidden", sName === name ? "false" : "true");
    });

    // nav underline rules:
    // - if we enter a main tab screen => currentTab = that screen
    // - if we enter detail/in-game => keep currentTab as previous main tab
    if (
      name === "home" ||
      name === "games" ||
      name === "media" ||
      name === "system"
    ) {
      setActiveTab(name);
    }

    // set focus context per screen
    if (name === "home") setFocusContext("home");
    else if (name === "games") setFocusContext("games");
    else if (name === "media") setFocusContext("media");
    else if (name === "system") setFocusContext("system");
    else if (name === "game-details") setFocusContext("details");
    else if (name === "now-playing") setFocusContext("nowPlaying");
    else if (name === "in-game") setFocusContext("inGame");

    clearAllFocusClasses();
    focusFirstInContext();
  }

  function goBack() {
    if (
      state.powerMenuOpen ||
      state.sleeping ||
      state.poweredOff ||
      state.booting
    )
      return;

    const prev = state.historyStack.pop();
    if (!prev) {
      setActiveScreen(state.currentTab || "home", { pushHistory: false });
      return;
    }
    setActiveScreen(prev, { pushHistory: false });
  }

  // -------------------- Focus Manager (Unified) --------------------
  function setFocusContext(ctx) {
    state.focus.context = ctx;
    state.focus.index = 0;
  }

  function clearAllFocusClasses() {
    $$(".is-focused").forEach((el) => el.classList.remove("is-focused"));
  }

  function markFocused(el) {
    if (!el) return;
    clearAllFocusClasses();
    el.classList.add("is-focused");
    if (el.classList.contains("nav-item"))
      el.setAttribute("aria-selected", "true");
  }

  function focusEl(el) {
    if (!el) return;
    try {
      el.focus?.();
    } catch (_) {}
    markFocused(el);
  }

  function getGameCards() {
    return gamesGrid ? $$(".game-card", gamesGrid) : [];
  }

  function getContextItems(ctx = state.focus.context) {
    if (ctx === "nav") return navItems;

    if (ctx === "home") {
      const home = $(".home-screen");
      const heroBtns = $$(".hero-btn", home);
      const cards = $$(".context-card", home);
      return [...heroBtns, ...cards].filter(Boolean);
    }

    if (ctx === "games") {
      const backBtn = $(".games-screen .back-btn");
      const cards = getGameCards();
      return [
        backBtn,
        filterBtn,
        sortBtn,
        searchInput,
        applyFiltersBtn,
        ...cards,
      ].filter(Boolean);
    }

    if (ctx === "media") {
      const m = $(".media-screen");
      const backBtn = $(".media-screen .back-btn");
      const cards = $$(".media-card", m);
      return [backBtn, ...cards].filter(Boolean);
    }

    if (ctx === "system") {
      const s = $(".system-screen");
      const backBtn = $(".system-screen .back-btn");
      const cards = $$("[data-setting-card]", s);
      return [backBtn, ...cards, volumeSlider].filter(Boolean);
    }

    if (ctx === "details") {
      const d = $(".game-details-screen");
      const backBtn = $(".game-details-screen .back-btn");
      const actions = $$(".details-actions .hero-btn", d);
      const uninstall = $("#uninstallBtn");
      return [backBtn, ...actions, uninstall].filter(Boolean);
    }

    if (ctx === "nowPlaying") {
      const s = $(".now-playing-screen");
      const backBtn = $(".now-playing-screen .back-btn");
      const btns = $$(".details-actions .hero-btn", s);
      return [backBtn, ...btns].filter(Boolean);
    }

    if (ctx === "inGame") {
      const s = $(".in-game-screen");
      const backBtn = $(".in-game-screen .back-btn");
      const btns = $$(".details-actions .hero-btn", s);
      return [backBtn, ...btns].filter(Boolean);
    }

    if (ctx === "power") {
      const opts = powerOptions ? $$(".power-option", powerOptions) : [];
      return opts;
    }

    return [];
  }

  function focusFirstInContext() {
    const items = getContextItems();
    if (!items.length) return;

    // restore games grid focus
    if (state.focus.context === "games") {
      const cards = getGameCards();
      if (cards.length) {
        const idx = clamp(state.gamesUI.lastGridFocus, 0, cards.length - 1);
        state.focus.index = 5 + idx; // back + filter + sort + search + apply = 5
      }
    }

    const el = items[clamp(state.focus.index, 0, items.length - 1)];
    focusEl(el);
  }

  function moveFocus(delta) {
    const items = getContextItems();
    if (!items.length) return;

    let i = clamp(state.focus.index + delta, 0, items.length - 1);
    state.focus.index = i;

    const el = items[i];
    focusEl(el);

    if (state.focus.context === "games") {
      const cards = getGameCards();
      const cardIdx = cards.indexOf(el);
      if (cardIdx >= 0) state.gamesUI.lastGridFocus = cardIdx;
    }
  }

  // -------------------- Navigation (Tab switching) --------------------
  function openTab(tab) {
    uiSound.ok();
    setActiveScreen(tab, { pushHistory: true });
    showToast(tab.toUpperCase());
  }

  function bindNav() {
    navItems.forEach((item) => {
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      item.addEventListener("click", () => openTab(item.dataset.screen));
      item.addEventListener("focus", () => markFocused(item));
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openTab(item.dataset.screen);
        }
      });
    });
  }

  // -------------------- Back buttons (FIX: always bind + keyboard) --------------------
  function bindBackButtons() {
    const backs = $$('[data-action="back"]');
    backs.forEach((btn) => {
      if (!btn.hasAttribute("tabindex")) btn.setAttribute("tabindex", "0");
      btn.setAttribute("role", "button");
      btn.setAttribute("aria-label", "Back");

      if (btn.dataset.boundBack === "1") return;
      btn.dataset.boundBack = "1";

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        uiSound.back();
        goBack();
      });

      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          uiSound.back();
          goBack();
        }
      });
    });
  }

  // -------------------- Games Data --------------------
  function seedDefaultGames() {
    return [
      {
        id: "tlou2",
        title: "The Last of Us Part II",
        genre: "Action",
        installed: true,
        size: 86.4,
        lastPlayed: now() - 1000 * 60 * 60 * 24 * 2,
        cover: "assets/images/covers/tlou2.jpg",
        desc: "Survive. Adapt. Endure.",
      },
      {
        id: "horizon",
        title: "Horizon",
        genre: "Adventure",
        installed: true,
        size: 54.1,
        lastPlayed: now() - 1000 * 60 * 60 * 48,
        cover: "assets/images/covers/horizon.jpg",
        desc: "A wild world beyond.",
      },
      {
        id: "cyberpunk",
        title: "Cyberpunk",
        genre: "RPG",
        installed: false,
        size: 0,
        lastPlayed: 0,
        cover: "assets/images/covers/cyberpunk.jpg",
        desc: "Night City never sleeps.",
      },
      {
        id: "gtavi",
        title: "GTA VI",
        genre: "Open World",
        installed: false,
        size: 0,
        lastPlayed: 0,
        cover: "assets/images/covers/gtavi.jpg",
        desc: "Next-gen chaos.",
      },
      {
        id: "eldenring",
        title: "Elden Ring",
        genre: "Soulslike",
        installed: true,
        size: 48.8,
        lastPlayed: now() - 1000 * 60 * 60 * 24 * 12,
        cover: "assets/images/covers/eldenring.jpg",
        desc: "Rise, Tarnished.",
      },
      {
        id: "minecraft",
        title: "Minecraft",
        genre: "Sandbox",
        installed: true,
        size: 2.1,
        lastPlayed: now() - 1000 * 60 * 60 * 240,
        cover: "assets/images/covers/minecraft.jpg",
        desc: "Build anything. Survive anywhere.",
      },
    ];
  }

  function loadGamesState() {
    const saved = loadJson(STORAGE.games, null);
    if (Array.isArray(saved) && saved.length) {
      state.games = saved;
    } else {
      state.games = seedDefaultGames();
      saveJson(STORAGE.games, state.games);
    }
  }

  function saveGamesState() {
    saveJson(STORAGE.games, state.games);
  }

  function getVisibleGames() {
    let list = [...state.games];

    if (state.gamesUI.filter === "installed")
      list = list.filter((g) => !!g.installed);

    const q = (state.gamesUI.search || "").trim().toLowerCase();
    if (q) list = list.filter((g) => g.title.toLowerCase().includes(q));

    if (state.gamesUI.sort === "az")
      list.sort((a, b) => a.title.localeCompare(b.title));
    else list.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));

    return list;
  }

  function renderGamesGrid() {
    if (!gamesGrid) return;
    const list = getVisibleGames();
    gamesGrid.innerHTML = "";

    list.forEach((g) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "game-card";
      btn.dataset.id = g.id;
      btn.setAttribute("aria-selected", "false");
      btn.title = `${g.title}${g.installed ? " (Installed)" : ""}`;

      // cover style
      const coverStyle = g.cover
        ? `background-image:url("${g.cover}")`
        : `background-image:
          radial-gradient(800px 420px at 20% 20%, rgba(124,195,255,0.22), transparent 60%),
          radial-gradient(700px 420px at 85% 25%, rgba(255,77,230,0.14), transparent 60%),
          radial-gradient(900px 520px at 55% 95%, rgba(169,255,107,0.10), transparent 65%),
          linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.35))`;

      btn.innerHTML = `
  <span class="gc-cover" style='${coverStyle}' aria-hidden="true"></span>

  <span class="gc-info">
    <span>
      <span class="gc-title">${g.title}</span>
      <div class="gc-line">${(g.genre || "—").toUpperCase()} • ${
        g.installed ? "INSTALLED" : "NOT INSTALLED"
      }</div>
    </span>

    <span class="gc-meta">
      <span class="gc-chip ${g.installed ? "" : "is-get"}">
        ${g.installed ? "PLAY" : "GET"}
      </span>
      <span class="gc-chip" style="opacity:.7">
        ${g.size ? `${Number(g.size).toFixed(g.size >= 10 ? 0 : 1)} GB` : "--"}
      </span>
    </span>
  </span>
`;

      btn.addEventListener("click", () => {
        uiSound.ok();
        openGameDetails(g.id);
      });

      btn.addEventListener("focus", () => {
        markFocused(btn);
        const cards = getGameCards();
        const idx = cards.indexOf(btn);
        if (idx >= 0) state.gamesUI.lastGridFocus = idx;
      });

      gamesGrid.appendChild(btn);
    });

    if (!list.length) {
      const empty = document.createElement("div");
      empty.style.cssText =
        "grid-column:1/-1;opacity:.7;letter-spacing:.12em;text-transform:uppercase;text-align:center;padding:18px;";
      empty.textContent = "No games found";
      gamesGrid.appendChild(empty);
    }
  }

  function updateGamesFiltersUI() {
    if (filterValue)
      filterValue.textContent = state.gamesUI.filter.toUpperCase();
    if (sortValue) sortValue.textContent = state.gamesUI.sort.toUpperCase();
    if (searchInput && searchInput.value !== state.gamesUI.search)
      searchInput.value = state.gamesUI.search || "";
  }

  function applyGamesFilters() {
    updateGamesFiltersUI();
    renderGamesGrid();
    showToast("Library updated");
  }

  function cycleFilter() {
    state.gamesUI.filter = state.gamesUI.filter === "all" ? "installed" : "all";
    uiSound.move();
    showToast(`Filter: ${state.gamesUI.filter.toUpperCase()}`);
    applyGamesFilters();
  }

  function cycleSort() {
    state.gamesUI.sort = state.gamesUI.sort === "recent" ? "az" : "recent";
    uiSound.move();
    showToast(`Sort: ${state.gamesUI.sort.toUpperCase()}`);
    applyGamesFilters();
  }

  // -------------------- Details --------------------
  function fmtSize(gb) {
    if (!Number.isFinite(gb) || gb <= 0) return "--";
    return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  }
  function fmtLastPlayed(ts) {
    if (!ts) return "Never";
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }

  function getGameById(id) {
    return state.games.find((g) => g.id === id) || null;
  }

  function ensureUninstallButton() {
    const actions = $(".game-details-screen .details-actions");
    if (!actions) return;

    let btn = $("#uninstallBtn");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "uninstallBtn";
      btn.type = "button";
      btn.className = "hero-btn";
      btn.textContent = "Uninstall";
      actions.appendChild(btn);
    }
    return btn;
  }

  function updateDetailsUI(game) {
    if (!game) return;

    detailsTitle && (detailsTitle.textContent = game.title);
    detailsSub && (detailsSub.textContent = game.desc || game.genre || "");

    detailsGenre && (detailsGenre.textContent = game.genre || "--");
    detailsSize && (detailsSize.textContent = fmtSize(game.size));
    detailsLastPlayed &&
      (detailsLastPlayed.textContent = fmtLastPlayed(game.lastPlayed));

    if (detailsCover) {
      detailsCover.style.backgroundImage = game.cover
        ? `url("${game.cover}")`
        : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.35))";
    }

    // install/uninstall logic
    const uninstallBtn = ensureUninstallButton();
    if (uninstallBtn) {
      uninstallBtn.style.display = game.installed ? "inline-flex" : "none";
      uninstallBtn.onclick = () => {
        if (!game.installed) return;
        uiSound.error();
        showOverlay("Uninstalling", game.title);
        setTimeout(() => {
          game.installed = false;
          game.size = 0;
          saveGamesState();
          renderGamesGrid();
          updateDetailsUI(game);
          hideOverlay();
          showToast("Uninstalled");
        }, 700);
      };
    }

    // Play button state
    if (playBtn) {
      playBtn.textContent = game.installed ? "Play" : "Install";
      playBtn.onclick = () => {
        if (!game.installed) {
          uiSound.ok();
          showOverlay("Installing", game.title);
          setTimeout(() => {
            game.installed = true;
            game.size = clamp(game.size || Math.random() * 60 + 8, 2, 120);
            game.lastPlayed = game.lastPlayed || now();
            saveGamesState();
            renderGamesGrid();
            updateDetailsUI(game);
            hideOverlay();
            showToast("Installed");
          }, 850);
          return;
        }

        // Launch game
        uiSound.launch();
        state.runningGameId = game.id;

        // XP tick
        state.xp += 15;
        saveNum(STORAGE.xp, state.xp);

        game.lastPlayed = now();
        saveGamesState();

        showOverlay("Launching", game.title);
        setTimeout(() => {
          hideOverlay();
          openInGame(game.id);
        }, 650);
      };
    }
  }

  function openGameDetails(gameId) {
    const g = getGameById(gameId);
    if (!g) return;

    setActiveScreen("game-details", { pushHistory: true });
    updateDetailsUI(g);

    // focus play
    setTimeout(() => playBtn?.focus?.(), 0);
  }

  // -------------------- In-Game / Now Playing --------------------
  function openInGame(gameId) {
    const g = getGameById(gameId);
    if (!g) return;

    inGameTitle && (inGameTitle.textContent = "IN GAME");
    inGameSub && (inGameSub.textContent = g.title);

    setActiveScreen("in-game", { pushHistory: true });
    setTimeout(() => openNowPlayingBtn?.focus?.(), 0);
  }

  function openNowPlaying() {
    const g = getGameById(state.runningGameId);
    nowPlayingTitle && (nowPlayingTitle.textContent = "NOW PLAYING");
    nowPlayingSub && (nowPlayingSub.textContent = g ? g.title : "—");

    setActiveScreen("now-playing", { pushHistory: true });
    setTimeout(() => resumeBtn?.focus?.(), 0);
  }

  function resumeGame() {
    uiSound.ok();
    setActiveScreen("in-game", { pushHistory: true });
    setTimeout(() => openNowPlayingBtn?.focus?.(), 0);
  }

  function quitGame() {
    uiSound.quit();
    const g = getGameById(state.runningGameId);
    showOverlay("Quitting", g ? g.title : "Game");
    setTimeout(() => {
      state.runningGameId = null;
      hideOverlay();
      setActiveScreen("games", { pushHistory: true });
      setTimeout(() => focusFirstInContext(), 0);
    }, 700);
  }

  // -------------------- Power Menu (P) --------------------
  let powerIndex = 0;

  function showPowerMenu() {
    if (!powerOverlay || state.poweredOff || state.sleeping || state.booting)
      return;
    state.powerMenuOpen = true;
    powerOverlay.classList.add("is-active");
    powerOverlay.setAttribute("aria-hidden", "false");
    setFocusContext("power");
    powerIndex = 0;
    updatePowerFocus();
    uiSound.ok();
  }

  function hidePowerMenu() {
    if (!powerOverlay) return;
    state.powerMenuOpen = false;
    powerOverlay.classList.remove("is-active");
    powerOverlay.setAttribute("aria-hidden", "true");
    // return focus to current screen context
    if (state.currentScreen === "home") setFocusContext("home");
    else if (state.currentScreen === "games") setFocusContext("games");
    else if (state.currentScreen === "media") setFocusContext("media");
    else if (state.currentScreen === "system") setFocusContext("system");
    else if (state.currentScreen === "game-details") setFocusContext("details");
    else if (state.currentScreen === "now-playing")
      setFocusContext("nowPlaying");
    else if (state.currentScreen === "in-game") setFocusContext("inGame");

    focusFirstInContext();
    uiSound.back();
  }

  function updatePowerFocus() {
    const items = getContextItems("power");
    items.forEach((el, i) =>
      el.classList.toggle("is-focused", i === powerIndex)
    );
    const el = items[powerIndex];
    el?.focus?.();
  }

  function powerSelect() {
    const items = getContextItems("power");
    const el = items[powerIndex];
    const action = el?.dataset?.power;

    if (!action) return;

    if (action === "sleep") {
      uiSound.ok();
      hidePowerMenu();
      state.sleeping = true;
      sleepOverlay?.classList.add("is-active");
      sleepOverlay?.setAttribute("aria-hidden", "false");
      return;
    }

    if (action === "restart") {
      uiSound.launch();
      location.reload();
      return;
    }

    if (action === "off") {
      uiSound.quit();
      hidePowerMenu();
      state.poweredOff = true;
      offOverlay?.classList.add("is-active");
      offOverlay?.setAttribute("aria-hidden", "false");
      return;
    }
  }

  function wakeFromSleep() {
    state.sleeping = false;
    sleepOverlay?.classList.remove("is-active");
    sleepOverlay?.setAttribute("aria-hidden", "true");
    showToast("Woke up");
    uiSound.ok();
    focusFirstInContext();
  }

  function powerOnFromOff() {
    state.poweredOff = false;
    offOverlay?.classList.remove("is-active");
    offOverlay?.setAttribute("aria-hidden", "true");
    showToast("Power On");
    uiSound.launch();
    setActiveScreen("home", { pushHistory: false });
    onEnterHome();
  }

  // -------------------- System UI bindings --------------------
  function bindSystemUI() {
    clock12Btn?.addEventListener(
      "click",
      () => (uiSound.ok(), setClockFormat(false))
    );
    clock24Btn?.addEventListener(
      "click",
      () => (uiSound.ok(), setClockFormat(true))
    );

    soundOnBtn?.addEventListener(
      "click",
      () => (uiSound.ok(), setSoundEnabled(true))
    );
    soundOffBtn?.addEventListener(
      "click",
      () => (uiSound.ok(), setSoundEnabled(false))
    );

    volumeSlider?.addEventListener("input", (e) => setVolume(e.target.value));

    motionOffBtn?.addEventListener(
      "click",
      () => (uiSound.ok(), setReduceMotion(false))
    );
    motionOnBtn?.addEventListener(
      "click",
      () => (uiSound.ok(), setReduceMotion(true))
    );

    contrastOffBtn?.addEventListener(
      "click",
      () => (uiSound.ok(), setHighContrast(false))
    );
    contrastOnBtn?.addEventListener(
      "click",
      () => (uiSound.ok(), setHighContrast(true))
    );

    themeDarkBtn?.addEventListener(
      "click",
      () => (uiSound.ok(), setTheme("dark"))
    );
    themeIceBtn?.addEventListener(
      "click",
      () => (uiSound.ok(), setTheme("ice"))
    );
    themeNeonBtn?.addEventListener(
      "click",
      () => (uiSound.ok(), setTheme("neon"))
    );
  }

  // -------------------- Screen enter helpers --------------------
  function onEnterHome() {
    // underline stays HOME anyway, focus first hero
    setTimeout(() => {
      const home = $(".home-screen");
      const firstHero = $(".hero-btn", home);
      firstHero?.focus?.();
      markFocused(firstHero);
    }, 0);
  }

  function onEnterGames() {
    renderGamesGrid();
    updateGamesFiltersUI();
    setTimeout(() => focusFirstInContext(), 0);
  }

  function onEnterMedia() {
    setTimeout(() => focusFirstInContext(), 0);
  }

  function onEnterSystem() {
    applySoundUI();
    applyVolumeUI();
    applyClockFormat();
    applyReduceMotion();
    applyHighContrast();
    applyTheme();
    setTimeout(() => focusFirstInContext(), 0);
  }

  // -------------------- Global Click Delegation --------------------
  document.addEventListener("click", (e) => {
    // Header toggles
    const wifiEl = e.target.closest("#wifiStatus");
    if (wifiEl) {
      e.preventDefault();
      uiSound.move();
      toggleWifi();
      return;
    }

    const ctrlEl = e.target.closest("#controllerStatus");
    if (ctrlEl) {
      e.preventDefault();
      uiSound.move();
      toggleController();
      return;
    }

    const sndEl = e.target.closest("#sndStatus");
    if (sndEl) {
      e.preventDefault();
      toggleSound();
      return;
    }

    const backEl = e.target.closest('[data-action="back"]');
    if (backEl) {
      e.preventDefault();
      uiSound.back();
      goBack();
      return;
    }
  });

  // -------------------- Keyboard Shortcuts (Console feel) --------------------
  document.addEventListener("keydown", (e) => {
    // Wake / power-on overrides
    if (state.sleeping) {
      wakeFromSleep();
      return;
    }
    if (state.poweredOff) {
      // only P wakes when off (console-like)
      if (e.key.toLowerCase() === "p") powerOnFromOff();
      return;
    }

    if (state.booting) return;

    // Sound toggle (M)
    if (!e.repeat && e.key.toLowerCase() === "m" && !e.shiftKey) {
      if (isTypingContext()) return;
      toggleSound();
      uiSound.ok();
      return;
    }

    // Shift+M => open System on sound
    if (!e.repeat && e.key.toLowerCase() === "m" && e.shiftKey) {
      if (isTypingContext()) return;
      setActiveScreen("system", { pushHistory: true });
      onEnterSystem();
      setTimeout(() => soundOnBtn?.focus?.(), 0);
      return;
    }

    // T => clock toggle
    if (!e.repeat && e.key.toLowerCase() === "t") {
      if (isTypingContext()) return;
      setClockFormat(!state.settings.clock24);
      uiSound.move();
      return;
    }

    // W => wifi toggle
    if (!e.repeat && e.key.toLowerCase() === "w") {
      if (isTypingContext()) return;
      toggleWifi();
      uiSound.move();
      return;
    }

    // C => controller toggle
    if (!e.repeat && e.key.toLowerCase() === "c") {
      if (isTypingContext()) return;
      toggleController();
      uiSound.move();
      return;
    }

    // P => power menu toggle
    if (!e.repeat && e.key.toLowerCase() === "p") {
      if (state.powerMenuOpen) hidePowerMenu();
      else showPowerMenu();
      return;
    }

    // If power menu open => handle arrows/enter/esc
    if (state.powerMenuOpen) {
      const items = getContextItems("power");
      if (!items.length) return;

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        powerIndex = clamp(powerIndex - 1, 0, items.length - 1);
        uiSound.move();
        updatePowerFocus();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        powerIndex = clamp(powerIndex + 1, 0, items.length - 1);
        uiSound.move();
        updatePowerFocus();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        powerSelect();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        hidePowerMenu();
        return;
      }
      return;
    }

    // Global Back: Esc
    if (e.key === "Escape") {
      if (isTypingContext()) return;
      e.preventDefault();
      uiSound.back();
      goBack();
      return;
    }

    // Focus movement (console style): arrows
    if (isTypingContext()) {
      // allow typing in inputs
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      uiSound.move();
      moveFocus(-1);
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      uiSound.move();
      moveFocus(+1);
      return;
    }

    if (e.key === "Enter") {
      // simulate click on focused element
      const items = getContextItems();
      const el = items[state.focus.index];
      if (el) {
        e.preventDefault();
        uiSound.ok();
        el.click?.();
      }
      return;
    }
  });

  // -------------------- Bind games filters buttons --------------------
  function bindGamesUI() {
    filterBtn?.addEventListener("click", () => cycleFilter());
    sortBtn?.addEventListener("click", () => cycleSort());
    applyFiltersBtn?.addEventListener("click", () => applyGamesFilters());
    searchInput?.addEventListener("input", (e) => {
      state.gamesUI.search = e.target.value || "";
      renderGamesGrid();
      updateGamesFiltersUI();
    });
  }

  // -------------------- Buttons in now playing / in game --------------------
  resumeBtn?.addEventListener("click", () => resumeGame());
  quitBtn?.addEventListener("click", () => quitGame());
  openNowPlayingBtn?.addEventListener("click", () => openNowPlaying());
  quitFromGameBtn?.addEventListener("click", () => quitGame());

  // -------------------- Initial Apply --------------------
  function init() {
    // Apply settings to DOM
    applySoundUI();
    applyVolumeUI();
    applyClockFormat();
    applyReduceMotion();
    applyHighContrast();
    applyTheme();

    syncWifiUI();
    syncControllerUI();
    syncClock();

    loadGamesState();

    bindNav();
    bindBackButtons();
    bindGamesUI();
    bindSystemUI();

    // Screen enter hooks
    const onScreenChange = () => {
      if (state.currentScreen === "home") onEnterHome();
      if (state.currentScreen === "games") onEnterGames();
      if (state.currentScreen === "media") onEnterMedia();
      if (state.currentScreen === "system") onEnterSystem();
    };

    // run boot then enter home
    runBootSequence();

    // whenever screen changes via nav clicks we call onEnter* through setActiveScreen,
    // but for safety keep this small observer:
    const observer = new MutationObserver(() => onScreenChange());
    screens.forEach((s) =>
      observer.observe(s, { attributes: true, attributeFilter: ["class"] })
    );
  }

  init();
})();
