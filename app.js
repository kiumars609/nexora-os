const screens = document.querySelectorAll(".screen");
const navItems = document.querySelectorAll(".nav-item");

// -------------------- History --------------------
let currentScreen = "home";
const historyStack = [];

// ✅ جلوگیری از click-through بعد از ورود به Games
let blockGameOpenUntil = 0;
let lastGamesFocusIndex = 0;
let runningGame = null; // ✅ بازی در حال اجرا

// ==================== UI Sounds (WebAudio) ====================
let audioCtx = null;
let soundEnabled = true;

function ensureAudio() {
  if (!soundEnabled) return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
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
  open() {
    beep({ freq: 680, dur: 0.06, type: "triangle", vol: 0.06 });
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

uiSound.launch = () => chord([520, 660, 820], 0.05, 0.01); // 🔊 Launch
uiSound.quit = () => chord([420, 320], 0.06, 0.02); // 🔊 Quit
uiSound.overlay = () => beep({ freq: 640, dur: 0.03, type: "sine", vol: 0.04 }); // 🔊 Overlay pop

function showOverlay(title = "Launching", sub = "Please wait...") {
  const overlay = document.getElementById("loadingOverlay");
  const titleEl = document.getElementById("loadingTitle");
  const subEl = document.getElementById("loadingSub");

  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = sub;

  overlay?.classList.add("is-active");
  overlay?.setAttribute("aria-hidden", "false");

  uiSound.overlay(); // 🔊 صدای باز شدن/ظاهر شدن Overlay
}

function hideOverlay() {
  const overlay = document.getElementById("loadingOverlay");
  overlay?.classList.remove("is-active");
  overlay?.setAttribute("aria-hidden", "true");
}

function launchGameFlow() {
  const gameName =
    document.getElementById("detailsTitle")?.textContent?.trim() || "Game";

  runningGame = gameName; // ✅ ست بازی درحال اجرا

  // Now Playing text
  const npTitle = document.getElementById("nowPlayingTitle");
  const npSub = document.getElementById("nowPlayingSub");
  if (npTitle) npTitle.textContent = gameName;
  if (npSub) npSub.textContent = "Running... Resume to continue.";

  // In-Game text
  const igTitle = document.getElementById("inGameTitle");
  const igSub = document.getElementById("inGameSub");
  if (igTitle) igTitle.textContent = gameName;
  if (igSub) igSub.textContent = "You are in-game. Open Now Playing anytime.";

  showOverlay("Launching", gameName);

  setTimeout(() => {
    hideOverlay();
    setActiveScreen("in-game"); // ✅ به جای now-playing مستقیم برو داخل بازی
    setTimeout(() => document.getElementById("openNowPlayingBtn")?.focus(), 0);
  }, 900);
}

// -------------------- NAV focus (for keyboard) --------------------
let navFocusIndex = 0;

function getNavOrder() {
  return Array.from(navItems)
    .map((el) => el.dataset.screen)
    .filter(Boolean);
}

function setNavActiveByName(name) {
  navItems.forEach((i) => i.classList.remove("active"));
  document
    .querySelector(`.nav-item[data-screen="${name}"]`)
    ?.classList.add("active");
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

function syncNavFocusWithCurrent() {
  const order = getNavOrder();
  const i = order.indexOf(currentScreen);
  navFocusIndex = i >= 0 ? i : 0;

  // active همیشه صفحه‌ی فعلی
  setNavActiveByName(currentScreen);

  // focus: اگر home نیستیم، فوکوس هم‌جهت با صفحه فعلی باشه
  if (currentScreen !== "home") {
    setNavFocusByName(order[navFocusIndex] || currentScreen);
  } else {
    clearNavFocus(); // روی Home، فوکوس رو Home Engine کنترل می‌کنه
  }
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
  // ✅ یادمون می‌مونه آخرین کارت کدوم بود
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

  // متن‌های صفحه details رو پر کن
  const titleEl = document.getElementById("detailsTitle");
  const subEl = document.getElementById("detailsSub");

  if (titleEl) titleEl.textContent = gameName;
  if (subEl) subEl.textContent = "Press Play to start, or Back to return.";

  // برو به صفحه جزئیات
  setActiveScreen("game-details");
  setTimeout(() => document.getElementById("playBtn")?.focus(), 0);
}

// -------------------- Screen switching --------------------
function setActiveScreen(name, options = { pushHistory: true }) {
  if (!name) return;

  if (options.pushHistory && name !== currentScreen) {
    historyStack.push(currentScreen);
  }
  currentScreen = name;

  screens.forEach((s) => s.classList.remove("is-active"));
  document.querySelector(`.${name}-screen`)?.classList.add("is-active");

  setNavActiveByName(name);

  if (name === "games") {
    blockGameOpenUntil = performance.now() + 150;

    // ✅ به جای 0، همون کارت قبلی رو برگردون
    setTimeout(() => focusGameByIndex(lastGamesFocusIndex), 0);
  } else {
    // ✅ فقط وقتی داریم از games می‌ریم بیرون و مقصد "game-details" نیست، پاک کن
    if (name !== "game-details") {
      clearGameFocus();
      lastGamesFocusIndex = 0;
    }
  }

  syncNavFocusWithCurrent();
}

function goBack() {
  const prev = historyStack.pop();
  if (!prev) return;
  setActiveScreen(prev, { pushHistory: false });
}

// -------------------- Pointer (Console-like) --------------------
document.addEventListener("pointerdown", (e) => {
  // 1) Back
  const backEl = e.target.closest('[data-action="back"]');
  if (backEl) {
    e.preventDefault();
    e.stopPropagation();
    goBack();
    return;
  }

  // 2) Game card
  const card = e.target.closest(".games-screen .game-card");
  if (card && currentScreen === "games") {
    // ✅ اگر تازه وارد games شدیم، باز کردن کارت ممنوع
    if (performance.now() < blockGameOpenUntil) return;

    e.preventDefault();
    e.stopPropagation();

    const cards = getGameCards();
    const index = cards.indexOf(card);
    if (index >= 0) focusGameByIndex(index);

    openGameFromElement(card);
    return;
  }

  // 2.5) Details buttons (Play / Options)
  if (currentScreen === "game-details") {
    const playBtn = e.target.closest("#playBtn");
    const optionsBtn = e.target.closest("#optionsBtn");

    if (playBtn || optionsBtn) {
      e.preventDefault();
      e.stopPropagation();

      const title =
        document.getElementById("detailsTitle")?.textContent?.trim() || "Game";

      if (playBtn) {
        launchGameFlow();
      } else {
        showOverlay("Opening Options", title);
        setTimeout(() => {
          hideOverlay();
          alert(`Options: ${title}`);
        }, 600);
      }

      return;
    }
  }

  // 3) Navigate by data-screen
  const goEl = e.target.closest("[data-screen]");
  if (!goEl) return;

  const target = goEl.dataset.screen;
  if (!target) return;

  e.preventDefault();
  e.stopPropagation();
  setActiveScreen(target);
});

// ✅ خیلی مهم: بعضی مرورگرها click رو بعدش می‌فرستن، اینجا خفه‌ش می‌کنیم
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
  true // capture
);

// -------------------- Keyboard: Back (ESC / Backspace) --------------------
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" && e.key !== "Backspace") return;

  const tag = document.activeElement?.tagName?.toLowerCase();
  const isTyping =
    tag === "input" ||
    tag === "textarea" ||
    document.activeElement?.isContentEditable;

  if (!isTyping) {
    uiSound.back();
    goBack();
  }
});

