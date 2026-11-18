/* Technician tab 7: storage of the reagents, handling on the bench, and the room. */
(function (R2) {
  "use strict";
  const $ = R2.$, X = R2.tech, NUM = ["probeMonths", "probeLightH", "freezeThaw", "primerMonths", "mixMonths", "benchMin", "ambientC", "carryover", "pipetCV", "inhibitor"], SEL = ["probeStoreC", "primerStoreC", "mixStoreC"], CHK = ["hotStart", "ungActive"];
  const temps = `<option value="-80">−80 °C</option><option value="-20">−20 °C</option><option value="4">4 °C</option><option value="22">22 °C</option><option value="37">37 °C</option>`;
  function draw() { const s = X.settings; for (const k of NUM) $("r-" + k).value = s[k]; for (const k of SEL) $("r-" + k).value = String(s[k]); for (const k of CHK) $("r-" + k).checked = s[k]; X.effects("r-eff2"); }
  X.tab({ id: "storage", title: "Storage and handling", done: () => { const d = R2.reagents.DEFAULT; return [...NUM, ...SEL, ...CHK].some(k => X.settings[k] !== d[k]); },
    html: `<div class="grid two"><div class="stack">
        <div class="panel"><h3>Storage</h3>
          <div class="row"><label>Probe stored at <select id="r-probeStoreC">${temps}</select></label><label>for <input id="r-probeMonths" type="number" min="0" max="120" style="width:4.5em"> months</label></div>
          <div class="row"><label>Probe in room light <input id="r-probeLightH" type="number" min="0" max="500" style="width:4.5em"> h</label><label>Freeze–thaw cycles <input id="r-freezeThaw" type="number" min="0" max="200" style="width:4.5em"></label></div>
          <div class="row"><label>Primers stored at <select id="r-primerStoreC">${temps}</select></label><label>for <input id="r-primerMonths" type="number" min="0" max="120" style="width:4.5em"> months</label></div>
          <div class="row"><label>Master mix stored at <select id="r-mixStoreC">${temps}</select></label><label>for <input id="r-mixMonths" type="number" min="0" max="60" style="width:4.5em"> months</label></div></div>
        <div class="panel"><h3>On the bench and in the room</h3>
          <div class="row"><label class="c"><input id="r-hotStart" type="checkbox"> hot-start polymerase</label><label>Plate waits <input id="r-benchMin" type="number" min="0" max="240" style="width:4.5em"> min</label><label>Room <input id="r-ambientC" type="number" min="10" max="38" style="width:4em"> °C</label></div>
          <div class="row"><label>Amplicon carry-over <input id="r-carryover" type="number" min="0" max="100000" step="10" style="width:6em"> copies per tube</label><label class="c"><input id="r-ungActive" type="checkbox"> UNG active in the mix</label></div>
          <div class="row"><label>Pipetting scatter <input id="r-pipetCV" type="number" min="0" max="30" style="width:4em"> %</label><label>Extra inhibitor in the sample <input id="r-inhibitor" type="number" min="0" max="0.8" step="0.05" style="width:4.5em"></label></div>
          <div class="row"><button id="r-reset2">Fresh reagents, method conditions</button></div></div></div>
      <div class="panel"><div id="r-eff2" class="stack" style="gap:5px"></div><p class="note">Half-lives, bleaching times and the other magnitudes are teaching assumptions of this bench, not properties of any product.</p></div></div>`,
    init() {
      for (const k of NUM) $("r-" + k).onchange = e => { X.settings[k] = +e.target.value || 0; draw(); X.marks(); };
      for (const k of SEL) $("r-" + k).onchange = e => { X.settings[k] = +e.target.value; draw(); X.marks(); };
      for (const k of CHK) $("r-" + k).onchange = e => { X.settings[k] = e.target.checked; draw(); X.marks(); };
      $("r-reset2").onclick = () => { const d = R2.reagents.DEFAULT; for (const k of [...NUM, ...SEL, ...CHK]) X.settings[k] = d[k]; draw(); X.marks(); };
    }, show: draw });
})(window.R2);
