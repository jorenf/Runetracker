/**
 * src/utils/wikicons.js
 * Central registry of OSRS Wiki image URLs used as Discord embed thumbnails.
 *
 * All images are served directly from the Old School RuneScape Wiki CDN.
 * Skill icons:  https://oldschool.runescape.wiki/w/Category:Skill_icons
 * Boss images:  https://oldschool.runescape.wiki/w/Bosses
 */

const W = 'https://oldschool.runescape.wiki/images';

// ---------------------------------------------------------------------------
// Skill icons  (24 skills + overall)
// ---------------------------------------------------------------------------
export const SKILL_ICON = {
  overall:      `${W}/Stats_icon.png`,
  attack:       `${W}/Attack_icon.png`,
  defence:      `${W}/Defence_icon.png`,
  strength:     `${W}/Strength_icon.png`,
  hitpoints:    `${W}/Hitpoints_icon.png`,
  ranged:       `${W}/Ranged_icon.png`,
  prayer:       `${W}/Prayer_icon.png`,
  magic:        `${W}/Magic_icon.png`,
  cooking:      `${W}/Cooking_icon.png`,
  woodcutting:  `${W}/Woodcutting_icon.png`,
  fletching:    `${W}/Fletching_icon.png`,
  fishing:      `${W}/Fishing_icon.png`,
  firemaking:   `${W}/Firemaking_icon.png`,
  crafting:     `${W}/Crafting_icon.png`,
  smithing:     `${W}/Smithing_icon.png`,
  mining:       `${W}/Mining_icon.png`,
  herblore:     `${W}/Herblore_icon.png`,
  agility:      `${W}/Agility_icon.png`,
  thieving:     `${W}/Thieving_icon.png`,
  slayer:       `${W}/Slayer_icon.png`,
  farming:      `${W}/Farming_icon.png`,
  runecrafting: `${W}/Runecraft_icon.png`,
  hunter:       `${W}/Hunter_icon.png`,
  construction: `${W}/Construction_icon.png`,
  sailing:      `${W}/Sailing_icon.png`,
};

// ---------------------------------------------------------------------------
// Boss images
// ---------------------------------------------------------------------------
export const BOSS_ICON = {
  // Wilderness
  chaos_elemental:         `${W}/Chaos_Elemental.png`,
  chaos_fanatic:           `${W}/Chaos_Fanatic.png`,
  crazy_archaeologist:     `${W}/Crazy_archaeologist.png`,
  king_black_dragon:       `${W}/King_Black_Dragon.png`,
  scorpia:                 `${W}/Scorpia.png`,
  vetion:                  `${W}/Vet%27ion.png`,
  venenatis:               `${W}/Venenatis.png`,
  callisto:                `${W}/Callisto.png`,

  // God Wars Dungeon
  commander_zilyana:       `${W}/Commander_Zilyana.png`,
  general_graardor:        `${W}/General_Graardor.png`,
  kril_tsutsaroth:         `${W}/K%27ril_Tsutsaroth.png`,
  kreearra:                `${W}/Kree%27arra.png`,
  nex:                     `${W}/Nex.png`,

  // Slayer bosses
  cerberus:                `${W}/Cerberus.png`,
  grotesque_guardians:     `${W}/Grotesque_Guardians.png`,
  abyssal_sire:            `${W}/Abyssal_Sire.png`,
  kraken:                  `${W}/Kraken.png`,
  thermonuclear_smoke_devil: `${W}/Thermonuclear_smoke_devil.png`,
  alchemical_hydra:        `${W}/Alchemical_Hydra.png`,
  skotizo:                 `${W}/Skotizo.png`,

  // Classic
  giant_mole:              `${W}/Giant_Mole.png`,
  kalphite_queen:          `${W}/Kalphite_Queen.png`,
  barrows_chests:          `${W}/Dharok_the_Wretched.png`,
  dagannoth_prime:         `${W}/Dagannoth_Prime.png`,
  dagannoth_rex:           `${W}/Dagannoth_Rex.png`,
  dagannoth_supreme:       `${W}/Dagannoth_Supreme.png`,
  zulrah:                  `${W}/Zulrah.png`,
  vorkath:                 `${W}/Vorkath.png`,

  // Raids
  chambers_of_xeric:               `${W}/Chambers_of_Xeric.png`,
  chambers_of_xeric_challenge_mode: `${W}/Chambers_of_Xeric.png`,
  theatre_of_blood:                `${W}/Lady_Verzik_Vitur.png`,
  theatre_of_blood_hard_mode:      `${W}/Lady_Verzik_Vitur.png`,
  tombs_of_amascut:                `${W}/Tumeken%27s_Warden.png`,
  tombs_of_amascut_expert:         `${W}/Tumeken%27s_Warden.png`,

  // Minigames
  wintertodt:              `${W}/Wintertodt.png`,
  zalcano:                 `${W}/Zalcano.png`,
  tempoross:               `${W}/Tempoross.png`,

  // Inf/endgame
  tzkal_zuk:               `${W}/TzKal-Zuk.png`,
  tztok_jad:               `${W}/TzTok-Jad.png`,
  the_nightmare:           `${W}/The_Nightmare.png`,
  phosanis_nightmare:      `${W}/Phosani%27s_Nightmare.png`,

  // The Gauntlet
  the_gauntlet:            `${W}/Crystalline_Hunllef.png`,
  corrupted_gauntlet:      `${W}/Corrupted_Hunllef.png`,

  // DT2 bosses
  duke_sucellus:           `${W}/Duke_Sucellus.png`,
  the_leviathan:           `${W}/The_Leviathan.png`,
  the_whisperer:           `${W}/The_Whisperer.png`,
  vardorvis:               `${W}/Vardorvis.png`,

  // Newer
  phantom_muspah:          `${W}/Phantom_Muspah.png`,
  scurrius:                `${W}/Scurrius.png`,
  sol_heredit:             `${W}/Sol_Heredit.png`,
  lunar_chests:            `${W}/Lunar_chest.png`,
};