// -------------------- Keyboard: NAV (ArrowLeft/Right = انتخاب، Enter = ورود) --------------------
document.addEventListener("keydown", (e) => {
  if (currentScreen === "home") return; // ✅ جلوگیری از تداخل با Home Focus Engine
  if (currentScreen === "games" || currentScreen === "game-details") return;

  const tag = document.activeElement?.tagName?.toLowerCase();
  const isTyping =
    tag === "input" ||
    tag === "textarea" ||
    document.activeElement?.isContentEditable;
  if (isTyping) return;

  const order = getNavOrder();
  if (!order.length) return;

  if (e.key === "ArrowRight") {
    navFocusIndex = (navFocusIndex + 1) % order.length;
    updateNavActiveByName(order[navFocusIndex]);
  }

  if (e.key === "ArrowLeft") {
    navFocusIndex = (navFocusIndex - 1 + order.length) % order.length;
    updateNavActiveByName(order[navFocusIndex]);
  }

  if (e.key === "Enter") {
    const target = order[navFocusIndex];
    if (target) setActiveScreen(target);
  }
});

// -------------------- Keyboard: Games Grid (Arrow = حرکت، Enter = باز کردن) --------------------
document.addEventListener("keydown", (e) => {
  if (currentScreen !== "games") return;

  const cards = getGameCards();
  if (!cards.length) return;

  const isOnGameCard = document.activeElement?.classList?.contains("game-card");
  if (!isOnGameCard) return;

  const grid = document.getElementById("gamesGrid");
  const style = grid ? getComputedStyle(grid) : null;
  const cols = style ? style.gridTemplateColumns.split(" ").length : 4;

  const index = getFocusedGameIndex();

  if (e.key === "ArrowRight") {
    e.preventDefault();
    uiSound.move();
    focusGameByIndex(index + 1);
  }

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    uiSound.move();
    focusGameByIndex(index - 1);
  }

  if (e.key === "ArrowDown") {
    e.preventDefault();
    uiSound.move();
    focusGameByIndex(index + cols);
  }

  if (e.key === "ArrowUp") {
    e.preventDefault();
    uiSound.move();
    focusGameByIndex(index - cols);
  }

  if (e.key === "Enter") {
    // ✅ Enter هم اگر تازه وارد شدیم، باز نکنه
    if (performance.now() < blockGameOpenUntil) return;

    e.preventDefault();
    uiSound.ok();
    openGameFromElement(document.activeElement);
  }
});

