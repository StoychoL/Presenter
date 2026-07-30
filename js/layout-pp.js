// Partnership Program tier grouping — sourced from the user's "PP Teir 1/2/3 plus core" diagrams.
// Nested structure: Tier 3 is the base "must stock" range; Tier 2 = Tier 3 + 3 new products;
// Tier 1 = Tier 2 + 4 new products (which land in a new "Premium Spirits" section).
// "Bonus Range" = the flexible either/or slots (Captain Morgan 35/20cl, Gordon's 35/20cl, a Crush flavour)
// shown as individual tickable options rather than enforced pairs.
//
// Core Range composition now diverges per tier (each tier widens its own mandatory "must stock"
// set independently, they no longer share one array): Tier 2 folds just CrushLL/CrushMP/Ciroc Blue
// into Core Range, leaving a smaller Bonus Range and no Premium Spirits section (Ciroc Blue was its
// only item). Tier 1 folds the *entire* Bonus Range into Core Range, leaving only Premium Spirits
// as a separate (optional) section. Tier 3 is untouched.

const CORE_SPIRITS = [
  "Smirnoff20cl", "Smirnoff35cl", "Smirnoff70Cl", "MiamiPeach70cl", "RaspberryCrush70cl",
  "CaptianMorgan70cl", "GordonsOriginal70cl", "GordonsPink70cl", "GordonsPink35cl"
];
const GUINNESS = ["Guinness0", "GuinnessDraugh"];
const RTD_TIER3 = ["RTDVColla", "RTDCM", "RTDGO", "RTDGP", "SmirnoffIce70cl", "SmirnoffIce4pack"];
const BONUS_RANGE = ["CaptianMorgan35cl", "CaptianMorgan20cl", "GordonsOriginal35cl", "Gordons20cl", "CrushLL", "CrushMP"];

const CORE_SPIRITS_TIER2 = CORE_SPIRITS.concat(["Baileys70Cl"]);
const RTD_TIER2 = RTD_TIER3.concat(["RTDRCrush"]);

// "Core Range" = Core Spirits + Guinness + RTD together, shown as one section —
// these three used to be split into separate bands, but they're all part of the
// same "must stock" core range per the reference diagrams (one red box around all three rows).
const CORE_RANGE_TIER3 = CORE_SPIRITS.concat(GUINNESS, RTD_TIER3);
const CORE_RANGE_TIER2 = CORE_SPIRITS_TIER2.concat(GUINNESS, RTD_TIER2);

// Tier 2: only Crush Lemon & Lime, Crush Mango & Peach, and Ciroc Blue fold into Core Range —
// Ciroc Blue was the only Premium Spirits item, so that section is dropped for this tier.
const BONUS_RANGE_TIER2 = BONUS_RANGE.filter(function (id) { return id !== "CrushLL" && id !== "CrushMP"; });
const CORE_RANGE_TIER2_FULL = CORE_RANGE_TIER2.concat(["CrushLL", "CrushMP", "CirocBlue70cl"]);

// Tier 1: the entire Bonus Range folds into Core Range — no Bonus Range section remains.
const CORE_RANGE_TIER1 = CORE_RANGE_TIER2.concat(BONUS_RANGE);

window.PP_LAYOUT = {
  tier1: {
    label: "Tier 1", reward: 240, targetCount: 30,
    sections: [
      { label: "Core Range", items: CORE_RANGE_TIER1, isCore: true },
      { label: "Premium Spirits", items: ["CirocBlue70cl", "BlackLabel70cl", "CirocRed70cl", "Tanqueray70cl", "Casamigo70cl"] }
    ]
  },
  tier2: {
    label: "Tier 2", reward: 180, targetCount: 25,
    sections: [
      { label: "Core Range", items: CORE_RANGE_TIER2_FULL, isCore: true },
      { label: "Bonus Range", items: BONUS_RANGE_TIER2 }
    ]
  },
  tier3: {
    label: "Tier 3", reward: 120, targetCount: 20,
    sections: [
      { label: "Core Range", items: CORE_RANGE_TIER3, isCore: true },
      { label: "Bonus Range", items: BONUS_RANGE }
    ]
  }
};
