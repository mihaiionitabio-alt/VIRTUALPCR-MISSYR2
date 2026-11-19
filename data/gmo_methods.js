/* EURL GMFF reference methods used on the technician bench.
 * Source: GMOMETHODS, the EU database of reference methods for GMO analysis (https://gmo-crl.jrc.ec.europa.eu/gmomethods/),
 * read on 16 November 2026 from each method's PDF summary. Oligonucleotides, concentrations, volumes, cycling stages,
 * reported performance and the reference material are copied from those records. © European Union; reuse with
 * acknowledgement of the source.
 * Element presence per event: JRC GMO-Matrix export (matrix_1.csv), 2 = amplification predicted with perfect annealing,
 * 1 = with imperfect annealing, 0 = none. The P-35S column of that export belongs to method QL-ELE-00-004; it is used
 * here for the P-35S assay QL-ELE-00-012, whose amplicon lies elsewhere in the promoter.
 * Not from the database (model assumptions, marked "assumed"): genome mass per haploid genome, the GM content of the
 * control material where the record names only the material, and amplicon lengths the record does not list.
 * Fields: F/R/P oligos; nM = final concentrations [forward, reverse, probe] in nmol/L; cyc = [UNG s at 50 °C, activation s
 * at 95 °C, cycles, denaturation s, anneal °C, anneal s, extension °C or 0, extension s]; eff = reported PCR efficiency %. */
