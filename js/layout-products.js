// Product Presenter page grouping/order — just ids into CATALOG, no coordinates.

window.PRODUCTS_LAYOUT = [
  {
    key: "instock",
    label: "In Stock",
    items: [],
    isTop: true
  },
  {
    key: "70cl",
    label: "70cl Range",
    items: [
      "Smirnoff70Cl", "BlackLabel70cl", "RedLabel70cl", "CaptianMorgan70cl",
      "GordonsOriginal70cl", "GordonsPink70cl", "Baileys70Cl", "Tanqueray70cl",
      "Casamigo70cl", "CirocBlue70cl", "CirocRed70cl", "SmirnoffIce70cl",
      "MangoAndPF70cl", "MiamiPeach70cl", "RaspberryCrush70cl"
    ],
    promoteOnPrice: true
  },
  {
    key: "35cl",
    label: "35cl Range",
    items: [
      "Smirnoff35cl", "BlackLabel35cl", "RedLabel35cl", "CaptianMorgan35cl",
      "GordonsOriginal35cl", "GordonsPink35cl",
      "MangoAndPF35cl", "MiamiPeach35cl", "RaspberryCrush35cl"
    ],
    promoteOnPrice: true
  },
  {
    key: "20cl",
    label: "20cl Range",
    items: ["Smirnoff20cl", "CaptianMorgan20cl", "Gordons20cl"],
    promoteOnPrice: true
  },
  {
    key: "rtd",
    label: "RTD & 4-Packs",
    items: [
      "RTDVColla", "RTDCRanberry", "RTDMP", "RTDRCrush",
      "RTDJWL", "RTDSice", "RTDCM", "RTDPimms",
      "RTDGO", "RTDGP", "RTDGD",
      "CrushLL", "CrushMP", "CrushBP",
      "SmirnoffIce4pack", "GuinnessDraugh", "Guinness0"
    ],
    promoteOnPrice: true
  }
];