// -------------------- Init --------------------
setActiveScreen("home", { pushHistory: false });

// -------------------- Keyboard: Game Details (Left/Right + Enter) --------------------
document.addEventListener("keydown", (e) => {
  if (currentScreen !== "game-details") return;

  const playBtn = document.getElementById("playBtn");
  const optionsBtn = document.getElementById("optionsBtn");
  if (!playBtn || !optionsBtn) return;

  // اگر فوکوس روی هیچکدوم نبود، خودمون می‌ذاریم روی Play
  const active = document.activeElement;
  const isOnDetailsBtn = active === playBtn || active === optionsBtn;

  if (!isOnDetailsBtn) {
    playBtn.focus();
  }

  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    e.stopPropagation();
    uiSound.move();

    // اگر روی Play هستیم برو Options، اگر روی Options هستیم برو Play
    if (document.activeElement === playBtn) optionsBtn.focus();
    else playBtn.focus();
  }

  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    uiSound.ok();

    const title =
      document.getElementById("detailsTitle")?.textContent?.trim() || "Game";

    if (document.activeElement === playBtn) {
      launchGameFlow();
    } else {
      showOverlay("Opening Options", title);
      setTimeout(() => {
        hideOverlay();
        alert(`Options: ${title}`);
      }, 600);
    }
  }
});

document.addEventListener("pointerdown", (e) => {
  if (currentScreen !== "now-playing") return;

  const resume = e.target.closest("#resumeBtn");
  const quit = e.target.closest("#quitBtn");
  if (!resume && !quit) return;

  e.preventDefault();
  e.stopPropagation();

  const title =
    document.getElementById("nowPlayingTitle")?.textContent?.trim() || "Game";

  if (resume) {
    if (!runningGame) return;

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
    showOverlay("Quitting", runningGame || title);
    setTimeout(() => {
      runningGame = null; // ✅ بازی رو ببند
      hideOverlay();
      setActiveScreen("games");
    }, 700);
  }
});

