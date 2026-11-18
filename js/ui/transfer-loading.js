/* Shared full-screen transfer display for the workbench and bundled MISSY. */
(() => {
  "use strict";
  let screen, timer, began;
  function update(value, status) {
    if (!screen) return;
    screen.querySelector("progress").value = value;
    screen.querySelector("[data-stage]").textContent = status;
  }
  function close() {
    clearInterval(timer); screen?.close(); screen?.remove(); screen = null;
  }
  function open(status = "Preparing the analysis workspace…") {
    close(); began = performance.now();
    screen = document.createElement("dialog");
    screen.id = "r2-transfer-loading"; screen.setAttribute("aria-labelledby", "r2-loading-title");
    screen.style.cssText = "position:fixed;inset:0;margin:0;width:100%;height:100dvh;max-width:none;max-height:none;border:0;background:#000;color:#e7ccea;padding:clamp(20px,6vw,90px);z-index:2147483647";
    screen.innerHTML = `<div style="max-width:1100px;min-height:80%;margin:auto;display:flex;flex-direction:column;justify-content:center;gap:24px;border-top:16px solid #ff9966;border-bottom:14px solid #cc99cc;border-radius:55px 0 0 45px;padding:35px">
      <h1 id="r2-loading-title" style="font:700 clamp(27px,4vw,44px) Arial;color:#ff9966">Opening your experiments in MISSY</h1>
      <p data-stage role="status" style="font:20px Arial"></p>
      <progress max="100" value="5" aria-label="Transfer and analysis loading progress" style="width:100%;height:24px;accent-color:#ff9966"></progress>
      <pre data-computer style="white-space:pre-wrap;font:15px/1.8 monospace;color:#cc99cc"></pre>
      <button type="button" data-return style="align-self:start;padding:10px 22px;border-radius:25px;background:#cc99cc;color:#1a0b20;border:0" hidden>Go back</button></div>`;
    document.body.append(screen); screen.showModal();
    screen.addEventListener("cancel", event => event.preventDefault());
    screen.querySelector("[data-return]").onclick = close;
    let previous = performance.now();
    function sample() {
      if (!screen) return;
      const now = performance.now(), memory = performance.memory;
      const heap = memory ? Math.round(memory.usedJSHeapSize / 1048576) + " MB browser JavaScript memory" : "Browser memory reporting unavailable";
      screen.querySelector("[data-computer]").textContent =
        "Elapsed " + ((now - began) / 1000).toFixed(1) + " s\n" + heap +
        "\nUI scheduling delay " + Math.max(0, Math.round(now - previous - 500)) + " ms";
      previous = now;
    }
    sample(); timer = setInterval(sample, 500); update(5, status);
  }
  function fail(message) { update(0, message); if (screen) screen.querySelector("[data-return]").hidden = false; }
  window.R2TransferLoading = { open, update, close, fail };
})();
