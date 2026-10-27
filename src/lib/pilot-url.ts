// Context changes replace the URL without fetching/recreating a draft editor.
// Preserve Next's history state so Back/Forward retain the correct route tree.
export function replacePilotQuery(values: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (url.href !== window.location.href) {
    const state = { ...window.history.state };
    // Next restores these markers itself. Passing them back would bypass its
    // URL synchronisation and leave Link/Back using the previous query.
    delete state.__NA; delete state._N;
    window.history.replaceState(state, "", next);
  }
}
