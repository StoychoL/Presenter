// Partnership Program tier grouping — sourced from the rules sheet photos (images/PP.jpg,
// images/PPT1.jpg, images/PPT2.jpg, images/PPT3.jpg), which supersede the older bottle-poster
// diagrams this file used to be built from.
//
// Core Range is the same fixed 13-product "must stock" list (CORE_RANGE, isCore: true) for
// all three tiers — it's the mandatory gate and never changes shape per tier. What differs per
// tier is the size of the Bonus/Premium pool built on top of it, which is what grows the
// required-product target (30 for Tier 1, 26 for Tier 2, 23 for Tier 3).
//
// Every tier's non-core sections carry `promoteOnCheck: true`, meaning ticking one of those items
// visually promotes it into the Core Range section on the page (see partnership.js's
// jumpedItems/sectionItemsToRender) — purely a display move, the Core-100% gate always means
// exactly these 13 fixed products.
//
// Captain Morgan and Gordon's each come in two sizes (35cl/20cl). The sheet lists both as fully
// independent lines for Tier 1, so both stay separately tickable there with no extra requirement.
// For Tier 2 and Tier 3 the sheet instead treats each size-pair as a single "either" slot — since
// the app can't merge two different products into one checkbox, both sizes stay tickable for
// flexibility, but a `gate: { groups: [...] }` requires at least one from each pair before the
// tier can unlock (see partnership.js's sectionGateStats). Tier 3 additionally requires 2 of all
// 4 bottle sizes combined plus 1 of 2 Crush flavours — this is the one rule kept unchanged from
// the old scheme.

const CORE_RANGE = [
  "Smirnoff70Cl", "Smirnoff35cl", "Smirnoff20cl",
  "CaptianMorgan70cl", "GordonsOriginal70cl", "GordonsPink70cl", "GordonsPink35cl",
  "GuinnessDraugh",
  "RTDVColla", "RTDCM", "RTDGP", "RTDGO",
  "SmirnoffIce70cl"
];

const BONUS_BOTTLES = ["CaptianMorgan35cl", "CaptianMorgan20cl", "GordonsOriginal35cl", "Gordons20cl"];
const BONUS_CRUSHES = ["CrushLL", "CrushMP"];

const BONUS_RANGE_TIER1 = [
  "Guinness0", "CaptianMorgan35cl", "CaptianMorgan20cl", "GordonsOriginal35cl", "Gordons20cl",
  "SmirnoffIce4pack", "CrushLL", "CrushMP", "RaspberryCrush70cl", "MiamiPeach70cl",
  "Baileys70Cl", "RTDRCrush"
];
const PREMIUM_SPIRITS_TIER1 = ["CirocBlue70cl", "BlackLabel70cl", "CirocRed70cl", "Tanqueray70cl", "Casamigo70cl"];

const BONUS_RANGE_TIER2 = BONUS_RANGE_TIER1.concat(["CirocBlue70cl"]);

const BONUS_RANGE_TIER3 = ["Guinness0"].concat(BONUS_BOTTLES, BONUS_CRUSHES, ["SmirnoffIce4pack", "RaspberryCrush70cl", "MiamiPeach70cl"]);

window.PP_LAYOUT = {
  tier1: {
    label: "Tier 1", reward: 240, targetCount: 30,
    sections: [
      { label: "Core Range", items: CORE_RANGE, isCore: true },
      { label: "Bonus Range", items: BONUS_RANGE_TIER1, promoteOnCheck: true },
      { label: "Premium Spirits", items: PREMIUM_SPIRITS_TIER1, promoteOnCheck: true }
    ]
  },
  tier2: {
    label: "Tier 2", reward: 180, targetCount: 26,
    sections: [
      { label: "Core Range", items: CORE_RANGE, isCore: true },
      {
        label: "Bonus Range", items: BONUS_RANGE_TIER2, promoteOnCheck: true,
        gate: { hideTag: true, groups: [
          { label: "Captain Morgan", items: ["CaptianMorgan35cl", "CaptianMorgan20cl"], min: 1 },
          { label: "Gordon's", items: ["GordonsOriginal35cl", "Gordons20cl"], min: 1 }
        ] }
      }
    ]
  },
  tier3: {
    // Tier 3 unlocks its reward at an absolute count (20 of 23), not the 90%+ rule Tier 1/2 use —
    // see partnership.js's tierStats/unlockCount handling.
    label: "Tier 3", reward: 120, targetCount: 23, unlockCount: 20,
    sections: [
      { label: "Core Range", items: CORE_RANGE, isCore: true },
      {
        label: "Bonus Range", items: BONUS_RANGE_TIER3, promoteOnCheck: true,
        gate: { groups: [
          { label: "bottles", items: BONUS_BOTTLES, min: 2 },
          { label: "crush", items: BONUS_CRUSHES, min: 1 }
        ] }
      }
    ]
  }
};
