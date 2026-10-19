/** Adapt only the two documented legacy routes; never silently skip malformed fixtures. */
export function localizationRoute(file, input) {
  const route = { ...input };
  if (/^chapter-one-(science|occult)\.json$/.test(file) && route.entry === undefined) {
    route.entry = 20001;
  }
  if (!Number.isInteger(route.entry) || route.entry <= 0 || !Array.isArray(route.trace)) {
    throw new Error(`Invalid localization route fixture: ${file}`);
  }
  return route;
}
