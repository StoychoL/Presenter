// Single source of truth for every product: identity, image, and case size.
// caseSize: how many bottles/cans make up one case (6 for bottles/4-packs, 12 for RTD cans) —
// used to derive the per-bottle price from the case price you enter (Case price ÷ caseSize).
// bookerPrice / bestwayPrice are CASE prices, entered/edited in the app (start at 0 = "not set").

const IMG_DIR = "images/Products/Single/";

window.CATALOG = {
  // ---- 70cl Range ----
  "Baileys70Cl": { name: "Baileys Original (70cl)", image: IMG_DIR + "Baileys70Cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "BlackLabel70cl": { name: "Johnnie Walker Black Label (70cl)", image: IMG_DIR + "BlackLabel70cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "CaptianMorgan70cl": { name: "Captain Morgan Spiced Gold (70cl)", image: IMG_DIR + "CaptianMorgan70cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "Casamigo70cl": { name: "Casamigos Blanco Tequila (70cl)", image: IMG_DIR + "Casamigo70cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "CirocBlue70cl": { name: "Cîroc Vodka (70cl)", image: IMG_DIR + "CirocBlue70cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "CirocRed70cl": { name: "Cîroc Red Berry (70cl)", image: IMG_DIR + "CirocRed70cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "GordonsOriginal70cl": { name: "Gordon's London Dry Gin (70cl)", image: IMG_DIR + "GordonsOriginal70cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "GordonsPink70cl": { name: "Gordon's Premium Pink (70cl)", image: IMG_DIR + "GordonsPink70cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "MangoAndPF70cl": { name: "Smirnoff Mango & Passionfruit (70cl)", image: IMG_DIR + "MangoAndPF70cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "MiamiPeach70cl": { name: "Smirnoff Miami Peach (70cl)", image: IMG_DIR + "MiamiPeach70cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "RaspberryCrush70cl": { name: "Smirnoff Raspberry Crush (70cl)", image: IMG_DIR + "RaspberryCrush70cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "RedLabel70cl": { name: "Johnnie Walker Red Label (70cl)", image: IMG_DIR + "RedLabel70cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "Smirnoff70Cl": { name: "Smirnoff No.21 (70cl)", image: IMG_DIR + "Smirnoff70Cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "SmirnoffIce70cl": { name: "Smirnoff Ice Original (70cl)", image: IMG_DIR + "SmirnoffIce70cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "Tanqueray70cl": { name: "Tanqueray London Dry Gin (70cl)", image: IMG_DIR + "Tanqueray70cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },

  // ---- 35cl Range ----
  "BlackLabel35cl": { name: "Johnnie Walker Black Label (35cl)", image: IMG_DIR + "BlackLabel35cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "CaptianMorgan35cl": { name: "Captain Morgan Spiced Gold (35cl)", image: IMG_DIR + "CaptianMorgan35cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "GordonsOriginal35cl": { name: "Gordon's London Dry Gin (35cl)", image: IMG_DIR + "GordonsOriginal35cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "GordonsPink35cl": { name: "Gordon's Premium Pink (35cl)", image: IMG_DIR + "GordonsPink35cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "MangoAndPF35cl": { name: "Smirnoff Mango & Passionfruit (35cl)", image: IMG_DIR + "MangoAndPF35cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "MiamiPeach35cl": { name: "Smirnoff Miami Peach (35cl)", image: IMG_DIR + "MiamiPeach35cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "RaspberryCrush35cl": { name: "Smirnoff Raspberry Crush (35cl)", image: IMG_DIR + "RaspberryCrush35cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "RedLabel35cl": { name: "Johnnie Walker Red Label (35cl)", image: IMG_DIR + "RedLabel35cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "Smirnoff35cl": { name: "Smirnoff No.21 (35cl)", image: IMG_DIR + "Smirnoff35cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },

  // ---- 20cl Range ----
  "CaptianMorgan20cl": { name: "Captain Morgan Spiced Gold (20cl)", image: IMG_DIR + "CaptianMorgan20cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "Gordons20cl": { name: "Gordon's London Dry Gin (20cl)", image: IMG_DIR + "Gordons20cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "Smirnoff20cl": { name: "Smirnoff No.21 (20cl)", image: IMG_DIR + "Smirnoff20cl.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },

  // ---- RTD & 4-Packs ----
  "CrushBP": { name: "Smirnoff Crush Blueberry & Pomegranate", image: IMG_DIR + "CrushBP.png", caseSize: 12, bookerPrice: 0, bestwayPrice: 0 },
  "CrushLL": { name: "Smirnoff Crush Lemon & Lime", image: IMG_DIR + "CrushLL.png", caseSize: 12, bookerPrice: 0, bestwayPrice: 0 },
  "CrushMP": { name: "Smirnoff Crush Mango & Peach", image: IMG_DIR + "CrushMP.png", caseSize: 12, bookerPrice: 0, bestwayPrice: 0 },
  "Guinness0": { name: "Guinness 0.0 Non-Alcoholic (4-Pack)", image: IMG_DIR + "Guinness0.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "GuinnessDraugh": { name: "Guinness Draught (4-Pack)", image: IMG_DIR + "GuinnessDraugh.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 },
  "RTDCM": { name: "Captain Morgan Spiced Gold & Pepsi (Can)", image: IMG_DIR + "RTDCM.png", caseSize: 12, bookerPrice: 0, bestwayPrice: 0 },
  "RTDCRanberry": { name: "Smirnoff Vodka & Cranberry (Can)", image: IMG_DIR + "RTDCRanberry.png", caseSize: 12, bookerPrice: 0, bestwayPrice: 0 },
  "RTDGD": { name: "Gordon's Gin & Diet Tonic (Can)", image: IMG_DIR + "RTDGD.png", caseSize: 12, bookerPrice: 0, bestwayPrice: 0 },
  "RTDGO": { name: "Gordon's Gin & Tonic (Can)", image: IMG_DIR + "RTDGO.png", caseSize: 12, bookerPrice: 0, bestwayPrice: 0 },
  "RTDGP": { name: "Gordon's Pink Gin & Tonic (Can)", image: IMG_DIR + "RTDGP.png", caseSize: 12, bookerPrice: 0, bestwayPrice: 0 },
  "RTDJWL": { name: "Johnnie Walker & Lemonade (Can)", image: IMG_DIR + "RTDJWL.png", caseSize: 12, bookerPrice: 0, bestwayPrice: 0 },
  "RTDMP": { name: "Smirnoff Miami Peach (Can)", image: IMG_DIR + "RTDMP.png", caseSize: 12, bookerPrice: 0, bestwayPrice: 0 },
  "RTDPimms": { name: "Pimm's No.1 & Lemonade (Can)", image: IMG_DIR + "RTDPimms.png", caseSize: 12, bookerPrice: 0, bestwayPrice: 0 },
  "RTDRCrush": { name: "Smirnoff Raspberry Crush (Can)", image: IMG_DIR + "RTDRCrush.png", caseSize: 12, bookerPrice: 0, bestwayPrice: 0 },
  "RTDSice": { name: "Smirnoff Ice Original (Can)", image: IMG_DIR + "RTDSice.png", caseSize: 12, bookerPrice: 0, bestwayPrice: 0 },
  "RTDVColla": { name: "Smirnoff Vodka & Cola (Can)", image: IMG_DIR + "RTDVColla.png", caseSize: 12, bookerPrice: 0, bestwayPrice: 0 },
  "SmirnoffIce4pack": { name: "Smirnoff Ice Original (4-Pack)", image: IMG_DIR + "SmirnoffIce4pack.png", caseSize: 6, bookerPrice: 0, bestwayPrice: 0 }
};
