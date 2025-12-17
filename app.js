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
      tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable;

    if (!isTyping) goBack();
  }
});

// اگر خواستی مطمئن باشه از ابتدا home فعاله:
setActiveScreen("home", { pushHistory: false });
