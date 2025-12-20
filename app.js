const screens = document.querySelectorAll(".screen");
const navItems = document.querySelectorAll(".nav-item");

// -------------------- History --------------------
let currentScreen = "home";
const historyStack = [];

// ✅ جلوگیری از click-through بعد از ورود به Games
let blockGameOpenUntil = 0;

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
    // ✅ 150ms قفل برای اینکه کلیک قبلی تبدیل به کلیک روی کارت نشه
    blockGameOpenUntil = performance.now() + 150;
    setTimeout(() => focusGameByIndex(0), 0);
  } else {
    clearGameFocus();
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
  if (currentScreen === "games") return;

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
