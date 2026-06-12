function diffAchievements(oldList, newList) {
  const oldNames = new Set((oldList ?? []).map(a => a.name));
  return (newList ?? []).filter(a => !oldNames.has(a.name));
}

function hasTrustedAchievementBaseline(storedSnap) {
  if (!storedSnap) return false;
  if (storedSnap.achievements_loaded === true) return true;

  // Backward compatibility for snapshots written before the explicit flag.
  // A non-empty array means the bot had successfully fetched achievements once.
  return Array.isArray(storedSnap.achievements) && storedSnap.achievements.length > 0;
}

/**
 * Decide which achievements to notify and which baseline to persist.
 *
 * Untrusted empty baselines are seeded silently. This prevents group imports
 * and failed achievement fetches from making old WOM achievements look new.
 *
 * @param {object|null} storedSnap
 * @param {Array<object>} fetchedAchievements
 * @param {boolean} fetchSucceeded
 */
export function reconcileAchievements(storedSnap, fetchedAchievements, fetchSucceeded) {
  const previousAchievements = Array.isArray(storedSnap?.achievements)
    ? storedSnap.achievements
    : [];
  const baselineTrusted = hasTrustedAchievementBaseline(storedSnap);

  if (!fetchSucceeded) {
    return {
      newAchievements: [],
      achievementsForSnapshot: previousAchievements,
      achievementsLoaded: baselineTrusted,
    };
  }

  const achievementsForSnapshot = Array.isArray(fetchedAchievements)
    ? fetchedAchievements
    : [];

  if (!baselineTrusted) {
    return {
      newAchievements: [],
      achievementsForSnapshot,
      achievementsLoaded: true,
    };
  }

  return {
    newAchievements: diffAchievements(previousAchievements, achievementsForSnapshot),
    achievementsForSnapshot,
    achievementsLoaded: true,
  };
}
