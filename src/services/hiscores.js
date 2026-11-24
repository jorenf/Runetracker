/**
 * Direct OSRS hiscores client.
 *
 * Player skill, activity, and boss rows are normalized to the snapshot shape
 * used by the tracker. WOM remains the fallback for unavailable hiscore data.
 */

const BASE_URL = 'https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws';
const CACHE_MS = 60_000;

const SKILLS = [
  'overall', 'attack', 'defence', 'strength', 'hitpoints', 'ranged', 'prayer', 'magic',
  'cooking', 'woodcutting', 'fletching', 'fishing', 'firemaking', 'crafting', 'smithing',
  'mining', 'herblore', 'agility', 'thieving', 'slayer', 'farming', 'runecraft', 'hunter',
  'construction', 'sailing',
];

const ACTIVITIES = [
  'league_points', 'bounty_hunter_hunter', 'bounty_hunter_rogue',
  'clue_scrolls_all', 'clue_scrolls_beginner', 'clue_scrolls_easy', 'clue_scrolls_medium',
  'clue_scrolls_hard', 'clue_scrolls_elite', 'clue_scrolls_master', 'last_man_standing',
  'pvp_arena', 'soul_wars_zeal', 'guardians_of_the_rift', 'colosseum_glory', 'collections_logged',
];

const BOSSES = [
  'abyssal_sire', 'alchemical_hydra', 'amoxliatl', 'araxxor', 'artio', 'barrows_chests',
  'brutus', 'bryophyta', 'callisto', 'calvarion', 'cerberus', 'chambers_of_xeric',
  'chambers_of_xeric_challenge_mode', 'chaos_elemental', 'chaos_fanatic',
  'commander_zilyana', 'corporeal_beast', 'crazy_archaeologist', 'dagannoth_prime',
  'dagannoth_rex', 'dagannoth_supreme', 'deranged_archaeologist', 'doom_of_mokhaiotl',
  'duke_sucellus', 'general_graardor', 'giant_mole', 'grotesque_guardians', 'hespori',
  'kalphite_queen', 'king_black_dragon', 'kraken', 'kree_arra', 'kril_tsutsaroth',
  'lunar_chests', 'mad_angel', 'maggot_king', 'mimic', 'nex', 'nightmare',
  'phosanis_nightmare', 'obor', 'phantom_muspah', 'sarachnis', 'scorpia', 'scurrius',
  'shellbane_gryphon', 'skotizo', 'sol_heredit', 'spindel', 'tempoross', 'the_gauntlet',
  'the_corrupted_gauntlet', 'the_hueycoatl', 'the_leviathan', 'the_royal_titans',
  'the_whisperer', 'theatre_of_blood', 'theatre_of_blood_hard_mode',
  'the_fractured_archive', 'thermonuclear_smoke_devil', 'tombs_of_amascut',
  'tombs_of_amascut_expert', 'tzkal_zuk', 'tztok_jad', 'vardorvis', 'venenatis', 'vetion',
  'vorkath', 'wintertodt', 'yama', 'zalcano', 'zulrah',
];

const MIN_HISCORE_ROWS = SKILLS.length + ACTIVITIES.length + BOSSES.length;
const MAX_CACHE_ENTRIES = 1000;
const cache = new Map();

function parseValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseRow(line, hasExperience = false) {
  const parts = line.split(',');
  const requiredValues = hasExperience ? 3 : 2;
  if (parts.length < requiredValues || parts.slice(0, requiredValues).some(value => !Number.isFinite(Number(value)))) {
    throw new Error('OSRS hiscores returned a malformed row.');
  }
  const [rank, value, experience] = parts.map(Number);
  return {
    rank: Number.isFinite(rank) && rank >= 0 ? rank : -1,
    value: parseValue(value),
    experience: parseValue(experience),
  };
}

export function parseHiscoreResponse(text, username) {
  const rows = String(text).trim().split(/\r?\n/);
  if (rows.length < MIN_HISCORE_ROWS) {
    throw new Error(`OSRS hiscores returned incomplete data for "${username}".`);
  }

  const skills = {};
  for (let index = 0; index < SKILLS.length; index += 1) {
    const row = parseRow(rows[index], true);
    skills[SKILLS[index]] = {
      rank: row.rank,
      level: row.value,
      experience: row.experience,
    };
  }

  const activities = {};
  const activityStart = SKILLS.length;
  for (let index = 0; index < ACTIVITIES.length; index += 1) {
    const row = parseRow(rows[activityStart + index]);
    activities[ACTIVITIES[index]] = { rank: row.rank, score: row.value };
  }

  const bosses = {};
  const bossStart = activityStart + ACTIVITIES.length;
  for (let index = 0; index < BOSSES.length && bossStart + index < rows.length; index += 1) {
    const row = parseRow(rows[bossStart + index]);
    bosses[BOSSES[index]] = { rank: row.rank, kills: row.value };
  }

  return {
    username,
    latestSnapshot: { data: { skills, activities, bosses } },
  };
}

export async function fetchHiscorePlayer(username) {
  const normalized = username.trim().toLowerCase();
  const cached = cache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.player;

  const url = `${BASE_URL}?player=${encodeURIComponent(username.trim())}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`OSRS hiscores returned HTTP ${response.status} for "${username}".`);
  }

  const player = parseHiscoreResponse(await response.text(), username.trim());
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(normalized, { expiresAt: Date.now() + CACHE_MS, player });
  return player;
}
