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

  // -------------------- Audio (UI Sounds) --------------------
  let audioCtx = null;
  function ensureAudio() {
    if (!state.settings.soundEnabled) return null;
    if (!audioCtx)
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") {
      try {
        audioCtx.resume?.();
      } catch (_) {}
    }
    return audioCtx;
  }
  function beep({ freq = 600, dur = 0.045, type = "sine", vol = 0.06 } = {}) {
    const ctx = ensureAudio();
    if (!ctx) return;

    const volFactor = clamp(state.settings.volume, 0, 100) / 100;
    const finalVol = vol * volFactor;
    if (finalVol <= 0.0001) return;

    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(finalVol, t0 + 0.01);
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
    boot: () => beep({ freq: 260, dur: 0.09, vol: 0.08, type: "triangle" }),
  };

  // -------------------- State (Central) --------------------
  const state = {
    // OS runtime flags
    booting: true,
    powerMenuOpen: false,
    sleeping: false,
    poweredOff: false,

    // routing
    currentScreen: "home",
    historyStack: [],
    currentTab: "home", // active underline tab

    // focus manager (single source)
    focus: {
      context: "home", // home | nav | games | media | system | details | nowPlaying | inGame | power
      index: 0,
    },

    // header statuses
    wifiOn: loadBool(STORAGE.wifi, true),
    controllerOn: loadBool(STORAGE.controller, true),

    // settings
    settings: {
      soundEnabled: loadBool(STORAGE.sound, true),
      volume: clamp(loadNum(STORAGE.volume, 60), 0, 100),
      clock24: loadBool(STORAGE.clock24, false),
      reduceMotion: loadBool(STORAGE.reduceMotion, false),
      highContrast: loadBool(STORAGE.contrast, false),
      theme: loadJson(STORAGE.theme, "dark"), // dark | ice | neon
    },

    // games data + ui
    games: [],
    gamesUI: {
      filter: "all", // all | installed
      sort: "recent", // recent | az
      search: "",
      lastGridFocus: 0,
      selectedId: null,
    },

    // running / quick resume
    running: loadJson(STORAGE.quickResume, []), // [{id, startedAt}]
    runningActiveId: null,

    // xp/achievements
    xp: clamp(loadNum(STORAGE.xp, 0), 0, 999999),
    achievements: loadJson(STORAGE.achievements, {}), // { [key]: true }
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

  // -------------------- Inject UI (filters bar, theme card, details extra, media overlay, profile overlay) --------------------
  function injectGamesFilterBar() {
    const gamesScreen = $(".games-screen");
    if (!gamesScreen) return;

    if ($("#gamesFilters")) return;

    const bar = document.createElement("div");
    bar.id = "gamesFilters";
    bar.style.cssText = `
      width: 80%;
      margin: 0 auto 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    `;

    bar.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;">
        <button class="hero-btn" id="filterBtn" type="button" style="min-width:180px;">FILTER: <span id="filterValue">ALL</span></button>
        <button class="hero-btn" id="sortBtn" type="button" style="min-width:200px;">SORT: <span id="sortValue">RECENT</span></button>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <input id="searchInput" type="text" placeholder="Search..." aria-label="Search games"
          style="
            height: 46px; width: 260px; padding: 0 14px; border-radius: 999px;
            background: rgba(255,255,255,0.03); border: 1px solid rgba(220,235,255,0.14);
            color: rgba(230,237,245,0.9); outline: none; letter-spacing: 0.06em;
          "/>
        <button class="hero-btn primary" id="applyFiltersBtn" type="button" style="min-width:160px;">APPLY</button>
      </div>
    `;

    const titleEl = $(".games-title", gamesScreen);
    if (titleEl && titleEl.parentElement)
      titleEl.parentElement.insertBefore(bar, titleEl.nextSibling);

    // hint
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
      "L/R: toggle Filter/Sort • Enter: apply • Esc: clear search";
    bar.parentElement?.insertBefore(hint, bar.nextSibling);
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

    // put under subtitle
    const sub = $("#detailsSub");
    if (sub && sub.parentElement)
      sub.parentElement.insertBefore(
        panel,
        $(".details-actions", detailsScreen)
      );
  }

  function injectSystemThemeCard() {
    const sys = $(".system-screen");
    if (!sys) return;
    if ($("#themeCard")) return;

    const card = document.createElement("div");
    card.className = "setting-card";
    card.id = "themeCard";
    card.setAttribute("data-setting-card", "");
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="context-title">Theme</div>
      <div class="context-value" id="themeValue">Dark</div>
      <div class="details-actions" style="margin-top: 12px">
        <button class="hero-btn primary" id="themeDarkBtn" type="button">Dark</button>
        <button class="hero-btn" id="themeIceBtn" type="button">Ice</button>
        <button class="hero-btn" id="themeNeonBtn" type="button">Neon</button>
      </div>
    `;

    // replace the placeholder Theme card if exists (the "Coming soon" one)
    const placeholders = $$(".system-grid .context-card", sys);
    const themePlaceholder = placeholders.find(
      (c) =>
        $(".context-title", c)?.textContent?.trim()?.toLowerCase() === "theme"
    );
    if (themePlaceholder) {
      themePlaceholder.replaceWith(card);
    } else {
      systemGrid?.appendChild(card);
    }
  }

  function injectMediaOverlay() {
    if ($("#mediaOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "mediaOverlay";
    overlay.setAttribute("aria-hidden", "true");
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
          Coming soon...
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
  }

  // -------------------- Themes (CSS vars via body class) --------------------
  function applyTheme() {
    // You can style these classes in CSS if you want. JS handles switching.
    document.body.classList.remove("theme-dark", "theme-ice", "theme-neon");
    const t = state.settings.theme || "dark";
    document.body.classList.add(`theme-${t}`);
    saveJson(STORAGE.theme, t);

    const themeValue = $("#themeValue");
    if (themeValue) themeValue.textContent = t[0].toUpperCase() + t.slice(1);

    // buttons
    const darkBtn = $("#themeDarkBtn");
    const iceBtn = $("#themeIceBtn");
    const neonBtn = $("#themeNeonBtn");
    darkBtn?.classList.toggle("primary", t === "dark");
    iceBtn?.classList.toggle("primary", t === "ice");
    neonBtn?.classList.toggle("primary", t === "neon");
  }
  function setTheme(next) {
    state.settings.theme = next;
    applyTheme();
    showToast(`Theme: ${next.toUpperCase()}`);
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

  // -------------------- Clock --------------------
  function formatTime(d) {
    const h = d.getHours();
    const m = d.getMinutes();
    const mm = String(m).padStart(2, "0");
    if (state.settings.clock24) {
      return `${String(h).padStart(2, "0")}:${mm}`;
    }
    const hh = h % 12 || 12;
    const ampm = h >= 12 ? "PM" : "AM";
    return `${hh}:${mm} ${ampm}`;
  }

  function renderTime() {
    if (!timeEl) return;
    timeEl.textContent = formatTime(new Date());
  }

  let clockTimer = null;
  function startClock() {
    renderTime();
    clearInterval(clockTimer);
    clockTimer = setInterval(renderTime, 60 * 1000);
  }

  function applyClockUI() {
    if (clockFormatValue)
      clockFormatValue.textContent = state.settings.clock24 ? "24H" : "12H";
    clock12Btn?.classList.toggle("primary", !state.settings.clock24);
    clock24Btn?.classList.toggle("primary", !!state.settings.clock24);
  }
  function setClockFormat(use24) {
    state.settings.clock24 = !!use24;
    saveBool(STORAGE.clock24, state.settings.clock24);
    applyClockUI();
    renderTime();
    showToast(`Clock: ${state.settings.clock24 ? "24H" : "12H"}`);
  }
  function toggleClockFormat() {
    setClockFormat(!state.settings.clock24);
  }

  // -------------------- Sound setting --------------------
  function applySoundUI() {
    if (sndStatusEl) {
      sndStatusEl.textContent = `SND: ${
        state.settings.soundEnabled ? "ON" : "OFF"
      }`;
      sndStatusEl.classList.toggle("is-off", !state.settings.soundEnabled);
      sndStatusEl.setAttribute("title", `Toggle sound (M)`);
    }
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
  }

  // -------------------- Volume --------------------
  function applyVolumeUI() {
    if (volumeValue) volumeValue.textContent = String(state.settings.volume);
    if (volumeSlider) volumeSlider.value = String(state.settings.volume);
  }
  function setVolume(n) {
    state.settings.volume = clamp(Number(n) || 0, 0, 100);
    saveNum(STORAGE.volume, state.settings.volume);
    applyVolumeUI();
  }

  // -------------------- Wi-Fi / Controller --------------------
  function applyWifiUI() {
    if (!wifiEl) return;
    wifiEl.style.opacity = state.wifiOn ? "1" : "0.35";
    wifiEl.setAttribute("title", `Wi-Fi: ${state.wifiOn ? "ON" : "OFF"} (W)`);
  }
  function applyControllerUI() {
    if (!ctrlEl) return;
    ctrlEl.style.opacity = state.controllerOn ? "1" : "0.35";
    ctrlEl.setAttribute(
      "title",
      `Controller: ${state.controllerOn ? "Connected" : "Disconnected"} (C)`
    );
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

  // -------------------- Boot Sequence --------------------
  function runBootSequence() {
    state.booting = true;
    if (bootScreen) {
      bootScreen.classList.add("is-active");
      bootScreen.setAttribute("aria-hidden", "false");
    }

    uiSound.boot();

    const total = 100;
    let p = 0;

    const stepMs = state.settings.reduceMotion ? 10 : 18;

    const timer = setInterval(() => {
      p += Math.floor(Math.random() * 6) + 2;
      if (p > total) p = total;

      if (bootBarFill) bootBarFill.style.width = `${p}%`;
      if (bootPercent) bootPercent.textContent = `${p}%`;

      if (p >= total) {
        clearInterval(timer);
        setTimeout(
          () => {
            if (bootScreen) {
              bootScreen.classList.remove("is-active");
              bootScreen.setAttribute("aria-hidden", "true");
            }
            state.booting = false;
            // land on home
            setActiveScreen("home", { pushHistory: false });
            setFocusContext("home");
            focusFirstInContext();
          },
          state.settings.reduceMotion ? 50 : 260
        );
      }
    }, stepMs);
  }

  // -------------------- Loading Overlay --------------------
  function showLoading(title = "Launching", sub = "Please wait...") {
    if (!loadingOverlay) return;
    loadingTitle.textContent = title;
    loadingSub.textContent = sub;
    loadingOverlay.classList.add("is-active");
    loadingOverlay.setAttribute("aria-hidden", "false");
  }
  function hideLoading() {
    if (!loadingOverlay) return;
    loadingOverlay.classList.remove("is-active");
    loadingOverlay.setAttribute("aria-hidden", "true");
  }

  // -------------------- Routing / History --------------------
  function getScreenNameByEl(el) {
    if (!el) return "";
    if (el.classList.contains("home-screen")) return "home";
    if (el.classList.contains("games-screen")) return "games";
    if (el.classList.contains("media-screen")) return "media";
    if (el.classList.contains("system-screen")) return "system";
    if (el.classList.contains("game-details-screen")) return "game-details";
    if (el.classList.contains("now-playing-screen")) return "now-playing";
    if (el.classList.contains("in-game-screen")) return "in-game";
    return "";
  }

  function setActiveScreen(name, { pushHistory = true } = {}) {
    if (
      state.powerMenuOpen ||
      state.sleeping ||
      state.poweredOff ||
      state.booting
    )
      return;

    if (pushHistory && state.currentScreen && state.currentScreen !== name) {
      state.historyStack.push(state.currentScreen);
    }

    state.currentScreen = name;

    // switch screen DOM
    screens.forEach((s) => {
      const sn = getScreenNameByEl(s);
      s.classList.toggle("is-active", sn === name);
    });

    // set currentTab rule:
    // - home/games/media/system => tab = screen
    // - non-home (details/now-playing/in-game) => keep previous tab (usually games) but do NOT move underline away
    if (["home", "games", "media", "system"].includes(name)) {
      state.currentTab = name;
    }

    // update nav active underline
    navItems.forEach((it) => {
      const n = it.dataset.screen;
      it.classList.toggle("active", n === state.currentTab);
      it.setAttribute(
        "aria-selected",
        n === state.currentTab ? "true" : "false"
      );
    });

    // set focus context per screen
    if (name === "home") setFocusContext("home");
    else if (name === "games") setFocusContext("games");
    else if (name === "media") setFocusContext("media");
    else if (name === "system") setFocusContext("system");
    else if (name === "game-details") setFocusContext("details");
    else if (name === "now-playing") setFocusContext("nowPlaying");
    else if (name === "in-game") setFocusContext("inGame");

    // polish: on screen change, clear focused classes
    clearAllFocusClasses();

    // auto focus
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
      // if no history, go to current tab root
      setActiveScreen(state.currentTab || "home", { pushHistory: false });
      return;
    }
    setActiveScreen(prev, { pushHistory: false });
  }

  // -------------------- Focus Manager (Unified) --------------------
  function setFocusContext(ctx) {
    state.focus.context = ctx;
    state.focus.index = 0;

    // active tab focus rule:
    // Home: active focus uses home items (cards/hero)
    // Non-home screens: nav focus uses currentTab (underline stays)
    // Details/In-game: nav stays at currentTab but focus stays in page
  }

  function clearAllFocusClasses() {
    $$(".is-focused").forEach((el) => el.classList.remove("is-focused"));
  }

  function markFocused(el) {
    if (!el) return;
    clearAllFocusClasses();
    el.classList.add("is-focused");
  }

  function focusEl(el) {
    if (!el) return;
    try {
      el.focus?.();
    } catch (_) {}
    markFocused(el);
  }

  function isTypingContext() {
    const a = document.activeElement;
    if (!a) return false;
    const tag = (a.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return true;
    if (a.isContentEditable) return true;
    return false;
  }

  function getContextItems(ctx = state.focus.context) {
    if (ctx === "nav") return navItems;

    if (ctx === "home") {
      // hero buttons + home context cards
      const home = $(".home-screen");
      const heroBtns = $$(".hero-btn", home);
      const cards = $$(".context-card", home);
      return [...heroBtns, ...cards].filter(Boolean);
    }

    if (ctx === "games") {
      const g = $(".games-screen");
      const filterBtn = $("#filterBtn");
      const sortBtn = $("#sortBtn");
      const searchInput = $("#searchInput");
      const applyBtn = $("#applyFiltersBtn");
      const backBtn = $(".games-screen .back-btn");
      const cards = getGameCards();
      // order: back, filters, grid
      return [
        backBtn,
        filterBtn,
        sortBtn,
        searchInput,
        applyBtn,
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
      // also include slider
      const vs = $("#volumeSlider");
      return [backBtn, ...cards, vs].filter(Boolean);
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
      const opts = $$(".power-option", powerOptions || document);
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
        state.focus.index = 5 + idx; // because list includes back+filter+sort+search+apply = 5
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

    // remember games grid index if focusing on a card
    if (state.focus.context === "games") {
      const cards = getGameCards();
      const cardIdx = cards.indexOf(el);
      if (cardIdx >= 0) state.gamesUI.lastGridFocus = cardIdx;
    }
  }

  function focusNavDomByName(name) {
    const el = navItems.find((n) => n.dataset.screen === name);
    if (!el) return;
    setFocusContext("nav");
    state.focus.index = navItems.indexOf(el);
    focusEl(el);
  }

  function getNavOrder() {
    return navItems.map((n) => n.dataset.screen).filter(Boolean);
  }

  // -------------------- Header interactive keys --------------------
  function bindHeaderToggleKeys() {
    const onKey = (handler) => (e) => {
      if (
        state.powerMenuOpen ||
        state.sleeping ||
        state.poweredOff ||
        state.booting
      )
        return;
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      uiSound.move();
      handler();
    };

    wifiEl?.addEventListener("keydown", onKey(toggleWifi));
    ctrlEl?.addEventListener("keydown", onKey(toggleController));

    sndStatusEl?.addEventListener("keydown", (e) => {
      if (
        state.powerMenuOpen ||
        state.sleeping ||
        state.poweredOff ||
        state.booting
      )
        return;
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      uiSound.ok();
      toggleSound();
    });

    sndStatusEl?.addEventListener("click", () => {
      if (
        state.powerMenuOpen ||
        state.sleeping ||
        state.poweredOff ||
        state.booting
      )
        return;
      uiSound.ok();
      toggleSound();
    });

    wifiEl?.addEventListener("click", () => {
      if (
        state.powerMenuOpen ||
        state.sleeping ||
        state.poweredOff ||
        state.booting
      )
        return;
      uiSound.move();
      toggleWifi();
    });

    ctrlEl?.addEventListener("click", () => {
      if (
        state.powerMenuOpen ||
        state.sleeping ||
        state.poweredOff ||
        state.booting
      )
        return;
      uiSound.move();
      toggleController();
    });
  }

  // -------------------- Power Menu --------------------
  let powerIndex = 0;

  function setPowerFocus(i) {
    const opts = $$(".power-option", powerOptions || document);
    if (!opts.length) return;
    powerIndex = (i + opts.length) % opts.length;
    opts.forEach((o, idx) =>
      o.classList.toggle("is-focused", idx === powerIndex)
    );
    focusEl(opts[powerIndex]);
  }

  function openPowerMenu() {
    if (state.poweredOff || state.sleeping || state.booting) return;
    state.powerMenuOpen = true;
    if (powerOverlay) {
      powerOverlay.classList.add("is-active");
      powerOverlay.setAttribute("aria-hidden", "false");
    }
    setFocusContext("power");
    setPowerFocus(0);
  }

  function closePowerMenu() {
    state.powerMenuOpen = false;
    if (powerOverlay) {
      powerOverlay.classList.remove("is-active");
      powerOverlay.setAttribute("aria-hidden", "true");
    }
    // return to current screen context
    if (["home", "games", "media", "system"].includes(state.currentScreen)) {
      setFocusContext(state.currentScreen);
    } else if (state.currentScreen === "game-details")
      setFocusContext("details");
    else if (state.currentScreen === "now-playing")
      setFocusContext("nowPlaying");
    else if (state.currentScreen === "in-game") setFocusContext("inGame");
    focusFirstInContext();
  }

  function doSleep() {
    state.sleeping = true;
    closePowerMenu();
    if (sleepOverlay) {
      sleepOverlay.classList.add("is-active");
      sleepOverlay.setAttribute("aria-hidden", "false");
    }
  }
  function wakeFromSleep() {
    state.sleeping = false;
    if (sleepOverlay) {
      sleepOverlay.classList.remove("is-active");
      sleepOverlay.setAttribute("aria-hidden", "true");
    }
    // focus restore
    focusFirstInContext();
  }
  function doPowerOff() {
    state.poweredOff = true;
    closePowerMenu();
    if (offOverlay) {
      offOverlay.classList.add("is-active");
      offOverlay.setAttribute("aria-hidden", "false");
    }
  }
  function powerOn() {
    state.poweredOff = false;
    if (offOverlay) {
      offOverlay.classList.remove("is-active");
      offOverlay.setAttribute("aria-hidden", "true");
    }
    focusFirstInContext();
  }

  function selectPowerAction() {
    const opts = $$(".power-option", powerOptions || document);
    const el = opts[powerIndex];
    if (!el) return;
    const action = el.dataset.power;
    if (action === "sleep") doSleep();
    else if (action === "restart") location.reload();
    else if (action === "off") doPowerOff();
  }

  // -------------------- Games Data (Phase 5.1) --------------------
  function seedDefaultGames() {
    // You can later replace covers with real images; paths assumed under assets/images/covers/*
    return [
      {
        id: "tlou2",
        title: "The Last of Us Part II",
        genre: "Action",
        installed: true,
        size: 89.4,
        lastPlayed: now() - 1000 * 60 * 60 * 3,
        cover: "assets/images/covers/tlou2.jpg",
        desc: "Survive the aftermath in a brutal, emotional journey.",
      },
      {
        id: "gowr",
        title: "God of War Ragnarök",
        genre: "Action RPG",
        installed: true,
        size: 107.1,
        lastPlayed: now() - 1000 * 60 * 60 * 28,
        cover: "assets/images/covers/gowr.jpg",
        desc: "Fimbulwinter approaches. A father and son face destiny.",
      },
      {
        id: "sm2",
        title: "Spider-Man 2",
        genre: "Action",
        installed: true,
        size: 76.8,
        lastPlayed: now() - 1000 * 60 * 60 * 70,
        cover: "assets/images/covers/sm2.jpg",
        desc: "Two Spider-Men. One city. Bigger threats.",
      },
      {
        id: "horizon",
        title: "Horizon",
        genre: "Adventure",
        installed: false,
        size: 64.2,
        lastPlayed: 0,
        cover: "assets/images/covers/horizon.jpg",
        desc: "Explore a wild world ruled by machines.",
      },
      {
        id: "cyberpunk",
        title: "Cyberpunk",
        genre: "RPG",
        installed: false,
        size: 71.3,
        lastPlayed: 0,
        cover: "assets/images/covers/cyberpunk.jpg",
        desc: "Night City never sleeps. Neither do its legends.",
      },
      {
        id: "gtavi",
        title: "GTA VI",
        genre: "Open World",
        installed: false,
        size: 120.0,
        lastPlayed: 0,
        cover: "assets/images/covers/gtavi.jpg",
        desc: "Welcome back to chaos. Coming soon.",
      },
      {
        id: "elden",
        title: "Elden Ring",
        genre: "Soulslike",
        installed: true,
        size: 58.9,
        lastPlayed: now() - 1000 * 60 * 60 * 120,
        cover: "assets/images/covers/elden.jpg",
        desc: "Become Elden Lord in a shattered realm.",
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

    // filter
    if (state.gamesUI.filter === "installed")
      list = list.filter((g) => !!g.installed);

    // search
    const q = (state.gamesUI.search || "").trim().toLowerCase();
    if (q) list = list.filter((g) => g.title.toLowerCase().includes(q));

    // sort
    if (state.gamesUI.sort === "az") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      list.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    }

    return list;
  }

  function getGameCards() {
    return gamesGrid ? $$(".game-card", gamesGrid) : [];
  }

  function renderGamesGrid() {
    if (!gamesGrid) return;

    const list = getVisibleGames();
    gamesGrid.innerHTML = "";

    list.forEach((g) => {
      const btn = document.createElement("button");
      btn.className = "game-card";
      btn.type = "button";
      btn.dataset.id = g.id;
      btn.dataset.game = g.title; // compatibility
      btn.setAttribute(
        "aria-label",
        `${g.title}${g.installed ? " (Installed)" : ""}`
      );

      // subtle: installed marker
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

    // if empty
    if (!list.length) {
      const empty = document.createElement("div");
      empty.style.cssText =
        "grid-column:1/-1;opacity:.7;letter-spacing:.12em;text-transform:uppercase;text-align:center;padding:18px;";
      empty.textContent = "No games found";
      gamesGrid.appendChild(empty);
    }
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

  function openGameDetails(id) {
    state.gamesUI.selectedId = id;
    const g = getGameById(id);
    if (!g) return;

    // details content
    if (detailsTitle) detailsTitle.textContent = g.title.toUpperCase();
    if (detailsSub)
      detailsSub.textContent = `${g.genre} • ${fmtSize(
        g.size
      )} • Last played: ${fmtLastPlayed(g.lastPlayed)}`;

    // injected panel content
    const cover = $("#detailsCover");
    if (cover) {
      cover.src = g.cover || "";
      cover.onerror = () => {
        cover.removeAttribute("src");
        cover.style.display = "none";
      };
      cover.style.display = "block";
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

    // play button text
    if (playBtn) playBtn.textContent = g.installed ? "Play" : "Install";

    // uninstall visibility
    const uninstallBtn = ensureUninstallButton();
    if (uninstallBtn) {
      uninstallBtn.style.display = g.installed ? "inline-flex" : "none";
      uninstallBtn.onclick = () => {
        uiSound.ok();
        uninstallGame(g.id);
      };
    }

    setActiveScreen("game-details");
  }

  function installGame(id) {
    const g = getGameById(id);
    if (!g) return;
    if (g.installed) return;
    g.installed = true;
    saveGamesState();
    showToast("Installed");
    applyGamesFilters();
    openGameDetails(id);
  }

  function uninstallGame(id) {
    const g = getGameById(id);
    if (!g) return;
    g.installed = false;
    // also remove from running
    state.running = state.running.filter((r) => r.id !== id);
    saveJson(STORAGE.quickResume, state.running);
    saveGamesState();
    showToast("Uninstalled");
    applyGamesFilters();
    openGameDetails(id);
  }

  // -------------------- Play / Running / Quick Resume (Phase 8.2) --------------------
  function addToQuickResume(id) {
    const exists = state.running.find((r) => r.id === id);
    const item = { id, startedAt: now() };
    if (exists) {
      exists.startedAt = item.startedAt;
    } else {
      state.running.unshift(item);
      // keep max 3 running for vibe
      state.running = state.running.slice(0, 3);
    }
    saveJson(STORAGE.quickResume, state.running);
  }

  function setRunningGame(id) {
    state.runningActiveId = id;
    addToQuickResume(id);
    renderHomeCards();
  }

  // -------------------- XP / Achievements (Phase 8.1) --------------------
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

    // launch
    uiSound.ok();
    showLoading("Launching", g.title);
    setTimeout(
      () => {
        hideLoading();

        // update last played
        g.lastPlayed = now();
        saveGamesState();

        // running game
        setRunningGame(id);

        // xp + achievements
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
    setActiveScreen("in-game");
  }

  function openNowPlaying() {
    const id = state.runningActiveId;
    const g = getGameById(id);
    if (!g) return;
    if (nowPlayingTitle) nowPlayingTitle.textContent = `NOW PLAYING`;
    if (nowPlayingSub)
      nowPlayingSub.textContent = `${g.title} • Running in Quick Resume`;
    setActiveScreen("now-playing");
  }

  function quitRunningGame() {
    const id = state.runningActiveId;
    if (!id) return;
    const g = getGameById(id);
    state.runningActiveId = null;
    // remove only active from running list
    state.running = state.running.filter((r) => r.id !== id);
    saveJson(STORAGE.quickResume, state.running);

    if (g) showToast(`Quit: ${g.title}`);
    renderHomeCards();

    // return to games tab root
    setActiveScreen("games", { pushHistory: true });
  }

  // -------------------- Home Cards (Quick Resume / Recent / Downloads / Friends) --------------------
  function renderHomeCards() {
    const home = $(".home-screen");
    if (!home) return;

    const cards = $$(".context-card", home);
    if (!cards.length) return;

    // Based on your existing 4 cards order:
    // 0 Quick Resume, 1 Recent, 2 Downloads, 3 Friends
    const quick = cards[0];
    const recent = cards[1];
    const downloads = cards[2];
    const friends = cards[3];

    // quick resume
    if (quick) {
      $(".context-value", quick).textContent = `${state.running.length} Games`;
      $(".context-sub", quick).textContent = state.running.length
        ? "Ready to resume"
        : "No running games";
    }

    // recent
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

    // downloads (symbolic)
    if (downloads) {
      $(".context-value", downloads).textContent = "1 Active";
      $(".context-sub", downloads).textContent = "45%";
    }

    // friends (symbolic)
    if (friends) {
      $(".context-value", friends).textContent = "3 Online";
      $(".context-sub", friends).textContent = `XP: ${state.xp}`;
    }
  }

  // -------------------- Media Placeholder (Phase 6.1) --------------------
  function openMediaOverlay(title, sub) {
    const ov = $("#mediaOverlay");
    if (!ov) return;
    $("#mediaOverlayTitle").textContent = title;
    $("#mediaOverlaySub").textContent = sub || "Coming soon...";
    ov.style.display = "flex";
    ov.setAttribute("aria-hidden", "false");
    setFocusContext("mediaOverlay");
    // focus ok
    $("#mediaOverlayOkBtn")?.focus();
  }
  function closeMediaOverlay() {
    const ov = $("#mediaOverlay");
    if (!ov) return;
    ov.style.display = "none";
    ov.setAttribute("aria-hidden", "true");
    // restore media screen focus
    if (state.currentScreen === "media") {
      setFocusContext("media");
      focusFirstInContext();
    }
  }

  // -------------------- System UI sync --------------------
  function syncSystemUI() {
    applyClockUI();
    applySoundUI();
    applyVolumeUI();
    applyReduceMotion();
    applyHighContrast();
    applyTheme();
  }

  function openSystemOnSound() {
    setActiveScreen("system", { pushHistory: true });
    // focus sound card
    const cards = getContextItems("system");
    const soundCard =
      cards.find((el) => el && el.id === "systemSoundValue") || null;
    // better: find the setting-card that contains systemSoundValue
    const card = systemGrid
      ? $$(".setting-card,[data-setting-card]", systemGrid).find((c) =>
          $("#systemSoundValue", c)
        )
      : null;
    if (card) focusEl(card);
  }

  // -------------------- Click bindings (nav/back/buttons/system) --------------------
  function bindNavClick() {
    navItems.forEach((it) => {
      it.setAttribute("role", "button");
      it.setAttribute(
        "aria-selected",
        it.classList.contains("active") ? "true" : "false"
      );
      it.addEventListener("click", () => {
        if (
          state.powerMenuOpen ||
          state.sleeping ||
          state.poweredOff ||
          state.booting
        )
          return;
        uiSound.ok();
        const name = it.dataset.screen;
        if (name) setActiveScreen(name);
      });
      it.addEventListener("focus", () => markFocused(it));
    });
  }

  function bindBackButtons() {
    $$("[data-action='back']").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (
          state.powerMenuOpen ||
          state.sleeping ||
          state.poweredOff ||
          state.booting
        )
          return;
        uiSound.back();
        goBack();
      });
    });
  }

  function bindSystemControls() {
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

    // theme
    $("#themeDarkBtn")?.addEventListener("click", () => {
      uiSound.ok();
      setTheme("dark");
    });
    $("#themeIceBtn")?.addEventListener("click", () => {
      uiSound.ok();
      setTheme("ice");
    });
    $("#themeNeonBtn")?.addEventListener("click", () => {
      uiSound.ok();
      setTheme("neon");
    });
  }

  function bindGamesFilterControls() {
    const filterBtn = $("#filterBtn");
    const sortBtn = $("#sortBtn");
    const searchInput = $("#searchInput");
    const applyBtn = $("#applyFiltersBtn");

    filterBtn?.addEventListener("click", () => cycleFilter());
    sortBtn?.addEventListener("click", () => cycleSort());

    searchInput?.addEventListener("input", (e) => {
      state.gamesUI.search = e.target.value || "";
    });

    applyBtn?.addEventListener("click", () => {
      uiSound.ok();
      applyGamesFilters();
    });
  }

  function bindDetailsButtons() {
    playBtn?.addEventListener("click", () => onPlayPressed());

    optionsBtn?.addEventListener("click", () => {
      uiSound.ok();
      showToast("Options (coming soon)");
    });
  }

  function bindNowPlayingButtons() {
    resumeBtn?.addEventListener("click", () => {
      uiSound.ok();
      // go back to game
      if (state.runningActiveId) openInGame(state.runningActiveId);
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

  function bindMediaCards() {
    const cards = $$(".media-card");
    cards.forEach((c) => {
      c.addEventListener("click", () => {
        uiSound.ok();
        const t = c.dataset.media || "Media";
        openMediaOverlay(
          t.toUpperCase(),
          "This module is a placeholder right now."
        );
      });
      c.addEventListener("focus", () => markFocused(c));
    });

    $("#mediaOverlayOkBtn")?.addEventListener("click", () => {
      uiSound.ok();
      closeMediaOverlay();
    });
  }

  // -------------------- Keyboard (Global) --------------------
  function handleGlobalKeydown(e) {
    // Power off: only P can wake
    if (state.poweredOff) {
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        uiSound.ok();
        powerOn();
      }
      return;
    }

    // Sleep: any key wakes
    if (state.sleeping) {
      e.preventDefault();
      uiSound.ok();
      wakeFromSleep();
      return;
    }

    // Boot blocks
    if (state.booting) return;

    // Media overlay blocks (if open)
    const mediaOv = $("#mediaOverlay");
    const mediaOpen = mediaOv && mediaOv.style.display === "flex";
    if (mediaOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        uiSound.back();
        closeMediaOverlay();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        uiSound.ok();
        closeMediaOverlay();
        return;
      }
      e.preventDefault();
      return;
    }

    // Power menu has priority
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

    // Power menu open (P)
    if (e.key === "p" || e.key === "P") {
      e.preventDefault();
      uiSound.ok();
      openPowerMenu();
      return;
    }

    // Back (ESC / Backspace)
    if (e.key === "Escape" || e.key === "Backspace") {
      // typing context: allow escape to clear search first
      const si = $("#searchInput");
      if (document.activeElement === si && si && si.value) {
        e.preventDefault();
        uiSound.back();
        si.value = "";
        state.gamesUI.search = "";
        applyGamesFilters();
        return;
      }
      if (isTypingContext() && document.activeElement !== volumeSlider) return;

      e.preventDefault();
      uiSound.back();
      goBack();
      return;
    }

    // Mute toggle (M) + Shift+M
    if (e.key === "m" || e.key === "M") {
      if (isTypingContext() && document.activeElement !== volumeSlider) return;
      e.preventDefault();
      if (e.shiftKey) {
        uiSound.ok();
        openSystemOnSound();
        return;
      }
      toggleSound();
      return;
    }

    // T toggle clock (test)
    if (e.key === "t" || e.key === "T") {
      if (isTypingContext() && document.activeElement !== volumeSlider) return;
      e.preventDefault();
      uiSound.ok();
      toggleClockFormat();
      return;
    }

    // W / C header toggles
    if (e.key === "w" || e.key === "W") {
      if (isTypingContext() && document.activeElement !== volumeSlider) return;
      e.preventDefault();
      uiSound.move();
      toggleWifi();
      return;
    }
    if (e.key === "c" || e.key === "C") {
      if (isTypingContext() && document.activeElement !== volumeSlider) return;
      e.preventDefault();
      uiSound.move();
      toggleController();
      return;
    }

    // NAV keyboard when a nav-item focused
    const active = document.activeElement;
    if (active && active.classList?.contains("nav-item")) {
      if (isTypingContext() && document.activeElement !== volumeSlider) return;

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
        if (currentName) setActiveScreen(currentName);
        return;
      }
    }

    // Games: L/R filter/sort quick handling even if grid focused
    if (state.currentScreen === "games") {
      // if typing in search, ignore L/R toggles
      const si = $("#searchInput");
      if (document.activeElement === si) return;

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
      if (e.key === "Enter") {
        // if a game card is focused => open details
        const onCard = document.activeElement?.classList?.contains("game-card");
        if (onCard) {
          e.preventDefault();
          uiSound.ok();
          const id = document.activeElement.dataset.id;
          if (id) openGameDetails(id);
          return;
        }
      }
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

    // Global focus movement (context items) with arrows (console feel)
    if (isTypingContext() && document.activeElement !== volumeSlider) return;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      uiSound.move();
      moveFocus(+1);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      uiSound.move();
      moveFocus(-1);
      return;
    }

    // Enter on focused elements
    if (e.key === "Enter") {
      const el = document.activeElement;
      if (!el) return;
      // if it's a setting card => click primary button inside
      if (el.hasAttribute("data-setting-card")) {
        e.preventDefault();
        uiSound.ok();
        const primary = $(".hero-btn.primary", el) || $(".hero-btn", el);
        primary?.click?.();
        return;
      }
      // if it's a media card => click
      if (el.classList.contains("media-card")) {
        e.preventDefault();
        uiSound.ok();
        el.click();
        return;
      }
      // if it's a context-card on home
      if (
        el.classList.contains("context-card") &&
        state.currentScreen === "home"
      ) {
        e.preventDefault();
        uiSound.ok();
        // quick resume card opens in-game if any running
        const title = $(".context-title", el)
          ?.textContent?.trim()
          ?.toLowerCase();
        if (title === "quick resume") {
          const first = state.running[0];
          if (first) {
            state.runningActiveId = first.id;
            openInGame(first.id);
          } else {
            showToast("No running games");
          }
          return;
        }
        showToast("Coming soon");
        return;
      }
    }
  }

  // -------------------- Accessibility: nav roles --------------------
  function applyA11y() {
    navItems.forEach((it) => {
      it.setAttribute("role", "tab");
      it.setAttribute(
        "aria-selected",
        it.classList.contains("active") ? "true" : "false"
      );
    });
    // already have aria-live on statuses in HTML
  }

  // -------------------- Init --------------------
  function init() {
    // inject missing UIs
    injectGamesFilterBar();
    injectDetailsPanel();
    injectSystemThemeCard();
    injectMediaOverlay();

    // load data
    loadGamesState();

    // apply settings to UI
    syncSystemUI();
    applyWifiUI();
    applyControllerUI();

    // clock
    startClock();

    // render game library
    updateGamesFiltersUI();
    renderGamesGrid();
    renderHomeCards();

    // binds
    bindNavClick();
    bindBackButtons();
    bindHeaderToggleKeys();

    bindSystemControls();
    bindGamesFilterControls();
    bindDetailsButtons();
    bindNowPlayingButtons();
    bindInGameButtons();
    bindMediaCards();

    // power option click
    $$(".power-option", powerOptions || document).forEach((btn, idx) => {
      btn.addEventListener("click", () => {
        powerIndex = idx;
        uiSound.ok();
        selectPowerAction();
      });
      btn.addEventListener("focus", () => {
        powerIndex = idx;
        setPowerFocus(powerIndex);
      });
    });

    // global keyboard
    document.addEventListener("keydown", handleGlobalKeydown);

    // search input: stop arrow keys from moving focus while typing
    $("#searchInput")?.addEventListener("keydown", (e) => {
      // allow Enter to apply
      if (e.key === "Enter") {
        e.preventDefault();
        uiSound.ok();
        applyGamesFilters();
      }
      // Esc clears via global handler
      e.stopPropagation();
    });

    // apply a11y
    applyA11y();

    // open games details by clicking old static html cards (compat)
    // (after renderGamesGrid, these are new buttons with data-id)
    // But keep safe if HTML still had static content before render.
    gamesGrid?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.(".game-card");
      if (!btn) return;
      const id = btn.dataset.id;
      if (id) return; // handled by button listener
    });

    // actions
    playBtn && (playBtn.onclick = onPlayPressed);
    openNowPlayingBtn &&
      (openNowPlayingBtn.onclick = () => (uiSound.ok(), openNowPlaying()));

    // finally boot
    runBootSequence();
  }

  init();
})();