// -------------------- Keyboard: Now Playing (Left/Right + Enter) --------------------
// -------------------- Keyboard: Now Playing (Left/Right + Enter) --------------------
document.addEventListener("keydown", (e) => {
  if (currentScreen !== "now-playing") return;

  const resumeBtn = document.getElementById("resumeBtn");
  const quitBtn = document.getElementById("quitBtn");
  if (!resumeBtn || !quitBtn) return;

  const active = document.activeElement;
  const isOnNpBtn = active === resumeBtn || active === quitBtn;

  if (!isOnNpBtn) resumeBtn.focus();

  // ⬅➡ move
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    e.stopPropagation();
    uiSound.move(); // 🔊

    if (document.activeElement === resumeBtn) quitBtn.focus();
    else resumeBtn.focus();
    return;
  }

  // ⏎ ok
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    uiSound.ok(); // 🔊

    const title =
      document.getElementById("nowPlayingTitle")?.textContent?.trim() || "Game";

    if (document.activeElement === resumeBtn) {
      if (!runningGame) return;

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
      showOverlay("Quitting", runningGame || title);
      setTimeout(() => {
        runningGame = null;
        hideOverlay();
        setActiveScreen("games");
      }, 700);
    }
  }
});

// ==================== Home Focus Engine (PS-like) ====================
let homeZone = 0; // 0: Hero buttons | 1: Nav | 2: Context cards
let heroIndex = 0;
let homeNavIndex = 0;
let cardIndex = 0;

function qsAll(sel) {
  return Array.from(document.querySelectorAll(sel));
}

function getHomeHeroButtons() {
  // فقط دکمه‌های داخل home-screen
  return qsAll(".home-screen .hero-btn");
}

function getHomeNavItems() {
  return qsAll(".home-screen .nav-item");
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

  // ✅ فقط فوکوس (نه active)
  setNavFocusByName(items[homeNavIndex].dataset.screen);
}

function focusHomeCard(i = 0) {
  const cards = getHomeCards();
  if (!cards.length) return;
  cardIndex = Math.max(0, Math.min(i, cards.length - 1));
  clearHomeCardFocus();
  cards[cardIndex].classList.add("is-focused");
  // برای اسکرین‌ریدر بهتر:
  cards[cardIndex].setAttribute("aria-selected", "true");
}

function syncHomeZoneFocus() {
  clearHomeCardFocus();

  if (homeZone === 0) {
    clearNavFocus(); // ✅ وقتی روی Hero هستیم، nav focus نداشته باشه
    focusHomeHero(heroIndex);
  }

  if (homeZone === 1) {
    focusHomeNav(homeNavIndex);
  }

  if (homeZone === 2) {
    clearNavFocus(); // ✅ وقتی روی کارت‌ها هستیم، nav focus نداشته باشه
    focusHomeCard(cardIndex);
  }
}

// وقتی وارد Home شدیم، فوکوس رو منطقی تنظیم کن
function onEnterHome() {
  homeZone = 0;
  heroIndex = 0;
  homeNavIndex = 0;
  cardIndex = 0;
  syncHomeZoneFocus();
}

// patch: هر بار home فعال شد
// (بدون دست زدن به setActiveScreen، با یک observer ساده)
const homeScreenEl = document.querySelector(".home-screen");
const homeObserver = new MutationObserver(() => {
  if (currentScreen === "home") onEnterHome();
});
if (homeScreenEl) homeObserver.observe(homeScreenEl, { attributes: true });

