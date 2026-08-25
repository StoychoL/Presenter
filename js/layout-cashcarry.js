// Cash & Carry Form data — mirrors the external Microsoft Form ("Cash & Carry Stock Availability
// Convenience") a rep fills out on every C&C depot visit. Verified directly against the live form
// (all four chain branches and both regions show the identical 39-product list) rather than
// guessed — see CLAUDE.md's "Cash & Carry Form" section for the full design rationale.

window.CASHCARRY_CHAINS = ["Bestway", "Booker", "Makro", "Other"];

window.CASHCARRY_REGIONS = ["North", "South"];

window.CASHCARRY_STATUS_OPTIONS = [
  "No stock not ranged",
  "Retro Off, No stock but ranged",
  "Retro Off, Stock - plenty of it",
  "Retro Off, Stock but limited",
  "Retro On, No stock but ranged",
  "Retro On, Stock - plenty of it",
  "Retro On, Stock but limited"
];

// id: a stable slug derived once from the product name — not array-index-based, so inserting or
// reordering a product later can never silently shift another product's saved status onto the
// wrong id. name: exact verbatim text from the real form (including its punctuation quirks),
// shown as "<name>, what is the stock status?" so a rep can quickly re-pick the same answer on
// the real Microsoft Form afterward.
window.CASHCARRY_PRODUCTS = [
  { id: "guinnessDraught00Can4pkPmp", name: "Guinness Draught 0.0% in can 0.44L 4PK - PMP" },
  { id: "guinnessDraughtCan4pk", name: "Guinness Draught in can 0.44L 4PK" },
  { id: "smirnoffCrushMangoPeach440ml", name: "Smirnoff Crush RTD Mango and Peach (RTD) 440ml" },
  { id: "smirnoffCrushLemonLime440ml", name: "Smirnoff Crush RTD Lemon and Lime (RTD) 440ml" },
  { id: "smirnoffCrushBlueberryPomegranate440ml", name: "Smirnoff Crush  Blueberry and Pomegranate (RTD) 440ml" },
  { id: "guinnessFes", name: "Guinness FES" },
  { id: "jwLemonadeRtd", name: "JW & Lemonade (RTD)" },
  { id: "smirnoffIce07lPmp", name: "Smirnoff Ice (RTD) 0.7L PMP" },
  { id: "smirnoffMiamiPeach35cl", name: "Smirnoff Miami Peach 35cl" },
  { id: "gordonsGinTonic025l", name: "Gordon's Gin & Tonic (RTD) 0.25L" },
  { id: "smirnoffMiamiPeachSd07l", name: "Smirnoff Miami Peach (SD) 0.7L" },
  { id: "smirnoffMiamiPeachRtd025l", name: "Smirnoff Miami Peach RTD 0.25L" },
  { id: "gordonsDietTonic025l", name: "Gordon's & Diet Tonic (RTD) 0.25L" },
  { id: "gordonsPinkDietTonic025l", name: "Gordon's Pink & Diet Tonic (RTD) 0.25L" },
  { id: "smirnoffVodkaCranberry025l", name: "Smirnoff Vodka & Cranberry Juice (RTD 0.25L" },
  { id: "smirnoffRaspberryCrushLemonade", name: "Smirnoff Raspberry Crush & Lemonade (RTD)" },
  { id: "smirnoffVodkaCola025l", name: "Smirnoff Vodka & Cola (RTD) 0.25L" },
  { id: "smirnoffRaspberryCrush07l", name: "Smirnoff Raspberry Crush (RTD) 0.7L" },
  { id: "smirnoffRaspberryCrush35cl", name: "Smirnoff Raspberry Crush 35cl" },
  { id: "jwBlack35cl", name: "JW Black 35cl" },
  { id: "capMPepsiMax025l", name: "Cap M&Pepsi Max 0.25L" },
  { id: "jwRed35cl", name: "JW Red 35cl" },
  { id: "cirocBlueDotVodka07l", name: "Ciroc Blue Dot Vodka 0.7L" },
  { id: "tanquerayLondonDryGin07l", name: "Tanqueray London Dry Gin 0.7L" },
  { id: "cirocRedBerryLemonade07l", name: "Cîroc Red Berry & Lemonade 0.7L" },
  { id: "baileysOriginal07l", name: "Baileys Original 0.7L" },
  { id: "jwBlackLabel07l", name: "JW Black Label 0.7L" },
  { id: "captainMorganSpicedGold07l", name: "Captain Morgan Spiced Gold 0.7L" },
  { id: "captainMorganSpicedGold035l", name: "Captain Morgan Spiced Gold 0.35L" },
  { id: "smirnoffIce4pk025l", name: "Smirnoff Ice (RTD) 4 pk 0.25L" },
  { id: "captainMorganSpicedGold02l6pk", name: "Captain Morgan Spiced Gold 0.2L 6PK" },
  { id: "gordonsDry35cl", name: "Gordons Dry 35cl" },
  { id: "gordonsDry70cl", name: "Gordons Dry 70cl" },
  { id: "gordonsPink35cl", name: "Gordons Pink 35cl" },
  { id: "gordonsPink70cl", name: "Gordons Pink 70cl" },
  { id: "smirnoffRed20cl", name: "Smirnoff Red 20cl" },
  { id: "smirnoffRed70cl", name: "Smirnoff Red 70cl" },
  { id: "smirnoffRed35cl", name: "Smirnoff Red 35cl" },
  { id: "casamigos70cl", name: "Casamigos 70cl" }
];
