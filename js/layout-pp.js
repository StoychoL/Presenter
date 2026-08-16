// Partnership Program tier grouping — sourced from the rules sheet photos (images/PP.jpg,
// images/PPT1.jpg, images/PPT2.jpg, images/PPT3.jpg), which supersede the older bottle-poster
// diagrams this file used to be built from.
//
// Core Range is the same fixed 13-product "must stock" list (CORE_RANGE, isCore: true) for
// all three tiers — it's the mandatory gate and never changes shape per tier. What differs per
// tier is the size of the Bonus/Premium pool built on top of it, which is what grows the
// required-product target (30 for Tier 1, 24 for Tier 2, 20 for Tier 3).
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
// tier can unlock (see partnership.js's sectionGateStats). Tier 3's Smirnoff Crush Lemon & Lime /
// Mango & Peach get the same either-slot treatment, on top of Captain Morgan/Gordon's.
//
// Tier 2 goes one step further: its Captain Morgan/Gordon's gate groups also carry
// `mergeCount: true`, meaning each pair counts as at most 1 toward the required-product total
// (ticking one size, the other, or both all count as 1) — see partnership.js's
// tierCheckedCount. That's why Tier 2's targetCount (24) is lower than its 26 physical products
// (13 Core Range + 13 Bonus Range, 4 of which collapse into 2 counted slots).
//
// Tier 3 applies that same Captain Morgan/Gordon's merge-pair treatment, plus a third merge pair
// of its own: Smirnoff Crush Lemon & Lime / Mango & Peach (the sheet lists these as a single
// EITHER/OR line for Tier 3, unlike Tier 2 where they're two independent lines). All three merge
// pairs are `min: 1` (at least one size/flavour required) — same shape as Tier 2's groups, just
// three of them instead of two. That's why Tier 3's targetCount (20) is lower than its 23
// physical products (13 Core Range + 10 Bonus Range, 6 of which collapse into 3 counted slots).

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
    // Unlocks at an absolute count (27 of 30), not the 90%+ rule — same mechanism as Tier 2/3,
    // see partnership.js's tierStats/unlockCount handling.
    label: "Tier 1", reward: 240, targetCount: 30, unlockCount: 27,
    sections: [
      { label: "Core Range", items: CORE_RANGE, isCore: true },
      { label: "Bonus Range", items: BONUS_RANGE_TIER1, promoteOnCheck: true },
      { label: "Premium Spirits", items: PREMIUM_SPIRITS_TIER1, promoteOnCheck: true }
    ]
  },
  tier2: {
    // Unlocks at an absolute count (22 of 24), not the 90%+ rule Tier 1 uses — see
    // partnership.js's tierStats/unlockCount handling, same mechanism as Tier 3.
    label: "Tier 2", reward: 180, targetCount: 24, unlockCount: 22,
    sections: [
      { label: "Core Range", items: CORE_RANGE, isCore: true },
      {
        label: "Bonus Range", items: BONUS_RANGE_TIER2, promoteOnCheck: true,
        gate: { hideTag: true, groups: [
          { label: "Captain Morgan", items: ["CaptianMorgan35cl", "CaptianMorgan20cl"], min: 1, mergeCount: true },
          { label: "Gordon's", items: ["GordonsOriginal35cl", "Gordons20cl"], min: 1, mergeCount: true }
        ] }
      }
    ]
  },
  tier3: {
    // Tier 3 unlocks its reward at an absolute count (18 of 20), not the 90%+ rule Tier 1/2 use —
    // see partnership.js's tierStats/unlockCount handling.
    label: "Tier 3", reward: 120, targetCount: 20, unlockCount: 18,
    sections: [
      { label: "Core Range", items: CORE_RANGE, isCore: true },
      {
        label: "Bonus Range", items: BONUS_RANGE_TIER3, promoteOnCheck: true,
        gate: { hideTag: true, groups: [
          { label: "Captain Morgan", items: ["CaptianMorgan35cl", "CaptianMorgan20cl"], min: 1, mergeCount: true },
          { label: "Gordon's", items: ["GordonsOriginal35cl", "Gordons20cl"], min: 1, mergeCount: true },
          { label: "Crush", items: BONUS_CRUSHES, min: 1, mergeCount: true }
        ] }
      }
    ]
  }
};
