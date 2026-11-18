/* Sensor curves of the source instrument (chaipcr realtime/app/constants.h) and the divider arithmetic of sheet R04/R05. */
(function (R2) {
  "use strict";
  const T = R2.thermistor = {};
  T.curves = {
    block: { name: "Block sensor (US Sensor J, 10 kΩ)", a: 1.129138e-3, b: 2.34126e-4, c: 8.76656e-8 },
    lid: { name: "Lid sensor (beta 3500 K, 10 kΩ at 25 °C)", a: 7.224906e-4, b: 2.857143e-4, c: 0 },
    heatsink: { name: "Heat-sink sensor (fit to QTI curve Z)", a: 1.124238e-3, b: 2.349958e-4, c: 8.38766e-8 }
  };
  T.ohmToC = (cv, r) => { const l = Math.log(r); return 1 / (cv.a + cv.b * l + cv.c * l * l * l) - 273.15; };
  T.cToOhm = function (cv, t) { let lo = 1, hi = 5e6; for (let i = 0; i < 80; i++) { const mid = Math.sqrt(lo * hi); if (T.ohmToC(cv, mid) > t) lo = mid; else hi = mid; } return Math.sqrt(lo * hi); };
  T.e96 = function (r) { const d = Math.pow(10, Math.floor(Math.log10(r))); let best = 1, err = 1e9; for (let i = 0; i < 96; i++) { const v = Math.round(Math.pow(10, i / 96) * 100) / 100; if (Math.abs(v * d - r) < err) { err = Math.abs(v * d - r); best = v; } } return best * d; };
  T.fmtR = r => r >= 1e6 ? (r / 1e6).toPrecision(3) + " MΩ" : r >= 1e3 ? (r / 1e3).toPrecision(3) + " kΩ" : r.toPrecision(3) + " Ω";
  // comparator threshold divider for a trip temperature: sensor to ground, pull-up rPu to the supply
  T.tripDivider = function (cv, tTrip, rPu, rBottom) {
    const rn = T.cToOhm(cv, tTrip), ratio = rn / (rn + rPu), rTopIdeal = rBottom * (1 - ratio) / ratio, rTop = T.e96(rTopIdeal);
    const got = rBottom / (rBottom + rTop), rAt = got * rPu / (1 - got);
    return { ntcOhm: rn, ratio, rTop, rBottom, ratioGot: got, tripActual: T.ohmToC(cv, rAt) };
  };
})(window.R2);
