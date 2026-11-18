/* Large role cards open an accessible full-screen level dialog. */
(function (R2) {
  "use strict";
  // Remove only retired Engineer training data; PCR runs and other levels are retained.
  for (const key of ["r2-eng-score", "missy-r2-eng-service", "missy-r2-eng-trouble", "missy-r2-level-engineer"]) {
    try { localStorage.removeItem(key); } catch {}
  }
  const roles = ["technician", "quality"];
  const dialog = document.createElement("dialog");
  dialog.className = "level-dialog";
  dialog.setAttribute("aria-labelledby", "level-dialog-title");
  document.body.append(dialog);
  let chosenRole = null;
  function closePicker() { if (dialog.open) dialog.close(); }
  function pick(role, level) {
    if (role === "technician") return R2.techAccess.open(dialog, level);
    chosenRole = role;
    dialog.innerHTML = `<div class="level-dialog-content"><a class="picker-back" href="#home">← Go back</a>
      <h1 id="level-dialog-title">Choose your level</h1><p>${{technician:"Technician",quality:"Quality manager"}[role]}</p>
      <div class="workspace-options level-options">${R2.levels.ORDER.map(level => `<button class="workspace-choice" data-picker-level="${level}"><strong>${R2.levels.NAME[level]}</strong><span>${R2.levels.BENCH[role].help[level]}</span></button>`).join("")}</div></div>`;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector("button").focus();
  }
  dialog.addEventListener("click", event => {
    const button = event.target.closest("[data-picker-level]");
    if (button && chosenRole) location.hash = chosenRole + "/" + button.dataset.pickerLevel;
  });
  dialog.addEventListener("cancel", event => { event.preventDefault(); location.hash = "home"; });
  for (const role of roles) {
    const nav = document.createElement("nav");
    nav.className = "bench-back row";
    nav.setAttribute("aria-label", "Workbench navigation");
    nav.innerHTML = `<a href="#home">Choose role</a>${role === "technician" ? `<a href="#${role}">Choose level</a><span class="bench-level"></span>` : ""}`;
    R2.$("view-" + role).prepend(nav);
  }
  function show() {
    if (window.R2Boot && !R2Boot.entered) return;
    const [requested, requestedLevel] = location.hash.slice(1).split("/");
    const level = requested === "quality" ? "admin" : requestedLevel;
    const role = roles.includes(requested) ? requested : "home";
    const active = role !== "home" && R2.levels.ORDER.includes(level) && (role !== "technician" || R2.techAccess.allowed(level));
    for (const name of ["home", ...roles]) {
      const view = R2.$("view-" + name);
      view.hidden = active ? name !== role : name !== "home";
      view.classList.remove("choosing-level");
    }
    if (active) {
      closePicker();
      R2.levels.save(role, level);
      const levelLabel = R2.$("view-" + role).querySelector(".bench-level");
      if (levelLabel) levelLabel.textContent = R2.levels.NAME[level];
      R2.ui[role].show();
    } else if (role !== "home") pick(role, level);
    else closePicker();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", show);
  if (window.R2Boot) R2Boot.whenEntered(show); else show();
})(window.R2);
