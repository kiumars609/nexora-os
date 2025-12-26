/* =========================
   Nexora OS - app.js (FULL FIXED v2)
   - Wi-Fi/Controller click + keyboard focus works
   - Toast visible feedback
   - Global nav + Home/Games/Media/System focus logic preserved
   ========================= */

(() => {
  // -------------------- DOM --------------------
  const screens = document.querySelectorAll(".screen");
  const navItems = document.querySelectorAll(".nav-item");

  // -------------------- History --------------------
  let currentScreen = "home";
  const historyStack = [];

  let blockGameOpenUntil = 0;
  let lastGamesFocusIndex = 0;
  let runningGame = null;

  // currentTab = active underline tab (HOME/GAMES/MEDIA/SYSTEM)
  let currentTab = "home";

  let toastTimer = null;

  function showToast(msg = "OK") {
    const el = document.getElementById("toast");
    if (!el) return;

    el.textContent = msg;
    el.classList.add("is-show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-show"), 1000);
  }

  // ==================== SETTINGS ====================
  const SETTINGS = {
    soundKey: "nexora_sound_enabled", // "1" | "0"
    clockKey: "nexora_use24h", // "1" | "0"
    wifiKey: "nexora_wifi_on", // "1" | "0"
    controllerKey: "nexora_controller_on", // "1" | "0"
  };

  function loadBool(key, defaultValue) {
    try {
      const v = localStorage.getItem(key);
      if (v === "1") return true;
      if (v === "0") return false;
      return defaultValue;
    } catch (_) {
      return defaultValue;
    }
  }

  function saveBool(key, value) {
    try {
      localStorage.setItem(key, value ? "1" : "0");
    } catch (_) {}
  }

  // ==================== NAV helpers ====================
  let navFocusIndex = 0;

  function getNavOrder() {
    return Array.from(navItems)
      .map((el) => el.dataset.screen)
      .filter(Boolean);
  }

  function getCurrentTabIndex() {
    const order = getNavOrder();
    const i = order.indexOf(currentTab);
    return i >= 0 ? i : 0;
  }

  function setNavActiveByName(name) {
    const target = document.querySelector(`.nav-item[data-screen="${name}"]`);
    if (!target) return;
    navItems.forEach((i) => i.classList.remove("active"));
    target.classList.add("active");
  }

  function setNavFocusByName(name) {
    navItems.forEach((i) => i.classList.remove("is-focused"));
    document
      .querySelector(`.nav-item[data-screen="${name}"]`)
      ?.classList.add("is-focused");
  }

  function clearNavFocus() {
    navItems.forEach((i) => i.classList.remove("is-focused"));
  }

  function focusNavDomByName(name) {
    const el = document.querySelector(`.nav-item[data-screen="${name}"]`);
    if (!el) return;
    setNavFocusByName(name);
    el.focus?.();
  }

  function syncNavUI() {
    const order = getNavOrder();
    setNavActiveByName(currentTab);

    if (currentScreen !== "home") {
      const i = order.indexOf(currentTab);
      navFocusIndex = i >= 0 ? i : 0;
      setNavFocusByName(order[navFocusIndex] || currentTab);
    } else {
      clearNavFocus();
    }
  }

  // ==================== Header status: WiFi / Controller ====================
  let wifiOn = loadBool(SETTINGS.wifiKey, true);
  let controllerOn = loadBool(SETTINGS.controllerKey, true);

  function syncWifiUI() {
    const el = document.getElementById("wifiStatus");
    if (!el) return;
    el.classList.toggle("is-off", !wifiOn);
    el.title = `Wi-Fi: ${wifiOn ? "ON" : "OFF"} (W)`;
  }

  function syncControllerUI() {
    const el = document.getElementById("controllerStatus");
    if (!el) return;
    el.classList.toggle("is-off", !controllerOn);
    el.title = `Controller: ${
      controllerOn ? "Connected" : "Disconnected"
    } (C)`;
  }

  function toggleWifi() {
    wifiOn = !wifiOn;
    saveBool(SETTINGS.wifiKey, wifiOn);
    syncWifiUI();
    showToast(`Wi-Fi: ${wifiOn ? "ON" : "OFF"}`);
  }

  function toggleController() {
    controllerOn = !controllerOn;
    saveBool(SETTINGS.controllerKey, controllerOn);
    syncControllerUI();
    showToast(
      `Controller: ${controllerOn ? "Connected" : "Disconnected"}`
    );
  }

  // ==================== Clock ====================
  let use24h = loadBool(SETTINGS.clockKey, false);

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatTime(date) {
    const h = date.getHours();
    const m = date.getMinutes();

    if (use24h) return `${pad2(h)}:${pad2(m)}`;

    const hour12 = h % 12 || 12;
    const ampm = h < 12 ? "AM" : "PM";
    return `${hour12}:${pad2(m)} ${ampm}`;
  }

  let clockInterval = null;

  function renderClock() {
    const el = document.getElementById("timeEl");
    if (!el) return;
    el.textContent = formatTime(new Date());
  }

  function startClock() {
    renderClock();
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(renderClock, 60 * 1000);
  }

  function setClockFormat(nextUse24h) {
    use24h = !!nextUse24h;
    saveBool(SETTINGS.clockKey, use24h);
    renderClock();
    syncSystemUI();
    showToast(`Clock: ${use24h ? "24H" : "12H"}`);
  }

  function toggleClockFormat() {
    setClockFormat(!use24h);
  }

  // ==================== UI Sounds (WebAudio) ====================
  let audioCtx = null;
  let soundEnabled = loadBool(SETTINGS.soundKey, true);
  let sndStatusEl = null;

  function ensureAudio() {
    if (!soundEnabled) return null;

    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioCtx.state === "suspended") {
      try {
        audioCtx.resume?.();
      } catch (_) {}
    }

    return audioCtx;
  }

  function beep({ freq = 600, dur = 0.04, type = "sine", vol = 0.06 } = {}) {
    const ctx = ensureAudio();
    if (!ctx) return;

    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  const uiSound = {
    move() {
      beep({ freq: 520, dur: 0.03, type: "triangle", vol: 0.05 });
    },
    ok() {
      beep({ freq: 760, dur: 0.05, type: "sine", vol: 0.06 });
    },
    back() {
      beep({ freq: 320, dur: 0.05, type: "sine", vol: 0.06 });
    },
  };

  function chord(freqs = [520, 760], dur = 0.06, gap = 0.015) {
    const ctx = ensureAudio();
    if (!ctx) return;
    freqs.forEach((f, idx) => {
      setTimeout(() => {
        beep({ freq: f, dur, type: "triangle", vol: 0.05 });
      }, idx * (dur * 1000 + gap * 1000));
    });
  }

  uiSound.launch = () => chord([520, 660, 820], 0.05, 0.01);
  uiSound.quit = () => chord([420, 320], 0.06, 0.02);
  uiSound.overlay = () =>
    beep({ freq: 640, dur: 0.03, type: "sine", vol: 0.04 });

  function syncSoundUI() {
    if (!sndStatusEl) return;
    sndStatusEl.textContent = `SND: ${soundEnabled ? "ON" : "OFF"}`;
    sndStatusEl.classList.toggle("is-off", !soundEnabled);
  }

  function setSoundEnabled(next) {
    soundEnabled = !!next;
    saveBool(SETTINGS.soundKey, soundEnabled);

    if (!soundEnabled && audioCtx && audioCtx.state !== "closed") {
      try {
        audioCtx.suspend?.();
      } catch (_) {}
    }

    if (soundEnabled) {
      ensureAudio();
      setTimeout(() => uiSound.ok(), 0);
    }

    syncSoundUI();
    syncSystemUI();
    showToast(`Sound: ${soundEnabled ? "ON" : "OFF"}`);
  }

  function toggleSound() {
    setSoundEnabled(!soundEnabled);
  }

  // -------------------- Overlay --------------------
  function showOverlay(title = "Launching", sub = "Please wait...") {
    const overlay = document.getElementById("loadingOverlay");
    const titleEl = document.getElementById("loadingTitle");
    const subEl = document.getElementById("loadingSub");

    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = sub;

    overlay?.classList.add("is-active");
    overlay?.setAttribute("aria-hidden", "false");

    uiSound.overlay();
  }

  function hideOverlay() {
    const overlay = document.getElementById("loadingOverlay");
    overlay?.classList.remove("is-active");
    overlay?.setAttribute("aria-hidden", "true");
  }

  // -------------------- Screen switching --------------------
  function setActiveScreen(name, options = { pushHistory: true }) {
    if (!name) return;

    if (options.pushHistory && name !== currentScreen) {
      historyStack.push(currentScreen);
    }

    currentScreen = name;

    // ✅ هر صفحه‌ای که جزو nav هست، active-tab هم همون بشه
    if (getNavOrder().includes(name)) currentTab = name;

    screens.forEach((s) => s.classList.remove("is-active"));
    document.querySelector(`.${name}-screen`)?.classList.add("is-active");

    syncNavUI();

    if (name === "games") {
      blockGameOpenUntil = performance.now() + 150;
      setTimeout(() => focusGameByIndex(lastGamesFocusIndex), 0);
    } else {
      if (name !== "game-details") {
        clearGameFocus();
        lastGamesFocusIndex = 0;
      }
    }

    if (name === "home") onEnterHome();
    if (name === "media") onEnterMedia();
    if (name === "system") onEnterSystem();
  }

  function goBack() {
    const prev = historyStack.pop();
    if (!prev) return;
    setActiveScreen(prev, { pushHistory: false });
  }

  // -------------------- Games Grid helpers --------------------
  function getGameCards() {
    return Array.from(document.querySelectorAll(".games-screen .game-card"));
  }

  function clearGameFocus() {
    getGameCards().forEach((c) => c.classList.remove("is-focused"));
    const grid = document.getElementById("gamesGrid");
    if (grid) grid.dataset.focusIndex = "0";
  }

  function focusGameByIndex(index) {
    const cards = getGameCards();
    if (!cards.length) return;

    const i = Math.max(0, Math.min(index, cards.length - 1));
    lastGamesFocusIndex = i;

    cards.forEach((c) => c.classList.remove("is-focused"));
    cards[i].classList.add("is-focused");
    cards[i].focus();

    const grid = document.getElementById("gamesGrid");
    if (grid) grid.dataset.focusIndex = String(i);
  }

  function getFocusedGameIndex() {
    const grid = document.getElementById("gamesGrid");
    if (!grid) return 0;
    const v = parseInt(grid.dataset.focusIndex || "0", 10);
    return Number.isFinite(v) ? v : 0;
  }

  function openGameFromElement(el) {
    const gameName = el?.dataset?.game || el?.textContent?.trim() || "Game";

    const titleEl = document.getElementById("detailsTitle");
    const subEl = document.getElementById("detailsSub");

    if (titleEl) titleEl.textContent = gameName;
    if (subEl) subEl.textContent = "Press Play to start, or Back to return.";

    setActiveScreen("game-details");
    setTimeout(() => document.getElementById("playBtn")?.focus(), 0);
  }

  // -------------------- Launch flow --------------------
  function launchGameFlow() {
    const gameName =
      document.getElementById("detailsTitle")?.textContent?.trim() || "Game";
    runningGame = gameName;

    const npTitle = document.getElementById("nowPlayingTitle");
    const npSub = document.getElementById("nowPlayingSub");
    if (npTitle) npTitle.textContent = gameName;
    if (npSub) npSub.textContent = "Running... Resume to continue.";

    const igTitle = document.getElementById("inGameTitle");
    const igSub = document.getElementById("inGameSub");
    if (igTitle) igTitle.textContent = gameName;
    if (igSub) igSub.textContent = "You are in-game. Open Now Playing anytime.";

    showOverlay("Launching", gameName);
    uiSound.launch();

    setTimeout(() => {
      hideOverlay();
      setActiveScreen("in-game");
      setTimeout(
        () => document.getElementById("openNowPlayingBtn")?.focus(),
        0
      );
    }, 900);
  }

  // ==================== Home Focus Engine ====================
  // global nav: 0 nav | 1 hero | 2 cards
  let homeZone = 1;
  let heroIndex = 0;
  let homeNavIndex = 0;
  let cardIndex = 0;

  function qsAll(sel) {
    return Array.from(document.querySelectorAll(sel));
  }
  function getHomeHeroButtons() {
    return qsAll(".home-screen .hero-btn");
  }
  function getHomeNavItems() {
    return qsAll(".nav .nav-item");
  }
  function getHomeCards() {
    return qsAll(".home-screen .context-card");
  }
  function clearHomeCardFocus() {
    getHomeCards().forEach((c) => c.classList.remove("is-focused"));
  }

  function focusHomeHero(i = 0) {
    const btns = getHomeHeroButtons();
    if (!btns.length) return;
    heroIndex = Math.max(0, Math.min(i, btns.length - 1));
    btns[heroIndex].focus();
  }

  function focusHomeNav(i = 0) {
    const items = getHomeNavItems();
    if (!items.length) return;
    homeNavIndex = Math.max(0, Math.min(i, items.length - 1));
    const name = items[homeNavIndex].dataset.screen;
    focusNavDomByName(name);
  }

  function focusHomeCard(i = 0) {
    const cards = getHomeCards();
    if (!cards.length) return;
    cardIndex = Math.max(0, Math.min(i, cards.length - 1));
    clearHomeCardFocus();
    cards[cardIndex].classList.add("is-focused");
    cards[cardIndex].focus?.();
  }

  function syncHomeZoneFocus() {
    clearHomeCardFocus();

    if (homeZone === 0) {
      focusHomeNav(homeNavIndex);
      return;
    }
    if (homeZone === 1) {
      clearNavFocus();
      focusHomeHero(heroIndex);
      return;
    }
    if (homeZone === 2) {
      clearNavFocus();
      focusHomeCard(cardIndex);
    }
  }

  function onEnterHome() {
    homeZone = 1;
    heroIndex = 0;
    homeNavIndex = getCurrentTabIndex();
    cardIndex = 0;
    syncHomeZoneFocus();
  }

  // ==================== MEDIA Zone/Focus ====================
  let mediaZone = 0; // 0 nav | 1 cards
  let mediaNavIndex = 0;
  let mediaCardIndex = 0;

  function getMediaCards() {
    return qsAll(".media-screen .media-card, .media-screen .context-card");
  }
  function clearMediaCardFocus() {
    getMediaCards().forEach((c) => c.classList.remove("is-focused"));
  }
  function focusMediaNav(i = 0) {
    const order = getNavOrder();
    mediaNavIndex = Math.max(0, Math.min(i, order.length - 1));
    const name = order[mediaNavIndex] || "home";
    focusNavDomByName(name);
  }
  function focusMediaCard(i = 0) {
    const cards = getMediaCards();
    if (!cards.length) return;
    mediaCardIndex = Math.max(0, Math.min(i, cards.length - 1));
    clearMediaCardFocus();
    cards[mediaCardIndex].classList.add("is-focused");
    cards[mediaCardIndex].focus?.();
  }
  function syncMediaZoneFocus() {
    clearMediaCardFocus();
    if (mediaZone === 0) {
      focusMediaNav(mediaNavIndex);
      return;
    }
    if (mediaZone === 1) {
      clearNavFocus();
      focusMediaCard(mediaCardIndex);
    }
  }
  function onEnterMedia() {
    mediaZone = 0;
    mediaNavIndex = getCurrentTabIndex();
    mediaCardIndex = 0;
    syncMediaZoneFocus();
  }

  // ==================== SYSTEM Zone/Focus + Settings ====================
  let systemZone = 0; // 0 nav | 1 cards | 2 inner buttons
  let systemNavIndex = 0;
  let systemCardIndex = 0;
  let systemBtnIndex = 0;

  function getSystemCards() {
    return qsAll(".system-screen [data-setting-card]");
  }
  function getSystemButtonsInCard(cardEl) {
    if (!cardEl) return [];
    return Array.from(cardEl.querySelectorAll("button.hero-btn"));
  }
  function clearSystemCardFocus() {
    getSystemCards().forEach((c) => c.classList.remove("is-focused"));
  }
  function focusSystemNav(i = 0) {
    const order = getNavOrder();
    systemNavIndex = Math.max(0, Math.min(i, order.length - 1));
    const name = order[systemNavIndex] || "home";
    focusNavDomByName(name);
  }
  function focusSystemCard(i = 0) {
    const cards = getSystemCards();
    if (!cards.length) return;
    systemCardIndex = Math.max(0, Math.min(i, cards.length - 1));
    clearSystemCardFocus();
    cards[systemCardIndex].classList.add("is-focused");
    cards[systemCardIndex].focus?.();
  }
  function focusSystemButton(i = 0) {
    const cards = getSystemCards();
    const card = cards[systemCardIndex];
    const btns = getSystemButtonsInCard(card);
    if (!btns.length) return;
    systemBtnIndex = Math.max(0, Math.min(i, btns.length - 1));
    btns[systemBtnIndex].focus();
  }
  function syncSystemZoneFocus() {
    clearSystemCardFocus();

    if (systemZone === 0) {
      focusSystemNav(systemNavIndex);
      return;
    }
    if (systemZone === 1) {
      clearNavFocus();
      focusSystemCard(systemCardIndex);
      return;
    }
    if (systemZone === 2) {
      clearNavFocus();
      focusSystemCard(systemCardIndex);
      focusSystemButton(systemBtnIndex);
    }
  }

  function syncSystemUI() {
    const clockValue = document.getElementById("clockFormatValue");
    if (clockValue) clockValue.textContent = use24h ? "24H" : "12H";

    const sysSoundValue = document.getElementById("systemSoundValue");
    if (sysSoundValue) sysSoundValue.textContent = soundEnabled ? "ON" : "OFF";

    const clock12Btn = document.getElementById("clock12Btn");
    const clock24Btn = document.getElementById("clock24Btn");
    if (clock12Btn && clock24Btn) {
      clock12Btn.classList.toggle("primary", !use24h);
      clock24Btn.classList.toggle("primary", use24h);
    }

    const soundOnBtn = document.getElementById("soundOnBtn");
    const soundOffBtn = document.getElementById("soundOffBtn");
    if (soundOnBtn && soundOffBtn) {
      soundOnBtn.classList.toggle("primary", soundEnabled);
      soundOffBtn.classList.toggle("primary", !soundEnabled);
    }
  }

  function onEnterSystem() {
    systemZone = 0;
    systemNavIndex = getCurrentTabIndex();
    systemCardIndex = 0;
    systemBtnIndex = 0;
    syncSystemUI();
    syncSystemZoneFocus();
  }

  function openSystemOnSound() {
    setActiveScreen("system");
    systemZone = 2;
    systemCardIndex = 1;
    systemBtnIndex = 0;
    syncSystemZoneFocus();
  }

  // ==================== Pointer interactions ====================
  document.addEventListener("pointerdown", (e) => {
    // ✅ Wi-Fi click
    const wifiEl = e.target.closest("#wifiStatus");
    if (wifiEl) {
      e.preventDefault();
      e.stopPropagation();
      uiSound.move();
      toggleWifi();
      return;
    }

    // ✅ Controller click
    const ctrlEl = e.target.closest("#controllerStatus");
    if (ctrlEl) {
      e.preventDefault();
      e.stopPropagation();
      uiSound.move();
      toggleController();
      return;
    }

    // SND click (header)
    const sndEl = e.target.closest("#sndStatus");
    if (sndEl) {
      e.preventDefault();
      e.stopPropagation();
      toggleSound();
      return;
    }

    // Back
    const backEl = e.target.closest('[data-action="back"]');
    if (backEl) {
      e.preventDefault();
      e.stopPropagation();
      uiSound.back();
      goBack();
      return;
    }

    // SYSTEM clicks
    if (currentScreen === "system") {
      const c12 = e.target.closest("#clock12Btn");
      const c24 = e.target.closest("#clock24Btn");
      const sOn = e.target.closest("#soundOnBtn");
      const sOff = e.target.closest("#soundOffBtn");

      if (c12 || c24 || sOn || sOff) {
        e.preventDefault();
        e.stopPropagation();
        uiSound.ok();

        if (c12) setClockFormat(false);
        if (c24) setClockFormat(true);
        if (sOn) setSoundEnabled(true);
        if (sOff) setSoundEnabled(false);
        return;
      }
    }

    // In-Game
    if (currentScreen === "in-game") {
      const openNp = e.target.closest("#openNowPlayingBtn");
      const quitG = e.target.closest("#quitFromGameBtn");
      if (openNp || quitG) {
        e.preventDefault();
        e.stopPropagation();

        if (openNp) {
          uiSound.ok();
          setActiveScreen("now-playing");
          setTimeout(() => document.getElementById("resumeBtn")?.focus(), 0);
          return;
        }
        if (quitG) {
          uiSound.quit();
          showOverlay("Quitting", runningGame || "Game");
          setTimeout(() => {
            runningGame = null;
            hideOverlay();
            setActiveScreen("games");
            setTimeout(() => focusGameByIndex(lastGamesFocusIndex), 0);
          }, 700);
          return;
        }
      }
    }

    // Now Playing
    if (currentScreen === "now-playing") {
      const resume = e.target.closest("#resumeBtn");
      const quit = e.target.closest("#quitBtn");
      if (resume || quit) {
        e.preventDefault();
        e.stopPropagation();

        const title =
          document.getElementById("nowPlayingTitle")?.textContent?.trim() ||
          "Game";

        if (resume) {
          if (!runningGame) return;
          uiSound.ok();
          showOverlay("Resuming", runningGame);
          setTimeout(() => {
            hideOverlay();
            setActiveScreen("in-game");
            setTimeout(
              () => document.getElementById("openNowPlayingBtn")?.focus(),
              0
            );
          }, 500);
        } else {
          uiSound.quit();
          showOverlay("Quitting", runningGame || title);
          setTimeout(() => {
            runningGame = null;
            hideOverlay();
            setActiveScreen("games");
            setTimeout(() => focusGameByIndex(lastGamesFocusIndex), 0);
          }, 700);
        }
        return;
      }
    }

    // Games card click
    const card = e.target.closest(".games-screen .game-card");
    if (card && currentScreen === "games") {
      if (performance.now() < blockGameOpenUntil) return;
      e.preventDefault();
      e.stopPropagation();

      const cards = getGameCards();
      const index = cards.indexOf(card);
      if (index >= 0) focusGameByIndex(index);

      uiSound.ok();
      openGameFromElement(card);
      return;
    }

    // Details (Play/Options)
    if (currentScreen === "game-details") {
      const playBtn = e.target.closest("#playBtn");
      const optionsBtn = e.target.closest("#optionsBtn");
      if (playBtn || optionsBtn) {
        e.preventDefault();
        e.stopPropagation();

        const title =
          document.getElementById("detailsTitle")?.textContent?.trim() ||
          "Game";

        if (playBtn) {
          uiSound.ok();
          launchGameFlow();
        } else {
          uiSound.ok();
          showOverlay("Opening Options", title);
          setTimeout(() => {
            hideOverlay();
            alert(`Options: ${title}`);
          }, 600);
        }
        return;
      }
    }

    // Nav click (global)
    const goEl = e.target.closest("[data-screen]");
    if (goEl) {
      const target = goEl.dataset.screen;
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();
      uiSound.ok();
      setActiveScreen(target);
      return;
    }
  });

  // Prevent click-through after pointerdown (games)
  document.addEventListener(
    "click",
    (e) => {
      if (currentScreen !== "games") return;
      if (performance.now() < blockGameOpenUntil) {
        const card = e.target.closest(".games-screen .game-card");
        if (card) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      }
    },
    true
  );

  // ==================== Keyboard: universal helpers ====================
  function isTypingContext() {
    const tag = document.activeElement?.tagName?.toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      document.activeElement?.isContentEditable
    );
  }

  // ✅ NAV keyboard always works when nav-item focused
  document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    if (!active || !active.classList?.contains("nav-item")) return;
    if (isTypingContext()) return;

    const order = getNavOrder();
    if (!order.length) return;

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
    }
  });

  // Back (ESC / Backspace)
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" && e.key !== "Backspace") return;
    if (isTypingContext()) return;
    uiSound.back();
    goBack();
  });

  // Mute toggle (M) + Shift+M
  document.addEventListener("keydown", (e) => {
    if (e.key !== "m" && e.key !== "M") return;
    if (isTypingContext()) return;

    e.preventDefault();
    if (e.shiftKey) {
      uiSound.ok();
      openSystemOnSound();
      return;
    }
    toggleSound();
  });

  // T toggle clock
  document.addEventListener("keydown", (e) => {
    if (e.key !== "t" && e.key !== "T") return;
    if (isTypingContext()) return;
    e.preventDefault();
    uiSound.ok();
    toggleClockFormat();
  });

  // W / C toggle wifi/controller
  document.addEventListener("keydown", (e) => {
    if (isTypingContext()) return;

    if (e.key === "w" || e.key === "W") {
      e.preventDefault();
      uiSound.move();
      toggleWifi();
    }

    if (e.key === "c" || e.key === "C") {
      e.preventDefault();
      uiSound.move();
      toggleController();
    }
  });

  // Also allow Enter/Space on wifi/controller themselves
  function bindHeaderToggleKeys() {
    const wifiEl = document.getElementById("wifiStatus");
    const ctrlEl = document.getElementById("controllerStatus");

    const onKey = (handler) => (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      uiSound.move();
      handler();
    };

    wifiEl?.addEventListener("keydown", onKey(toggleWifi));
    ctrlEl?.addEventListener("keydown", onKey(toggleController));
  }

  // ==================== Keyboard: Games Grid ====================
  document.addEventListener("keydown", (e) => {
    if (currentScreen !== "games") return;
    if (isTypingContext()) return;

    const cards = getGameCards();
    if (!cards.length) return;

    const isOnGameCard =
      document.activeElement?.classList?.contains("game-card");
    if (!isOnGameCard) return;

    const grid = document.getElementById("gamesGrid");
    const style = grid ? getComputedStyle(grid) : null;
    const cols = style ? style.gridTemplateColumns.split(" ").length : 4;

    const index = getFocusedGameIndex();

    if (e.key === "ArrowRight") {
      e.preventDefault();
      uiSound.move();
      focusGameByIndex(index + 1);
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      uiSound.move();
      focusGameByIndex(index - 1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      uiSound.move();
      focusGameByIndex(index + cols);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      uiSound.move();

      // اگر روی ردیف اول هستی، برو روی NAV
      if (index < cols) {
        navFocusIndex = getCurrentTabIndex();
        const name = getNavOrder()[navFocusIndex] || currentTab;
        focusNavDomByName(name);
        return;
      }

      focusGameByIndex(index - cols);
      return;
    }
    if (e.key === "Enter") {
      if (performance.now() < blockGameOpenUntil) return;
      e.preventDefault();
      uiSound.ok();
      openGameFromElement(document.activeElement);
    }
  });

  // Keyboard: Game Details
  document.addEventListener("keydown", (e) => {
    if (currentScreen !== "game-details") return;
    if (isTypingContext()) return;

    const playBtn = document.getElementById("playBtn");
    const optionsBtn = document.getElementById("optionsBtn");
    if (!playBtn || !optionsBtn) return;

    const active = document.activeElement;
    const isOnDetailsBtn = active === playBtn || active === optionsBtn;
    if (!isOnDetailsBtn) playBtn.focus();

    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      uiSound.move();
      if (document.activeElement === playBtn) optionsBtn.focus();
      else playBtn.focus();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const title =
        document.getElementById("detailsTitle")?.textContent?.trim() || "Game";

      if (document.activeElement === playBtn) {
        uiSound.ok();
        launchGameFlow();
      } else {
        uiSound.ok();
        showOverlay("Opening Options", title);
        setTimeout(() => {
          hideOverlay();
          alert(`Options: ${title}`);
        }, 600);
      }
    }
  });

  // Keyboard: In-Game
  document.addEventListener("keydown", (e) => {
    if (currentScreen !== "in-game") return;
    if (isTypingContext()) return;

    const openBtn = document.getElementById("openNowPlayingBtn");
    const quitBtn = document.getElementById("quitFromGameBtn");
    if (!openBtn || !quitBtn) return;

    const active = document.activeElement;
    const isOnBtn = active === openBtn || active === quitBtn;
    if (!isOnBtn) openBtn.focus();

    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      uiSound.move();
      if (document.activeElement === openBtn) quitBtn.focus();
      else openBtn.focus();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (document.activeElement === openBtn) {
        uiSound.ok();
        setActiveScreen("now-playing");
        setTimeout(() => document.getElementById("resumeBtn")?.focus(), 0);
      } else {
        uiSound.quit();
        showOverlay("Quitting", runningGame || "Game");
        setTimeout(() => {
          runningGame = null;
          hideOverlay();
          setActiveScreen("games");
          setTimeout(() => focusGameByIndex(lastGamesFocusIndex), 0);
        }, 700);
      }
    }
  });

  // Keyboard: Now Playing
  document.addEventListener("keydown", (e) => {
    if (currentScreen !== "now-playing") return;
    if (isTypingContext()) return;

    const resumeBtn = document.getElementById("resumeBtn");
    const quitBtn = document.getElementById("quitBtn");
    if (!resumeBtn || !quitBtn) return;

    const active = document.activeElement;
    const isOnNpBtn = active === resumeBtn || active === quitBtn;
    if (!isOnNpBtn) resumeBtn.focus();

    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      uiSound.move();
      if (document.activeElement === resumeBtn) quitBtn.focus();
      else resumeBtn.focus();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const title =
        document.getElementById("nowPlayingTitle")?.textContent?.trim() ||
        "Game";

      if (document.activeElement === resumeBtn) {
        if (!runningGame) return;
        uiSound.ok();
        showOverlay("Resuming", runningGame);
        setTimeout(() => {
          hideOverlay();
          setActiveScreen("in-game");
          setTimeout(
            () => document.getElementById("openNowPlayingBtn")?.focus(),
            0
          );
        }, 500);
      } else {
        uiSound.quit();
        showOverlay("Quitting", runningGame || title);
        setTimeout(() => {
          runningGame = null;
          hideOverlay();
          setActiveScreen("games");
          setTimeout(() => focusGameByIndex(lastGamesFocusIndex), 0);
        }, 700);
      }
    }
  });

  // Keyboard: HOME Engine
  document.addEventListener("keydown", (e) => {
    if (currentScreen !== "home") return;
    if (isTypingContext()) return;

    const heroBtns = getHomeHeroButtons();
    const navs = getHomeNavItems();
    const cards = getHomeCards();

    if (e.key === "ArrowDown") {
      e.preventDefault();
      uiSound.move();
      homeZone = Math.min(2, homeZone + 1);
      syncHomeZoneFocus();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      uiSound.move();
      homeZone = Math.max(0, homeZone - 1);
      syncHomeZoneFocus();
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      uiSound.move();

      if (homeZone === 0 && navs.length) {
        homeNavIndex = (homeNavIndex + 1) % navs.length;
        focusHomeNav(homeNavIndex);
      }
      if (homeZone === 1 && heroBtns.length) {
        heroIndex = (heroIndex + 1) % heroBtns.length;
        focusHomeHero(heroIndex);
      }
      if (homeZone === 2 && cards.length) {
        cardIndex = (cardIndex + 1) % cards.length;
        focusHomeCard(cardIndex);
      }
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      uiSound.move();

      if (homeZone === 0 && navs.length) {
        homeNavIndex = (homeNavIndex - 1 + navs.length) % navs.length;
        focusHomeNav(homeNavIndex);
      }
      if (homeZone === 1 && heroBtns.length) {
        heroIndex = (heroIndex - 1 + heroBtns.length) % heroBtns.length;
        focusHomeHero(heroIndex);
      }
      if (homeZone === 2 && cards.length) {
        cardIndex = (cardIndex - 1 + cards.length) % cards.length;
        focusHomeCard(cardIndex);
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      uiSound.ok();

      if (homeZone === 1) {
        heroBtns[heroIndex]?.click?.();
        return;
      }

      if (homeZone === 0) {
        const target = navs[homeNavIndex]?.dataset?.screen;
        if (target) setActiveScreen(target);
        return;
      }

      if (homeZone === 2) {
        const title =
          cards[cardIndex]
            ?.querySelector(".context-title")
            ?.textContent?.trim() || "Card";
        showOverlay("Opening", title);
        setTimeout(() => hideOverlay(), 600);
      }
    }
  });

  // Keyboard: MEDIA Engine
  document.addEventListener("keydown", (e) => {
    if (currentScreen !== "media") return;
    if (isTypingContext()) return;

    const order = getNavOrder();
    const cards = getMediaCards();

    if (e.key === "ArrowDown") {
      e.preventDefault();
      uiSound.move();
      mediaZone = Math.min(1, mediaZone + 1);
      syncMediaZoneFocus();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      uiSound.move();
      mediaZone = Math.max(0, mediaZone - 1);
      syncMediaZoneFocus();
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      uiSound.move();

      if (mediaZone === 0 && order.length) {
        mediaNavIndex = (mediaNavIndex + 1) % order.length;
        focusMediaNav(mediaNavIndex);
      }
      if (mediaZone === 1 && cards.length) {
        mediaCardIndex = (mediaCardIndex + 1) % cards.length;
        focusMediaCard(mediaCardIndex);
      }
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      uiSound.move();

      if (mediaZone === 0 && order.length) {
        mediaNavIndex = (mediaNavIndex - 1 + order.length) % order.length;
        focusMediaNav(mediaNavIndex);
      }
      if (mediaZone === 1 && cards.length) {
        mediaCardIndex = (mediaCardIndex - 1 + cards.length) % cards.length;
        focusMediaCard(mediaCardIndex);
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      uiSound.ok();

      if (mediaZone === 0) {
        const target = order[mediaNavIndex];
        if (target) setActiveScreen(target);
        return;
      }

      if (mediaZone === 1) {
        const title = cards[mediaCardIndex]?.dataset?.media || "Media";
        showOverlay("Opening", title);
        setTimeout(() => hideOverlay(), 600);
      }
    }
  });

  // Keyboard: SYSTEM Engine
  document.addEventListener("keydown", (e) => {
    if (currentScreen !== "system") return;
    if (isTypingContext()) return;

    const order = getNavOrder();
    const cards = getSystemCards();
    const btns = getSystemButtonsInCard(cards[systemCardIndex]);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      uiSound.move();
      systemZone = Math.min(2, systemZone + 1);
      syncSystemZoneFocus();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      uiSound.move();
      systemZone = Math.max(0, systemZone - 1);
      syncSystemZoneFocus();
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      uiSound.move();

      if (systemZone === 0 && order.length) {
        systemNavIndex = (systemNavIndex + 1) % order.length;
        focusSystemNav(systemNavIndex);
      }
      if (systemZone === 1 && cards.length) {
        systemCardIndex = (systemCardIndex + 1) % cards.length;
        focusSystemCard(systemCardIndex);
      }
      if (systemZone === 2 && btns.length) {
        systemBtnIndex = (systemBtnIndex + 1) % btns.length;
        focusSystemButton(systemBtnIndex);
      }
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      uiSound.move();

      if (systemZone === 0 && order.length) {
        systemNavIndex = (systemNavIndex - 1 + order.length) % order.length;
        focusSystemNav(systemNavIndex);
      }
      if (systemZone === 1 && cards.length) {
        systemCardIndex = (systemCardIndex - 1 + cards.length) % cards.length;
        focusSystemCard(systemCardIndex);
      }
      if (systemZone === 2 && btns.length) {
        systemBtnIndex = (systemBtnIndex - 1 + btns.length) % btns.length;
        focusSystemButton(systemBtnIndex);
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      uiSound.ok();

      if (systemZone === 0) {
        const target = order[systemNavIndex];
        if (target) setActiveScreen(target);
        return;
      }

      if (systemZone === 1) {
        systemZone = 2;
        systemBtnIndex = 0;
        syncSystemZoneFocus();
        return;
      }

      if (systemZone === 2) {
        const focusedId = document.activeElement?.id;

        if (focusedId === "clock12Btn") setClockFormat(false);
        if (focusedId === "clock24Btn") setClockFormat(true);

        if (focusedId === "soundOnBtn") setSoundEnabled(true);
        if (focusedId === "soundOffBtn") setSoundEnabled(false);
      }
    }
  });

  // ==================== Init ====================
  function init() {
    sndStatusEl = document.getElementById("sndStatus");

    if (sndStatusEl) {
      sndStatusEl.setAttribute("tabindex", "0");
      sndStatusEl.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        toggleSound();
      });
    }

    // ✅ Header toggle keys for wifi/controller elements
    bindHeaderToggleKeys();

    // sync header
    syncSoundUI();
    syncWifiUI();
    syncControllerUI();

    // clock
    startClock();

    // system ui sync
    syncSystemUI();

    // start
    setActiveScreen("home", { pushHistory: false });

    // Optional small hint
    // showToast("W: Wi-Fi  |  C: Controller  |  M: Sound");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
