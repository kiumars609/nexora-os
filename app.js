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

    // Treat only text-like inputs as typing contexts (so shortcuts still work on sliders).
    if (tag === "input") {
      const type = (a.getAttribute("type") || "").toLowerCase();
      const textLike = [
        "",
        "text",
        "search",
        "email",
        "password",
        "number",
        "tel",
        "url",
      ];
      return textLike.includes(type);
    }

    if (tag === "textarea" || tag === "select") return true;
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
  // Media overlay
  const mediaOverlay = $("#mediaOverlay");
  const mediaOverlayTitle = $("#mediaOverlayTitle");
  const mediaOverlayBody = $("#mediaOverlayBody");
  const mediaOpenBtn = $("#mediaOpenBtn");
  const mediaBackBtn = $("#mediaBackBtn");

  // Quick Resume overlay
  const quickResumeOverlay = $("#quickResumeOverlay");
  const qrList = $("#qrList");
  const qrCloseBtn = $("#qrCloseBtn");

  // Home Quick Resume card
  const quickResumeCard = $("#quickResumeCard");
  const quickResumeValue = $("#quickResumeValue");

  // Profile (System)
  const xpValueEl = $("#xpValue");
  const achValueEl = $("#achValue");
  const achLastValueEl = $("#achLastValue");

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

  const themeAuroraBtn = $("#themeAuroraBtn");
  const themeLavaBtn = $("#themeLavaBtn");
  const themeSakuraBtn = $("#themeSakuraBtn");
  const themeFrostBtn = $("#themeFrostBtn");

  // -------------------- Central State --------------------
  const state = {
    booting: true,
    powerMenuOpen: false,
    mediaOverlayOpen: false,
    quickResumeOpen: false,
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

  // -------------------- Background Music --------------------
  let bgmAudio = null;
  let bgmCtx = null;
  let bgmGain = null;
  let bgmPendingPlay = false;

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

  function initBGM() {
    if (bgmAudio) return;

    bgmAudio = new Audio("assets/audio/ambient.mp3");
    bgmAudio.loop = true;
    bgmAudio.preload = "auto";

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    bgmCtx = new Ctx();
    const src = bgmCtx.createMediaElementSource(bgmAudio);

    bgmGain = bgmCtx.createGain();
    bgmGain.gain.value = state.settings.soundEnabled
      ? (state.settings.volume / 100) * 0.25
      : 0;

    src.connect(bgmGain).connect(bgmCtx.destination);

    // resume after first user interaction
    document.addEventListener("click", () => bgmCtx.resume(), { once: true });
  }

  function playBGM() {
    if (!bgmAudio || !state.settings.soundEnabled) return;

    const p = bgmAudio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // Autoplay blocked -> wait for user gesture then retry
        bgmPendingPlay = true;
      });
    }
  }

  function unlockAudio() {
    // Resume contexts if suspended
    try {
      bgmCtx?.resume?.();
    } catch {}
    try {
      audioCtx?.resume?.();
    } catch {}

    // Retry pending bgm play
    if (bgmPendingPlay) {
      bgmPendingPlay = false;
      playBGM();
    }
  }

  function stopBGM() {
    if (bgmAudio) bgmAudio.pause();
  }

  function updateBGMVolume() {
    if (!bgmGain) return;
    bgmGain.gain.value = state.settings.soundEnabled
      ? (state.settings.volume / 100) * 0.25
      : 0;
  }

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

    updateBGMVolume();
    if (state.settings.soundEnabled) playBGM();
    else stopBGM();
  }

  function applyVolumeUI() {
    if (volumeSlider) volumeSlider.value = String(state.settings.volume);
    if (volumeValue) volumeValue.textContent = `${state.settings.volume}%`;
    saveNum(STORAGE.volume, state.settings.volume);
    updateBGMVolume();
  }

  function applyTheme() {
    document.body.classList.remove(
      "theme-dark",
      "theme-ice",
      "theme-neon",
      "theme-aurora",
      "theme-lava",
      "theme-sakura",
      "theme-frost"
    );
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
    themeAuroraBtn?.classList.toggle("primary", t === "aurora");
    themeLavaBtn?.classList.toggle("primary", t === "lava");
    themeSakuraBtn?.classList.toggle("primary", t === "sakura");
    themeFrostBtn?.classList.toggle("primary", t === "frost");
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
    updateProfileUI();
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
          initBGM();
          playBGM();
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

  // -------------------- Media Overlay --------------------
  const MEDIA_CONTENT = {
    music: {
      title: "Music",
      body: "A simple music hub. (Placeholder for now.)",
    },
    gallery: {
      title: "Gallery",
      body: "View screenshots / covers. (Placeholder for now.)",
    },
    streaming: {
      title: "Streaming",
      body: "Connect streaming apps. (Placeholder for now.)",
    },
    downloads: {
      title: "Downloads",
      body: "Manage downloaded media. (Placeholder for now.)",
    },
  };

  const focusSnapshot = { ctx: "home", index: 0 };

  function snapshotFocus() {
    focusSnapshot.ctx = state.focus.context;
    focusSnapshot.index = state.focus.index;
  }
  function restoreFocus() {
    setFocusContext(focusSnapshot.ctx);
    setFocusIndex(focusSnapshot.index);
    const items = getContextItems(focusSnapshot.ctx);
    focusEl(items[focusSnapshot.index]);
  }

  function openMediaOverlay(kind = "music") {
    if (!mediaOverlay) return;
    snapshotFocus();
    const meta = MEDIA_CONTENT[kind] || {
      title: "Media",
      body: "Coming soon…",
    };
    mediaOverlayTitle && (mediaOverlayTitle.textContent = meta.title);
    mediaOverlayBody && (mediaOverlayBody.textContent = meta.body);

    state.mediaOverlayOpen = true;
    mediaOverlay.classList.add("is-active");
    mediaOverlay.setAttribute("aria-hidden", "false");
    setFocusContext("mediaOverlay");
    setFocusIndex(0);
    focusEl(mediaOpenBtn || mediaBackBtn);
    uiSound.ok();
  }

  function closeMediaOverlay() {
    if (!mediaOverlay) return;
    state.mediaOverlayOpen = false;
    mediaOverlay.classList.remove("is-active");
    mediaOverlay.setAttribute("aria-hidden", "true");
    restoreFocus();
    uiSound.back();
  }

  // -------------------- Quick Resume --------------------
  function saveQuickResume() {
    saveJson(STORAGE.quickResume, state.quickResume);
    updateQuickResumeUI();
  }

  function updateQuickResume(gameId) {
    const ts = now();
    const existing = state.quickResume.find((g) => g.id === gameId);
    if (existing) existing.ts = ts;
    else state.quickResume.unshift({ id: gameId, ts });
    // keep max 5
    state.quickResume = state.quickResume
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .slice(0, 5);
    saveQuickResume();
  }

  function formatAgo(ts) {
    const diff = Math.max(0, Date.now() - ts);
    const min = Math.floor(diff / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  function updateQuickResumeUI() {
    // Home card number
    if (quickResumeValue) {
      const n = state.quickResume?.length || 0;
      quickResumeValue.textContent = n === 1 ? "1 Game" : `${n} Games`;
    }

    // System profile
    updateProfileUI();

    // overlay list (if open)
    if (state.quickResumeOpen) renderQuickResumeList();
  }

  function renderQuickResumeList() {
    if (!qrList) return;
    qrList.innerHTML = "";
    const items = state.quickResume || [];
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "qr-meta";
      empty.textContent = "No suspended games.";
      qrList.appendChild(empty);
      return;
    }
    items.forEach((it, idx) => {
      const game = state.games.find((g) => g.id === it.id);
      const row = document.createElement("button");
      row.type = "button";
      row.className = "qr-item";
      row.setAttribute("role", "option");
      row.setAttribute(
        "aria-selected",
        idx === state.focus.index ? "true" : "false"
      );
      row.innerHTML = `
        <div>
          <div>${game ? game.title : it.id}</div>
          <div class="qr-meta">${formatAgo(it.ts || Date.now())}</div>
        </div>
        <div class="qr-meta">Resume</div>
      `;
      row.addEventListener("click", () => resumeFromQuickResume(idx));
      qrList.appendChild(row);
    });
  }

  function openQuickResumeOverlay() {
    if (!quickResumeOverlay) return;
    snapshotFocus();
    state.quickResumeOpen = true;
    quickResumeOverlay.classList.add("is-active");
    quickResumeOverlay.setAttribute("aria-hidden", "false");
    setFocusContext("quickResume");
    setFocusIndex(0);
    renderQuickResumeList();
    // focus first item or close
    const first = qrList?.querySelector(".qr-item");
    focusEl(first || qrCloseBtn);
    uiSound.ok();
  }

  function closeQuickResumeOverlay() {
    if (!quickResumeOverlay) return;
    state.quickResumeOpen = false;
    quickResumeOverlay.classList.remove("is-active");
    quickResumeOverlay.setAttribute("aria-hidden", "true");
    restoreFocus();
    uiSound.back();
  }

  function resumeFromQuickResume(index) {
    const items = state.quickResume || [];
    const it = items[index];
    if (!it) return;
    const game = state.games.find((g) => g.id === it.id);
    if (!game) return;

    closeQuickResumeOverlay();

    // resume into in-game directly
    state.runningGameId = game.id;
    setActiveScreen("inGame", { pushHistory: true });
    updateInGameUI();
    showToast(`Resumed: ${game.title}`);
    uiSound.launch();
  }

  // -------------------- Achievements --------------------
  function saveAchievements() {
    saveJson(STORAGE.achievements, state.achievements);
    updateProfileUI();
  }

  function unlockAchievement(key, label) {
    if (!key) return;
    const exists = (state.achievements || []).some((a) => a.key === key);
    if (exists) return;

    const entry = { key, label, ts: now() };
    state.achievements = [entry, ...(state.achievements || [])].slice(0, 50);
    saveAchievements();
    showToast(`Achievement unlocked: ${label}`);
    uiSound.ok();
  }

  function updateProfileUI() {
    if (xpValueEl) xpValueEl.textContent = String(state.xp || 0);
    if (achValueEl)
      achValueEl.textContent = String((state.achievements || []).length);
    if (achLastValueEl) {
      const last = (state.achievements || [])[0];
      achLastValueEl.textContent = last?.label || "—";
    }
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

    // remove visual focus from anything else
    clearAllFocusClasses();
    el.classList.add("is-focused");

    // ensure focused element is keyboard-focusable
    if (
      !el.hasAttribute("tabindex") &&
      !(el instanceof HTMLInputElement) &&
      !(el instanceof HTMLTextAreaElement) &&
      !(el instanceof HTMLButtonElement) &&
      !(el instanceof HTMLSelectElement) &&
      !(el instanceof HTMLAnchorElement)
    ) {
      el.setAttribute("tabindex", "0");
    }

    // keep ARIA selection consistent (only one selected tab)
    if (el.classList.contains("nav-item")) {
      navItems.forEach((n) => n.setAttribute("aria-selected", "false"));
      el.setAttribute("aria-selected", "true");
    } else {
      // when focus leaves nav, ensure tabs remain "selected" based on active tab
      navItems.forEach((n) => {
        const isActive = n.classList.contains("active");
        n.setAttribute("aria-selected", isActive ? "true" : "false");
      });
    }
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

    if (ctx === "mediaOverlay") {
      return [mediaOpenBtn, mediaBackBtn].filter(Boolean);
    }

    if (ctx === "quickResume") {
      const items = qrList ? $$(".qr-item", qrList) : [];
      return [...items, qrCloseBtn].filter(Boolean);
    }

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

  // -------------------- Focus movement (Directional / Console-like) --------------------
  function moveFocusDir(direction) {
    const items = getContextItems();
    if (!items.length) return;

    // If nothing focused yet, focus first item.
    let currentEl = items[state.focus.index] || items[0];
    if (!currentEl) return;

    // Ensure current index matches currentEl
    let currentIdx = items.indexOf(currentEl);
    if (currentIdx < 0) currentIdx = 0;

    const cur = currentEl.getBoundingClientRect();

    let bestIdx = -1;
    let bestScore = Infinity;

    for (let i = 0; i < items.length; i++) {
      const el = items[i];
      if (!el || el === currentEl) continue;
      const r = el.getBoundingClientRect();

      const dx = r.left - cur.left;
      const dy = r.top - cur.top;

      // Filter candidates by direction
      if (
        (direction === "RIGHT" && dx <= 0) ||
        (direction === "LEFT" && dx >= 0) ||
        (direction === "DOWN" && dy <= 0) ||
        (direction === "UP" && dy >= 0)
      )
        continue;

      // Prefer closer in the intended axis; penalize cross-axis drift.
      let primary = 0,
        secondary = 0;
      if (direction === "RIGHT" || direction === "LEFT") {
        primary = Math.abs(dx);
        secondary = Math.abs(dy);
      } else {
        primary = Math.abs(dy);
        secondary = Math.abs(dx);
      }

      const score = primary * primary + secondary * secondary * 1.5;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      state.focus.index = bestIdx;
      const el = items[bestIdx];
      focusEl(el);

      // Keep games grid memory in sync
      if (state.focus.context === "games") {
        const cards = getGameCards();
        const cardIdx = cards.indexOf(el);
        if (cardIdx >= 0) state.gamesUI.lastGridFocus = cardIdx;
      }
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

  // -------------------- Covers (Internet) - migration safe --------------------
  const COVER_LIBRARY = {
    tlou2:
      "https://cdn.cloudflare.steamstatic.com/steam/apps/253131/capsule_616x353.jpg",
    gowr: "https://cdn.cloudflare.steamstatic.com/steam/apps/2322010/capsule_616x353.jpg",
    sm2: "https://cdn.cloudflare.steamstatic.com/steam/apps/2651280/capsule_616x353.jpg",
    horizon:
      "https://cdn.cloudflare.steamstatic.com/steam/apps/1151640/capsule_616x353.jpg",
    cyberpunk:
      "https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/capsule_616x353.jpg",
    eldenring:
      "https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/capsule_616x353.jpg",
    minecraft:
      "https://cdn.cloudflare.steamstatic.com/steam/apps/1672970/capsule_616x353.jpg",
    gtavi:
      "https://images.unsplash.com/photo-1520975958225-5a3b8c3f7f76?auto=format&fit=crop&w=1400&q=70",
  };

  // -------------------- Games Data --------------------
  function seedDefaultGames() {
    return [
      {
        id: "eldenring",
        title: "Elden Ring",
        genre: "Soulslike",
        installed: true,
        size: 52.9,
        lastPlayed: Date.now() - 1000 * 60 * 60 * 24 * 21,
        cover:
          "https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/capsule_616x353.jpg",
        desc: "Become the Elden Lord.",
      },
      {
        id: "cyberpunk",
        title: "Cyberpunk 2077",
        genre: "RPG",
        installed: false,
        size: 71.5,
        lastPlayed: null,
        cover:
          "https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/capsule_616x353.jpg",
        desc: "Night City never sleeps.",
      },
      {
        id: "horizon",
        title: "Horizon Zero Dawn",
        genre: "Action Adventure",
        installed: true,
        size: 54.2,
        lastPlayed: Date.now() - 1000 * 60 * 60 * 24 * 10,
        cover:
          "https://cdn.cloudflare.steamstatic.com/steam/apps/1151640/capsule_616x353.jpg",
        desc: "Machines. Mystery. Survival.",
      },

      // ---- Temporary internet art (replace later with local covers) ----
      {
        id: "tlou2",
        title: "The Last of Us Part II",
        genre: "Action",
        installed: true,
        size: 78.4,
        lastPlayed: Date.now() - 1000 * 60 * 60 * 24 * 2,
        cover:
          "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1400&q=70",
        desc: "Survive. Adapt. Endure.",
      },
      {
        id: "gtavi",
        title: "GTA VI",
        genre: "Open World",
        installed: false,
        size: 110.0,
        lastPlayed: null,
        cover:
          "https://images.unsplash.com/photo-1535223289827-42f1e9919769?auto=format&fit=crop&w=1400&q=70",
        desc: "Next generation open world crime saga.",
      },
      {
        id: "minecraft",
        title: "Minecraft",
        genre: "Sandbox",
        installed: true,
        size: 1.2,
        lastPlayed: Date.now() - 1000 * 60 * 60 * 24 * 1,
        cover:
          "https://images.unsplash.com/photo-1611996575749-79a3a250f948?auto=format&fit=crop&w=1400&q=70",
        desc: "Build. Mine. Survive. Create.",
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

  function migrateGameCoversIfNeeded() {
    if (!Array.isArray(state.games) || !state.games.length) return;

    let changed = false;

    state.games = state.games.map((g) => {
      const id = g?.id;
      let cover = (g?.cover || "").trim();

      const looksLocal =
        cover.startsWith("assets/") ||
        cover.startsWith("./") ||
        (cover.endsWith(".jpg") && !cover.startsWith("http"));

      const missing = !cover;

      if ((missing || looksLocal) && COVER_LIBRARY[id]) {
        cover = COVER_LIBRARY[id];
        changed = true;
        return { ...g, cover }; // ✅ درست
      }

      return g;
    });

    if (changed) {
      saveJson(STORAGE.games, state.games);
    }
  }

  function saveGamesState() {
    saveJson(STORAGE.games, state.games);
  }

  function getVisibleGames() {
    let list = [...state.games]; // ✅ درست

    if (state.gamesUI.filter === "installed") {
      list = list.filter((g) => !!g.installed);
    }

    const q = (state.gamesUI.search || "").trim().toLowerCase();
    if (q) list = list.filter((g) => g.title.toLowerCase().includes(q));

    if (state.gamesUI.sort === "az")
      list.sort((a, b) => a.title.localeCompare(b.title));
    else list.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));

    return list;
  }

  function applyCardCover(coverEl, url, cardEl) {
    cardEl?.classList.remove("cover-loaded");
    cardEl?.classList.remove("cover-failed");

    if (!url) {
      cardEl?.classList.add("cover-failed");
      return;
    }

    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      coverEl.style.backgroundImage = `url("${url}")`;
      cardEl?.classList.add("cover-loaded"); // ✅ جدید
      cardEl?.classList.remove("cover-failed");
    };
    img.onerror = () => {
      cardEl?.classList.add("cover-failed");
      cardEl?.classList.remove("cover-loaded");
      coverEl.style.backgroundImage = "";
    };
    img.src = url;
  }

  function renderGamesGrid() {
  if (!gamesGrid) return;

  const list = getVisibleGames();
  gamesGrid.innerHTML = "";

  list.forEach((g, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "game-card";
    btn.dataset.id = g.id;
    btn.setAttribute("aria-selected", "false");
    btn.title = `${g.title}${g.installed ? " (Installed)" : ""}`;

    const coverStyle = g.cover
      ? `background-image:url("${g.cover}")`
      : `background-image:
        radial-gradient(800px 420px at 20% 20%, rgba(124,195,255,0.22), transparent 60%),
        radial-gradient(700px 420px at 85% 25%, rgba(255,77,230,0.14), transparent 60%),
        radial-gradient(900px 520px at 55% 95%, rgba(169,255,107,0.10), transparent 65%),
        linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.35))`;

    btn.innerHTML = `
      <span class="gc-cover" aria-hidden="true" style="${coverStyle}"></span>

      <span class="gc-badge ${g.installed ? "is-installed" : "is-store"}">
        ${g.installed ? "INSTALLED" : "STORE"}
      </span>

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

    // کلیک روی کارت
    btn.addEventListener("click", () => openGameDetails(g.id));

    gamesGrid.appendChild(btn);
  });

  // فوکوس هم اگر داری
  // focusGamesGrid(state.gamesUI.lastGridFocus || 0);
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
        updateQuickResume(game.id);
        unlockAchievement(
          `FIRST_LAUNCH_${game.id}`,
          `First launch: ${game.title}`
        );

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
      stopBGM();
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
    playBGM();
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
    themeAuroraBtn?.addEventListener(
      "click",
      () => (uiSound.ok(), setTheme("aurora"))
    );
    themeLavaBtn?.addEventListener(
      "click",
      () => (uiSound.ok(), setTheme("lava"))
    );
    themeSakuraBtn?.addEventListener(
      "click",
      () => (uiSound.ok(), setTheme("sakura"))
    );
    themeFrostBtn?.addEventListener(
      "click",
      () => (uiSound.ok(), setTheme("frost"))
    );
  }

  // -------------------- Screen enter helpers --------------------
  function onEnterHome() {
    updateQuickResumeUI();
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

    // If Media overlay open => trap focus + controls
    if (state.mediaOverlayOpen) {
      if (e.key === "Tab") {
        e.preventDefault();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeMediaOverlay();
        return;
      }
      const items = getContextItems("mediaOverlay");
      if (!items.length) return;

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex(clamp(state.focus.index - 1, 0, items.length - 1));
        uiSound.move();
        focusEl(items[state.focus.index]);
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex(clamp(state.focus.index + 1, 0, items.length - 1));
        uiSound.move();
        focusEl(items[state.focus.index]);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (state.focus.index === 0) mediaOpenBtn?.click();
        else mediaBackBtn?.click();
        return;
      }
      return;
    }

    // If Quick Resume overlay open => trap focus + controls
    if (state.quickResumeOpen) {
      if (e.key === "Tab") {
        e.preventDefault();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeQuickResumeOverlay();
        return;
      }
      const items = getContextItems("quickResume");
      if (!items.length) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex(clamp(state.focus.index - 1, 0, items.length - 1));
        uiSound.move();
        focusEl(items[state.focus.index]);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex(clamp(state.focus.index + 1, 0, items.length - 1));
        uiSound.move();
        focusEl(items[state.focus.index]);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const idx = Math.min(
          state.focus.index,
          (state.quickResume?.length || 0) - 1
        );
        if ((state.quickResume?.length || 0) === 0) {
          closeQuickResumeOverlay();
        } else if (idx >= 0) {
          resumeFromQuickResume(idx);
        }
        return;
      }
      return;
    }

    // If power menu open => handle arrows/enter/esc
    if (state.powerMenuOpen) {
      if (e.key === "Tab") {
        e.preventDefault();
        return;
      }
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

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      uiSound.move();
      moveFocusDir("LEFT");
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      uiSound.move();
      moveFocusDir("RIGHT");
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      uiSound.move();
      moveFocusDir("UP");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      uiSound.move();
      moveFocusDir("DOWN");
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

  // -------------------- Media cards / overlays --------------------
  $$(".media-card").forEach((card) => {
    card.addEventListener("click", () => openMediaOverlay(card.dataset.media));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMediaOverlay(card.dataset.media);
      }
    });
  });

  mediaBackBtn?.addEventListener("click", () => closeMediaOverlay());
  mediaOpenBtn?.addEventListener("click", () => {
    showToast("Opening… (placeholder)");
    closeMediaOverlay();
  });

  // -------------------- Quick Resume --------------------
  quickResumeCard?.addEventListener("click", () => openQuickResumeOverlay());
  quickResumeCard?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openQuickResumeOverlay();
    }
  });

  qrCloseBtn?.addEventListener("click", () => closeQuickResumeOverlay());
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
    updateQuickResumeUI();
    updateProfileUI();
    migrateGameCoversIfNeeded();
    renderGamesGrid();

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
  ["pointerdown", "keydown", "touchstart", "mousedown"].forEach((evt) => {
    document.addEventListener(evt, unlockAudio, { passive: true });
  });
  init();
})();
(function initNexoraPS6BootFx() {
  const bootScreen = document.getElementById("bootScreen");
  if (!bootScreen) return;

  // Respect Reduce Motion
  const prefersReduced =
    document.body.classList.contains("reduce-motion") ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  // Ensure canvas exists (so you don't have to edit HTML)
  let canvas = document.getElementById("bootFx");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "bootFx";
    canvas.setAttribute("aria-hidden", "true");
    bootScreen.prepend(canvas);
  }

  // Canvas styling (PS-like full-screen layer)
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    zIndex: "0",
    pointerEvents: "none",
    opacity: "0.95",
  });

  // Put boot content above canvas
  const inner = bootScreen.querySelector(".boot-inner");
  if (inner) {
    inner.style.position = "relative";
    inner.style.zIndex = "2";
  }

  const ctx = canvas.getContext("2d", { alpha: true });

  const CFG = {
    ribbons: 4,
    ribbonWidth: 84,
    glowWidth: 10,
    // Nexora "PS6" palette (cool, premium)
    cA: [184, 220, 255], // ice blue
    cB: [120, 170, 255], // deep blue
    cC: [120, 255, 232], // teal hint
    bgFade: 0.1,
    speed: 1.0,

    glyphs: 26,
    glyphAlpha: 0.18,
  };

  let W = 1,
    H = 1,
    dpr = Math.min(2, window.devicePixelRatio || 1);
  let t = 0;

  function resize() {
    const r = bootScreen.getBoundingClientRect();
    W = Math.max(1, Math.floor(r.width));
    H = Math.max(1, Math.floor(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Gentle parallax
  let mx = 0.5,
    my = 0.5;
  const onMove = (e) => {
    const rect = bootScreen.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    mx = Math.min(1, Math.max(0, x / rect.width));
    my = Math.min(1, Math.max(0, y / rect.height));
  };
  bootScreen.addEventListener("mousemove", onMove, { passive: true });
  bootScreen.addEventListener("touchmove", onMove, { passive: true });

  const mix = (a, b, k) => a + (b - a) * k;
  const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;

  // Create ribbon "lanes" (PS5-ish swoosh but more futuristic)
  const ribbons = Array.from({ length: CFG.ribbons }, (_, i) => {
    const k = i / Math.max(1, CFG.ribbons - 1);
    return {
      k,
      phase: Math.random() * Math.PI * 2,
      drift: (Math.random() * 0.6 + 0.6) * (i % 2 ? 1 : -1),
      yK: 0.46 + i * 0.075,
      amp: 22 + i * 10,
      freq: 0.008 + i * 0.0022,
      width: CFG.ribbonWidth - i * 10,
    };
  });

  // PS button glyph particles (inspired, not copied)
  const glyphTypes = ["circle", "square", "triangle", "cross"];
  const glyphs = Array.from({ length: CFG.glyphs }, () => ({
    type: glyphTypes[(Math.random() * glyphTypes.length) | 0],
    x: Math.random(),
    y: Math.random(),
    s: Math.random() * 14 + 10,
    r: Math.random() * Math.PI * 2,
    vr: (Math.random() * 0.6 + 0.2) * (Math.random() < 0.5 ? -1 : 1),
    v: Math.random() * 0.18 + 0.05,
    drift: (Math.random() * 0.6 + 0.3) * (Math.random() < 0.5 ? -1 : 1),
  }));

  function drawGlyph(g, alpha) {
    const x = g.x * W;
    const y = g.y * H;
    const s = g.s;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(g.r);

    ctx.lineWidth = Math.max(1.2, s * 0.08);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "screen";

    // color drift between A/B/C
    const k = 0.5 + 0.5 * Math.sin(t * 0.01 + g.x * 6);
    const col = [
      Math.floor(mix(CFG.cA[0], CFG.cB[0], k)),
      Math.floor(mix(CFG.cA[1], CFG.cC[1], k * 0.7)),
      Math.floor(mix(CFG.cA[2], CFG.cC[2], k)),
    ];

    ctx.strokeStyle = rgba(col, alpha);

    ctx.beginPath();
    if (g.type === "circle") {
      ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
    } else if (g.type === "square") {
      const q = s * 0.36;
      ctx.rect(-q, -q, q * 2, q * 2);
    } else if (g.type === "triangle") {
      const q = s * 0.44;
      ctx.moveTo(0, -q);
      ctx.lineTo(q * 0.9, q * 0.8);
      ctx.lineTo(-q * 0.9, q * 0.8);
      ctx.closePath();
    } else {
      // cross
      const q = s * 0.38;
      ctx.moveTo(-q, -q);
      ctx.lineTo(q, q);
      ctx.moveTo(q, -q);
      ctx.lineTo(-q, q);
    }
    ctx.stroke();

    ctx.restore();
  }

  function drawRibbon(r) {
    const k = r.k;
    const col = [
      Math.floor(mix(CFG.cA[0], CFG.cB[0], k)),
      Math.floor(mix(CFG.cA[1], CFG.cB[1], k)),
      Math.floor(mix(CFG.cA[2], CFG.cC[2], 0.65 * (1 - k))),
    ];

    // subtle parallax
    const px = (mx - 0.5) * 34 * (0.5 + k);
    const py = (my - 0.5) * 26 * (0.5 + k);

    const baseY = H * r.yK;
    const width = r.width;

    ctx.save();
    ctx.translate(px, py);

    // Core path (smooth band)
    ctx.beginPath();
    const step = 14;
    for (let x = -60; x <= W + 60; x += step) {
      const n =
        Math.sin(x * r.freq + r.phase + t * 0.012 * r.drift) +
        0.55 * Math.sin(x * r.freq * 0.62 - r.phase + t * 0.008);
      const y = baseY + n * r.amp;
      if (x === -60) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    // thick glow band
    const grad = ctx.createLinearGradient(0, baseY - width, 0, baseY + width);
    grad.addColorStop(0, rgba(col, 0));
    grad.addColorStop(0.35, rgba(col, 0.06));
    grad.addColorStop(0.5, rgba(col, 0.095));
    grad.addColorStop(0.65, rgba(col, 0.06));
    grad.addColorStop(1, rgba(col, 0));

    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = grad;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    // razor highlight (PS console feel)
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = Math.max(1.2, width * 0.028);
    ctx.strokeStyle = rgba(col, 0.22);
    ctx.stroke();

    // micro spark along the ribbon (gives "new-gen" vibe)
    const sparkX = ((t * 6.5 + k * 240) % (W + 220)) - 110;
    const sparkN =
      Math.sin(sparkX * r.freq + r.phase + t * 0.012 * r.drift) +
      0.55 * Math.sin(sparkX * r.freq * 0.62 - r.phase + t * 0.008);
    const sparkY = baseY + sparkN * r.amp;
    ctx.beginPath();
    ctx.fillStyle = rgba(col, 0.18);
    ctx.arc(sparkX, sparkY, CFG.glowWidth, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function frame() {
    requestAnimationFrame(frame);

    // only render while boot is visible
    if (!bootScreen.classList.contains("is-active")) return;
    if (prefersReduced) return;

    t += CFG.speed;

    // Trail fade
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(5,6,7,${CFG.bgFade})`;
    ctx.fillRect(0, 0, W, H);

    // subtle vignette (draw as big radial gradient)
    const vg = ctx.createRadialGradient(
      W * 0.5,
      H * 0.55,
      20,
      W * 0.5,
      H * 0.55,
      Math.max(W, H) * 0.75
    );
    vg.addColorStop(0, "rgba(10,14,18,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // ribbons
    for (let i = 0; i < ribbons.length; i++) drawRibbon(ribbons[i]);

    // glyph particles
    for (const g of glyphs) {
      g.r += 0.0028 * g.vr;
      g.y -= g.v * 0.0022;
      g.x += Math.sin(t * 0.004 + g.y * 7) * 0.00015 * g.drift;

      if (g.y < -0.12) {
        g.y = 1.12;
        g.x = Math.random();
      }
      if (g.x < -0.12) g.x = 1.12;
      if (g.x > 1.12) g.x = -0.12;

      // fade by distance to center (keeps it premium, not "biology")
      const dx = g.x - 0.5;
      const dy = g.y - 0.55;
      const d = Math.hypot(dx, dy);
      const a = CFG.glyphAlpha * Math.max(0, 1 - d * 1.4);
      if (a > 0.01) drawGlyph(g, a);
    }
  }

  resize();

  // Start with clean frame
  ctx.fillStyle = "#050607";
  ctx.fillRect(0, 0, W, H);

  const ro = new ResizeObserver(resize);
  ro.observe(bootScreen);
  window.addEventListener("resize", resize);

  // Sync with boot fade-out
  const mo = new MutationObserver(() => {
    if (bootScreen.classList.contains("is-leaving")) {
      canvas.style.transition = "opacity 420ms ease-in";
      canvas.style.opacity = "0";
    } else {
      canvas.style.transition = "";
      canvas.style.opacity = prefersReduced ? "0" : "0.95";
    }
  });
  mo.observe(bootScreen, { attributes: true, attributeFilter: ["class"] });

  requestAnimationFrame(frame);
})();

/* --- Patch: Gamepad bridge (maps controller to existing keyboard handlers) --- */
(() => {
  const KEY = {
    UP: "ArrowUp",
    DOWN: "ArrowDown",
    LEFT: "ArrowLeft",
    RIGHT: "ArrowRight",
    SELECT: "Enter",
    BACK: "Escape",
    TAB_L: "[",
    TAB_R: "]",
    POWER: "p",
  };

  // Standard mapping for most controllers:
  // 12/13/14/15 = dpad up/down/left/right
  // 0 = A, 1 = B, 4 = LB, 5 = RB, 9 = Start
  const BTN = {
    A: 0,
    B: 1,
    LB: 4,
    RB: 5,
    START: 9,
    DU: 12,
    DD: 13,
    DL: 14,
    DR: 15,
  };

  let prev = new Map(); // gamepadIndex -> buttons pressed boolean[]

  const fireKey = (key) => {
    // Dispatch both keydown+keyup so existing logic that listens to keydown works,
    // and keyup-based behaviors (if any) won't get stuck.
    const down = new KeyboardEvent("keydown", { key, bubbles: true });
    const up = new KeyboardEvent("keyup", { key, bubbles: true });
    document.dispatchEvent(down);
    document.dispatchEvent(up);
  };

  const tick = () => {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const p = prev.get(gp.index) || [];
      const b = gp.buttons.map((x) => !!x.pressed);

      const edge = (i) => b[i] && !p[i];

      if (edge(BTN.DU)) fireKey(KEY.UP);
      if (edge(BTN.DD)) fireKey(KEY.DOWN);
      if (edge(BTN.DL)) fireKey(KEY.LEFT);
      if (edge(BTN.DR)) fireKey(KEY.RIGHT);

      if (edge(BTN.A)) fireKey(KEY.SELECT);
      if (edge(BTN.B)) fireKey(KEY.BACK);

      if (edge(BTN.LB)) fireKey(KEY.TAB_L);
      if (edge(BTN.RB)) fireKey(KEY.TAB_R);

      if (edge(BTN.START)) fireKey(KEY.POWER);

      prev.set(gp.index, b);
    }
    requestAnimationFrame(tick);
  };

  // Start loop once user interacts (some browsers require a gesture)
  window.addEventListener("gamepadconnected", () => {
    if (!window.__nexora_gp_loop_started) {
      window.__nexora_gp_loop_started = true;
      requestAnimationFrame(tick);
    }
  });

  // Also start when page loads (works in many browsers)
  window.addEventListener("load", () => {
    if (!window.__nexora_gp_loop_started) {
      window.__nexora_gp_loop_started = true;
      requestAnimationFrame(tick);
    }
  });
})();
const hero = document.getElementById("hero");
const gamesGrid = document.getElementById("gamesGrid");

if (gamesGrid && hero) {
  gamesGrid.addEventListener("click", (e) => {
    const card = e.target.closest(".game-card");
    if (!card) return;

    const cover = card.getAttribute("data-cover");
    if (!cover) return;

    document.documentElement.style.setProperty("--hero-bg", `url("${cover}")`);
  });
}
