const screens = document.querySelectorAll(".screen");
const navItems = document.querySelectorAll(".nav-item");

// -------------------- History --------------------
let currentScreen = "home";
const historyStack = [];

// ✅ جلوگیری از click-through بعد از ورود به Games
let blockGameOpenUntil = 0;
let lastGamesFocusIndex = 0;

function showOverlay(title = "Launching", sub = "Please wait...") {
  const overlay = document.getElementById("loadingOverlay");
  const titleEl = document.getElementById("loadingTitle");
  const subEl = document.getElementById("loadingSub");

  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = sub;

  overlay?.classList.add("is-active");
  overlay?.setAttribute("aria-hidden", "false");
}

function hideOverlay() {
  const overlay = document.getElementById("loadingOverlay");
  overlay?.classList.remove("is-active");
  overlay?.setAttribute("aria-hidden", "true");
}

function launchGameFlow() {
  const gameName =
    document.getElementById("detailsTitle")?.textContent?.trim() || "Game";

  // متن صفحه Now Playing رو هم پر کن
  const npTitle = document.getElementById("nowPlayingTitle");
  const npSub = document.getElementById("nowPlayingSub");
  if (npTitle) npTitle.textContent = gameName;
  if (npSub) npSub.textContent = "Running... Press Back to return.";

  showOverlay("Launching", gameName);

  setTimeout(() => {
    hideOverlay();
    setActiveScreen("now-playing");
    setTimeout(() => document.getElementById("resumeBtn")?.focus(), 0);
  }, 900);
}

// -------------------- NAV focus (for keyboard) --------------------
let navFocusIndex = 0;

function getNavOrder() {
  return Array.from(navItems)
    .map((el) => el.dataset.screen)
    .filter(Boolean);
}

function updateNavActiveByName(name) {
  navItems.forEach((i) => i.classList.remove("active"));
  document
    .querySelector(`.nav-item[data-screen="${name}"]`)
    ?.classList.add("active");
}

function syncNavFocusWithCurrent() {
  const order = getNavOrder();
  const i = order.indexOf(currentScreen);
  navFocusIndex = i >= 0 ? i : 0;
  updateNavActiveByName(order[navFocusIndex] || "home");
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

  updateNavActiveByName(name);

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

  if (!isTyping) goBack();
});

// -------------------- Keyboard: NAV (ArrowLeft/Right = انتخاب، Enter = ورود) --------------------
document.addEventListener("keydown", (e) => {
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
    focusGameByIndex(index + 1);
  }

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    focusGameByIndex(index - 1);
  }

  if (e.key === "ArrowDown") {
    e.preventDefault();
    focusGameByIndex(index + cols);
  }

  if (e.key === "ArrowUp") {
    e.preventDefault();
    focusGameByIndex(index - cols);
  }

  if (e.key === "Enter") {
    // ✅ Enter هم اگر تازه وارد شدیم، باز نکنه
    if (performance.now() < blockGameOpenUntil) return;

    e.preventDefault();
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

    // اگر روی Play هستیم برو Options، اگر روی Options هستیم برو Play
    if (document.activeElement === playBtn) optionsBtn.focus();
    else playBtn.focus();
  }

  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();

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
    showOverlay("Resuming", title);
    setTimeout(() => hideOverlay(), 500);
  } else {
    showOverlay("Quitting", title);
    setTimeout(() => {
      hideOverlay();
      // برگرد به Games (یا Home، هرچی دوست داری)
      setActiveScreen("games");
    }, 700);
  }
});

// -------------------- Keyboard: Now Playing (Left/Right + Enter) --------------------
document.addEventListener("keydown", (e) => {
  if (currentScreen !== "now-playing") return;

  const resumeBtn = document.getElementById("resumeBtn");
  const quitBtn = document.getElementById("quitBtn");
  if (!resumeBtn || !quitBtn) return;

  const active = document.activeElement;
  const isOnNpBtn = active === resumeBtn || active === quitBtn;

  // اگر فوکوس روی هیچکدوم نبود، بذار روی Resume
  if (!isOnNpBtn) resumeBtn.focus();

  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    e.stopPropagation();

    if (document.activeElement === resumeBtn) quitBtn.focus();
    else resumeBtn.focus();
  }

  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();

    const title =
      document.getElementById("nowPlayingTitle")?.textContent?.trim() || "Game";

    if (document.activeElement === resumeBtn) {
      showOverlay("Resuming", title);
      setTimeout(() => hideOverlay(), 500);
    } else {
      showOverlay("Quitting", title);
      setTimeout(() => {
        hideOverlay();
        setActiveScreen("games");
      }, 700);
    }
  }
});
