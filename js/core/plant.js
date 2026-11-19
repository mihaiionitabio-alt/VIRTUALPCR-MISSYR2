/* Simulated instrument hardware: lumped thermal model, independent protection chain (sheet R04), detector.
 * JavaScript port of firmware/sim/hal_sim.c. Parameters are illustrative, not measured. */
(/* @r2fn R2-C0031-F00001 */function (R2) {
  "use strict";
  const NW = 16, FS = 4095, DARK = 200, COUNTS_PER_BP = 6.0e-12, COUNTS_PER_NM = 45;   // reporter dye: detector counts per nmol/L of unquenched fluorophore
  /* opts.wells: 16 (R2 block, default, engineer bench) or 384 (plate of the technician bench, imaged by a camera) */
  R2.Plant = /* @r2fn R2-C0031-F00002 */function (seed, opts) {
    opts = opts || {}; this.NW = opts.wells || NW; this.cols = this.NW === 384 ? 24 : 8; this.rows = this.NW / this.cols; this.camera = !!opts.camera;
    this.rng = new R2.Rng(seed || 7);
    this.opticsSeed = (opts.opticsSeed ?? ((seed || 7) ^ 0x47514f50)) >>> 0;
    const opticsRng = new R2.Rng(this.opticsSeed);
    this.t = 0; this.Tb = [25, 25]; this.Ts = [25, 25]; this.Tlid = 25; this.Ths = 25; this.Tamb = 25;
    this.duty = [0, 0]; this.lidDuty = 0; this.fan = 0; this.fwEnable = false; this.otTest = false; this.hwTrip = false;
    this.lidClosed = true; this.railsOk = true; this.wdtOk = true; this.lastKick = 0; this.iTec = [0, 0]; this.iLid = 0; this.fanRpm = 0;
    this.fault = null; this.faultAt = 0; this.faultEnd = 0; this.tripBlock = 108; this.tripLid = 125;
    this.wells = []; this.sel = -1; this.led = 0;
    for (let w = 0; w < this.NW; w++) this.wells.push({ a: R2.chem.assayDefaults(), ch: null, factor: this.camera ? 0.98 + 0.04 * ((w * 7) % 16) / 15 : 0.88 + 0.24 * ((w * 7) % 16) / 15, gainBoost: 1,
      driftOffset: cameraReporter.opticalVariation.baselineDriftSd * boundedNormal(opticsRng),
      scatterScale: Math.exp(cameraReporter.opticalVariation.logReadScatterSd * boundedNormal(opticsRng)),
      reporterRateOffset: cameraReporter.opticalVariation.cameraRateSd * boundedNormal(opticsRng),
      lateProfile: Math.floor(opticsRng.u() * lateP35SProfiles.length)
    });
    this.loadWells();
  };
  const P = R2.Plant.prototype; R2.Plant.COUNTS_PER_NM = COUNTS_PER_NM;
  const boundedNormal = /* @r2fn R2-C0031-F00003 */rng => R2.clamp(rng.gauss(), -2.5, 2.5);
  const cameraReporter = R2.Plant.CAMERA_REPORTER_MODEL = Object.freeze({ reachableFraction: 0.115, onsetFraction: 0.05, ratePerCycle: 0.61, transitionCycles: 2,
    lateP35S: Object.freeze({ firstCycle: 34, fullCycle: 37, onsetFraction: 0.025, profiles: 71, elapsedScale: 1.34, riseScale: 1.11 }),
    opticalVariation: Object.freeze({ baselineDriftSd: 0.00045, logReadScatterSd: 0.24, cameraRateSd: 0.026 }),
    rateByMethod: Object.freeze({
      "QT-TAX-GM-002": 0.58,
      "MARA-17-LEC": 0.649,
      "MARA-17-35S": 0.541,
      "MARA-17-NOS": 0.756
    })
  });
  // Normalized, smoothed rises from the 71 late OpticalCyclerA P-35S wells.
  // One entry per well preserves the association between growth and terminal signal.
  const lateP35SProfiles = [
    [0.025,0.0273,0.0322,0.0401,0.0535,0.0776,0.1186,0.1841,0.2787,0.3953,0.5005,0.5248],
    [0.025,0.0281,0.031,0.0356,0.0444,0.0599,0.0862,0.1274,0.1911,0.2761,0.3727,0.4693,0.5456,0.5697],
    [0.025,0.0276,0.0302,0.0326,0.0362,0.0401,0.0434,0.0456,0.0476,0.0496,0.0512,0.0544,0.0593,0.0665,0.0801,0.1044,0.1438,0.204,0.2847,0.3758,0.4548,0.4852],
    [0.025,0.0265,0.0269,0.0297,0.0345,0.037,0.0395,0.043,0.0464,0.0506,0.0558,0.0615,0.074,0.0984,0.1372,0.2035,0.3111,0.4693,0.6699,0.8719,0.987],
    [0.0329,0.0363,0.0391,0.0419,0.0456,0.051,0.0558,0.0586,0.0619,0.0632,0.0676,0.0729,0.0775,0.0839,0.0917,0.1029,0.1213,0.1522,0.2084,0.3005,0.4379,0.6251,0.8425,1.0625,1.2233],
    [0.025,0.037,0.0576,0.0914,0.1474,0.2305,0.3386,0.4585,0.5749,0.6697,0.7038],
    [0.025,0.0277,0.03,0.0313,0.0351,0.0401,0.0506,0.0685,0.0985,0.1485,0.2199,0.3152,0.4256,0.5378,0.6278,0.6451],
    [0.025,0.0494,0.0901,0.1513,0.2329,0.3295,0.4295,0.5196,0.5785],
    [0.025,0.0305,0.0389,0.054,0.0813,0.1257,0.1892,0.2698,0.3515,0.4232,0.474,0.4787],
    [0.025,0.0381,0.0631,0.1128,0.1898,0.2935,0.417,0.5502,0.6728,0.7535],
    [0.025,0.0263,0.0282,0.0303,0.0332,0.035,0.0375,0.0416,0.0458,0.052,0.06,0.0738,0.097,0.1365,0.2006,0.2907,0.4022,0.523,0.6367,0.7232,0.7457],
    [0.025,0.0274,0.0302,0.0347,0.0409,0.0499,0.0641,0.0892,0.1342,0.2112,0.3309,0.4968,0.697,0.9056,1.0892,1.1813],
    [0.025,0.0277,0.0316,0.0339,0.0369,0.0394,0.0418,0.0447,0.0485,0.0541,0.0617,0.0717,0.0902,0.1241,0.1799,0.2622,0.3719,0.501,0.6333,0.7496,0.8186],
    [0.025,0.031,0.0411,0.0577,0.0866,0.135,0.2075,0.3049,0.4213,0.5424,0.647,0.694],
    [0.025,0.0306,0.0385,0.0542,0.0794,0.1236,0.1991,0.3091,0.4413,0.5848,0.7209,0.8255,0.8407],
    [0.0262,0.027,0.0287,0.0319,0.0335,0.0359,0.0374,0.0399,0.043,0.0448,0.0472,0.0504,0.055,0.0612,0.0719,0.0873,0.1137,0.1563,0.2316,0.3503,0.5208,0.7278,0.9476,1.1503,1.2894],
    [0.025,0.0267,0.0285,0.0311,0.0333,0.0357,0.0391,0.0436,0.0476,0.0533,0.0623,0.0734,0.089,0.1154,0.1632,0.2398,0.3527,0.5021,0.6769,0.8443,0.9216],
    [0.025,0.0275,0.029,0.0316,0.0343,0.0352,0.0367,0.0398,0.0473,0.0602,0.0787,0.1099,0.1629,0.2498,0.3828,0.5619,0.7741,0.9972,1.194,1.2821],
    [0.025,0.0277,0.0291,0.0291,0.0291,0.0294,0.0346,0.0388,0.0428,0.049,0.057,0.0683,0.0902,0.1273,0.1952,0.3033,0.4552,0.6456,0.8469,1.0007],
    [0.025,0.0263,0.029,0.0335,0.0364,0.0384,0.0401,0.0407,0.0407,0.0418,0.0464,0.051,0.0542,0.0612,0.0722,0.0881,0.1164,0.1665,0.2463,0.365,0.5222,0.7064,0.8812,0.9502],
    [0.025,0.0318,0.0441,0.0627,0.0858,0.1121,0.1297],
    [0.025,0.0339,0.0487,0.075,0.1206,0.1891,0.2806,0.3826,0.4738,0.5359,0.5497],
    [0.025,0.0368,0.0588,0.0958,0.1549,0.237,0.3329,0.4219,0.4785],
    [0.025,0.0293,0.032,0.0325,0.0339,0.0369,0.0399,0.0433,0.0465,0.0504,0.0541,0.0591,0.0696,0.0852,0.1112,0.1509,0.2059,0.2668,0.3207,0.3575,0.3635],
    [0.025,0.0279,0.0296,0.0312,0.0329,0.0376,0.0409,0.0413,0.0433,0.0468,0.0501,0.0533,0.0563,0.058,0.0628,0.0691,0.0767,0.093,0.1198,0.1582,0.2105,0.2731,0.3262,0.3605,0.3615],
    [0.025,0.0275,0.0285,0.0302,0.0329,0.0358,0.0385,0.0408,0.0438,0.0497,0.0601,0.075,0.0991,0.1407,0.2053,0.295,0.4063,0.5243,0.6237,0.6685],
    [0.025,0.0267,0.0291,0.0316,0.0328,0.0346,0.0377,0.0397,0.0405,0.0429,0.0468,0.0496,0.0547,0.0627,0.0731,0.0875,0.1092,0.1409,0.1853,0.2418,0.3024,0.3531,0.3599],
    [0.025,0.0275,0.0298,0.0314,0.032,0.0337,0.0364,0.0401,0.0454,0.0517,0.0605,0.0756,0.099,0.1307,0.1701,0.2122,0.2481,0.2654],
    [0.025,0.0278,0.0284,0.0298,0.0332,0.0362,0.0383,0.0398,0.0425,0.0483,0.0565,0.07,0.0891,0.1183,0.1618,0.2109,0.2504,0.2676],
    [0.025,0.0375,0.0604,0.0998,0.1604,0.2448,0.3441,0.4411,0.5178,0.5554],
    [0.025,0.0275,0.0295,0.0314,0.0344,0.0393,0.0468,0.0604,0.0827,0.1176,0.1726,0.2479,0.3308,0.4017,0.4342],
    [0.025,0.0288,0.0346,0.0429,0.0568,0.082,0.1256,0.1919,0.2775,0.3693,0.4506,0.4972],
    [0.025,0.0264,0.0274,0.0302,0.0333,0.0371,0.0429,0.0516,0.0691,0.0981,0.1455,0.2165,0.3083,0.4104,0.505,0.5612],
    [0.025,0.0269,0.029,0.0299,0.0312,0.0328,0.0356,0.038,0.0425,0.0477,0.056,0.072,0.0957,0.1337,0.19,0.2666,0.361,0.463,0.5579,0.6232],
    [0.025,0.0328,0.0465,0.0701,0.1098,0.1695,0.2506,0.3459,0.442,0.5178,0.554],
    [0.025,0.0322,0.0436,0.0639,0.0992,0.1535,0.2282,0.3197,0.4149,0.4922,0.5224],
    [0.025,0.0412,0.0667,0.1012,0.1439,0.1884,0.2231,0.2302],
    [0.025,0.0336,0.0454,0.0655,0.0998,0.1541,0.2315,0.3294,0.4331,0.5232,0.5769],
    [0.025,0.0279,0.0281,0.0314,0.0352,0.0354,0.0385,0.0433,0.0471,0.0507,0.0596,0.0724,0.0925,0.1265,0.1727,0.231,0.2793,0.3065],
    [0.025,0.0251,0.0282,0.032,0.0322,0.0352,0.0401,0.0438,0.048,0.0561,0.0671,0.0895,0.1241,0.175,0.2498,0.3294,0.384,0.3876],
    [0.025,0.0274,0.028,0.0296,0.0333,0.0354,0.0376,0.0428,0.0485,0.0532,0.0599,0.0725,0.0949,0.1298,0.181,0.2571,0.3522,0.44,0.4777],
    [0.025,0.0282,0.0324,0.0333,0.0388,0.0459,0.0547,0.0682,0.0938,0.1345,0.1992,0.2857,0.3847,0.49,0.5734,0.6182],
    [0.025,0.0374,0.0593,0.0918,0.1368,0.1913,0.2503,0.298,0.2981],
    [0.025,0.0495,0.0926,0.1579,0.2414,0.3305,0.4011,0.4206],
    [0.025,0.0334,0.0462,0.067,0.098,0.1402,0.1877,0.2269,0.2353],
    [0.025,0.0387,0.0623,0.1042,0.1696,0.2545,0.3457,0.4204,0.4476],
    [0.025,0.0382,0.0609,0.1,0.1609,0.244,0.3397,0.4269,0.4835,0.4875],
    [0.025,0.0276,0.0323,0.0422,0.0578,0.0849,0.1289,0.1893,0.2579,0.3171,0.3517],
    [0.025,0.0433,0.0727,0.1117,0.1504,0.1811,0.1987],
    [0.025,0.0404,0.068,0.1129,0.1802,0.2683,0.3649,0.4495,0.5016,0.5088],
    [0.025,0.0358,0.0547,0.0851,0.1356,0.2114,0.3081,0.4147,0.5122,0.5692],
    [0.025,0.0329,0.0466,0.0701,0.1085,0.1662,0.2449,0.3408,0.4447,0.5405,0.582],
    [0.025,0.0325,0.0435,0.0615,0.093,0.1424,0.215,0.3083,0.4127,0.5133,0.5867,0.6037],
    [0.025,0.0265,0.0282,0.0316,0.0382,0.0491,0.068,0.1006,0.1512,0.2222,0.3046,0.3756,0.407],
    [0.025,0.047,0.0798,0.1238,0.1766,0.2293,0.2603],
    [0.025,0.0414,0.0731,0.128,0.2078,0.3034,0.3968,0.4575],
    [0.025,0.0324,0.0469,0.0738,0.1176,0.1845,0.2797,0.396,0.5192,0.632,0.6941],
    [0.025,0.0303,0.041,0.0602,0.0931,0.1461,0.2252,0.328,0.4318,0.4792],
    [0.025,0.0393,0.0646,0.1094,0.1785,0.2729,0.3823,0.4907,0.5748,0.6021],
    [0.025,0.0446,0.0801,0.1392,0.2246,0.3276,0.4315,0.5069],
    [0.025,0.036,0.0587,0.0976,0.1599,0.2476,0.3498,0.4469,0.5105,0.5172],
    [0.025,0.0296,0.0369,0.0502,0.0755,0.1213,0.1913,0.2862,0.3932,0.4664],
    [0.025,0.037,0.0572,0.093,0.1497,0.2188,0.2868,0.3411,0.3697],
    [0.025,0.0328,0.0457,0.0662,0.1009,0.159,0.2446,0.3548,0.4757,0.5809,0.6398],
    [0.025,0.0361,0.0567,0.0897,0.1404,0.209,0.2823,0.3347,0.3353],
    [0.025,0.0395,0.0649,0.1079,0.1707,0.2518,0.3406,0.4025],
    [0.025,0.0373,0.0577,0.0924,0.143,0.206,0.266,0.3029],
    [0.025,0.0373,0.0583,0.0928,0.148,0.2267,0.3261,0.4312,0.5211,0.5713],
    [0.025,0.0379,0.0622,0.1008,0.1585,0.2254,0.2837,0.3208],
    [0.025,0.028,0.0325,0.0395,0.0515,0.0723,0.1071,0.1607,0.2325,0.304,0.3329],
    [0.025,0.0437,0.0767,0.1301,0.2076,0.3079,0.4197,0.5198,0.5687]
  ];
  /* Hydrolysis probe (a.probe): { nM: intact probe carrying a working reporter, darkNM: intact probe whose reporter is bleached,
   * freeNM: reporter already cut loose by degradation, tm, width, q: quenching efficiency, channel }.
   * Every completed copy of the target cuts one bound probe; the share bound is set by the probe Tm against the coolest
   * temperature of the cycle (the annealing step). A well may hold a second reaction (a2) for duplex assays. */
  /* Curve shape follows what real hydrolysis-probe runs look like (12,500 curves of 730 screening and reference-gene runs,
   * 45 cycles): the plateau is about 2.3 times the baseline, because only a small share of the probe is ever cut and
   * the intact probe is not fully quenched; the baseline starts about 3 % high and falls about 0.15 % per cycle; one
   * reading scatters by about 0.16 % of the baseline. CUT_MAX is the share of probe cut when the product reaches its plateau. */
  const CUT_MAX = 0.15, FIRST_HIGH = 0.03, DRIFT = 0.0015, READ_SCATTER = 0.0016;
  const probeInit = /* @r2fn R2-C0031-F00004 */a => a && a.probe ? { tot: (a.probe.nM + a.probe.darkNM) * R2.chem.NM, cut: 0, last: 0, tmin: 200, hot: false, cycles: 0 } : null;
  P.loadWells = /* @r2fn R2-C0031-F00005 */function () { for (const w of this.wells) { w.ch = R2.chem.init(w.a, this.rng); w.pr = probeInit(w.a); w.ch2 = w.a2 ? R2.chem.init(w.a2, this.rng) : null; w.pr2 = probeInit(w.a2); w.jit = 1; w.cycles = 0; w.hot = false; } };
  /* @r2fn R2-C0031-F00006 */function probeStep(a, ch, pr, T) {
    if (T > 85) { pr.tmin = 200; if (!pr.hot) { pr.hot = true; pr.cycles++; } } else { if (T < pr.tmin) pr.tmin = T; if (T < 75) pr.hot = false; }
    const made = ch.madeTgt - pr.last; pr.last = ch.madeTgt; if (made <= 0) return;
    // share of new strands that carry a probe: equilibrium (probe Tm against the annealing temperature) times how far hybridisation gets in the annealing time
    const hyb = 1 - Math.exp(-2e-3 * (a.probe.nM + a.probe.darkNM) * (a.probe.annS || 60)), full = 2 * (a.primer_ref_nM || a.primer_nM) * R2.chem.NM * 0.8;      // product at its plateau under the method's own primer concentration
    const delta = pr.tot * CUT_MAX * (made / full) * R2.sigm((a.probe.tm - pr.tmin) / a.probe.width) * hyb / 0.95;
    pr.cut = Math.min(pr.tot * CUT_MAX * 1.5, pr.cut + delta);
  }
  const smoothstep = /* @r2fn R2-C0031-F00007 */value => { const u = R2.clamp(value, 0, 1); return u * u * (3 - 2 * u); };
  /* @r2fn R2-C0031-F00008 */function lateReporter(profile, elapsed) {
    const last = profile.length - 1, i = Math.floor(elapsed);
    if (i < last) return profile[i] + (elapsed - i) * (profile[i + 1] - profile[i]);
    const increment = Math.max(0, profile[last] - profile[Math.max(0, last - 2)]) / 2;
    return profile[last] + increment * (1 - Math.exp(-0.45 * (elapsed - last))) / 0.45;
  }
  /* @r2fn R2-C0031-F00009 */function cameraCleavage(pr, methodId, well) {
    const limit = pr.tot * cameraReporter.reachableFraction;
    if (limit <= 0) return 0;
    const fraction = pr.cut / limit;
    const late = cameraReporter.lateP35S;
    if (methodId === "MARA-17-35S" && !pr.onset && !pr.lateOnset &&
        pr.cycles >= late.firstCycle && fraction >= late.onsetFraction) {
      pr.lateOnset = { cycle: pr.cycles, fraction };
    }
    if (!pr.onset && fraction >= cameraReporter.onsetFraction) {
      const start = R2.clamp(fraction, cameraReporter.onsetFraction, 0.8);
      pr.onset = { cycle: pr.cycles, logit: Math.log(start / (1 - start)) };
    }
    let response = fraction;
    if (pr.onset) {
      const elapsed = pr.cycles - pr.onset.cycle;
      const rate = (cameraReporter.rateByMethod[methodId] ?? cameraReporter.ratePerCycle) + well.reporterRateOffset;
      response += smoothstep(elapsed / cameraReporter.transitionCycles) *
        (R2.sigm(pr.onset.logit + rate * elapsed) - response);
    }
    if (pr.lateOnset) {
      const elapsed = pr.cycles - pr.lateOnset.cycle;
      const lateWeight = smoothstep((pr.lateOnset.cycle - late.firstCycle) / (late.fullCycle - late.firstCycle));
      const profile = lateP35SProfiles[well.lateProfile];
      const fitted = profile[0] + late.riseScale *
        (lateReporter(profile, elapsed * late.elapsedScale) - profile[0]);
      const offset = (pr.lateOnset.fraction - late.onsetFraction) * Math.exp(-elapsed);
      response += lateWeight * smoothstep(elapsed / cameraReporter.transitionCycles) * (fitted + offset - response);
    }
    return limit * R2.clamp(response, 0, 1.65);
  }
  const probeCounts = /* @r2fn R2-C0031-F00010 */(a, pr, t, camera, well) => {
    const cut = camera ? cameraCleavage(pr, a.probe.methodId, well) : pr.cut;
    const bright = a.probe.nM / Math.max(1e-9, a.probe.nM + a.probe.darkNM), cutNM = cut / R2.chem.NM * bright, intactNM = (pr.tot - cut) / R2.chem.NM * bright;
    return COUNTS_PER_NM * (cutNM + (intactNM * (1 - a.probe.q) + a.probe.freeNM) * (1 + FIRST_HIGH * Math.exp(-pr.cycles / 2) - (DRIFT + well.driftOffset) * pr.cycles)) * (1 - 0.004 * (t - 60));
  };
  P.probeState = /* @r2fn R2-C0031-F00011 */function (wi, second) { const w = this.wells[wi], a = second ? w.a2 : w.a, pr = second ? w.pr2 : w.pr; if (!pr) return null; return { cleaved: pr.tot > 0 ? pr.cut / pr.tot : 0, bound: R2.sigm((a.probe.tm - Math.min(pr.tmin, this.wellTemp(wi))) / a.probe.width), tm: a.probe.tm }; };
  P.zoneOf = /* @r2fn R2-C0031-F00012 */function (w) { return (w % this.cols) < this.cols / 2 ? 0 : 1; };
  // tubes at the ends of the block (and, on the 384-well plate, the first and last row) lose a little more heat to the room
  P.wellTemp = /* @r2fn R2-C0031-F00013 */function (w) { const t = this.Ts[this.zoneOf(w)], col = w % this.cols, row = Math.floor(w / this.cols), edge = col === 0 || col === this.cols - 1 || (this.cols === 24 && (row === 0 || row === this.rows - 1)); return edge ? t - (this.camera ? 0.0015 : 0.008) * (t - this.Tamb) : t; };
  P.faultActive = /* @r2fn R2-C0031-F00014 */function (name) { return this.fault === name && this.t >= this.faultAt && (!this.faultEnd || this.t < this.faultEnd); };
  P.hwEnable = /* @r2fn R2-C0031-F00015 */function () { return this.fwEnable && !this.hwTrip && this.wdtOk && this.lidClosed && this.railsOk; };
  P.chain = /* @r2fn R2-C0031-F00016 */function () {            // every node of the enable chain, for display
    return { fwEnable: this.fwEnable, tripLatched: this.hwTrip, watchdogOk: this.wdtOk, lidClosed: this.lidClosed, railsOk: this.railsOk, enDrv: this.hwEnable() };
  };
  P.stepMs = /* @r2fn R2-C0031-F00017 */function () {
    const dt = 1e-3; this.t++;
    if (this.fault === "lid_open") this.lidClosed = !this.faultActive("lid_open");
    if (this.faultActive("rails")) this.railsOk = false;
    this.wdtOk = (this.t - this.lastKick) <= 200;
    const tref = Math.max(this.Tb[0], this.Tb[1]);
    if (tref > this.tripBlock || this.Tlid > this.tripLid || this.otTest) this.hwTrip = true;
    if (this.faultActive("latch_dead")) this.hwTrip = false;
    const en = this.hwEnable(); let Qhs = 0;
    for (let z = 0; z < 2; z++) {
      let d = this.duty[z];
      if (this.faultActive("bridge_stuck") && z === 0) d = 1;
      if (this.faultActive("tec_open") && z === 0) d = 0;
      if (!en) d = 0;
      this.iTec[z] = Math.abs(d) * 6000;
      const Q = d > 0 ? d * 90 : d * 60, cond = 0.35 * (this.Tb[z] - this.Ths);
      const dTb = (Q - cond - 0.27 * (this.Tb[z] - this.Ts[z]) - 0.5 * (this.Tb[z] - this.Tb[1 - z]) - 0.05 * (this.Tb[z] - this.Tamb)) / 21;
      const dTs = (0.27 * (this.Tb[z] - this.Ts[z]) + 0.006 * (this.Tlid - this.Ts[z])) / 0.67;
      this.Tb[z] += dTb * dt; this.Ts[z] += dTs * dt; Qhs += -Q + Math.abs(d) * 40 + cond;
    }
    const fan = this.faultActive("fan_stall") ? 0 : this.fan;
    this.fanRpm = Math.floor(4200 * fan);
    this.Ths += (Qhs - (1.5 + 8 * fan) * (this.Ths - this.Tamb)) / 200 * dt;
    const lid = en ? this.lidDuty : 0; this.iLid = lid * 2000;
    this.Tlid += (40 * lid - 0.12 * (this.Tlid - this.Tamb)) / 25 * dt;
    if (this.t % 50 === 0) for (let i = 0; i < this.NW; i++) { const w = this.wells[i]; if (w.a.kind === "empty") continue; const T = this.wellTemp(i);
      if (T > 85) { if (!w.hot) { w.hot = true; w.cycles++; } } else if (T < 75) w.hot = false;
      R2.chem.step(w.ch, w.a, T, 0.05, this.rng); if (w.pr) probeStep(w.a, w.ch, w.pr, T);
      if (w.a2) { R2.chem.step(w.ch2, w.a2, T, 0.05, this.rng); if (w.pr2) probeStep(w.a2, w.ch2, w.pr2, T); } }
  };
  // sensors as the controller sees them: [zone1, zone2, lid, heat sink, independent block sensor]; NaN = open, -Infinity = short
  P.readSensors = /* @r2fn R2-C0031-F00018 */function () {
    const n = /* @r2fn R2-C0031-F00019 */() => 0.01 * this.rng.gauss();
    const r = [this.Tb[0] + n(), this.Tb[1] + n(), this.Tlid + n(), this.Ths + n(), 0.5 * (this.Tb[0] + this.Tb[1]) + n()];
    if (this.faultActive("ntc_open")) r[0] = NaN;
    if (this.faultActive("ntc_short")) r[0] = -Infinity;
    if (this.faultActive("ntc_drift")) r[0] = this.Tb[0] - Math.min(12, (this.t - this.faultAt) * 1e-3 * 0.5) + n();
    return r;
  };
  P.clearTrip = /* @r2fn R2-C0031-F00020 */function () { if (Math.max(this.Tb[0], this.Tb[1]) < 100 && this.Tlid < 115 && !this.otTest) this.hwTrip = false; };
  P.kick = /* @r2fn R2-C0031-F00021 */function () { this.lastKick = this.t; };
  P.select = /* @r2fn R2-C0031-F00022 */function (well, code) { this.sel = well; this.led = well < 0 ? 0 : code / 128; if (well >= 0) this.wells[well].jit = 1 + READ_SCATTER * this.wells[well].scatterScale * this.rng.gauss(); };   // each reading of a tube differs slightly (optical path, timing)
  // expected detector counts (above dark) of both channels for a well, LED on
  P.signal = /* @r2fn R2-C0031-F00023 */function (wi) {
    const w = this.wells[wi], t = this.wellTemp(wi); let dyeA = 0, dyeB = 0;
    if (w.a.kind === "reaction") {
      const add = /* @r2fn R2-C0031-F00024 */(a, ch, pr) => { if (pr) { const v = probeCounts(a, pr, t, this.camera, w); if (a.probe.channel === 1) dyeB += v; else dyeA += v; } else dyeA += (COUNTS_PER_BP * 0.55 * R2.chem.dsBasePairs(ch, a, t) + 780 * (1 + FIRST_HIGH * Math.exp(-w.cycles / 2) - (DRIFT + w.driftOffset) * w.cycles)) * (1 - 0.008 * (t - 60)); };   // SYBR Green: unbound dye and primers give a sizeable background
      add(w.a, w.ch, w.pr); if (w.a2) add(w.a2, w.ch2, w.pr2);
      if (!w.a.noRef) dyeB += 800 * (1 - 0.003 * (t - 60));            // passive reference dye, absent in probe-based mixes run without it
    }
    else if (w.a.kind === "dye1") dyeA = 1800 * (1 - 0.008 * (t - 60));
    else if (w.a.kind === "dye2") dyeB = 800 * (1 - 0.003 * (t - 60));
    const f = w.factor * this.led * w.jit;
    return [f * (1.00 * dyeA + 0.04 * dyeB + 60) * w.gainBoost, f * (0.08 * dyeA + 1.00 * dyeB + 50)];
  };
  // one 1 ms chop period: 8 samples LED on, 8 samples LED off, per channel, plus the LED reference photodiode
  P.opticsPeriod = /* @r2fn R2-C0031-F00025 */function () {
    const n = 8, g = this.rng, p = { on: [0, 0], off: [0, 0], sat: [0, 0], refOn: 0, refOff: 0 };
    const sig = (this.sel >= 0 && this.hwEnable()) ? this.signal(this.sel) : [0, 0];
    for (let c = 0; c < 2; c++) for (let k = 0; k < n; k++) {
      let v = DARK + sig[c] + (2 + 0.15 * Math.sqrt(sig[c])) * g.gauss();
      if (v >= FS) { v = FS; p.sat[c]++; }
      p.on[c] += Math.floor(v + 0.5); p.off[c] += Math.floor(DARK + 2 * g.gauss() + 0.5);
    }
    for (let k = 0; k < n; k++) { p.refOn += Math.floor(DARK + 3000 * this.led + 3 * g.gauss() + 0.5); p.refOff += Math.floor(DARK + 2 * g.gauss() + 0.5); }
    if (this.sel < 0) p.refOn = p.refOff;
    return p;
  };
  /* camera exposure (384-well plate): the whole plate is lit and imaged at once; every occupied well gets its own
   * chopped integral, as one pixel group of the camera; each exposure scatters a little per well (optical path) */
  P.illuminate = /* @r2fn R2-C0031-F00026 */function (code, wells) { this.led = code / 128; for (const w of wells) this.wells[w].jit = 1 + READ_SCATTER * this.wells[w].scatterScale * this.rng.gauss(); };
  P.darken = /* @r2fn R2-C0031-F00027 */function () { this.led = 0; };
  P.opticsPeriodWell = /* @r2fn R2-C0031-F00028 */function (wi) {
    const n = 8, g = this.rng, p = { on: [0, 0], off: [0, 0], sat: [0, 0] }, sig = this.led > 0 && this.hwEnable() ? this.signal(wi) : [0, 0];
    for (let c = 0; c < 2; c++) for (let k = 0; k < n; k++) { let v = DARK + sig[c] + (2 + 0.15 * Math.sqrt(sig[c])) * g.gauss(); if (v >= FS) { v = FS; p.sat[c]++; } p.on[c] += Math.floor(v + 0.5); p.off[c] += Math.floor(DARK + 2 * g.gauss() + 0.5); }
    return p;
  };
  P.opticsReference = /* @r2fn R2-C0031-F00029 */function () { const n = 8, g = this.rng; let on = 0, off = 0; for (let k = 0; k < n; k++) { on += Math.floor(DARK + 3000 * this.led + 3 * g.gauss() + 0.5); off += Math.floor(DARK + 2 * g.gauss() + 0.5); } return { on: this.led > 0 ? on : off, off }; };
  R2.Plant.FAULTS = { ntc_open: "Zone-1 sensor open", ntc_short: "Zone-1 sensor short", ntc_drift: "Zone-1 sensor drifts low", tec_open: "Peltier 1 open circuit",
    fan_stall: "Fan stalled", lid_open: "Lid opened", rails: "Supply rail fails", bridge_stuck: "Bridge 1 stuck fully on",
    fw_hang: "Firmware hangs", fw_runaway: "Firmware drives full heat, ignores limits", latch_dead: "Trip latch defective" };
})(window.R2);

