const navItems = document.querySelectorAll(".nav-item");
const screens = document.querySelectorAll(".screen");

function setActiveScreen(name) {
  // screens
  screens.forEach((s) => s.classList.remove("is-active"));
  document.querySelector(`.${name}-screen`)?.classList.add("is-active");

  // nav active state (فقط داخل همون nav)
  navItems.forEach((i) => i.classList.remove("active"));
  document.querySelector(`.nav-item[data-screen="${name}"]`)?.classList.add("active");
}

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    const target = item.dataset.screen;
    if (!target) return;
    setActiveScreen(target);
  });
});
