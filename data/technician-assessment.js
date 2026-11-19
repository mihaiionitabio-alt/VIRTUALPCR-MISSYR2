/* Forty general molecular-biology and real-time PCR questions; no local protocol knowledge required. Correct options are shuffled by the UI. */
window.R2.assessmentQuestions = {
  "beginner": [
    {
      "id": "beginner-1",
      "prompt": "What does PCR mainly do?",
      "options": [
        "Make many copies of a selected DNA region",
        "Make proteins from amino acids",
        "Separate cells by size",
        "Measure blood pressure",
        "Turn every RNA molecule into DNA without an enzyme",
        "Remove all DNA from a sample",
        "Read an entire genome in one cycle",
        "Count living cells directly"
      ],
      "why": "PCR amplifies a DNA region defined by the primers."
    },
    {
      "id": "beginner-2",
      "prompt": "What are PCR primers?",
      "options": [
        "Short DNA sequences that define where amplification starts",
        "Proteins that digest every DNA molecule",
        "Fluorescent lamps inside the instrument",
        "Lipids that seal the plate",
        "The final PCR products only",
        "Entire chromosomes",
        "Salts that replace DNA polymerase",
        "Labels used only in file names"
      ],
      "why": "Primers bind complementary template sequences and provide starting points for DNA synthesis."
    },
    {
      "id": "beginner-3",
      "prompt": "What does DNA polymerase do during PCR?",
      "options": [
        "Extend a primer by adding nucleotides",
        "Emit the excitation light",
        "Separate wells on the plate",
        "Destroy all primers before amplification",
        "Translate DNA into protein",
        "Replace the DNA template",
        "Make the reaction fluorescent without any reporter",
        "Identify the sample by its name"
      ],
      "why": "DNA polymerase synthesizes DNA from a primed template."
    },
    {
      "id": "beginner-4",
      "prompt": "What happens during the denaturation step of PCR?",
      "options": [
        "The two strands of double-stranded DNA separate",
        "Primers are permanently removed",
        "DNA becomes protein",
        "All nucleotides become fluorescent",
        "The sample is frozen",
        "Two DNA strands are joined by a membrane",
        "The DNA sequence is read directly",
        "All DNA is deliberately destroyed"
      ],
      "why": "Heating disrupts base pairing so the DNA strands can separate."
    },
    {
      "id": "beginner-5",
      "prompt": "What happens during primer annealing?",
      "options": [
        "Primers bind complementary template sequences",
        "The instrument exports a spreadsheet",
        "DNA is translated into protein",
        "The plate creates new primers",
        "All products melt permanently",
        "Polymerase is replaced by water",
        "Fluorescence is always at its plateau",
        "DNA concentration becomes zero"
      ],
      "why": "Annealing allows primers to hybridize to suitable template sequences."
    },
    {
      "id": "beginner-6",
      "prompt": "What distinguishes real-time PCR from endpoint PCR?",
      "options": [
        "Fluorescence is monitored as amplification proceeds",
        "It never uses DNA polymerase",
        "It must always start with RNA",
        "It requires no primers",
        "It measures only the final product after the run",
        "It amplifies every DNA sequence equally",
        "It counts living organisms directly",
        "It does not use temperature changes"
      ],
      "why": "Real-time PCR follows a reporter signal during amplification."
    },
    {
      "id": "beginner-7",
      "prompt": "What does the horizontal axis of a typical amplification plot show?",
      "options": [
        "PCR cycle number",
        "Sample mass alone",
        "Primer length alone",
        "Fluorescence wavelength alone",
        "The number of chromosomes in a cell",
        "The extraction date",
        "The sample name",
        "Protein concentration"
      ],
      "why": "An amplification plot usually shows fluorescence against cycle number."
    },
    {
      "id": "beginner-8",
      "prompt": "What is the purpose of a no-template control (NTC)?",
      "options": [
        "Check for unwanted amplification when no sample template is added",
        "Guarantee every sample is negative",
        "Measure the target amount in an unknown sample",
        "Replace all positive controls",
        "Increase DNA concentration",
        "Make every curve identical",
        "Identify the species by its file name",
        "Measure polymerase molecular weight"
      ],
      "why": "An NTC helps reveal contamination or, depending on chemistry, nonspecific products."
    },
    {
      "id": "beginner-9",
      "prompt": "Why include a positive amplification control?",
      "options": [
        "Check that a known target can be amplified and detected",
        "Prove every sample contains the target",
        "Remove contamination from the other wells",
        "Replace the DNA polymerase",
        "Make all unknown samples negative",
        "Set the computer clock",
        "Prevent every possible extraction failure",
        "Measure sample volume automatically"
      ],
      "why": "A positive control tests amplification and detection of known target material."
    },
    {
      "id": "beginner-10",
      "prompt": "What are technical PCR replicates?",
      "options": [
        "Separate reactions prepared from the same template preparation",
        "Different names for a single recorded well",
        "Independent organisms that must have identical biology",
        "Different DNA sequences in one genome",
        "Only repeated screenshots of a graph",
        "Different dyes without separate reactions",
        "A positive control and an NTC",
        "Three unrelated species"
      ],
      "why": "Technical replicates help assess variation introduced by reaction preparation and measurement."
    }
  ],
  "intermediate": [
    {
      "id": "intermediate-1",
      "prompt": "5 µL of DNA at 40 ng/µL is added to a reaction. What DNA mass is added?",
      "options": [
        "200 ng",
        "8 ng",
        "40 ng",
        "45 ng",
        "100 ng",
        "400 ng",
        "800 ng",
        "2000 ng"
      ],
      "why": "Mass equals volume multiplied by concentration: 5 × 40 = 200 ng."
    },
    {
      "id": "intermediate-2",
      "prompt": "An extract at 40 ng/µL is diluted tenfold. What is its new concentration?",
      "options": [
        "4 ng/µL",
        "0.4 ng/µL",
        "10 ng/µL",
        "20 ng/µL",
        "30 ng/µL",
        "40 ng/µL",
        "80 ng/µL",
        "400 ng/µL"
      ],
      "why": "A tenfold dilution divides the concentration by ten."
    },
    {
      "id": "intermediate-3",
      "prompt": "For the same assay and analysis settings, which sample usually has the lower Cq?",
      "options": [
        "The sample with more amplifiable starting target",
        "The sample with less amplifiable starting target",
        "The sample with the longer file name",
        "The sample placed in the last column regardless of content",
        "The sample with no DNA",
        "The sample with the newest label regardless of content",
        "Both must have exactly the same Cq",
        "Cq depends only on the sample name"
      ],
      "why": "With comparable efficiency and no confounding inhibition, more starting target crosses the threshold earlier."
    },
    {
      "id": "intermediate-4",
      "prompt": "What is a common effect of PCR inhibitors in a DNA extract?",
      "options": [
        "Delayed or absent amplification despite target being present",
        "Guaranteed earlier amplification in every assay",
        "Creation of the correct target sequence from water",
        "Removal of all fluorescence noise",
        "Identical curves in every replicate",
        "Automatic correction of DNA concentration",
        "A change in sample species",
        "Elimination of the need for controls"
      ],
      "why": "Inhibitors can reduce enzyme activity or otherwise impair amplification and detection."
    },
    {
      "id": "intermediate-5",
      "prompt": "Which set of Cq values has the smallest spread?",
      "options": [
        "23.4 · 23.5 · 23.6",
        "23.1 · 23.5 · 23.9",
        "23.4 · 25.5 · 23.6",
        "22.0 · 23.5 · 25.0",
        "23.4 · 27.0 · 23.6",
        "23.8 · 24.8 · 23.9",
        "20.0 · 25.0 · 30.0",
        "23.0 · 23.9 · 23.4"
      ],
      "why": "The values 23.4, 23.5 and 23.6 have a range of only 0.2 cycles; the other groups have larger ranges."
    },
    {
      "id": "intermediate-6",
      "prompt": "Why can diluting an inhibited DNA extract sometimes improve amplification?",
      "options": [
        "Dilution also reduces the concentration of inhibitors",
        "Dilution creates new target DNA molecules",
        "Water replaces the polymerase enzyme",
        "Dilution guarantees a lower Cq in every sample",
        "Dilution changes the primer sequence",
        "Inhibitors always become stronger on dilution",
        "Dilution makes controls unnecessary",
        "The target concentration increases after dilution"
      ],
      "why": "Dilution lowers both target and inhibitor concentrations; relief of inhibition can sometimes outweigh target dilution."
    },
    {
      "id": "intermediate-7",
      "prompt": "What does an extraction blank help detect?",
      "options": [
        "Contamination introduced during extraction",
        "The exact target concentration in every sample",
        "All possible primer mismatches",
        "The number of DNA strands in every well",
        "The fluorescence wavelength of a dye",
        "The molecular weight of polymerase",
        "The exact efficiency of every sample reaction",
        "All biological differences between samples"
      ],
      "why": "An extraction blank passes through the extraction process without the sample material."
    },
    {
      "id": "intermediate-8",
      "prompt": "How does an intercalating dye such as SYBR Green usually generate a PCR signal?",
      "options": [
        "Its fluorescence increases when it binds double-stranded DNA",
        "It emits light only after a target-specific probe is cleaved",
        "It measures the sample name",
        "It binds only one species in every assay",
        "It replaces DNA polymerase",
        "It prevents all primer-dimers",
        "It directly measures RNA without amplification",
        "It counts individual cells"
      ],
      "why": "Intercalating-dye fluorescence can arise from target products and other double-stranded DNA products."
    },
    {
      "id": "intermediate-9",
      "prompt": "What gives a hydrolysis-probe assay an additional layer of sequence recognition?",
      "options": [
        "The probe must hybridize to a complementary target region",
        "The probe recognizes every DNA molecule equally",
        "The plate row defines the DNA sequence",
        "The dye color changes the primer sequence",
        "The sample name determines probe binding",
        "No primers are required",
        "The instrument reads the entire genome each cycle",
        "The probe replaces all reaction controls"
      ],
      "why": "In addition to primer binding, probe hybridization contributes to target recognition."
    },
    {
      "id": "intermediate-10",
      "prompt": "Why separate pre-PCR preparation from handling amplified PCR products?",
      "options": [
        "To reduce carry-over contamination by abundant amplicons",
        "To increase the number of chromosomes in samples",
        "To make every sample positive",
        "To avoid using primers",
        "To eliminate thermal cycling",
        "To turn DNA into RNA",
        "To make polymerase unnecessary",
        "To guarantee perfect efficiency"
      ],
      "why": "Amplified products are abundant contamination sources and should be kept away from clean preparation areas."
    }
  ],
  "expert": [
    {
      "id": "expert-1",
      "prompt": "During ideal exponential PCR, what happens to target copies in each cycle?",
      "options": [
        "They approximately double at 100% efficiency",
        "They increase by exactly one copy regardless of amount",
        "They are halved",
        "They remain constant",
        "They become proteins",
        "They increase only after the plateau",
        "They all become primers",
        "They disappear before detection"
      ],
      "why": "Ideal 100% amplification efficiency corresponds to a twofold increase per cycle during exponential amplification."
    },
    {
      "id": "expert-2",
      "prompt": "Why can an exponential amplification segment appear straight on a log-fluorescence plot?",
      "options": [
        "The logarithm of an exponential relationship is linear",
        "Taking a logarithm removes every measurement error",
        "Every PCR curve is linear throughout the whole run",
        "The logarithm creates new DNA copies",
        "Plateau fluorescence is always exponential",
        "The instrument changes the DNA sequence",
        "Logarithms force all wells to have the same Cq",
        "Only negative controls can form straight segments"
      ],
      "why": "A log-linear region can be observed where background-corrected positive signal grows approximately exponentially."
    },
    {
      "id": "expert-3",
      "prompt": "With ideal doubling and otherwise comparable conditions, a tenfold target dilution shifts Cq by about how much?",
      "options": [
        "3.32 cycles later",
        "0 cycles",
        "0.1 cycle earlier",
        "1 cycle earlier",
        "2 cycles earlier",
        "10 cycles earlier",
        "20 cycles later",
        "100 cycles later"
      ],
      "why": "The shift is log2(10), approximately 3.32 cycles, when efficiency is 100%."
    },
    {
      "id": "expert-4",
      "prompt": "On a standard curve plotting Cq against log10 starting quantity, which slope corresponds to approximately 100% efficiency?",
      "options": [
        "−3.32",
        "+3.32",
        "0",
        "−0.10",
        "+1.00",
        "−10.00",
        "+10.00",
        "−0.50"
      ],
      "why": "Efficiency is 10^(−1/slope) − 1; a slope near −3.32 corresponds to doubling."
    },
    {
      "id": "expert-5",
      "prompt": "Why can primer-dimers produce fluorescence in a dye-based assay but little signal in a target-specific hydrolysis-probe assay?",
      "options": [
        "Dyes report double-stranded DNA, while probe signal requires suitable probe recognition and cleavage",
        "All primer-dimers contain the intended probe-binding sequence",
        "Hydrolysis-probe reactions never contain primers",
        "Intercalating dyes bind only the intended target",
        "Hydrolysis probes measure only temperature",
        "Primer-dimers are always RNA",
        "A dye prevents every nonspecific product",
        "The two chemistries must report every product identically"
      ],
      "why": "The fluorescence mechanism determines whether nonspecific products are detected."
    },
    {
      "id": "expert-6",
      "prompt": "What is the purpose of a passive reference dye when a compatible assay uses one?",
      "options": [
        "Help normalize some non-amplification fluorescence variation",
        "Act as the target-specific primer",
        "Replace the target DNA",
        "Measure biological gene expression directly",
        "Make every target amplify with identical efficiency",
        "Remove all inhibitors",
        "Identify every nonspecific product by sequence",
        "Replace the need for an NTC"
      ],
      "why": "A passive reference provides a normalization signal; it does not measure target amplification itself."
    },
    {
      "id": "expert-7",
      "prompt": "What can a melting-curve analysis help assess in an intercalating-dye assay?",
      "options": [
        "Whether products with different melting behaviour may be present",
        "The exact DNA sequence without further analysis",
        "The number of living cells directly",
        "The identity of every contaminating organism with certainty",
        "The sample extraction date",
        "The amount of RNA before any reverse transcription",
        "The molecular weight of the instrument",
        "The complete genome of each sample"
      ],
      "why": "Melting behaviour can reveal product heterogeneity, but a single peak does not by itself prove sequence identity."
    },
    {
      "id": "expert-8",
      "prompt": "Why are low-copy target reactions sometimes positive in one replicate and negative in another?",
      "options": [
        "Random sampling may place different numbers of target molecules into individual reactions",
        "Every negative replicate proves fraud",
        "The instrument must assign alternating results",
        "Low-copy samples cannot contain target DNA",
        "Replicates must always be identical",
        "A positive replicate creates DNA in adjacent sealed wells",
        "Only the sample name controls the result",
        "All low-copy reactions contain exactly one molecule"
      ],
      "why": "At low copy number, stochastic partitioning and amplification contribute to replicate variability."
    },
    {
      "id": "expert-9",
      "prompt": "A late amplification curve is still rising at the final cycle. What can be concluded from the recorded trace?",
      "options": [
        "The rise was observed, but a plateau was not observed within the run",
        "The unrecorded plateau height is known exactly",
        "The sample is automatically negative",
        "The target must be abundant",
        "Its Cq must be changed to an earlier value",
        "The curve must be discarded solely because it is late",
        "All late signals prove contamination",
        "The final cycle proves 100% efficiency"
      ],
      "why": "A truncated late curve does not establish its eventual plateau or, by itself, establish a biological interpretation."
    },
    {
      "id": "expert-10",
      "prompt": "Two assays have different fluorescence scales and thresholds. Can their raw Cq values alone directly establish a target concentration ratio?",
      "options": [
        "No; assay efficiency, calibration and analysis settings must be considered",
        "Yes; equal Cq always means equal copy number across all assays",
        "Yes; fluorescence color alone supplies the ratio",
        "Yes; subtracting sample names supplies the ratio",
        "Yes; the later assay always has more copies",
        "Yes; every probe has identical brightness",
        "No; qPCR can never quantify DNA",
        "Yes; thresholds never affect Cq"
      ],
      "why": "Cq depends on assay and analysis characteristics as well as starting target quantity."
    }
  ],
  "admin": [
    {
      "id": "admin-1",
      "prompt": "What key efficiency assumption supports the usual 2^(−ΔΔCq) relative-quantification calculation?",
      "options": [
        "Target and reference amplify with similar efficiencies close to doubling",
        "Target efficiency is zero",
        "Reference efficiency is zero",
        "Every sample contains exactly one DNA molecule",
        "Target and reference sequences must be identical",
        "No reference gene is needed",
        "Fluorescence must be identical at every cycle",
        "All samples must have the same expression level"
      ],
      "why": "The standard calculation assumes similar target/reference efficiencies, approximately 100%; other cases need appropriate efficiency-aware methods."
    },
    {
      "id": "admin-2",
      "prompt": "Why should a reference gene be evaluated for stability across the samples being compared?",
      "options": [
        "Changing reference expression can bias normalized target estimates",
        "Every reference gene is constant in every tissue and condition",
        "Reference genes are used only to name files",
        "Reference genes prevent all contamination",
        "A reference gene makes biological replication unnecessary",
        "Reference genes determine the color of the plate",
        "Any highly variable gene is always ideal",
        "Stability matters only after the plateau"
      ],
      "why": "A changing denominator can distort relative quantification even when target measurements are technically consistent."
    },
    {
      "id": "admin-3",
      "prompt": "What is the difference between a limit of detection and a limit of quantification?",
      "options": [
        "Detection concerns reliable presence detection; quantification also requires acceptable quantitative performance",
        "They always mean exactly the same thing",
        "Detection is the highest measurable concentration",
        "Quantification means no target molecules are present",
        "Detection depends only on the file extension",
        "Quantification is defined only by the final cycle number",
        "A detected target is always accurately quantifiable",
        "Both limits are universal constants for all assays"
      ],
      "why": "A target may be detectable at an amount that cannot yet be quantified with acceptable precision and accuracy."
    },
    {
      "id": "admin-4",
      "prompt": "What does a high R² on a qPCR standard curve establish on its own?",
      "options": [
        "The fitted relationship explains much of the observed variation, but other performance checks are still needed",
        "Every unknown sample is free of inhibitors",
        "The amplification efficiency must be exactly 100%",
        "All standards have the correct assigned concentrations",
        "Every result is within the validated quantitative range",
        "All target sequences are identical",
        "The NTC must be negative",
        "Every sample is biologically identical"
      ],
      "why": "A strong fit does not independently prove correct standard preparation, acceptable efficiency or valid sample quantification."
    },
    {
      "id": "admin-5",
      "prompt": "What is a useful consequence of testing a dilution series of a possibly inhibited sample?",
      "options": [
        "It can reveal whether Cq shifts depart from the behaviour expected for dilution alone",
        "It guarantees removal of every inhibitor after one dilution",
        "It increases target concentration at every step",
        "It proves every late curve is genuine",
        "It replaces all negative controls",
        "It changes the target sequence into the reference sequence",
        "It guarantees identical Cq values across the series",
        "It makes amplification efficiency irrelevant"
      ],
      "why": "A dilution series can provide evidence of inhibition; target loss and sampling variability also need consideration."
    },
    {
      "id": "admin-6",
      "prompt": "Why use a no-reverse-transcriptase control in an RNA-based RT-qPCR experiment?",
      "options": [
        "To investigate amplification arising from DNA contamination",
        "To measure protein translation",
        "To replace the positive control in every experiment",
        "To make RNA amplify directly without conversion",
        "To check only the fluorescence wavelength",
        "To guarantee identical gene expression across samples",
        "To measure primer length directly",
        "To remove all RNA degradation"
      ],
      "why": "Without reverse transcriptase, a signal can indicate amplifiable DNA; primer design and control context also matter."
    },
    {
      "id": "admin-7",
      "prompt": "How can a primer-binding-site mismatch affect qPCR?",
      "options": [
        "It can reduce primer binding or amplification and bias estimated quantity",
        "It always improves amplification by exactly two cycles",
        "It changes all DNA into RNA",
        "It cannot affect amplification under any conditions",
        "It guarantees a positive NTC",
        "It makes all sample concentrations equal",
        "It changes the sample volume automatically",
        "It replaces the need for a probe"
      ],
      "why": "The effect depends on mismatch position, sequence and reaction conditions, and may cause underestimation or non-detection."
    },
    {
      "id": "admin-8",
      "prompt": "Why does a biological replicate provide information that extra technical PCR replicates alone cannot?",
      "options": [
        "It samples variation among independent biological specimens or units",
        "It always has the same Cq as every other specimen",
        "It eliminates every pipetting error",
        "It requires no sample collection",
        "It is only another read of the same well",
        "It guarantees the same expression in every organism",
        "It replaces all extraction controls",
        "It makes assay specificity irrelevant"
      ],
      "why": "Technical replication measures parts of technical variation; biological replication addresses variation among independent biological units."
    },
    {
      "id": "admin-9",
      "prompt": "What should be considered when a qPCR result is reported as copies per reaction?",
      "options": [
        "Conversion to the original sample depends on sampling, extraction, elution and dilution factors",
        "It is automatically the number of living organisms in the original sample",
        "It is automatically copies per gram in every experiment",
        "It is always equal to the number of cells",
        "No information about volumes is needed",
        "It always proves the organism is viable",
        "It directly gives protein concentration",
        "It automatically equals copies per millilitre of the original sample"
      ],
      "why": "Copies measured in a reaction refer to the aliquot tested, not automatically to the entire original sample or viable organisms."
    },
    {
      "id": "admin-10",
      "prompt": "Why is a very late signal alone insufficient to decide whether a target is genuinely present?",
      "options": [
        "Contamination, nonspecific amplification, noise and low-copy target detection must be distinguished using additional evidence",
        "Every late signal is automatically a true positive",
        "Every late signal is automatically a true negative",
        "Late signals cannot occur in real experiments",
        "The sample name is the only evidence needed",
        "A plateau must be invented to make the call",
        "The latest cycle always equals the exact copy number",
        "The dye color alone proves specificity"
      ],
      "why": "Interpret late signals with controls, curve behaviour, chemistry, replicate evidence and established assay performance."
    }
  ]
};
