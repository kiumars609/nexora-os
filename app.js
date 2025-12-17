const screens = document.querySelectorAll(".screen");
const navItems = document.querySelectorAll(".nav-item");

// history
let currentScreen = "home";
const historyStack = [];

function setActiveScreen(name, options = { pushHistory: true }) {
  if (!name) return;

  // history push (برای رفتن‌های معمولی)
  if (options.pushHistory && name !== currentScreen) {
    historyStack.push(currentScreen);
  }
  currentScreen = name;

  // screens
  screens.forEach((s) => s.classList.remove("is-active"));
  document.querySelector(`.${name}-screen`)?.classList.add("is-active");

  // nav active state
  navItems.forEach((i) => i.classList.remove("active"));
  document
    .querySelector(`.nav-item[data-screen="${name}"]`)
    ?.classList.add("active");
}

function goBack() {
  const prev = historyStack.pop();
  if (!prev) return;
  setActiveScreen(prev, { pushHistory: false });
}

// یک هندلر واحد برای همه‌ی کلیک‌ها (nav + دکمه‌ها + کارت‌ها ...)
document.addEventListener("click", (e) => {
  // 1) Back
  const backEl = e.target.closest('[data-action="back"]');
  if (backEl) {
    goBack();
    return;
  }

  // 2) Navigate by data-screen
  const goEl = e.target.closest("[data-screen]");
  if (!goEl) return;

  const target = goEl.dataset.screen;
  if (!target) return;

  setActiveScreen(target);
});

// (اختیاری ولی خیلی خوب) Back با کیبورد: ESC یا Backspace
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" || e.key === "Backspace") {
    // Backspace تو inputها اذیت نکنه
    const tag = document.activeElement?.tagName?.toLowerCase();
    const isTyping =
      tag === "input" ||
      tag === "textarea" ||
      document.activeElement?.isContentEditable;

    if (!isTyping) goBack();
  }
});

// اگر خواستی مطمئن باشه از ابتدا home فعاله:
setActiveScreen("home", { pushHistory: false });

document.addEventListener("keydown", (e) => {
  // اگر تایپ می‌کنه، مزاحم نشیم
  const tag = document.activeElement?.tagName?.toLowerCase();
  const isTyping =
    tag === "input" ||
    tag === "textarea" ||
    document.activeElement?.isContentEditable;
  if (isTyping) return;

  const order = Array.from(document.querySelectorAll(".nav-item"))
    .map((el) => el.dataset.screen)
    .filter(Boolean);

  if (!order.length) return;

  const currentIndex = Math.max(0, order.indexOf(currentScreen));

  if (e.key === "ArrowRight") {
    const next = order[(currentIndex + 1) % order.length];
    setActiveScreen(next); // همون لحظه برو صفحه بعدی
  }

  if (e.key === "ArrowLeft") {
    const prev = order[(currentIndex - 1 + order.length) % order.length];
    setActiveScreen(prev); // همون لحظه برو صفحه قبلی
  }
});

// ---------- Games Grid Navigation (Arrow keys + Enter) ----------
function focusGameByIndex(index) {
  const cards = Array.from(
    document.querySelectorAll(".games-screen .game-card")
  );
  if (!cards.length) return;

  // clamp
  const i = Math.max(0, Math.min(index, cards.length - 1));

  cards.forEach((c) => c.classList.remove("is-focused"));
  cards[i].classList.add("is-focused");
  cards[i].focus();

  // ذخیره index روی خود grid برای ادامه حرکت
  const grid = document.getElementById("gamesGrid");
  if (grid) grid.dataset.focusIndex = String(i);
}

function getFocusedGameIndex() {
  const grid = document.getElementById("gamesGrid");
  if (!grid) return 0;
  const v = parseInt(grid.dataset.focusIndex || "0", 10);
  return Number.isFinite(v) ? v : 0;
}

// وقتی وارد Games شدی، اولین کارت فوکوس بگیره
const _setActiveScreenOriginal = setActiveScreen;
setActiveScreen = function (name, options = { pushHistory: true }) {
  _setActiveScreenOriginal(name, options);

  if (name === "games") {
    // یه ذره صبر تا انیمیشن/DOM اوکی باشه
    setTimeout(() => focusGameByIndex(0), 0);
  } else {
    // وقتی از games رفتی بیرون، فوکوس کارت‌ها پاک شه
    const cards = document.querySelectorAll(".games-screen .game-card");
    cards.forEach((c) => c.classList.remove("is-focused"));
  }
};

// کنترل کیبورد داخل Games
document.addEventListener("keydown", (e) => {
  if (currentScreen !== "games") return;

  const cards = Array.from(
    document.querySelectorAll(".games-screen .game-card")
  );
  if (!cards.length) return;

  // فقط وقتی واقعاً روی کارت‌های بازی هستیم، فلش‌ها داخل grid کار کنن
  const isOnGameCard = document.activeElement?.classList?.contains("game-card");
  if (!isOnGameCard) return;

  // تعداد ستون‌ها را از CSS می‌گیریم (مثلاً 4)
  const grid = document.getElementById("gamesGrid");
  const style = grid ? getComputedStyle(grid) : null;
  const cols = style ? style.gridTemplateColumns.split(" ").length : 4;

  let index = getFocusedGameIndex();

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
    e.preventDefault();
    const gameName =
      document.activeElement?.dataset?.game ||
      document.activeElement?.textContent?.trim();
    alert(`Open game: ${gameName}`);
  }
});

// کلیک روی کارت = فوکوس + “باز کردن”
document.addEventListener("click", (e) => {
  const card = e.target.closest(".games-screen .game-card");
  if (!card) return;

  const cards = Array.from(
    document.querySelectorAll(".games-screen .game-card")
  );
  const index = cards.indexOf(card);
  if (index >= 0) focusGameByIndex(index);

  const gameName = card.dataset.game || card.textContent.trim();
  alert(`Open game: ${gameName}`);
});
