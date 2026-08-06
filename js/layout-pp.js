// Partnership Program tier grouping — sourced from the user's "PP Teir 1/2/3 plus core" diagrams.
//
// Core Range is the same fixed 17-product "must stock" list (CORE_RANGE_TIER3, isCore: true) for
// all three tiers — it's the mandatory gate and it never changes shape per tier. What differs per
// tier is the size of the Bonus/Premium pool built on top of it, which is what grows the
// required-product target (20 for Tier 3, 25 for Tier 2, 30 for Tier 1).
//
// "Bonus Range" = flexible either/or slots (Captain Morgan 35/20cl, Gordon's 35/20cl, a Crush
// flavour, plus Baileys/RTD Raspberry Crush/Ciroc Blue for Tier 1 & 2) shown as individually
// tickable options. Tier 1 & 2's non-core sections carry `promoteOnCheck: true`, meaning ticking
// one of those items visually promotes it into the Core Range section on the page (see
// partnership.js's jumpedItems/sectionItemsToRender) — purely a display move, the Core-100% gate
// always means exactly these 17 fixed products. Tier 3's Bonus Range deliberately does NOT set
// this flag — its items stay put when ticked, unchanged from before.
//
// Tier 3 keeps its own Bonus Range section but it's no longer purely optional: a section can carry
// a `gate: { groups: [...] }` config (see partnership.js's sectionGateStats) requiring at least
// `min` of a named subgroup to be ticked — Tier 3 requires 2 of the 4 bottles AND 1 of the 2 crush
// flavours before the tier can reach 90%, on top of (not instead of) Core Range being 100% stocked.

const CORE_SPIRITS = [
  "Smirnoff20cl", "Smirnoff35cl", "Smirnoff70Cl", "MiamiPeach70cl", "RaspberryCrush70cl",
  "CaptianMorgan70cl", "GordonsOriginal70cl", "GordonsPink70cl", "GordonsPink35cl"
];
const GUINNESS = ["Guinness0", "GuinnessDraugh"];
const RTD_TIER3 = ["RTDVColla", "RTDCM", "RTDGO", "RTDGP", "SmirnoffIce70cl", "SmirnoffIce4pack"];
const BONUS_BOTTLES = ["CaptianMorgan35cl", "CaptianMorgan20cl", "GordonsOriginal35cl", "Gordons20cl"];
const BONUS_CRUSHES = ["CrushLL", "CrushMP"];
const BONUS_RANGE = BONUS_BOTTLES.concat(BONUS_CRUSHES);

// "Core Range" = Core Spirits + Guinness + RTD together, shown as one section —
// these three used to be split into separate bands, but they're all part of the
// same "must stock" core range per the reference diagrams (one red box around all three rows).
// Shared by all three tiers — see file header comment.
const CORE_RANGE_TIER3 = CORE_SPIRITS.concat(GUINNESS, RTD_TIER3);

// Tier 2 Bonus Range: the flexible Bonus Range plus the items that used to be folded into Core.
const BONUS_RANGE_TIER2_FULL = BONUS_RANGE.concat(["Baileys70Cl", "RTDRCrush", "CirocBlue70cl"]);

// Tier 1 Bonus Range: same, minus Ciroc Blue which already lives in Premium Spirits below.
const BONUS_RANGE_TIER1 = BONUS_RANGE.concat(["Baileys70Cl", "RTDRCrush"]);

window.PP_LAYOUT = {
  tier1: {
    label: "Tier 1", reward: 240, targetCount: 30,
    sections: [
      { label: "Core Range", items: CORE_RANGE_TIER3, isCore: true },
      { label: "Bonus Range", items: BONUS_RANGE_TIER1, promoteOnCheck: true },
      { label: "Premium Spirits", items: ["CirocBlue70cl", "BlackLabel70cl", "CirocRed70cl", "Tanqueray70cl", "Casamigo70cl"], promoteOnCheck: true }
    ]
  },
  tier2: {
    label: "Tier 2", reward: 180, targetCount: 25,
    sections: [
      { label: "Core Range", items: CORE_RANGE_TIER3, isCore: true },
      { label: "Bonus Range", items: BONUS_RANGE_TIER2_FULL, promoteOnCheck: true }
    ]
  },
  tier3: {
    label: "Tier 3", reward: 120, targetCount: 20,
    sections: [
      { label: "Core Range", items: CORE_RANGE_TIER3, isCore: true },
      {
        label: "Bonus Range", items: BONUS_RANGE,
        gate: { groups: [
          { label: "bottles", items: BONUS_BOTTLES, min: 2 },
          { label: "crush", items: BONUS_CRUSHES, min: 1 }
        ] }
      }
    ]
  }
};
