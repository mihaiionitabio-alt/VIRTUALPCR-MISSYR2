/* Shared plate interactions: rectangular ranges, additive toggles and row/column headers. */
(function (R2) {
  "use strict";
  const cols = R2.PLATE.cols, count = R2.PLATE.n;
  const indexes = Array.from({ length: count }, (_, i) => i);
  const cell = (row, col) => row * cols + col;
  const rect = (a, b) => {
    const rows = [Math.floor(a / cols), Math.floor(b / cols)].sort((x, y) => x - y);
    const columns = [a % cols, b % cols].sort((x, y) => x - y);
    return indexes.filter(w => Math.floor(w / cols) >= rows[0] && Math.floor(w / cols) <= rows[1] && w % cols >= columns[0] && w % cols <= columns[1]);
  };
  R2.plateAxis = (axis, n, label) => `<button type="button" class="ph plate-axis" data-${axis}="${n}" aria-label="Select ${axis} ${label}">${label}</button>`;
  R2.wellIdentity = function (w, i) {
    const name = w.label || w.displayName || w.sampleName || w.sample || "Empty";
    return [R2.wellName(i), name, w.ext ? "Extract E" + w.ext : "", w.rep ? "PCR R" + w.rep : ""].filter(Boolean).join(" · ");
  };
  R2.selectPlate = (root, allowed, changed) => {
    let selected = null, anchor = null, initial = null, drag = null, suppress = false;
    const notify = focus => changed(selected, focus);
    const update = (values, e, focus) => {
      const next = values.filter(allowed), additive = e && (e.ctrlKey || e.metaKey);
      if (!additive) selected = new Set(next);
      else {
        if (selected === null) selected = new Set();
        for (const w of next) {
          if (next.length === 1 && !e.shiftKey && selected.has(w)) selected.delete(w);
          else selected.add(w);
        }
      }
      notify(focus);
    };
    const button = e => e.target.closest("[data-w]:not(:disabled)");
    root.addEventListener("pointerdown", e => {
      const b = button(e);
      if (e.button !== 0 || !b || e.pointerType !== "mouse") return;
      initial = { w: +b.dataset.w, x: e.clientX, y: e.clientY };
    });
    root.addEventListener("pointermove", e => {
      if (!initial || !(e.buttons & 1)) return;
      const b = button(e);
      if (b && Math.hypot(e.clientX - initial.x, e.clientY - initial.y) > 5) {
        drag = +b.dataset.w;
        root.querySelectorAll(".range-preview").forEach(el => el.classList.remove("range-preview"));
        for (const w of rect(initial.w, drag)) if (allowed(w)) root.querySelector(`[data-w="${w}"]`)?.classList.add("range-preview");
      }
    });
    const stop = e => {
      if (initial && drag !== null) {
        const values = rect(initial.w, drag), focus = drag;
        anchor = initial.w;
        suppress = true;
        setTimeout(() => { suppress = false; }, 0);
        update(values, e, focus);
      }
      initial = null;
      drag = null;
      root.querySelectorAll(".range-preview").forEach(el => el.classList.remove("range-preview"));
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", () => { initial = null; drag = null; root.querySelectorAll(".range-preview").forEach(el => el.classList.remove("range-preview")); });
    root.addEventListener("click", e => {
      if (suppress) return;
      const b = button(e), axis = e.target.closest("[data-row], [data-col]");
      if (b) {
        const w = +b.dataset.w;
        update(e.shiftKey && anchor !== null ? rect(anchor, w) : [w], e, w);
        if (!e.shiftKey || anchor === null) anchor = w;
      } else if (axis) {
        const rows = axis.dataset.row !== undefined, n = +(rows ? axis.dataset.row : axis.dataset.col);
        const a = anchor === null || !e.shiftKey ? n : rows ? Math.floor(anchor / cols) : anchor % cols;
        update(indexes.filter(w => {
          const coordinate = rows ? Math.floor(w / cols) : w % cols;
          return coordinate >= Math.min(a, n) && coordinate <= Math.max(a, n);
        }), e);
        if (!e.shiftKey || anchor === null) anchor = rows ? cell(n, 0) : n;
      }
    });
    root.addEventListener("keydown", e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") { e.preventDefault(); selected = null; notify(); }
      else if (e.key === "Escape") { selected = new Set(); notify(); }
      else if (button(e) && ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const start = +button(e).dataset.w, step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
        for (let w = start + step; w >= 0 && w < count && (Math.abs(step) > 1 || Math.floor(w / cols) === Math.floor(start / cols)); w += step) {
          if (!allowed(w)) continue;
          if (e.shiftKey) { anchor ??= start; update(rect(anchor, w), e, w); }
          root.querySelector(`[data-w="${w}"]`)?.focus();
          break;
        }
      }
    });
    return {
      all: () => { selected = null; anchor = null; notify(); },
      clear: () => { selected = new Set(); anchor = null; notify(); },
      reset: () => { selected = null; anchor = null; }
    };
  };
})(window.R2);
