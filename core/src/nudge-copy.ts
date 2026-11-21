/** Copy contract only. No new sender, schedule or webhook command is enabled. */
export function weeklyNudgeCopy(kept: number, opened: number) {
  if (![kept, opened].every((n) => Number.isSafeInteger(n) && n >= 0))
    throw new Error("Invalid weekly counts");
  return {
    body: `You kept ${kept} links this week and opened ${opened}. Still want these?`,
    quickReplies: [
      { id: "resurface_all", title: "Resurface all" },
      { id: "archive", title: "Archive" },
      { id: "quiet", title: "Quiet" },
    ],
  };
}
