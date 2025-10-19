// wrapper: localStorage + simple conflict resolution with server based on modifiedAt timestamps
export function loadLocal() {
  try { return JSON.parse(localStorage.getItem('ct_entries')||'{}'); } catch { return {}; }
}
export function saveLocal(entries) {
  localStorage.setItem('ct_entries', JSON.stringify(entries));
}
export function mergeWithServer(localEntries, serverEntries) {
  // serverEntries and localEntries are objects keyed by date
  const merged = { ...serverEntries };
  for (const k of Object.keys(localEntries)) {
    const l = localEntries[k], s = serverEntries[k];
    if (!s || (l.modifiedAt > (s.modifiedAt || 0))) merged[k] = l;
  }
  return merged;
}
