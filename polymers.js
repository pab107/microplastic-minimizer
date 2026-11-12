// polymers.js — the WATCH-LIST of synthetic polymers the app looks for.
//
// WHERE THIS LIST COMES FROM
//   Cosmetics: Beat the Microbead (Plastic Soup Foundation), which keeps two lists:
//     - Red List (556 ingredients, updated 05.01.2022): "commonly considered to be
//       microplastic ingredients". Built from research by UNEP, Tauw and ECHA.
//     - Orange List (622 ingredients): "sceptical" synthetic polymers, where there
//       isn't enough information on whether they break down in nature.
//   Clothing: Beat the Microbead only covers cosmetics, so fabric entries use
//     - the US FTC's official names for synthetic (man-made) fibers, and
//     - Napper & Thompson (2016), a study measuring fibers shed in the wash.
//   There is NO official complete list of microplastic ingredients; this is a
//   short list of the most common ones, not all ~1,000 on the full lists.
//
// Each entry has:
//   name    — the friendly name shown to the user
//   pattern — a "regular expression": a search pattern that can match
//             several spellings at once (e.g. "nylon", "nylon-6", "nylon-12").
//             \b means "word edge", ? means "optional", | means "or".
//             (?![\d%]) means "not followed by a digit or %", so on a tag like
//             "10% NYLON 5% POLYESTER" we don't read "nylon 5" as one name.
//   level   — "high"  = shown as MICROPLASTIC: on the Red List, or a synthetic
//                       fabric fiber that sheds microplastics in the wash
//             "watch" = shown as WATCH: on the Orange List (debated)
//   where   — where you usually see it: "fabric", "cosmetic", or "both"
//   why     — a one-line explanation shown in the results
//   source  — where we got it from (also shown in the results)
//
// ORDER MATTERS: longer, more specific names come first. When one is found,
// the app crosses it out so a shorter name inside it isn't counted twice
// (e.g. "polyethylene glycol" should not also count as "polyethylene").
//
// To add a new ingredient, copy one entry, change the values, and save.

// Short names for the sources, so each entry can just say which one it uses
const RED_LIST    = "Beat the Microbead Red List";
const ORANGE_LIST = "Beat the Microbead Orange List";
const FTC_FIBERS  = "US FTC generic names for synthetic fibers (16 CFR 303.7)";
const NAPPER_2016 = "Napper & Thompson (2016), Marine Pollution Bulletin";

