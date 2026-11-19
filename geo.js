/* RenterHere location helper.
   Turns a ZIP code or a city into a point (latitude/longitude) using zips.json (US ZIP codes, 50 states + DC),
   and measures distance in miles. The data file loads only when a page needs it (search, create listing).
   Distances are measured from the middle of the ZIP code or city, not from the exact house. */
var RN_GEO = (function(){
  var RADIUS = 20;                 /* miles */
  var EARTH = 3958.8;              /* miles */
  var db = null, loading = null;

  function norm(s){
    return String(s || "").toLowerCase().replace(/\./g, "").replace(/\bsaint\b/g, "st").replace(/\bmount\b/g, "mt").replace(/\bfort\b/g, "ft")
      .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  }
  function build(d){
    var out = { zips: {}, cities: {}, byName: {} };
    var names = d.c.map(function(c){ var i = c.lastIndexOf("|"); return { city: c.slice(0, i), state: d.s[parseInt(c.slice(i + 1), 10)] }; });
    d.z.split(";").forEach(function(row){
      var p = row.split(","), n = names[parseInt(p[3], 10)];
      var lat = parseInt(p[1], 10) / 1000, lng = parseInt(p[2], 10) / 1000;
      out.zips[p[0]] = { zip: p[0], lat: lat, lng: lng, city: n.city, state: n.state };
      var key = norm(n.city) + "|" + n.state, c = out.cities[key];
      if(!c){ c = out.cities[key] = { city: n.city, state: n.state, lat: 0, lng: 0, n: 0 }; (out.byName[norm(n.city)] = out.byName[norm(n.city)] || []).push(c); }
      c.lat += lat; c.lng += lng; c.n++;
    });
    Object.keys(out.cities).forEach(function(k){ var c = out.cities[k]; c.lat = c.lat / c.n; c.lng = c.lng / c.n; });
    return out;
  }
  function ready(){
    if(db) return Promise.resolve(db);
    if(!loading){
      loading = fetch("zips.json").then(function(r){ if(!r.ok) throw new Error("zips.json " + r.status); return r.json(); })
        .then(function(d){ db = build(d); return db; })
        .catch(function(e){ loading = null; throw e; });
    }
    return loading;
  }

  /* ---- lookups (call ready() first) ---- */
  function zip(z){ return db && db.zips[String(z || "").trim().slice(0, 5)] || null; }
  /* Conservative typo matching: correct only a close, clearly best city/neighborhood name. */
  function editDistance(a, b){
    var prev = [], curr = [], i, j;
    for(j = 0; j <= b.length; j++) prev[j] = j;
    for(i = 1; i <= a.length; i++){
      curr[0] = i;
      for(j = 1; j <= b.length; j++){
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        if(i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)){
          curr[j] = Math.min(curr[j], prev[j - 2] + 1);
        }
      }
      var swap = prev; prev = curr; curr = swap;
    }
    return prev[b.length];
  }
  function matchName(value, candidates){
    var q = norm(value);
    if(!q) return null;
    for(var x = 0; x < candidates.length; x++){ if(norm(candidates[x]) === q) return candidates[x]; }
    if(q.length < 4) return null;
    var best = null, bestD = Infinity, secondD = Infinity;
    for(var i = 0; i < candidates.length; i++){
      var c = norm(candidates[i]);
      if(!c || Math.abs(c.length - q.length) > 2) continue;
      var d = editDistance(q, c);
      if(d < bestD){ secondD = bestD; bestD = d; best = candidates[i]; }
      else if(d < secondD){ secondD = d; }
    }
    var limit = q.length <= 6 ? 1 : 2;
    return best && bestD <= limit && (secondD - bestD >= 1) ? best : null;
  }
  function city(name, st){
    if(!db) return null;
    var key = norm(name), matched = db.byName[key] ? key : matchName(name, Object.keys(db.byName));
    var list = matched ? db.byName[matched] : null; if(!list) return null;
    if(st){ for(var i = 0; i < list.length; i++){ if(list[i].state === st) return list[i]; } return null; }
    return list.slice().sort(function(a, b){ return b.n - a.n; })[0];   /* the biggest city with that name */
  }
  /* "ok" | "mismatch" (ZIP belongs to another state) | "unknown" (ZIP not found) */
  function zipCheck(z, st){
    var r = zip(z); if(!r) return "unknown";
    return r.state === String(st || "").trim() ? "ok" : "mismatch";
  }
  /* Where is a listing? Uses its ZIP when the ZIP is in the same state, otherwise the middle of its city. */
  function forListing(l){
    var st = String(l.state || "").trim();
    var z = zip(l.zip_code);
    if(z && (!st || z.state === st)) return { lat: z.lat, lng: z.lng };
    var c = city(l.city, st);
    return c ? { lat: c.lat, lng: c.lng } : null;
  }
  /* The middle of what a renter searched for. p = { zip, state, city, free, ... } from parseQuery(). */
  function center(p, hoodCity){
    var z = p.zip ? zip(p.zip) : null;
    if(z && (!p.state || z.state === p.state)) return { lat: z.lat, lng: z.lng, state: z.state, label: "ZIP code " + z.zip + " (" + z.city + ", " + z.state + ")" };
    var name = p.city || p.free, c = name ? city(name, p.state) : null;
    if(!c && name && hoodCity){ var h = hoodCity(name, p.state); if(h) c = city(h.city, h.state); }
    if(c) return { lat: c.lat, lng: c.lng, state: c.state, label: c.city + ", " + c.state };
    return null;
  }

  /* ---- distance ---- */
  function dist(lat1, lng1, lat2, lng2){
    var r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  /* A box that is always a little bigger than the circle, for the database query. The exact circle is checked afterwards. */
  function bbox(lat, lng, miles){
    var dLat = miles / 68.0, dLng = miles / (68.0 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
    return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
  }

  return { RADIUS: RADIUS, ready: ready, norm: norm, matchName: matchName, zip: zip, city: city, zipCheck: zipCheck, forListing: forListing, center: center, dist: dist, bbox: bbox };
})();
