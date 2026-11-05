/* FEMT PC: city search, and a city's time zone, offline.
   cities.tsv is the phone's GeoNames list (name, country, lat, lon, population).
   tz-lookup (CC0) maps coordinates to a zone from boundary data; the tz database's zone.tab (public domain, from
   Git for Windows' zoneinfo) says which zones belong to which country. If tz-lookup's answer isn't one of the city's
   own country's zones (a city on a border, or a coastal one it puts at sea), take the country's zone whose main city
   is nearest instead.
   In Node (the tests) the files are read from this folder; in the page, init() is given their text. */
(function (root) {
  const tzlookup = typeof module !== 'undefined' && module.exports ? require('./tz-lookup') : root.tzlookup;

  // zone.tab and tz-lookup may use different names for one zone (Asia/Kolkata, Asia/Calcutta).
  const canon = (tz) => { try { return new Intl.DateTimeFormat('en', { timeZone: tz }).resolvedOptions().timeZone; } catch { return tz; } };

  // "+404251-0740023" or "+4043-07400" -> degrees.
  function coord(s) {
    const m = /^([+-])(\d{2})(\d{2})(\d{2})?([+-])(\d{3})(\d{2})(\d{2})?$/.exec(s);
    if (!m) return null;
    const deg = (sign, d, mi, se) => (sign === '-' ? -1 : 1) * (+d + +mi / 60 + (+se || 0) / 3600);
    return { lat: deg(m[1], m[2], m[3], m[4]), lon: deg(m[5], m[6], m[7], m[8]) };
  }

  let zoneText = null, cityText = null;
  let zones = null, cities = null;

  function init(text) {
    if (text.zoneTab != null) { zoneText = text.zoneTab; zones = null; }
    if (text.cities != null) { cityText = text.cities; cities = null; }
  }

  function read(name) {
    if (typeof module === 'undefined' || !module.exports) return '';
    try { return require('fs').readFileSync(require('path').join(__dirname, name), 'utf8'); } catch { return ''; }
  }

  function loadZones() {
    if (zones) return zones;
    zones = [];
    for (const line of (zoneText ?? read('zone.tab')).split('\n')) {
      if (!line || line[0] === '#') continue;
      const [country, at, tz] = line.split('\t');
      const p = coord(at);
      if (p && tz) zones.push({ country, tz: tz.trim(), canon: canon(tz.trim()), ...p });
    }
    return zones;
  }

  function distanceKm(a, b) {
    const r = Math.PI / 180;
    const h = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  }

  /** The time zone for a city, given its ISO country code; null only if nothing is bundled. */
  function zoneFor(country, lat, lon) {
    let found = null;
    try { found = tzlookup(lat, lon); } catch { /* bad coordinates */ }
    const own = loadZones().filter((z) => z.country === country);
    if (found && (!own.length || own.some((z) => z.canon === canon(found)))) return found;
    // e.g. Kosovo (XK) isn't in zone.tab: then the nearest zone anywhere.
    let best = null, bestKm = Infinity;
    for (const z of own.length ? own : loadZones()) {
      const km = distanceKm({ lat, lon }, z);
      if (km < bestKm) { best = z; bestKm = km; }
    }
    return best ? best.tz : found;
  }

  /** Up to 20 cities whose names start with (then contain) the query, biggest first, each with its time zone. */
  function search(query) {
    if (!cities) {
      cities = [];
      for (const line of (cityText ?? read('cities.tsv')).split('\n')) {
        const [name, country, lat, lon, pop] = line.split('\t');
        if (name && lat) cities.push({ name, country, lat: +lat, lon: +lon, pop: +pop || 0, key: name.toLowerCase() });
      }
      cities.sort((a, b) => b.pop - a.pop);
    }
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    const starts = [], contains = [];
    for (const c of cities) {
      if (c.key.startsWith(q)) starts.push(c);
      else if (contains.length < 20 && c.key.includes(q)) contains.push(c);
      if (starts.length >= 20) break;
    }
    return starts.concat(contains).slice(0, 20).map(({ name, country, lat, lon }) => ({ name, country, lat, lon, tz: zoneFor(country, lat, lon) }));
  }

  const api = { init, zoneFor, search };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CityZone = api;
})(typeof window !== 'undefined' ? window : globalThis);