const POLYMERS = [
  // ---------- Specific names first ----------
  {
    name: "Polyethylene glycol (PEG)",
    pattern: /polyethylene glycol|\bpeg[\s-]*\d+(?![\d%])/,
    level: "watch", where: "cosmetic",
    why: "A liquid synthetic polymer. Whether it breaks down depends on its chain length, so it's debated.",
    source: ORANGE_LIST + " (all PEGs)"
  },
  {
    name: "Polypropylene glycol (PPG)",
    pattern: /polypropylene glycol|\bppg[\s-]*\d+(?![\d%])/,
    level: "watch", where: "cosmetic",
    why: "A liquid synthetic polymer related to PEG. Not enough evidence that it breaks down.",
    source: ORANGE_LIST + " (all PPGs)"
  },
  {
    name: "Polyethylene terephthalate (PET)",
    pattern: /polyethylene terephthalate/,
    level: "high", where: "both",
    why: "The plastic in water bottles. Used in glitter and polyester fabric; sheds microplastics.",
    source: RED_LIST
  },
  {
    name: "Polymethyl methacrylate (PMMA)",
    pattern: /polymethyl ?methacrylate|\bpmma\b/,
    level: "high", where: "cosmetic",
    why: "Acrylic plastic beads used to blur or smooth skin. A solid microplastic.",
    source: RED_LIST
  },
  {
    name: "Acrylates copolymer / crosspolymer",
    pattern: /\b(?:[a-z0-9-]+\/)*acrylates?\b[^,;.()]{0,40}?(?:co|cross)polymer/,
    level: "high", where: "cosmetic",
    why: "Synthetic acrylic polymers used as film-formers and thickeners.",
    source: RED_LIST
  },
  {
    name: "Modacrylic",
    pattern: /modacrylic/,
    level: "high", where: "fabric",
    why: "Synthetic acrylic-type fiber that sheds microfibers in the wash.",
    source: FTC_FIBERS
  },
  {
    name: "Polyvinyl chloride (PVC)",
    pattern: /polyvinyl chloride|\bpvc\b/,
    level: "high", where: "both",
    why: "A common plastic; also contains additives that can leach out.",
    source: RED_LIST
  },
  {
    name: "Polyvinyl alcohol (PVA)",
    pattern: /polyvinyl alcohol|\bpva\b/,
    level: "high", where: "cosmetic",
    why: "Synthetic polymer used in peel-off masks and laundry pods.",
    source: RED_LIST
  },
  {
    name: "Polyvinylpyrrolidone (PVP) / VP copolymers",
    pattern: /polyvinylpyrrolidone|\bpvp\b|\bvp\/va copolymer/,
    level: "high", where: "cosmetic",
    why: "Synthetic film-forming polymer common in hair styling products.",
    source: RED_LIST
  },
  {
    name: "Polytetrafluoroethylene (PTFE / Teflon)",
    pattern: /polytetrafluoroethylene|\bptfe\b/,
    level: "high", where: "cosmetic",
    why: "A fluorinated plastic (a PFAS 'forever chemical') used in some makeup.",
    source: RED_LIST
  },
  {
    // Beat the Microbead puts these two on the RED list, other polyquaterniums on ORANGE
    name: "Polyquaternium-6 / -7",
    pattern: /polyquaternium[\s-]*[67](?![\d%])/,
    level: "high", where: "cosmetic",
    why: "Synthetic polymers in shampoos and conditioners. These two are classed as microplastics.",
    source: RED_LIST
  },

  // ---------- Plastics (cosmetics and fabrics) ----------
  {
    name: "Polyethylene (PE)",
    pattern: /polyethylene/,
    level: "high", where: "both",
    why: "The most common plastic. Used as microbeads/scrubs in cosmetics.",
    source: RED_LIST
  },
  {
    name: "Polypropylene (PP)",
    pattern: /polypropylene/,
    level: "high", where: "both",
    why: "A common plastic used in cosmetics and some fabrics.",
    source: RED_LIST
  },
  {
    name: "Polystyrene",
    pattern: /polystyrene/,
    level: "high", where: "cosmetic",
    why: "The plastic in foam cups; sometimes used in cosmetics.",
    source: RED_LIST
  },
  {
    name: "Polyurethane",
    pattern: /polyurethane(?:[\s-]*\d+(?![\d%]))?/,
    level: "high", where: "both",
    why: "Plastic used in cosmetics films and stretchy/coated fabrics.",
    source: RED_LIST
  },
  {
    name: "Nylon / Polyamide",
    pattern: /\bnylon(?:[\s-]*\d+(?![\d%]))?|polyamide/,
    level: "high", where: "both",
    why: "Plastic fiber in clothing (sheds in the wash) and a powder in makeup (Nylon-12).",
    source: RED_LIST + "; " + FTC_FIBERS
  },
  {
    name: "Polyquaternium",
    pattern: /polyquaternium(?:[\s-]*\d+(?![\d%]))?/,
    level: "watch", where: "cosmetic",
    why: "Synthetic polymers in shampoos and conditioners. Liquid, but slow to break down.",
    source: ORANGE_LIST
  },
  {
    name: "Carbomer",
    pattern: /\bcarbomer\b/,
    level: "high", where: "cosmetic",
    why: "A synthetic acrylic thickener used in gels and lotions.",
    source: RED_LIST
  },
  {
    name: "Dimethicone (silicone)",
    pattern: /\bdimethicone\b/,
    level: "high", where: "cosmetic",
    why: "A silicone polymer that is very persistent in the environment.",
    source: RED_LIST
  },
  {
    name: "Polysorbate",
    pattern: /polysorbate(?:[\s-]*\d+(?![\d%]))?/,
    level: "watch", where: "cosmetic",
    why: "Synthetic emulsifier made with PEG chains. Not enough evidence that it breaks down.",
    source: ORANGE_LIST
  },
  {
    name: "Poloxamer",
    pattern: /poloxamer(?:[\s-]*\d+(?![\d%]))?/,
    level: "watch", where: "cosmetic",
    why: "Synthetic polymer (made of PEG and PPG) used in cleansers. Debated.",
    source: ORANGE_LIST
  },
  {
    name: "Glitter",
    pattern: /\bglitter\b/,
    level: "watch", where: "cosmetic",
    why: "Most cosmetic glitter is made of PET plastic unless labeled plant-based or mica.",
    source: "Not an ingredient name, so not on the lists; flagged because PET is on the " + RED_LIST
  },

  // ---------- Synthetic fabrics (clothing tags) ----------
  {
    name: "Polyester",
    pattern: /polyester/,
    level: "high", where: "fabric",
    why: "The most common synthetic fiber. Sheds thousands of microfibers each wash.",
    source: FTC_FIBERS + "; " + NAPPER_2016
  },
  {
    name: "Acrylic",
    pattern: /\bacrylic\b/,
    level: "high", where: "fabric",
    why: "Synthetic fiber (often a wool substitute). Shed the most fibers in washing tests.",
    source: FTC_FIBERS + "; " + NAPPER_2016
  },
  {
    name: "Spandex / Elastane / Lycra",
    pattern: /spandex|elastane|lycra/,
    level: "high", where: "fabric",
    why: "Stretchy polyurethane-based fiber that sheds microplastics.",
    source: FTC_FIBERS
  },
  {
    name: "Olefin",
    pattern: /\bolefin\b/,
    level: "high", where: "fabric",
    why: "A polypropylene/polyethylene fiber used in activewear and carpets.",
    source: FTC_FIBERS
  },
  {
    name: "Microfiber",
    pattern: /microfib(?:er|re)/,
    level: "high", where: "fabric",
    why: "Usually ultra-fine polyester or nylon; sheds easily.",
    source: "Microfiber is a fabric type, usually polyester or nylon (see those entries)"
  }
];
