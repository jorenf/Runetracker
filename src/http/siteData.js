const OPTION_TYPES = {
  1: 'subcommand',
  2: 'subcommand_group',
  3: 'string',
  4: 'integer',
  5: 'boolean',
  6: 'user',
  7: 'channel',
  8: 'role',
  9: 'mentionable',
  10: 'number',
  11: 'attachment',
};

const CATEGORY_BY_COMMAND = {
  setup: 'Setup',
  setchannel: 'Setup',
  setadmin: 'Setup',
  setgroup: 'Setup',
  track: 'Tracking',
  untrack: 'Tracking',
  trackoption: 'Tracking',
  spamfilter: 'Tracking',
  settings: 'Info',
  lookup: 'Info',
  help: 'Info',
  status: 'Admin Tools',
  checkupdate: 'Admin Tools',
  weeklytop: 'Admin Tools',
};

const CATEGORY_ORDER = ['Setup', 'Tracking', 'Info', 'Admin Tools', 'Other'];

function optionType(type) {
  return OPTION_TYPES[type] ?? String(type ?? 'unknown');
}

function isAdminCommand(raw) {
  return raw.default_member_permissions != null;
}

function normalOption(option) {
  return {
    name: option.name,
    type: optionType(option.type),
    required: Boolean(option.required),
    description: option.description ?? '',
    choices: (option.choices ?? []).map(c => ({ name: c.name, value: c.value })),
  };
}

function commandEntry(raw, name, description, options) {
  const root = raw.name;
  return {
    name,
    root,
    category: CATEGORY_BY_COMMAND[root] ?? 'Other',
    description,
    admin: isAdminCommand(raw),
    options: (options ?? []).map(normalOption),
  };
}

function flattenCommand(raw) {
  const options = raw.options ?? [];
  const subcommands = options.filter(o => o.type === 1);
  const groups = options.filter(o => o.type === 2);
  const entries = [];

  for (const sub of subcommands) {
    entries.push(commandEntry(raw, `/${raw.name} ${sub.name}`, sub.description ?? raw.description, sub.options ?? []));
  }

  for (const group of groups) {
    for (const sub of group.options?.filter(o => o.type === 1) ?? []) {
      entries.push(commandEntry(raw, `/${raw.name} ${group.name} ${sub.name}`, sub.description ?? group.description ?? raw.description, sub.options ?? []));
    }
  }

  if (!entries.length) {
    entries.push(commandEntry(raw, `/${raw.name}`, raw.description ?? '', options.filter(o => o.type !== 1 && o.type !== 2)));
  }

  return entries;
}

export function buildCommandCatalog(commands) {
  const raw = Array.from(commands)
    .map(command => command?.data?.toJSON?.())
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  const all = raw.flatMap(flattenCommand);
  all.sort((a, b) => {
    const cat = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    return cat || a.name.localeCompare(b.name);
  });

  const groups = CATEGORY_ORDER
    .map(category => ({
      category,
      commands: all.filter(c => c.category === category),
    }))
    .filter(group => group.commands.length > 0);

  return {
    total: all.length,
    groups,
    commands: all,
    raw,
  };
}

function numberValue(value) {
  return Math.max(0, Number(value) || 0);
}

function titleCaseMetric(key) {
  return String(key ?? '')
    .split('_')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function topRows(rows, limit = 10) {
  return rows
    .filter(row => row.value > 0)
    .sort((a, b) => b.value - a.value || a.username.localeCompare(b.username))
    .slice(0, limit)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

function bossTotals(player) {
  let total = 0;
  let topBoss = null;
  let topKills = 0;

  for (const [boss, data] of Object.entries(player.snapshot?.bosses ?? {})) {
    const kills = numberValue(data?.kills);
    total += kills;
    if (kills > topKills) {
      topKills = kills;
      topBoss = boss;
    }
  }

  return {
    total,
    topBoss: titleCaseMetric(topBoss),
  };
}

export function buildLeaderboards(players) {
  const totalLevelRows = topRows(players.map(player => ({
    username: player.username,
    value: numberValue(player.snapshot?.skills?.overall?.level),
    meta: `${numberValue(player.snapshot?.skills?.overall?.experience).toLocaleString('en-US')} XP`,
    updated_at: player.updated_at ?? null,
  })));

  const totalXpRows = topRows(players.map(player => ({
    username: player.username,
    value: numberValue(player.snapshot?.skills?.overall?.experience),
    meta: `Total level ${numberValue(player.snapshot?.skills?.overall?.level)}`,
    updated_at: player.updated_at ?? null,
  })));

  const bossRows = topRows(players.map(player => {
    const bosses = bossTotals(player);
    return {
      username: player.username,
      value: bosses.total,
      meta: bosses.topBoss || 'Boss KC',
      updated_at: player.updated_at ?? null,
    };
  }));

  return {
    total_level: {
      label: 'Total level',
      value_label: 'Level',
      rows: totalLevelRows,
    },
    total_xp: {
      label: 'Total XP',
      value_label: 'XP',
      rows: totalXpRows,
    },
    boss_kc: {
      label: 'Boss KC',
      value_label: 'Kills',
      rows: bossRows,
    },
  };
}

export function buildSiteSummary({ guilds, players, trackerState }) {
  const totalXp = players.reduce((sum, player) => (
    sum + numberValue(player.snapshot?.skills?.overall?.experience)
  ), 0);
  const lastSnapshot = Math.max(0, ...players.map(player => numberValue(player.updated_at)));
  return {
    guilds: guilds.length,
    tracked_players: guilds.reduce((sum, guild) => sum + numberValue(guild.player_count), 0),
    unique_players: players.length,
    snapshots: players.filter(player => player.snapshot).length,
    total_xp: totalXp,
    last_snapshot_at: lastSnapshot ? new Date(lastSnapshot).toISOString() : null,
    tracker: {
      running: Boolean(trackerState?.cycleRunning),
      interval_ms: trackerState?.intervalMs ?? null,
      last_cycle_at: trackerState?.lastCycleAt ? new Date(trackerState.lastCycleAt).toISOString() : null,
      next_cycle_at: trackerState?.nextCycleAt ? new Date(trackerState.nextCycleAt).toISOString() : null,
    },
  };
}

export function sanitizeGuild(raw) {
  return {
    name: raw.name ?? 'Unknown server',
    member_count: raw.member_count ?? null,
    player_count: numberValue(raw.player_count),
    wom_group: raw.wom_group ?? null,
    tracking_enabled: numberValue(raw.tracking_enabled),
  };
}