// -------------------- Keyboard: Home PS navigation --------------------
document.addEventListener("keydown", (e) => {
  if (currentScreen !== "home") return;

  const tag = document.activeElement?.tagName?.toLowerCase();
  const isTyping =
    tag === "input" ||
    tag === "textarea" ||
    document.activeElement?.isContentEditable;
  if (isTyping) return;

  const heroBtns = getHomeHeroButtons();
  const navs = getHomeNavItems();
  const cards = getHomeCards();

  // Up/Down: تغییر زون
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

  // Left/Right: حرکت داخل زون
  if (e.key === "ArrowRight") {
    e.preventDefault();
    uiSound.move();

    if (homeZone === 0 && heroBtns.length) {
      heroIndex = (heroIndex + 1) % heroBtns.length;
      focusHomeHero(heroIndex);
    }

    if (homeZone === 1 && navs.length) {
      homeNavIndex = (homeNavIndex + 1) % navs.length;
      focusHomeNav(homeNavIndex);
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

    if (homeZone === 0 && heroBtns.length) {
      heroIndex = (heroIndex - 1 + heroBtns.length) % heroBtns.length;
      focusHomeHero(heroIndex);
    }

    if (homeZone === 1 && navs.length) {
      homeNavIndex = (homeNavIndex - 1 + navs.length) % navs.length;
      focusHomeNav(homeNavIndex);
    }

    if (homeZone === 2 && cards.length) {
      cardIndex = (cardIndex - 1 + cards.length) % cards.length;
      focusHomeCard(cardIndex);
    }

    return;
  }

  // Enter: اجرا
  if (e.key === "Enter") {
    e.preventDefault();
    uiSound.ok();

    if (homeZone === 0) {
      // Hero buttons کلیک واقعی دارند
      heroBtns[heroIndex]?.click();
      return;
    }

    if (homeZone === 1) {
      // Nav: برو به صفحه انتخاب‌شده
      const target = navs[homeNavIndex]?.dataset?.screen;
      if (target) setActiveScreen(target);
      return;
    }

    if (homeZone === 2) {
      // Context cards: فعلاً یه رفتار نمونه (بعداً می‌تونیم actions واقعی بدیم)
      const title =
        cards[cardIndex]
          ?.querySelector(".context-title")
          ?.textContent?.trim() || "Card";
      showOverlay("Opening", title);
      setTimeout(() => hideOverlay(), 600);
      return;
    }
  }
});

// Init: اگر صفحه اول home بود
if (currentScreen === "home") onEnterHome();

document.addEventListener("pointerdown", (e) => {
  if (currentScreen !== "in-game") return;

  const openNp = e.target.closest("#openNowPlayingBtn");
  const quitG = e.target.closest("#quitFromGameBtn");
  if (!openNp && !quitG) return;

  e.preventDefault();
  e.stopPropagation();

  if (openNp) {
    setActiveScreen("now-playing");
    setTimeout(() => document.getElementById("resumeBtn")?.focus(), 0);
    return;
  }

  if (quitG) {
    showOverlay("Quitting", runningGame || "Game");
    setTimeout(() => {
      runningGame = null;
      hideOverlay();
      setActiveScreen("games");
      setTimeout(() => focusGameByIndex(lastGamesFocusIndex), 0);
    }, 700);
  }
});

// -------------------- Keyboard: In-Game (Left/Right + Enter) --------------------
document.addEventListener("keydown", (e) => {
  if (currentScreen !== "in-game") return;

  const openBtn = document.getElementById("openNowPlayingBtn");
  const quitBtn = document.getElementById("quitFromGameBtn");
  if (!openBtn || !quitBtn) return;

  const active = document.activeElement;
  const isOnBtn = active === openBtn || active === quitBtn;
  if (!isOnBtn) openBtn.focus();

  // ⬅➡ move
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    e.stopPropagation();
    uiSound.move(); // 🔊

    if (document.activeElement === openBtn) quitBtn.focus();
    else openBtn.focus();
    return;
  }

  // ⏎ ok
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    uiSound.ok(); // 🔊

    if (document.activeElement === openBtn) {
      setActiveScreen("now-playing");
      setTimeout(() => document.getElementById("resumeBtn")?.focus(), 0);
    } else {
      showOverlay("Quitting", runningGame || "Game");
      setTimeout(() => {
        runningGame = null;
        hideOverlay();
        setActiveScreen("games");
      }, 700);
    }
  }
});
