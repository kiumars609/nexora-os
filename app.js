/* =========================
   Nexora OS - app.js (FULL)
   - Boot + Power + Sleep/Off
   - Central settings + localStorage
   - Real clock + wifi/controller status
   - Unified Focus Manager (contexts)
   - Games library: data JSON + render + filters/sort/search
   - Game details: real + install/uninstall
   - Quick Resume (symbolic) + XP/Achievements (simple)
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

  function bindBackButtons() {
    // هر چیزی که data-action="back" داره
    const backs = $$('[data-action="back"]');

    backs.forEach((btn) => {
      // اگر div هست، قابل فوکوسش کن
      if (!btn.hasAttribute("tabindex")) btn.setAttribute("tabindex", "0");
      btn.setAttribute("role", "button");
      btn.setAttribute("aria-label", "Back");

      // جلوگیری از چندبار بایند شدن
      if (btn.dataset.boundBack === "1") return;
      btn.dataset.boundBack = "1";

      btn.addEventListener("click", (e) => {
        if (shouldBlockGlobalInput()) return;
        e.preventDefault();
        uiSound.back();
        goBack();
      });

      btn.addEventListener("keydown", (e) => {
        if (shouldBlockGlobalInput()) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          uiSound.back();
          goBack();
        }
      });
    });
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

  // -------------------- State (Central) --------------------
  const state = {
    booting: true,
    powerMenuOpen: false,
    sleeping: false,
    poweredOff: false,

    currentScreen: "home",
    historyStack: [],
    currentTab: "home",

    focus: {
      context: "home", // home | nav | games | media | system | details | nowPlaying | inGame | power
      index: 0,
    },

    wifiOn: loadBool(STORAGE.wifi, true),
    controllerOn: loadBool(STORAGE.controller, true),

    settings: {
      soundEnabled: loadBool(STORAGE.sound, true),
      volume: clamp(loadNum(STORAGE.volume, 60), 0, 100),
      clock24: loadBool(STORAGE.clock24, false),
      reduceMotion: loadBool(STORAGE.reduceMotion, false),
      highContrast: loadBool(STORAGE.contrast, false),
      theme: loadJson(STORAGE.theme, "dark"), // dark | ice | neon
    },

    games: [],
    gamesUI: {
      filter: "all",
      sort: "recent",
      search: "",
      lastGridFocus: 0,
      selectedId: null,
    },

    running: loadJson(STORAGE.quickResume, []), // [{id, startedAt}]
    runningActiveId: null,

    xp: clamp(loadNum(STORAGE.xp, 0), 0, 999999),
    achievements: loadJson(STORAGE.achievements, {}),
  };

  // -------------------- DOM refs --------------------
  const screens = $$(".screen");
  const navItems = $$(".nav-item");

  const timeEl = $("#timeEl");
  const sndStatusEl = $("#sndStatus");
  const wifiEl = $("#wifiStatus");
  const ctrlEl = $("#controllerStatus");

  const bootScreen = $("#bootScreen");
  const bootBarFill = $("#bootBarFill");
  const bootPercent = $("#bootPercent");

  const loadingOverlay = $("#loadingOverlay");
  const loadingTitle = $("#loadingTitle");
  const loadingSub = $("#loadingSub");

  const powerOverlay = $("#powerOverlay");
  const powerOptions = $("#powerOptions");
  const sleepOverlay = $("#sleepOverlay");
  const offOverlay = $("#offOverlay");

  const gamesGrid = $("#gamesGrid");
  const systemGrid = $("#systemGrid");

  // details screen existing ids
  const detailsTitle = $("#detailsTitle");
  const detailsSub = $("#detailsSub");
  const playBtn = $("#playBtn");
  const optionsBtn = $("#optionsBtn");

  const nowPlayingTitle = $("#nowPlayingTitle");
  const nowPlayingSub = $("#nowPlayingSub");
  const resumeBtn = $("#resumeBtn");
  const quitBtn = $("#quitBtn");

  const inGameTitle = $("#inGameTitle");
  const inGameSub = $("#inGameSub");
  const openNowPlayingBtn = $("#openNowPlayingBtn");
  const quitFromGameBtn = $("#quitFromGameBtn");

  // system controls existing ids
  const clockFormatValue = $("#clockFormatValue");
  const clock12Btn = $("#clock12Btn");
  const clock24Btn = $("#clock24Btn");

  const systemSoundValue = $("#systemSoundValue");
  const soundOnBtn = $("#soundOnBtn");
  const soundOffBtn = $("#soundOffBtn");

  const volumeValue = $("#volumeValue");
  const volumeSlider = $("#volumeSlider");

  const reduceMotionValue = $("#reduceMotionValue");
  const motionOffBtn = $("#motionOffBtn");
  const motionOnBtn = $("#motionOnBtn");

  const contrastValue = $("#contrastValue");
  const contrastOffBtn = $("#contrastOffBtn");
  const contrastOnBtn = $("#contrastOnBtn");

  // optional theme area if exists
  const themeValue = $("#themeValue");
  const themeDarkBtn = $("#themeDarkBtn");
  const themeIceBtn = $("#themeIceBtn");
  const themeNeonBtn = $("#themeNeonBtn");

  // -------------------- Toast --------------------
  let toastTimer = null;
  function showToast(msg = "OK") {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-show"), 1100);
  }

  // -------------------- Loading Overlay --------------------
  function showLoading(title = "Loading", sub = "") {
    if (!loadingOverlay) return;
    if (loadingTitle) loadingTitle.textContent = title;
    if (loadingSub) loadingSub.textContent = sub || "";
    loadingOverlay.classList.add("is-active");
    loadingOverlay.setAttribute("aria-hidden", "false");
  }
  function hideLoading() {
    if (!loadingOverlay) return;
    loadingOverlay.classList.remove("is-active");
    loadingOverlay.setAttribute("aria-hidden", "true");
  }

  // -------------------- Boot --------------------
  function showBoot() {
    bootScreen?.classList.add("is-active");
    bootScreen?.setAttribute("aria-hidden", "false");
  }
  function hideBoot() {
    bootScreen?.classList.remove("is-active");
    bootScreen?.setAttribute("aria-hidden", "true");
  }

  function runBootSequence() {
    if (!bootScreen) {
      state.booting = false;
      setActiveScreen("home", { pushHistory: false });
      onEnterHome();
      return;
    }

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

      setTimeout(tick, 140 + Math.random() * 160);
    };

    setTimeout(tick, 250);
  }

  function shouldBlockGlobalInput() {
    return (
      state.booting || state.sleeping || state.poweredOff || state.powerMenuOpen
    );
  }

  // -------------------- Focus Manager (Unified) --------------------
  function setFocusContext(ctx, index = 0) {
    state.focus.context = ctx;
    state.focus.index = index;
  }

  function markFocused(el) {
    if (!el) return;
    // clear focus styling in same scope
    const root =
      el.closest(".screen") || el.closest(".power-modal") || document.body;

    $$(".is-focused", root).forEach((n) => n.classList.remove("is-focused"));
    el.classList.add("is-focused");

    // accessibility
    if (el.hasAttribute("aria-selected"))
      el.setAttribute("aria-selected", "true");
  }

  function getNavOrder() {
    return navItems.map((n) => n.dataset.screen).filter(Boolean);
  }

  function setNavActiveByName(name) {
    const target = $(`.nav-item[data-screen="${name}"]`);
    if (!target) return;
    navItems.forEach((i) => i.classList.remove("active"));
    target.classList.add("active");
  }

  function setNavFocusByName(name) {
    navItems.forEach((i) => i.classList.remove("is-focused"));
    $(`.nav-item[data-screen="${name}"]`)?.classList.add("is-focused");
  }

  function clearNavFocus() {
    navItems.forEach((i) => i.classList.remove("is-focused"));
  }

  function focusNavDomByName(name) {
    const el = $(`.nav-item[data-screen="${name}"]`);
    if (!el) return;
    setNavFocusByName(name);
    el.focus?.();
  }

  function syncNavUI() {
    setNavActiveByName(state.currentTab);

    if (state.currentScreen !== "home") {
      setNavFocusByName(state.currentTab);
    } else {
      clearNavFocus();
    }
  }

  // -------------------- Routing + History --------------------
  function setActiveScreen(name, { pushHistory = true } = {}) {
    if (!name) return;

    const prev = state.currentScreen;
    if (prev === name) return;

    // push history if needed
    if (pushHistory) state.historyStack.push(prev);

    state.currentScreen = name;

    // tabs (active underline) only for main sections
    if (["home", "games", "media", "system"].includes(name)) {
      state.currentTab = name;
    }

    // switch screen classes
    screens.forEach((s) => s.classList.remove("is-active"));
    $(`.screen.${name}-screen`)?.classList.add("is-active");

    syncNavUI();

    // focus contexts
    if (name === "home") setFocusContext("home", 0);
    else if (name === "games")
      setFocusContext("games", state.gamesUI.lastGridFocus || 0);
    else if (name === "media") setFocusContext("media", 0);
    else if (name === "system") setFocusContext("system", 0);
    else if (name === "game-details") setFocusContext("details", 0);
    else if (name === "now-playing") setFocusContext("nowPlaying", 0);
    else if (name === "in-game") setFocusContext("inGame", 0);

    // screen-enter actions
    if (name === "home") onEnterHome();
    if (name === "games") onEnterGames();
    if (name === "media") onEnterMedia();
    if (name === "system") onEnterSystem();
    if (name === "now-playing") onEnterNowPlaying();
    if (name === "in-game") onEnterInGame();
    if (name === "game-details") onEnterDetails();
  }

  function goBack() {
    if (shouldBlockGlobalInput()) return;

    // close media overlay if open
    if (hideMediaOverlayIfOpen()) return;

    // close power menu if open
    if (state.powerMenuOpen) {
      closePowerMenu();
      uiSound.back();
      return;
    }

    const prev = state.historyStack.pop();
    if (!prev) {
      // if no history, behave console-like: go to current tab root or home
      if (state.currentScreen !== state.currentTab) {
        setActiveScreen(state.currentTab, { pushHistory: false });
      } else if (state.currentScreen !== "home") {
        setActiveScreen("home", { pushHistory: false });
      }
      return;
    }
    setActiveScreen(prev, { pushHistory: false });
    uiSound.back();
  }

  // -------------------- Header status: WiFi / Controller --------------------
  function applyWifiUI() {
    if (!wifiEl) return;
    wifiEl.classList.toggle("is-off", !state.wifiOn);
    wifiEl.title = `Wi-Fi: ${state.wifiOn ? "ON" : "OFF"} (W)`;
    wifiEl.setAttribute("tabindex", "0");
    wifiEl.setAttribute("role", "button");
    wifiEl.setAttribute("aria-label", wifiEl.title);
  }

  function applyControllerUI() {
    if (!ctrlEl) return;
    ctrlEl.classList.toggle("is-off", !state.controllerOn);
    ctrlEl.title = `Controller: ${
      state.controllerOn ? "Connected" : "Disconnected"
    } (C)`;
    ctrlEl.setAttribute("tabindex", "0");
    ctrlEl.setAttribute("role", "button");
    ctrlEl.setAttribute("aria-label", ctrlEl.title);
  }

  function toggleWifi() {
    state.wifiOn = !state.wifiOn;
    saveBool(STORAGE.wifi, state.wifiOn);
    applyWifiUI();
    showToast(`Wi-Fi: ${state.wifiOn ? "ON" : "OFF"}`);
  }

  function toggleController() {
    state.controllerOn = !state.controllerOn;
    saveBool(STORAGE.controller, state.controllerOn);
    applyControllerUI();
    showToast(
      `Controller: ${state.controllerOn ? "Connected" : "Disconnected"}`
    );
  }

  function bindHeaderToggleKeys() {
    const onKey = (handler) => (e) => {
      if (shouldBlockGlobalInput()) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      uiSound.move();
      handler();
    };
    wifiEl?.addEventListener("keydown", onKey(toggleWifi));
    ctrlEl?.addEventListener("keydown", onKey(toggleController));

    wifiEl?.addEventListener("click", () => {
      if (shouldBlockGlobalInput()) return;
      uiSound.move();
      toggleWifi();
    });
    ctrlEl?.addEventListener("click", () => {
      if (shouldBlockGlobalInput()) return;
      uiSound.move();
      toggleController();
    });
  }

  // -------------------- Clock --------------------
  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatTime(d) {
    const h = d.getHours();
    const m = d.getMinutes();
    const mm = pad2(m);

    if (state.settings.clock24) return `${pad2(h)}:${mm}`;

    const hh = h % 12 || 12;
    const ampm = h >= 12 ? "PM" : "AM";
    return `${hh}:${mm} ${ampm}`;
  }

  let clockInterval = null;
  function renderClock() {
    if (!timeEl) return;
    timeEl.textContent = formatTime(new Date());
  }
  function startClock() {
    renderClock();
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(renderClock, 60 * 1000);
  }

  function applyClockUI() {
    if (clockFormatValue)
      clockFormatValue.textContent = state.settings.clock24 ? "24H" : "12H";
    clock12Btn?.classList.toggle("primary", !state.settings.clock24);
    clock24Btn?.classList.toggle("primary", !!state.settings.clock24);
    startClock();
  }

  function setClockFormat(use24) {
    state.settings.clock24 = !!use24;
    saveBool(STORAGE.clock24, state.settings.clock24);
    applyClockUI();
    showToast(`Clock: ${state.settings.clock24 ? "24H" : "12H"}`);
  }

  function toggleClockFormat() {
    setClockFormat(!state.settings.clock24);
  }

  // -------------------- Sound / Volume --------------------
  function applySoundUI() {
    if (sndStatusEl)
      sndStatusEl.textContent = state.settings.soundEnabled ? "ON" : "OFF";
    if (systemSoundValue)
      systemSoundValue.textContent = state.settings.soundEnabled ? "ON" : "OFF";

    soundOnBtn?.classList.toggle("primary", !!state.settings.soundEnabled);
    soundOffBtn?.classList.toggle("primary", !state.settings.soundEnabled);
  }

  function setSoundEnabled(v) {
    state.settings.soundEnabled = !!v;
    saveBool(STORAGE.sound, state.settings.soundEnabled);
    applySoundUI();
    showToast(`Sound: ${state.settings.soundEnabled ? "ON" : "OFF"}`);
  }

  function toggleSound() {
    setSoundEnabled(!state.settings.soundEnabled);
    if (state.settings.soundEnabled) uiSound.ok();
  }

  function applyVolumeUI() {
    if (volumeValue)
      volumeValue.textContent = String(Math.round(state.settings.volume));
    if (volumeSlider)
      volumeSlider.value = String(Math.round(state.settings.volume));
  }

  function setVolume(v) {
    state.settings.volume = clamp(Number(v) || 0, 0, 100);
    saveNum(STORAGE.volume, state.settings.volume);
    applyVolumeUI();
  }

  function isVolumeSliderFocused() {
    return document.activeElement === volumeSlider;
  }

  // -------------------- Motion / Contrast --------------------
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
  }
  function setReduceMotion(v) {
    state.settings.reduceMotion = !!v;
    saveBool(STORAGE.reduceMotion, state.settings.reduceMotion);
    applyReduceMotion();
    showToast(`Reduce Motion: ${state.settings.reduceMotion ? "ON" : "OFF"}`);
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
  }
  function setHighContrast(v) {
    state.settings.highContrast = !!v;
    saveBool(STORAGE.contrast, state.settings.highContrast);
    applyHighContrast();
    showToast(`High Contrast: ${state.settings.highContrast ? "ON" : "OFF"}`);
  }

  // -------------------- Themes (body class) --------------------
  function applyTheme() {
    document.body.classList.remove("theme-dark", "theme-ice", "theme-neon");
    const t = state.settings.theme || "dark";
    document.body.classList.add(`theme-${t}`);
    document.body.classList.remove("theme-pulse");
    void document.body.offsetWidth; // reflow trick
    document.body.classList.add("theme-pulse");
    setTimeout(() => document.body.classList.remove("theme-pulse"), 700);
    saveJson(STORAGE.theme, t);

    if (themeValue) themeValue.textContent = t[0].toUpperCase() + t.slice(1);

    themeDarkBtn?.classList.toggle("primary", t === "dark");
    themeIceBtn?.classList.toggle("primary", t === "ice");
    themeNeonBtn?.classList.toggle("primary", t === "neon");
  }

  function setTheme(next) {
    state.settings.theme = next;
    applyTheme();
    showToast(`Theme: ${String(next).toUpperCase()}`);
  }

  // -------------------- System Screen bindings --------------------
  function bindSystemUI() {
    clock12Btn?.addEventListener("click", () => {
      uiSound.ok();
      setClockFormat(false);
    });
    clock24Btn?.addEventListener("click", () => {
      uiSound.ok();
      setClockFormat(true);
    });

    soundOnBtn?.addEventListener("click", () => {
      uiSound.ok();
      setSoundEnabled(true);
    });
    soundOffBtn?.addEventListener("click", () => {
      uiSound.ok();
      setSoundEnabled(false);
    });

    volumeSlider?.addEventListener("input", (e) => {
      setVolume(e.target.value);
    });

    motionOffBtn?.addEventListener("click", () => {
      uiSound.ok();
      setReduceMotion(false);
    });
    motionOnBtn?.addEventListener("click", () => {
      uiSound.ok();
      setReduceMotion(true);
    });

    contrastOffBtn?.addEventListener("click", () => {
      uiSound.ok();
      setHighContrast(false);
    });
    contrastOnBtn?.addEventListener("click", () => {
      uiSound.ok();
      setHighContrast(true);
    });

    themeDarkBtn?.addEventListener("click", () => {
      uiSound.ok();
      setTheme("dark");
    });
    themeIceBtn?.addEventListener("click", () => {
      uiSound.ok();
      setTheme("ice");
    });
    themeNeonBtn?.addEventListener("click", () => {
      uiSound.ok();
      setTheme("neon");
    });
  }

  function openSystemOnSound() {
    setActiveScreen("system", { pushHistory: true });
    setTimeout(() => {
      soundOnBtn?.focus?.();
    }, 0);
  }

  // -------------------- Games Data --------------------
  const DEFAULT_GAMES = [
    {
      id: "tlou2",
      title: "The Last of Us Part II",
      genre: "Action / Drama",
      installed: true,
      size: 78.4,
      lastPlayed: 0,
      cover: "",
      desc: "A gritty story-driven action experience.",
    },
    {
      id: "gow",
      title: "God of War",
      genre: "Action / Adventure",
      installed: true,
      size: 45.2,
      lastPlayed: 0,
      cover: "",
      desc: "Mythic battles and father-son journey.",
    },
    {
      id: "hzd",
      title: "Horizon Zero Dawn",
      genre: "RPG / Open World",
      installed: false,
      size: 62.1,
      lastPlayed: 0,
      cover: "",
      desc: "Machines. Mystery. A wild open world.",
    },
    {
      id: "spiderman",
      title: "Spider-Man",
      genre: "Action / Open World",
      installed: true,
      size: 52.7,
      lastPlayed: 0,
      cover: "",
      desc: "Swing through the city and save the day.",
    },
    {
      id: "elden",
      title: "Elden Ring",
      genre: "Soulslike / RPG",
      installed: false,
      size: 58.2,
      lastPlayed: 0,
      cover: "",
      desc: "A vast world of challenging battles.",
    },
    {
      id: "re4",
      title: "Resident Evil 4",
      genre: "Horror / Action",
      installed: false,
      size: 39.6,
      lastPlayed: 0,
      cover: "",
      desc: "Survival horror reimagined.",
    },
    {
      id: "gt7",
      title: "Gran Turismo 7",
      genre: "Racing",
      installed: true,
      size: 96.3,
      lastPlayed: 0,
      cover: "",
      desc: "Real driving simulator vibes.",
    },
    {
      id: "stray",
      title: "Stray",
      genre: "Adventure",
      installed: true,
      size: 7.1,
      lastPlayed: 0,
      cover: "",
      desc: "A cat’s journey through neon city.",
    },
  ];

  function loadGamesState() {
    const saved = loadJson(STORAGE.games, null);
    if (Array.isArray(saved) && saved.length) {
      // merge defaults with saved by id (so you can update defaults later)
      const map = new Map(saved.map((g) => [g.id, g]));
      state.games = DEFAULT_GAMES.map((g) => ({
        ...g,
        ...(map.get(g.id) || {}),
      }));
    } else {
      state.games = DEFAULT_GAMES.map((g) => ({ ...g }));
      saveGamesState();
    }
  }

  function saveGamesState() {
    saveJson(STORAGE.games, state.games);
  }

  // -------------------- Games UI (Filters/Sort/Search + Render) --------------------
  function getVisibleGames() {
    let list = [...state.games];

    if (state.gamesUI.filter === "installed") {
      list = list.filter((g) => !!g.installed);
    }

    if (state.gamesUI.search) {
      const q = state.gamesUI.search.trim().toLowerCase();
      list = list.filter((g) => g.title.toLowerCase().includes(q));
    }

    if (state.gamesUI.sort === "recent") {
      list.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    } else {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }

    return list;
  }

  function getGameCards() {
    return $$(".game-card", gamesGrid || document);
  }

  function focusGameByIndex(i) {
    const cards = getGameCards();
    if (!cards.length) return;
    const idx = clamp(i, 0, cards.length - 1);
    cards[idx].focus();
    markFocused(cards[idx]);
    state.gamesUI.lastGridFocus = idx;
  }

  function injectGamesFiltersBar() {
    const gamesScreen = $(".games-screen");
    if (!gamesScreen) return;
    if ($("#gamesFiltersBar")) return;

    const bar = document.createElement("div");
    bar.id = "gamesFiltersBar";
    bar.style.cssText = `
      width: min(980px, 92%);
      margin: 18px auto 10px;
      padding: 14px 14px;
      border-radius: 16px;
      border: 1px solid rgba(220,235,255,0.12);
      background: rgba(255,255,255,0.02);
      display:flex; gap:12px; align-items:center; justify-content:space-between;
      flex-wrap: wrap;
    `;
    bar.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <div style="opacity:.65;letter-spacing:.12em;text-transform:uppercase;font-size:11px;">
          Filter:
        </div>
        <div id="filterValue" style="font-weight:800;letter-spacing:.14em;">ALL</div>

        <div style="opacity:.65;letter-spacing:.12em;text-transform:uppercase;font-size:11px;margin-left:12px;">
          Sort:
        </div>
        <div id="sortValue" style="font-weight:800;letter-spacing:.14em;">RECENT</div>
      </div>

      <div style="display:flex;gap:10px;align-items:center;flex:1;justify-content:flex-end;min-width:260px;">
        <input id="searchInput" type="text" placeholder="Search..."
          style="
            flex:1; min-width:180px;
            background: rgba(255,255,255,0.03);
            color: rgba(230,237,245,0.9);
            border-radius: 12px;
            border: 1px solid rgba(220,235,255,0.12);
            padding: 10px 12px;
            outline: none;
            letter-spacing: 0.06em;
          "/>
        <button class="hero-btn primary" id="applyFiltersBtn" type="button" style="min-width:160px;">
          APPLY
        </button>
      </div>
    `;

    const titleEl = $(".games-title", gamesScreen);
    if (titleEl && titleEl.parentElement)
      titleEl.parentElement.insertBefore(bar, titleEl.nextSibling);

    const hint = document.createElement("div");
    hint.id = "gamesFiltersHint";
    hint.style.cssText = `
      width: 80%;
      margin: 0 auto 10px;
      opacity: 0.55;
      letter-spacing: 0.12em;
      font-size: 11px;
      text-transform: uppercase;
      text-align: center;
    `;
    hint.textContent =
      "L/R: toggle Filter/Sort • Enter: open game • Esc: back • Search: type";
    bar.parentElement?.insertBefore(hint, bar.nextSibling);

    // Bind
    const applyBtn = $("#applyFiltersBtn");
    const searchInput = $("#searchInput");

    applyBtn?.addEventListener("click", () => {
      uiSound.ok();
      applyGamesFilters();
    });

    searchInput?.addEventListener("input", (e) => {
      state.gamesUI.search = e.target.value || "";
      // live update (optional) : for smoother feel, render live:
      renderGamesGrid();
      updateGamesFiltersUI();
    });
  }

  function updateGamesFiltersUI() {
    const filterValue = $("#filterValue");
    const sortValue = $("#sortValue");
    const searchInput = $("#searchInput");
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

      btn.innerHTML = `
        <span style="display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;">
          <span style="text-align:left;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:78%;">
            ${g.title}
          </span>
          <span style="opacity:${
            g.installed ? "0.85" : "0.35"
          };letter-spacing:.12em;font-size:11px;">
            ${g.installed ? "INST" : "GET"}
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

  // -------------------- Details (Phase 5.3) --------------------
  function fmtSize(gb) {
    if (!Number.isFinite(gb)) return "--";
    return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  }

  function fmtLastPlayed(ts) {
    if (!ts) return "Never";
    const d = new Date(ts);
    const dd = d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
    return dd;
  }

  function getGameById(id) {
    return state.games.find((g) => g.id === id) || null;
  }

  function ensureUninstallButton() {
    const actions = $(".game-details-screen .details-actions");
    if (!actions) return null;

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

  function injectDetailsPanel() {
    const detailsScreen = $(".game-details-screen");
    if (!detailsScreen) return;
    if ($("#detailsPanel")) return;

    const panel = document.createElement("div");
    panel.id = "detailsPanel";
    panel.style.cssText = `
      width: min(860px, 92%);
      margin: 18px auto 0;
      padding: 18px 18px;
      border-radius: 18px;
      border: 1px solid rgba(220,235,255,0.12);
      background: rgba(255,255,255,0.02);
      display: grid;
      grid-template-columns: 160px 1fr;
      gap: 16px;
      align-items: center;
    `;
    panel.innerHTML = `
      <div style="width:160px;height:160px;border-radius:16px;overflow:hidden;border:1px solid rgba(220,235,255,0.12);background:rgba(255,255,255,0.02);display:flex;align-items:center;justify-content:center;">
        <img id="detailsCover" alt="Cover" style="width:100%;height:100%;object-fit:cover;display:block;" />
      </div>
      <div style="display:grid;gap:10px;">
        <div style="display:flex;flex-wrap:wrap;gap:10px;">
          <span id="detailsGenre" style="opacity:.75;letter-spacing:.12em;text-transform:uppercase;font-size:11px;"></span>
          <span id="detailsSize" style="opacity:.75;letter-spacing:.12em;text-transform:uppercase;font-size:11px;"></span>
          <span id="detailsLastPlayed" style="opacity:.75;letter-spacing:.12em;text-transform:uppercase;font-size:11px;"></span>
          <span id="detailsInstall" style="opacity:.75;letter-spacing:.12em;text-transform:uppercase;font-size:11px;"></span>
        </div>
        <div id="detailsDesc" style="opacity:.7;letter-spacing:.04em;line-height:1.45;"></div>
      </div>
    `;

    const sub = $("#detailsSub");
    if (sub && sub.parentElement)
      sub.parentElement.insertBefore(panel, sub.nextSibling);
  }

  function openGameDetails(id) {
    state.gamesUI.selectedId = id;
    const g = getGameById(id);
    if (!g) return;

    if (detailsTitle) detailsTitle.textContent = g.title.toUpperCase();
    if (detailsSub)
      detailsSub.textContent = `${g.genre} • ${fmtSize(
        g.size
      )} • Last played: ${fmtLastPlayed(g.lastPlayed)}`;

    const cover = $("#detailsCover");
    if (cover) {
      if (g.cover) {
        cover.src = g.cover;
        cover.style.display = "block";
      } else {
        cover.removeAttribute("src");
        cover.style.display = "none";
      }
    }

    const genre = $("#detailsGenre");
    const size = $("#detailsSize");
    const last = $("#detailsLastPlayed");
    const inst = $("#detailsInstall");
    const desc = $("#detailsDesc");

    if (genre) genre.textContent = `GENRE: ${g.genre}`;
    if (size) size.textContent = `SIZE: ${fmtSize(g.size)}`;
    if (last) last.textContent = `LAST: ${fmtLastPlayed(g.lastPlayed)}`;
    if (inst)
      inst.textContent = `STATUS: ${
        g.installed ? "INSTALLED" : "NOT INSTALLED"
      }`;
    if (desc) desc.textContent = g.desc || "—";

    const uninstallBtn = ensureUninstallButton();
    if (uninstallBtn) {
      uninstallBtn.style.display = g.installed ? "inline-flex" : "none";
      uninstallBtn.onclick = () => {
        uiSound.ok();
        uninstallGame(id);
      };
    }

    playBtn?.onclick && (playBtn.onclick = null);
    optionsBtn?.onclick && (optionsBtn.onclick = null);

    playBtn?.addEventListener("click", () => onPlayPressed());
    optionsBtn?.addEventListener("click", () => {
      uiSound.ok();
      showLoading("Opening Options", g.title);
      setTimeout(
        () => {
          hideLoading();
          alert(`Options: ${g.title}`);
        },
        state.settings.reduceMotion ? 250 : 650
      );
    });

    setActiveScreen("game-details", { pushHistory: true });

    setTimeout(() => {
      playBtn?.focus?.();
      markFocused(playBtn);
    }, 0);
  }

  function installGame(id) {
    const g = getGameById(id);
    if (!g) return;
    g.installed = true;
    saveGamesState();
    renderGamesGrid();
    openGameDetails(id);
    showToast("Installed");
  }

  function uninstallGame(id) {
    const g = getGameById(id);
    if (!g) return;
    g.installed = false;
    saveGamesState();
    renderGamesGrid();
    openGameDetails(id);
    showToast("Uninstalled");
  }

  // -------------------- Quick Resume --------------------
  function addToQuickResume(id) {
    const exists = state.running.find((r) => r.id === id);
    const item = { id, startedAt: now() };
    if (exists) exists.startedAt = item.startedAt;
    else {
      state.running.unshift(item);
      state.running = state.running.slice(0, 3);
    }
    saveJson(STORAGE.quickResume, state.running);
  }

  function setRunningGame(id) {
    state.runningActiveId = id;
    addToQuickResume(id);
    renderHomeCards();
  }

  // -------------------- XP / Achievements --------------------
  function addXP(amount) {
    const a = clamp(Number(amount) || 0, 0, 999999);
    if (a <= 0) return;
    state.xp = clamp(state.xp + a, 0, 999999);
    saveNum(STORAGE.xp, state.xp);
  }

  function unlockAchievement(key, title) {
    if (state.achievements[key]) return;
    state.achievements[key] = true;
    saveJson(STORAGE.achievements, state.achievements);
    showToast(`Achievement: ${title}`);
  }

  function onPlayPressed() {
    const id = state.gamesUI.selectedId;
    const g = getGameById(id);
    if (!g) return;

    if (!g.installed) {
      uiSound.ok();
      showLoading("Installing", g.title);
      setTimeout(
        () => {
          hideLoading();
          installGame(id);
        },
        state.settings.reduceMotion ? 350 : 900
      );
      return;
    }

    uiSound.ok();
    showLoading("Launching", g.title);
    setTimeout(
      () => {
        hideLoading();

        g.lastPlayed = now();
        saveGamesState();

        setRunningGame(id);

        addXP(25);
        unlockAchievement("first_play", "First Launch");

        openInGame(id);
        applyGamesFilters();
      },
      state.settings.reduceMotion ? 250 : 850
    );
  }

  function openInGame(id) {
    const g = getGameById(id);
    if (!g) return;
    if (inGameTitle) inGameTitle.textContent = `IN GAME`;
    if (inGameSub) inGameSub.textContent = `${g.title} • Press Back to return`;
    setActiveScreen("in-game", { pushHistory: true });
  }

  function openNowPlaying() {
    const id = state.runningActiveId;
    const g = getGameById(id);
    if (!g) return;
    if (nowPlayingTitle) nowPlayingTitle.textContent = `NOW PLAYING`;
    if (nowPlayingSub)
      nowPlayingSub.textContent = `${g.title} • Running in Quick Resume`;
    setActiveScreen("now-playing", { pushHistory: true });
  }

  function quitRunningGame() {
    const id = state.runningActiveId;
    if (!id) return;
    const g = getGameById(id);

    state.runningActiveId = null;
    state.running = state.running.filter((r) => r.id !== id);
    saveJson(STORAGE.quickResume, state.running);

    if (g) showToast(`Quit: ${g.title}`);
    renderHomeCards();

    setActiveScreen("games", { pushHistory: true });
  }

  // -------------------- Home Cards --------------------
  function renderHomeCards() {
    const home = $(".home-screen");
    if (!home) return;

    const cards = $$(".context-card", home);
    if (!cards.length) return;

    const quick = cards[0];
    const recent = cards[1];
    const downloads = cards[2];
    const friends = cards[3];

    if (quick) {
      $(".context-value", quick).textContent = `${state.running.length} Games`;
      $(".context-sub", quick).textContent = state.running.length
        ? "Ready to resume"
        : "No running games";
    }

    const sorted = [...state.games].sort(
      (a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0)
    );
    const last = sorted.find((g) => g.lastPlayed);
    if (recent) {
      $(".context-value", recent).textContent = last ? last.title : "—";
      $(".context-sub", recent).textContent = last
        ? `Last: ${fmtLastPlayed(last.lastPlayed)}`
        : "No activity yet";
    }

    if (downloads) {
      $(".context-value", downloads).textContent = "1 Active";
      $(".context-sub", downloads).textContent = "45%";
    }

    if (friends) {
      $(".context-value", friends).textContent = "Online";
      $(".context-sub", friends).textContent = "2 friends available";
    }
  }

  function onEnterHome() {
    clearNavFocus();
    const home = $(".home-screen");
    const cards = home ? $$(".context-card", home) : [];
    if (cards.length) {
      setTimeout(() => {
        cards[0].focus();
        markFocused(cards[0]);
        setFocusContext("home", 0);
      }, 0);
    }
  }

  function bindHomeCards() {
    const home = $(".home-screen");
    if (!home) return;
    const cards = $$(".context-card", home);
    if (!cards.length) return;

    cards.forEach((c, idx) => {
      c.addEventListener("focus", () => {
        setFocusContext("home", idx);
        markFocused(c);
      });
      c.addEventListener("click", () => {
        uiSound.ok();
        // 0 Quick Resume
        if (idx === 0) {
          if (state.runningActiveId) openNowPlaying();
          else showToast("No running games");
          return;
        }
        // 1 Recent -> games
        if (idx === 1) {
          setActiveScreen("games", { pushHistory: true });
          return;
        }
        // 2 Downloads -> media placeholder
        if (idx === 2) {
          setActiveScreen("media", { pushHistory: true });
          return;
        }
        // 3 Friends -> system for now
        if (idx === 3) {
          setActiveScreen("system", { pushHistory: true });
          return;
        }
      });
    });
  }

  // -------------------- Media Placeholder Overlay --------------------
  let mediaOverlay = null;
  function ensureMediaOverlay() {
    if (mediaOverlay) return;
    const overlay = document.createElement("div");
    overlay.id = "mediaOverlay";
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9000;
      display: none; align-items: center; justify-content: center;
      background: rgba(5,6,7,0.72); backdrop-filter: blur(10px);
    `;
    overlay.innerHTML = `
      <div style="
        width:min(620px,92%); border-radius:22px; padding:26px 22px;
        border:1px solid rgba(220,235,255,0.16); background: rgba(255,255,255,0.03);
        box-shadow: 0 30px 60px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(220,235,255,0.04);
        text-align:center;
      ">
        <div id="mediaOverlayTitle" style="color:#b8dcff;font-size:26px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">
          MEDIA
        </div>
        <div id="mediaOverlaySub" style="margin-top:10px;opacity:.7;letter-spacing:.06em;">
          Coming soon.
        </div>
        <div style="margin-top:18px;display:flex;gap:12px;justify-content:center;">
          <button class="hero-btn primary" id="mediaOverlayOkBtn" type="button" style="min-width:220px;">OK</button>
        </div>
        <div style="margin-top:12px;opacity:.55;letter-spacing:.12em;font-size:11px;text-transform:uppercase;">
          Enter: OK • Esc: Close
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    mediaOverlay = overlay;

    $("#mediaOverlayOkBtn")?.addEventListener("click", () => {
      uiSound.ok();
      hideMediaOverlayIfOpen(true);
    });
  }

  function openMediaOverlay(title = "Media", sub = "Coming soon.") {
    ensureMediaOverlay();
    if (!mediaOverlay) return;
    $("#mediaOverlayTitle").textContent = String(title).toUpperCase();
    $("#mediaOverlaySub").textContent = sub;
    mediaOverlay.style.display = "flex";
    setTimeout(() => $("#mediaOverlayOkBtn")?.focus?.(), 0);
  }

  function hideMediaOverlayIfOpen(force = false) {
    if (!mediaOverlay) return false;
    if (mediaOverlay.style.display !== "flex" && !force) return false;
    mediaOverlay.style.display = "none";
    // restore focus to a safe place
    setTimeout(() => {
      if (state.currentScreen === "media") onEnterMedia();
      else syncNavUI();
    }, 0);
    return true;
  }

  function bindMediaCards() {
    const media = $(".media-screen");
    if (!media) return;
    const cards = $$(".media-card", media);
    cards.forEach((c, idx) => {
      c.addEventListener("focus", () => {
        setFocusContext("media", idx);
        markFocused(c);
      });
      c.addEventListener("click", () => {
        uiSound.ok();
        const name = c.dataset.media || "Media";
        openMediaOverlay(name, "Coming soon.");
      });
    });
  }

  // -------------------- Screen enter hooks --------------------
  function onEnterGames() {
    setTimeout(() => {
      // focus first game or restore last grid focus
      const cards = getGameCards();
      if (cards.length) {
        focusGameByIndex(state.gamesUI.lastGridFocus || 0);
      } else {
        // if empty, focus nav
        focusNavDomByName(state.currentTab);
      }
    }, 0);
  }

  function onEnterMedia() {
    const media = $(".media-screen");
    const cards = media ? $$(".media-card", media) : [];
    setTimeout(() => {
      if (cards.length) {
        cards[0].focus();
        markFocused(cards[0]);
        setFocusContext("media", 0);
      } else {
        focusNavDomByName(state.currentTab);
      }
    }, 0);
  }

  function onEnterSystem() {
    setTimeout(() => {
      const cards = systemGrid ? $$("[data-setting-card]", systemGrid) : [];
      if (cards.length) {
        cards[0].focus();
        markFocused(cards[0]);
        setFocusContext("system", 0);
      } else {
        focusNavDomByName(state.currentTab);
      }
    }, 0);
  }

  function onEnterNowPlaying() {
    setTimeout(() => {
      resumeBtn?.focus?.();
      markFocused(resumeBtn);
      setFocusContext("nowPlaying", 0);
    }, 0);
  }

  function onEnterInGame() {
    setTimeout(() => {
      openNowPlayingBtn?.focus?.();
      markFocused(openNowPlayingBtn);
      setFocusContext("inGame", 0);
    }, 0);
  }

  function onEnterDetails() {
    setTimeout(() => {
      playBtn?.focus?.();
      markFocused(playBtn);
      setFocusContext("details", 0);
    }, 0);
  }

  // -------------------- Power Menu + Sleep/Off --------------------
  let powerIndex = 0;

  function getPowerItems() {
    return powerOptions ? $$("[data-power]", powerOptions) : [];
  }

  function setPowerFocus(i) {
    const items = getPowerItems();
    if (!items.length) return;
    powerIndex = clamp(i, 0, items.length - 1);
    const el = items[powerIndex];
    items.forEach((x) => x.classList.remove("is-focused"));
    el.classList.add("is-focused");
    el.focus?.();
  }

  function openPowerMenu() {
    if (!powerOverlay) return;
    state.powerMenuOpen = true;
    setFocusContext("power", 0);
    powerOverlay.classList.add("is-active");
    powerOverlay.setAttribute("aria-hidden", "false");
    setTimeout(() => setPowerFocus(0), 0);
  }

  function closePowerMenu() {
    if (!powerOverlay) return;
    state.powerMenuOpen = false;
    powerOverlay.classList.remove("is-active");
    powerOverlay.setAttribute("aria-hidden", "true");
    // restore focus
    setTimeout(() => {
      if (state.currentScreen === "home") onEnterHome();
      else syncNavUI();
    }, 0);
  }

  function enterSleep() {
    if (!sleepOverlay) return;
    state.sleeping = true;
    state.powerMenuOpen = false;

    powerOverlay?.classList.remove("is-active");
    powerOverlay?.setAttribute("aria-hidden", "true");

    sleepOverlay.classList.add("is-active");
    sleepOverlay.setAttribute("aria-hidden", "false");

    uiSound.quit();
  }

  function wakeFromSleep() {
    if (!sleepOverlay) return;
    state.sleeping = false;

    sleepOverlay.classList.remove("is-active");
    sleepOverlay.setAttribute("aria-hidden", "true");

    uiSound.launch();

    setTimeout(() => {
      if (state.currentScreen === "home") onEnterHome();
      else syncNavUI();
    }, 0);
  }

  function powerOff() {
    if (!offOverlay) return;
    state.poweredOff = true;
    state.powerMenuOpen = false;

    powerOverlay?.classList.remove("is-active");
    powerOverlay?.setAttribute("aria-hidden", "true");

    offOverlay.classList.add("is-active");
    offOverlay.setAttribute("aria-hidden", "false");

    uiSound.quit();
  }

  function powerOn() {
    if (!offOverlay) return;
    state.poweredOff = false;

    offOverlay.classList.remove("is-active");
    offOverlay.setAttribute("aria-hidden", "true");

    uiSound.launch();
    setActiveScreen("home", { pushHistory: false });
    onEnterHome();
  }

  function selectPowerAction() {
    const items = getPowerItems();
    const item = items[powerIndex];
    const action = item?.dataset?.power;
    if (action === "sleep") enterSleep();
    else if (action === "restart") location.reload();
    else if (action === "off") powerOff();
  }

  // -------------------- Nav click binding --------------------
  function bindNavClicks() {
    navItems.forEach((n) => {
      n.addEventListener("click", () => {
        if (shouldBlockGlobalInput()) return;
        uiSound.ok();
        const screen = n.dataset.screen;
        if (screen) setActiveScreen(screen, { pushHistory: true });
      });
      n.addEventListener("focus", () => {
        if (state.currentScreen === "home") return; // home keeps nav unfocused
        setNavFocusByName(n.dataset.screen);
        markFocused(n);
        setFocusContext("nav", getNavOrder().indexOf(n.dataset.screen));
      });
    });
  }

  // -------------------- Details buttons bind (Now Playing/InGame) --------------------
  function bindNowPlayingButtons() {
    resumeBtn?.addEventListener("click", () => {
      uiSound.ok();
      // resume -> go back in-game
      if (state.runningActiveId) openInGame(state.runningActiveId);
      else showToast("Nothing running");
    });

    quitBtn?.addEventListener("click", () => {
      uiSound.ok();
      quitRunningGame();
    });
  }

  function bindInGameButtons() {
    openNowPlayingBtn?.addEventListener("click", () => {
      uiSound.ok();
      openNowPlaying();
    });

    quitFromGameBtn?.addEventListener("click", () => {
      uiSound.ok();
      quitRunningGame();
    });
  }

  // -------------------- Keyboard (Single unified handler) --------------------
  document.addEventListener("keydown", (e) => {
    // PowerOff: only P turns on
    if (state.poweredOff) {
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        powerOn();
      }
      return;
    }

    // Sleep: any key wakes
    if (state.sleeping) {
      e.preventDefault();
      wakeFromSleep();
      return;
    }

    // Boot: block input
    if (state.booting) return;

    // Power menu open: only handle inside it
    if (state.powerMenuOpen) {
      if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        e.preventDefault();
        uiSound.back();
        closePowerMenu();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        uiSound.move();
        setPowerFocus(powerIndex + 1);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        uiSound.move();
        setPowerFocus(powerIndex - 1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        uiSound.ok();
        selectPowerAction();
        return;
      }
      e.preventDefault();
      return;
    }

    // Global: P open power menu
    if (e.key === "p" || e.key === "P") {
      if (isTypingContext() && !isVolumeSliderFocused()) return;
      e.preventDefault();
      uiSound.ok();
      openPowerMenu();
      return;
    }

    // Back
    if (e.key === "Escape" || e.key === "Backspace") {
      if (isTypingContext() && !isVolumeSliderFocused()) return;
      e.preventDefault();
      goBack();
      return;
    }

    // M mute toggle / Shift+M open system on sound
    if (e.key === "m" || e.key === "M") {
      if (isTypingContext() && !isVolumeSliderFocused()) return;
      e.preventDefault();
      if (e.shiftKey) {
        uiSound.ok();
        openSystemOnSound();
      } else {
        toggleSound();
      }
      return;
    }

    // T toggle clock format
    if (e.key === "t" || e.key === "T") {
      if (isTypingContext() && !isVolumeSliderFocused()) return;
      e.preventDefault();
      uiSound.ok();
      toggleClockFormat();
      return;
    }

    // W / C header toggles
    if (e.key === "w" || e.key === "W") {
      if (isTypingContext() && !isVolumeSliderFocused()) return;
      e.preventDefault();
      uiSound.move();
      toggleWifi();
      return;
    }
    if (e.key === "c" || e.key === "C") {
      if (isTypingContext() && !isVolumeSliderFocused()) return;
      e.preventDefault();
      uiSound.move();
      toggleController();
      return;
    }

    // System: volume slider arrows
    if (
      document.activeElement === volumeSlider &&
      (e.key === "ArrowLeft" || e.key === "ArrowRight")
    ) {
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? 2 : -2;
      setVolume(state.settings.volume + delta);
      uiSound.move();
      return;
    }

    // NAV keyboard when nav-item focused
    const active = document.activeElement;
    if (active && active.classList?.contains("nav-item")) {
      if (isTypingContext() && !isVolumeSliderFocused()) return;

      const order = getNavOrder();
      const currentName = active.dataset.screen;
      let i = order.indexOf(currentName);
      if (i < 0) i = 0;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        uiSound.move();
        i = (i + 1) % order.length;
        focusNavDomByName(order[i]);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        uiSound.move();
        i = (i - 1 + order.length) % order.length;
        focusNavDomByName(order[i]);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        uiSound.ok();
        if (currentName) setActiveScreen(currentName, { pushHistory: true });
        return;
      }
    }

    // Games: L/R quick filter/sort while not typing search
    if (state.currentScreen === "games") {
      const si = $("#searchInput");
      if (document.activeElement === si) {
        // typing allowed
      } else {
        if (e.key === "l" || e.key === "L") {
          e.preventDefault();
          cycleFilter();
          return;
        }
        if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          cycleSort();
          return;
        }
      }

      // Enter on game card -> open details
      if (e.key === "Enter") {
        const onCard = document.activeElement?.classList?.contains("game-card");
        if (onCard) {
          e.preventDefault();
          uiSound.ok();
          const id = document.activeElement.dataset.id;
          if (id) openGameDetails(id);
          return;
        }
      }

      // Arrow navigation inside grid
      const cards = getGameCards();
      if (
        cards.length &&
        document.activeElement?.classList?.contains("game-card")
      ) {
        const grid = $("#gamesGrid");
        const style = grid ? getComputedStyle(grid) : null;
        const cols = style ? style.gridTemplateColumns.split(" ").length : 4;
        const idx = cards.indexOf(document.activeElement);

        if (e.key === "ArrowRight") {
          e.preventDefault();
          uiSound.move();
          focusGameByIndex(idx + 1);
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          uiSound.move();
          focusGameByIndex(idx - 1);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          uiSound.move();
          focusGameByIndex(idx + cols);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          uiSound.move();

          if (idx < cols) {
            // go to nav
            focusNavDomByName(state.currentTab);
            return;
          }
          focusGameByIndex(idx - cols);
          return;
        }
      }
    }

    // Details screen: left/right between Play/Options/Uninstall (if visible)
    if (state.currentScreen === "game-details") {
      const uninstallBtn = $("#uninstallBtn");
      const btns = [playBtn, optionsBtn, uninstallBtn].filter(
        (b) => b && b.style.display !== "none"
      );

      if (!btns.length) return;

      const a = document.activeElement;
      let i = btns.indexOf(a);
      if (i < 0) {
        btns[0].focus();
        markFocused(btns[0]);
        i = 0;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        uiSound.move();
        const ni = (i + 1) % btns.length;
        btns[ni].focus();
        markFocused(btns[ni]);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        uiSound.move();
        const ni = (i - 1 + btns.length) % btns.length;
        btns[ni].focus();
        markFocused(btns[ni]);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        uiSound.ok();
        a?.click?.();
        return;
      }
    }

    // Now playing screen: left/right between Resume/Quit
    if (state.currentScreen === "now-playing") {
      if (!resumeBtn || !quitBtn) return;
      const btns = [resumeBtn, quitBtn];
      const a = document.activeElement;
      let i = btns.indexOf(a);
      if (i < 0) {
        resumeBtn.focus();
        markFocused(resumeBtn);
        i = 0;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        uiSound.move();
        const ni = i === 0 ? 1 : 0;
        btns[ni].focus();
        markFocused(btns[ni]);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        uiSound.ok();
        document.activeElement?.click?.();
        return;
      }
    }

    // In-game screen: left/right between NowPlaying/Quit
    if (state.currentScreen === "in-game") {
      if (!openNowPlayingBtn || !quitFromGameBtn) return;
      const btns = [openNowPlayingBtn, quitFromGameBtn];
      const a = document.activeElement;
      let i = btns.indexOf(a);
      if (i < 0) {
        openNowPlayingBtn.focus();
        markFocused(openNowPlayingBtn);
        i = 0;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        uiSound.move();
        const ni = i === 0 ? 1 : 0;
        btns[ni].focus();
        markFocused(btns[ni]);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        uiSound.ok();
        document.activeElement?.click?.();
        return;
      }
    }

    // System screen: grid navigation (simple)
    if (state.currentScreen === "system" && systemGrid) {
      const cards = $$("[data-setting-card]", systemGrid);
      if (!cards.length) return;

      const a = document.activeElement;
      const idx = cards.indexOf(a);

      // if focus not on a card, force focus first
      if (idx < 0 && (e.key.startsWith("Arrow") || e.key === "Enter")) {
        e.preventDefault();
        cards[0].focus();
        markFocused(cards[0]);
        return;
      }

      // navigation (2 columns if CSS grid is 2col, else approximate)
      const style = getComputedStyle(systemGrid);
      const cols = style ? style.gridTemplateColumns.split(" ").length : 2;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        uiSound.move();
        const ni = clamp(idx + 1, 0, cards.length - 1);
        cards[ni].focus();
        markFocused(cards[ni]);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        uiSound.move();
        const ni = clamp(idx - 1, 0, cards.length - 1);
        cards[ni].focus();
        markFocused(cards[ni]);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        uiSound.move();
        const ni = clamp(idx + cols, 0, cards.length - 1);
        cards[ni].focus();
        markFocused(cards[ni]);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        uiSound.move();
        if (idx < cols) {
          focusNavDomByName(state.currentTab);
          return;
        }
        const ni = clamp(idx - cols, 0, cards.length - 1);
        cards[ni].focus();
        markFocused(cards[ni]);
        return;
      }
    }

    // Home screen: left/right between context cards
    if (state.currentScreen === "home") {
      const home = $(".home-screen");
      const cards = home ? $$(".context-card", home) : [];
      if (!cards.length) return;

      const a = document.activeElement;
      let idx = cards.indexOf(a);
      if (idx < 0) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        uiSound.move();
        idx = (idx + 1) % cards.length;
        cards[idx].focus();
        markFocused(cards[idx]);
        setFocusContext("home", idx);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        uiSound.move();
        idx = (idx - 1 + cards.length) % cards.length;
        cards[idx].focus();
        markFocused(cards[idx]);
        setFocusContext("home", idx);
        return;
      }
      if (e.key === "ArrowUp") {
        // home keeps nav unfocused; ignore
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        uiSound.ok();
        a.click();
        return;
      }
    }

    // Media screen: left/right between media cards
    if (state.currentScreen === "media") {
      const media = $(".media-screen");
      const cards = media ? $$(".media-card", media) : [];
      if (!cards.length) return;

      const a = document.activeElement;
      let idx = cards.indexOf(a);
      if (idx < 0) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        uiSound.move();
        idx = (idx + 1) % cards.length;
        cards[idx].focus();
        markFocused(cards[idx]);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        uiSound.move();
        idx = (idx - 1 + cards.length) % cards.length;
        cards[idx].focus();
        markFocused(cards[idx]);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        uiSound.move();
        focusNavDomByName(state.currentTab);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        uiSound.ok();
        a.click();
        return;
      }
    }

    // Media overlay: Enter closes
    if (mediaOverlay && mediaOverlay.style.display === "flex") {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        uiSound.ok();
        hideMediaOverlayIfOpen(true);
        return;
      }
    }
  });

  // -------------------- Init --------------------
  function init() {
    // initial UI apply
    applyWifiUI();
    applyControllerUI();
    bindHeaderToggleKeys();

    applyTheme();
    applyReduceMotion();
    applyHighContrast();
    applyClockUI();

    applySoundUI();
    applyVolumeUI();

    // load games and UI
    loadGamesState();
    injectGamesFiltersBar();
    injectDetailsPanel();
    renderGamesGrid();
    updateGamesFiltersUI();

    // binds
    bindNavClicks();
    bindBackButtons();
    bindHomeCards();
    bindMediaCards();
    bindSystemUI();
    bindNowPlayingButtons();
    bindInGameButtons();

    // set initial screen to home but boot will reveal
    setActiveScreen("home", { pushHistory: false });
    renderHomeCards();

    // run boot
    runBootSequence();
  }

  init();
})();