// ---------------------------------------------------------------------------
// Clue scroll icons
// ---------------------------------------------------------------------------
export const CLUE_ICON = {
  clue_scrolls_beginner: `${W}/Clue_scroll_%28beginner%29.png`,
  clue_scrolls_easy:     `${W}/Clue_scroll_%28easy%29.png`,
  clue_scrolls_medium:   `${W}/Clue_scroll_%28medium%29.png`,
  clue_scrolls_hard:     `${W}/Clue_scroll_%28hard%29.png`,
  clue_scrolls_elite:    `${W}/Clue_scroll_%28elite%29.png`,
  clue_scrolls_master:   `${W}/Clue_scroll_%28master%29.png`,
  clue_scrolls_all:      `${W}/Clue_scroll_%28easy%29.png`,
};

// ---------------------------------------------------------------------------
// XP leaderboard bar icons (rank 0 = best)
// ---------------------------------------------------------------------------
export const XP_BAR_ICON = [
  `${W}/Gold_bar.png`,    // 1st
  `${W}/Mithril_bar.png`, // 2nd
  `${W}/Steel_bar.png`,   // 3rd
  `${W}/Iron_bar.png`,    // 4th
  `${W}/Bronze_bar.png`,  // 5th+
];

// ---------------------------------------------------------------------------
// Helpers with fallbacks
// ---------------------------------------------------------------------------

/** Returns the wiki icon URL for a skill, falling back to the Stats icon. */
export function getSkillIcon(skill) {
  return SKILL_ICON[skill] ?? SKILL_ICON.overall;
}

/** Returns the wiki image URL for a boss, falling back to a generic skull. */
export function getBossIcon(boss) {
  return BOSS_ICON[boss] ?? `${W}/Skull.png`;
}

/** Returns the clue scroll icon for a tier key. */
export function getClueIcon(tier) {
  return CLUE_ICON[tier] ?? CLUE_ICON.clue_scrolls_easy;
}

/** Returns the XP bar icon for a leaderboard rank (0-indexed). */
export function getXpBarIcon(rank) {
  return XP_BAR_ICON[Math.min(rank, XP_BAR_ICON.length - 1)];
}