(/* @r2fn R2-C0006-F00001 */function (R2) {
  "use strict";
  const M = {};
  const add = /* @r2fn R2-C0006-F00002 */(id, o) => { o.id = id; M[id] = o; };
  // ---------- taxon-specific (endogenous reference) systems ----------
  add("QT-TAX-GM-002", { kind: "taxon", crop: "soybean", target: "LE1 (lectin)", title: "Soybean lectin gene (LE1), ISO 21570:2005", bp: 74, bpSrc: "JRC136933",
    F: ["lecF", "CCAGCTTCGCCGCTTCCTTC"], R: ["lecR", "GAAGGCAAGCCCATCTGCAAGCC"], P: ["GM1", "FAM", "CTTCACCTTCTATGCCCCTGACAC", "TAMRA"], nM: [150, 150, 50], vol: 50, cyc: [120, 600, 45, 15, 60, 60, 0, 0], eff: 95 });
  add("QT-TAX-GM-009", { kind: "taxon", crop: "soybean", target: "LE1 (lectin)", title: "Soybean lectin gene (LE1), EURL GMFF 2007", bp: 105,
    F: ["KVM164", "CACCTTTCTCGCACCAATTGACA"], R: ["KVM165", "TCAAACTCAACAGCGACGAC"], P: ["TM021", "FAM", "CCACAAACACATGCAGGTTATCTTGG", "TAMRA"], nM: [200, 200, 200], vol: 25, cyc: [120, 600, 45, 15, 60, 60, 0, 0] });
  add("QT-TAX-GM-020", { kind: "taxon", crop: "soybean", target: "LE1 (lectin)", title: "Soybean lectin gene (LE1), EURL GMFF 2009", bp: 102, bpSrc: "JRC136933 (equivalent method QT-TAX-GM-003)",
    F: ["KVM164", "CTTTCTCGCACCAATTGACA"], R: ["KVM165", "TCAAACTCAACAGCGACGAC"], P: ["TM021", "VIC", "CCACAAACACATGCAGGTTATCTTGG", "TAMRA"], nM: [200, 200, 200], vol: 25, cyc: [120, 600, 45, 15, 60, 60, 0, 0], eff: 94 });
  add("QT-TAX-ZM-002", { kind: "taxon", crop: "maize", target: "HMG (high-mobility-group)", title: "Maize high-mobility-group gene (HMG), ISO 21570:2005", bp: 79, bpSrc: "JRC136933",
    F: ["ZM1-F", "TTGGACTAGAAATCTCGTGCTGA"], R: ["ZM1-R", "GCTACATAGGGAGCCTTGTCCT"], P: ["Probe ZM1", "FAM", "CAATCCACACAAACGCACGCGTA", "TAMRA"], nM: [300, 300, 160], vol: 25, cyc: [120, 600, 45, 15, 60, 60, 0, 0], eff: 95 });
  add("QT-TAX-ZM-011", { kind: "taxon", crop: "maize", target: "ADH1 (alcohol dehydrogenase 1)", title: "Maize alcohol dehydrogenase 1 gene (ADH1), EURL GMFF 2005", bp: 70, bpSrc: "assumed; the record lists no amplicon",
    F: ["Adh1 primer F", "CCTTCTTGGCGGCTTATCTG"], R: ["Adh1 primer R", "CCAGCCTCATGGCCAAAG"], P: ["Adh1 probe PR", "FAM", "CTTAGGGGCAGACTCCCGTGTTCCCT", "TAMRA"], nM: [150, 150, 50], vol: 50, cyc: [120, 600, 45, 15, 60, 60, 0, 0] });
  add("QT-TAX-ZM-014", { kind: "taxon", crop: "maize", target: "ADH1 (alcohol dehydrogenase 1)", title: "Maize alcohol dehydrogenase 1 gene (ADH1), EURL GMFF 2007", bp: 135, bpSrc: "JRC136933 (equivalent method QT-TAX-ZM-001)",
    F: ["Zm Adh1 primer F", "CGTCGTTTCCCATCTCTTCCTCC"], R: ["Zm Adh1 primer R", "CCACTCCGAGACCCTCAGTC"], P: ["Zm Adh1 probe", "VIC", "AATCAGGGCTCATTTTCTCGCTCCTCA", "TAMRA"], nM: [300, 300, 200], vol: 25, cyc: [120, 600, 40, 15, 60, 60, 0, 0] });
  // ---------- screening: element- and construct-specific ----------
  add("QL-ELE-00-012", { kind: "screen", el: "p35s", target: "CaMV P-35S promoter", title: "P-35S, duplex with T-nos (Waiblinger et al., 2008)", duplexWith: "QL-ELE-00-013",
    amp: "GCCTCTGCCGACAGTGGTNNCAAAGATGGACCCCCACCCACGNNNNNNNNNNNNNNNNNNGAAGACGTTCCAACCACGTCTT",
    F: ["35S-FTM", "GCCTCTGCCGACAGTGGT"], R: ["35S-RTM", "AAGACGTGGTTGGAACGTCTTC"], P: ["35S-TMP-FAM", "FAM", "CAAAGATGGACCCCCACCCACG", "BHQ1"], nM: [100, 100, 100], vol: 25, cyc: [120, 600, 45, 15, 60, 60, 0, 0], eff: 102,
    lod: "relative LOD ≤ 0.02 %", crm: "CRM BF412F (IRMM, JRC, Geel)", pc: { material: "Bt11 maize CRM ERM-BF412f", crop: "maize", event: "Bt11", pct: 5, ng: 50 }, doi: "10.1007/s00217-007-0748-z" });
  add("QL-ELE-00-013", { kind: "screen", el: "tnos", target: "nos terminator (T-nos)", title: "T-nos, duplex with P-35S (Waiblinger et al., 2008)", duplexWith: "QL-ELE-00-012",
    amp: "CATGTAATGCATGACGTTATTTATGAGATGGGTTTTTATGATTAGAGTCCCGCAATTATACATTTAATACGCGATAGAAAACAA",
    F: ["180-F", "CATGTAATGCATGACGTTATTTATG"], R: ["180-R", "TTGTTTTCTATCGCGTATTAAATGT"], P: ["TM-180YY", "YY", "ATGGGTTTTTATGATTAGAGTCCCGCAA", "BHQ1"], nM: [1000, 1000, 200], vol: 25, cyc: [120, 600, 45, 15, 60, 60, 0, 0], eff: 93,
    lod: "relative LOD ≤ 0.02 %", crm: "CRM BF412F (IRMM, JRC, Geel)", pc: { material: "Bt11 maize CRM ERM-BF412f", crop: "maize", event: "Bt11", pct: 5, ng: 50 }, doi: "10.1007/s00217-007-0748-z" });
  add("QT-ELE-00-002", { kind: "screen", el: "pat", target: "pat gene", title: "pat gene (Weighardt et al., 2004)",
    amp: "TTGAGGGTGTTGTGGCTGGTANTGCTTACGCTGGGCCCTGGAAGNNNAGGAACGCTTACGATTGGACA",
    F: ["KVM-5", "TTGAGGGTGTTGTGGCTGGTA"], R: ["KVM-6", "TGTCCAATCGTAAGCGTTCCT"], P: ["TaqMan Pat1", "FAM", "CTTCCAGGGCCCAGCGTAAGCA", "TAMRA"], nM: [400, 400, 200], vol: 50, cyc: [0, 600, 40, 15, 60, 60, 0, 0],
    lod: "relative LOD < 0.1 %", crm: "Plasmid DNA", pc: { material: "plasmid DNA carrying the target", copies: 2000 }, doi: "10.1093/jaoac/87.6.1342" });
  add("QL-CON-00-008", { kind: "screen", el: "ctp2cp4", target: "CTP2 / CP4-epsps junction", title: "CTP2–CP4-epsps construct (Grohmann et al., 2009)",
    amp: "GGGATGACGTTAATTGGCTCTGNNNNNNNNNNNNNNNNGGTCATGTCTTCTGTTTCCACGGCGTGNNNNCTTCACGGTGCAAGCAGCC",
    F: ["GT73-TmF", "GGGATGACGTTAATTGGCTCTG"], R: ["GT73-TmR", "GGCTGCTTGCACCGTGAAG"], P: ["GT73-TmP", "FAM", "CACGCCGTGGAAACAGAAGACATGACC", "TAMRA"], nM: [375, 375, 150], vol: 25, cyc: [0, 600, 45, 15, 60, 60, 0, 0], eff: 103,
    lod: "LOD ≤ 5 target copies; relative ≤ 0.02 %", crm: "Genomic DNA extracted from NK603 CRM (ERM-BF415f)", pc: { material: "NK603 maize CRM ERM-BF415f", crop: "maize", event: "NK603", pct: 5, ng: 50 }, doi: "10.1021/jf901598r" });
  add("QL-ELE-00-015", { kind: "screen", el: "pfmv", target: "FMV 35S promoter (P-FMV)", title: "P-FMV (BVL L 00.00-148, 2014; ISO/TS 21569-5)",
    amp: "CAAAATAACGTGGAAAAGAGCTGTCCTGACAGCCCACTCACTAATGCGTATGACGAACGCAGTGACGACCACAAAAGA",
    F: ["pFMV-F", "CAAAATAACGTGGAAAAGAGCT"], R: ["pFMV-R", "TCTTTTGTGGTCGTCACTGC"], P: ["Probe pFMV", "FAM", "CTGACAGCCCACTCACTAATGC", "BHQ1"], nM: [340, 340, 120], vol: 25, cyc: [0, 900, 45, 15, 60, 60, 0, 0],
    lod: "LOD 5 haploid genome equivalents", crm: "Plasmid DNA solution", pc: { material: "plasmid DNA carrying the target", copies: 2000 } });
  add("QL-ELE-00-024", { kind: "screen", el: "te9", target: "rbcS E9 terminator (tE9)", title: "tE9 terminator (Debode et al., 2016)",
    amp: "TTTTTATTCGGTTTTCGCTATCGAACTGTGAAATGGAAATGGATGGAGAAGAGTTAATGAATGATATGGTCCTTTTGTTCATTCTCA",
    F: ["T-E9-R", "TTTTTATTCGGTTTTCGCTATCG"], R: ["T-E9-F", "TGAGAATGAACAAAAGGACCATATCA"], P: ["T-E9-P", "FAM", "TCATTAACTCTTCTCCATCCATTTCCATTTCACAGT", "TAMRA"], nM: [340, 340, 300], vol: 25, cyc: [120, 600, 50, 15, 60, 60, 0, 0],
    crm: "Genomic DNA from non-GM oilseed rape and oilseed rape GT73 100 %", pc: { material: "GT73 oilseed rape genomic DNA", copies: 2000 }, doi: "10.1016/j.foodcont.2016.08.037" });
  add("QL-ELE-00-020", { kind: "screen", el: "cry1ab", target: "cry1A(b) gene", title: "cry1A(b), SYBR Green (Barbau-Piednoir et al., 2014)", sybr: true,
    amp: "ACCGGTTACACTCCCATCGANNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNGAGTTCGTG", bp: 73, bpSrc: "amplicon as listed is shorter than both primers together; 73 bp assumed",
    F: ["Cry1Ab_Bt_Cott_Fwd", "ACCGGTTACACTCCCATCGA"], R: ["Cry1Ab_Bt_Cott_Rev", "CAGCACCTGGCACGAACTC"], P: null, nM: [250, 250, 0], vol: 25, cyc: [0, 600, 40, 15, 60, 60, 0, 0], melt: true,
    lod: "LOD 23 cry1A(b) copies in 25 ng", crm: "Plasmids \"Sybricons\" mix DNA solution (BCCM/LMBP, Gent)", pc: { material: "Sybricons plasmid mix", copies: 2000 }, doi: "10.1007/s12161-014-9837-3" });
  // ---------- event-specific, quantitative ----------
  const ev = /* @r2fn R2-C0006-F00003 */(id, crop, event, uid, taxon, o) => add(id, Object.assign({ kind: "event", crop, event, uid, taxon, target: event + " insert/genome junction", title: "Event " + event + " (" + uid + ")" }, o));
  ev("QT-EVE-GM-005", "soybean", "40-3-2", "MON-04032-6", "QT-TAX-GM-002", { amp: "TTCATTCAAAATAAGATCATACATACAGGTTNNNNNNNNNNNNNNNNNCCCAAATGGAAAAGGAAGGTGGCTCCTACAAATGCC",
    F: ["40-3-2 AF", "TTCATTCAAAATAAGATCATACATACAGGTT"], R: ["40-3-2 AR", "GGCATTTGTAGGAGCCACCTT"], P: ["40-3-2 AP", "FAM", "CCTTTTCCATTTGGG", "MGBNFQ"], nM: [150, 150, 50], vol: 50, cyc: [120, 600, 45, 15, 55, 60, 0, 0], eff: 92,
    lod: "relative LOD ≤ 0.045 %, LOQ ≤ 0.09 %", crm: "Genomic DNA from non-GM and GM soybean event GTS 40-3-2 seeds", crmPct: 100, doi: "10.2760/720444" });
  ev("QT-EVE-GM-006", "soybean", "MON89788", "MON-89788-1", "QT-TAX-GM-002", { amp: "TCCCGCTCTAGCGCTTCAATNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNCTGAAGGCGGGAAACGACAATCTGNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNTTCTGCAGGTCCTGCTCGA",
    F: ["MON 89788-F", "TCCCGCTCTAGCGCTTCAAT"], R: ["MON 89788-R", "TCGAGCAGGACCTGCAGAA"], P: ["MON 89788-P", "FAM", "CTGAAGGCGGGAAACGACAATCTG", "TAMRA"], nM: [150, 150, 50], vol: 50, cyc: [120, 600, 45, 15, 60, 60, 0, 0], eff: 98,
    lod: "relative LOD ≤ 0.045 %, LOQ ≤ 0.09 %", crm: "Genomic DNA from non-GM and GM soybean event MON89788 seeds", crmPct: 100, doi: "10.2788/20464" });
  ev("QT-EVE-GM-004", "soybean", "A2704-12", "ACS-GM005-3", "QT-TAX-GM-009", { amp: "GCAAAAAAGCGGTTAGCTCCTNCGGTCCTCCGATCGCCCTTCCNAACAGTTGCGCAGCCTGAAT",
    F: ["KVM175", "GCAAAAAAGCGGTTAGCTCCT"], R: ["SMO001", "ATTCAGGCTGCGCAACTGTT"], P: ["TM031", "FAM", "CGGTCCTCCGATCGCCCTTCC", "TAMRA"], nM: [400, 400, 200], vol: 25, cyc: [120, 600, 45, 15, 60, 60, 0, 0],
    lod: "relative LOD ≤ 0.023 %, LOQ ≤ 0.045 %", crm: "Genomic DNA from non-GM and GM soybean event A2704-12 seeds", crmPct: 100, doi: "10.2788/28149" });
  ev("QT-EVE-GM-007", "soybean", "A5547-127", "ACS-GM006-4", "QT-TAX-GM-020", { amp: "GCTATTTGGTGGCATTTTTCCANNNNNCCGCAATGTCATACCGTCATCGTTGTNAGAAGTAAGTTGGCCGCAGTG",
    F: ["SHA003", "GCTATTTGGTGGCATTTTTCCA"], R: ["SHA004", "CACTGCGGCCAACTTACTTCT"], P: ["TM058", "FAM", "CCGCAATGTCATACCGTCATCGTTGT", "TAMRA"], nM: [400, 400, 200], vol: 25, cyc: [120, 600, 45, 15, 60, 60, 0, 0], eff: 93,
    lod: "relative LOD ≤ 0.023 %, LOQ ≤ 0.08 %", crm: "Genomic DNA from non-GM and GM soybean event A5547-127 leaves", crmPct: 100 });
  ev("QT-EVE-GM-010", "soybean", "MON87701", "MON-87701-2", "QT-TAX-GM-002", { amp: "TGGTGATATGAAGATACATGCTTAGCATNNNNNNGGCACGCTTAGTGTGTGTGTCAAACACTGANNNTTTAAACTGAAGGCGGGAAACG",
    F: ["MON87701 2", "TGGTGATATGAAGATACATGCTTAGCAT"], R: ["MON87701 1", "CGTTTCCCGCCTTCAGTTTAAA"], P: ["MON87701", "FAM", "TCAGTGTTTGACACACACACTAAGCGTGCC", "TAMRA"], nM: [600, 600, 250], vol: 50, cyc: [120, 600, 45, 15, 60, 60, 0, 0], eff: 93,
    lod: "relative LOD ≤ 0.04 %, LOQ ≤ 0.085 %", crm: "Genomic DNA from non-GM and GM soybean event MON87701 seeds", crmPct: 100, doi: "10.2788/38101" });
  ev("QT-EVE-ZM-020", "maize", "MON810", "MON-00810-6", "QT-TAX-ZM-002", { amp: "TCGAAGGACGAAGGACTCTAACGTTTAACATCCTTTGCCATTGCCCAGCTATCTGTCACTTTATTGTGAAGATAGTGGAAAAGGAAGGTGGC",
    F: ["Mail-F1", "TCGAAGGACGAAGGACTCTAACGT"], R: ["Mail-R1", "GCCACCTTCCTTTTCCACTATCTT"], P: ["Probe Mail-S2", "FAM", "AACATCCTTTGCCATTGCCCAGC", "TAMRA"], nM: [300, 300, 180], vol: 25, cyc: [120, 600, 45, 15, 60, 60, 0, 0],
    lod: "LOD 5, LOQ 10 haploid genome equivalents; relative ≤ 0.1 %", crm: "IRMM-413 (IRMM, JRC, Geel)", crmPct: 5 });
  ev("QT-EVE-ZM-008", "maize", "NK603", "MON-00603-6", "QT-TAX-ZM-011", { amp: "ATGAATGACCTCGAGTAAGCTTGTTAANNNNNNNNNNNNNNNNNNNNNNNNNNTGGTACCACGCGACACACTTCCACTCNAGTGTTTGAGTGGATCCTGTTATCTCTT",
    F: ["NK603-F", "ATGAATGACCTCGAGTAAGCTTGTTAA"], R: ["NK603-R", "AAGAGATAACAGGATCCACTCAAACACT"], P: ["NK603-PR", "FAM", "TGGTACCACGCGACACACTTCCACTC", "TAMRA"], nM: [150, 150, 50], vol: 50, cyc: [120, 600, 45, 15, 60, 60, 0, 0],
    lod: "relative LOD ≤ 0.05 %, LOQ 0.10 %", crm: "Certified Reference Material IRMM-415 (JRC-IRMM)", crmPct: 5 });
  ev("QT-EVE-ZM-015", "maize", "Bt11", "SYN-BT011-1", "QT-TAX-ZM-014", { amp: "TGTGTGGCCATTTATCATCGANTTCCATGACCAAAATCCCTTAACGTGAGTTTTCGTTCCACTGAGCG",
    F: ["Bt11-ev-f1", "TGTGTGGCCATTTATCATCGA"], R: ["Bt11-ev-r5", "CGCTCAGTGGAACGAAAACTC"], P: ["Bt11-ev-p1", "FAM", "TTCCATGACCAAAATCCCTTAACGTGAGT", "TAMRA"], nM: [200, 200, 150], vol: 25, cyc: [120, 600, 40, 15, 60, 60, 0, 0],
    lod: "relative LOD ≤ 0.04 %, LOQ ≤ 0.08 %", crm: "Genomic DNA from non-GM and GM maize event Bt11 seeds", crmPct: 100, doi: "10.2788/4370" });
  ev("QT-EVE-ZM-010", "maize", "TC1507", "DAS-01507-1", "QT-TAX-ZM-002", { amp: "TAGTCTTCGGCCAGAATGGNNTAACTCAAGGCCCTCACTCCGCTTGATCTTGGCAAAG",
    F: ["MaiY-F1", "TAGTCTTCGGCCAGAATGG"], R: ["MaiY-R3", "CTTTGCCAAGATCAAGCG"], P: ["MaiY-S1", "FAM", "TAACTCAAGGCCCTCACTCCG", "TAMRA"], nM: [300, 300, 150], vol: 25, cyc: [0, 600, 45, 15, 60, 60, 0, 0], eff: 97,
    lod: "LOD 1.25 GM copies; LOQ ≤ 10 GM copies, relative ≤ 0.08 %", crm: "Genomic DNA from non-GM and GM maize event TC1507", crmPct: 100 });
  ev("QT-EVE-ZM-014", "maize", "GA21", "MON-00021-9", "QT-TAX-ZM-014", { amp: "CGTTATGCTATTTGCAACTTTAGAACANNNNNNNNNNNNNNNNNNTTTCTCAACAGCAGGTGGGTCCGGGTNNNNNNNNNNNNNAACGCGAGGAGGATCGC",
    F: ["esGA21-5' forward", "CGTTATGCTATTTGCAACTTTAGAACA"], R: ["esGA21-5' reverse", "GCGATCCTCCTCGCGTT"], P: ["esGA21-5' probe", "FAM", "TTTCTCAACAGCAGGTGGGTCCGGGT", "TAMRA"], nM: [900, 900, 200], vol: 25, cyc: [120, 600, 40, 15, 60, 60, 0, 0],
    lod: "relative LOD ≤ 0.04 %, LOQ ≤ 0.04 %", crm: "Genomic DNA from non-GM and GM maize event GA21", crmPct: 100, doi: "10.2788/62889" });
  ev("QT-EVE-ZM-016", "maize", "MON88017", "MON-88017-3", "QT-TAX-ZM-002", { amp: "GAGCAGGACCTGCAGAAGCTNNNNNNNNNNNNNNNNNNNNNNNNNNTCCCGCCTTCAGTTTAAACAGAGTCGGGTNTGGATGGTCAACTCCGGC", ampNote: "the reverse primer as listed (TCCGGAGTTGACCATCCA) does not match the listed amplicon end exactly",
    F: ["MON 88017 AF", "GAGCAGGACCTGCAGAAGCT"], R: ["MON 88017 AR", "TCCGGAGTTGACCATCCA"], P: ["MON 88017 AP", "FAM", "TCCCGCCTTCAGTTTAAACAGAGTCGGGT", "TAMRA"], nM: [150, 150, 50], vol: 50, cyc: [120, 600, 45, 15, 60, 60, 0, 0], eff: 94,
    lod: "relative LOD ≤ 0.045 %, LOQ ≤ 0.09 %", crm: "Genomic DNA from non-GM and GM maize event MON 88017 seeds", crmPct: 100, doi: "10.2788/22579" });
  ev("QT-EVE-ZM-018", "maize", "MON89034", "MON-89034-3", "QT-TAX-ZM-002", { amp: "TTCTCCATATTGACCATCATACTCATTNNATCCCCGGAAATTATGTTNNTTTAAAAACCACGGTATTATAGATACCG",
    F: ["MON 89034 primer 1", "TTCTCCATATTGACCATCATACTCATT"], R: ["MON 89034 primer 2", "CGGTATCTATAATACCGTGGTTTTTAAA"], P: ["MON 89034 probe", "FAM", "ATCCCCGGAAATTATGTT", "MGBNFQ"], nM: [450, 450, 100], vol: 50, cyc: [120, 600, 45, 15, 60, 60, 0, 0], eff: 89,
    lod: "relative LOD ≤ 0.04 %, LOQ ≤ 0.085 %", crm: "Genomic DNA from non-GM and GM maize event MON 89034 seeds", crmPct: 100, doi: "10.2788/68713" });
  ev("QT-EVE-ZM-012", "maize", "59122", "DAS-59122-7", "QT-TAX-ZM-002", { amp: "GGGATAAGCAAGTAAAAGCGCTCNNNNNNNNNNNNTTTAAACTGAAGGCGGGAAACGACAANCTGATCATGAGCGGAGAATTAAGG",
    F: ["DAS-59122-7-rb1f", "GGGATAAGCAAGTAAAAGCGCTC"], R: ["DAS-59122-7-rb1r", "CCTTAATTCTCCGCTCATGATCAG"], P: ["DAS-59122-7-rb1rs-P", "FAM", "TTTAAACTGAAGGCGGGAAACGACAA", "TAMRA"], nM: [250, 250, 200], vol: 25, cyc: [0, 600, 50, 15, 60, 60, 0, 0], eff: 91,
    lod: "relative LOD 0.05 %, LOQ 0.09 %", crm: "Genomic DNA from non-GM and GM maize event 59122 seeds", crmPct: 100, doi: "10.2788/31820" });
  for (const id in M) { const m = M[id]; if (!m.bp && m.amp) m.bp = m.amp.length; }

  // element presence per event (JRC GMO-Matrix export): p35s, tnos, pat, te9, ctp2cp4, pfmv, cry1ab
  const EL = ["p35s", "tnos", "pat", "te9", "ctp2cp4", "pfmv", "cry1ab"];
  const E = /* @r2fn R2-C0006-F00004 */(crop, name, uid, method, row) => ({ crop, name, uid, method, el: Object.fromEntries(EL.map(/* @r2fn R2-C0006-F00005 */(k, i) => [k, row[i]])) });
  const EVENTS = [
    E("soybean", "40-3-2", "MON-04032-6", "QT-EVE-GM-005", [2, 2, 0, 0, 0, 0, 0]),
    E("soybean", "MON89788", "MON-89788-1", "QT-EVE-GM-006", [0, 0, 0, 2, 2, 2, 0]),
    E("soybean", "A2704-12", "ACS-GM005-3", "QT-EVE-GM-004", [2, 0, 2, 0, 0, 0, 0]),
    E("soybean", "A5547-127", "ACS-GM006-4", "QT-EVE-GM-007", [2, 0, 2, 0, 0, 0, 0]),
    E("soybean", "MON87701", "MON-87701-2", "QT-EVE-GM-010", [0, 0, 0, 0, 0, 0, 2]),
    E("maize", "MON810", "MON-00810-6", "QT-EVE-ZM-020", [2, 0, 0, 0, 0, 0, 1]),
    E("maize", "NK603", "MON-00603-6", "QT-EVE-ZM-008", [2, 2, 0, 0, 2, 0, 0]),
    E("maize", "Bt11", "SYN-BT011-1", "QT-EVE-ZM-015", [2, 2, 2, 0, 0, 0, 2]),
    E("maize", "TC1507", "DAS-01507-1", "QT-EVE-ZM-010", [2, 0, 2, 0, 0, 0, 0]),
    E("maize", "GA21", "MON-00021-9", "QT-EVE-ZM-014", [0, 2, 0, 0, 0, 0, 0]),
    E("maize", "MON88017", "MON-88017-3", "QT-EVE-ZM-016", [2, 2, 0, 0, 2, 0, 0]),
    E("maize", "MON89034", "MON-89034-3", "QT-EVE-ZM-018", [2, 2, 0, 0, 0, 2, 1]),
    E("maize", "59122", "DAS-59122-7", "QT-EVE-ZM-012", [2, 0, 2, 0, 0, 0, 0])
  ];
  // haploid genome copies per ng of DNA (assumed: 1C = 2.725 pg maize, 1.13 pg soybean, values commonly used for copy-number conversion)
  const CROPS = { maize: { label: "Maize (Zea mays)", copiesPerNg: 367, taxon: "QT-TAX-ZM-002" }, soybean: { label: "Soybean (Glycine max)", copiesPerNg: 885, taxon: "QT-TAX-GM-002" } };
  // the one sample to analyse; pct = GM content in % of haploid genome copies
  const SAMPLES = [
    { key: "soyA", label: "Soybean meal A", crop: "soybean", events: { "40-3-2": 1.0 }, frag: 2000, inhibitor: 0 },
    { key: "soyB", label: "Soybean meal B (two events, one near the detection limit)", crop: "soybean", events: { "MON89788": 0.5, "40-3-2": 0.05 }, frag: 2000, inhibitor: 0 },
    { key: "soyF", label: "Processed soybean product F (degraded DNA, inhibitors carried over)", crop: "soybean", events: { "A2704-12": 0.3 }, frag: 180, inhibitor: 0.25 },
    { key: "maiC", label: "Maize flour C", crop: "maize", events: { "MON810": 2.0 }, frag: 2000, inhibitor: 0 },
    { key: "maiD", label: "Maize flour D (three events)", crop: "maize", events: { "NK603": 0.4, "Bt11": 0.1, "MON89034": 1.0 }, frag: 2000, inhibitor: 0 },
    { key: "maiE", label: "Maize flour E (non-GM)", crop: "maize", events: {}, frag: 2000, inhibitor: 0 },
    { key: "blind", label: "Blind sample (composition drawn from the seed, revealed after the analysis)", blind: true }
  ];
  R2.GMO = { methods: M, events: EVENTS, crops: CROPS, samples: SAMPLES, elements: EL,
    elementNames: { p35s: "P-35S", tnos: "T-nos", pat: "pat", te9: "tE9", ctp2cp4: "CTP2-CP4 EPSPS", pfmv: "P-FMV", cry1ab: "cry1A(b)" },
    source: "GMOMETHODS, EU database of reference methods for GMO analysis, EURL GMFF, https://gmo-crl.jrc.ec.europa.eu/gmomethods/ (read 16 November 2026)" };
})(window.R2);
