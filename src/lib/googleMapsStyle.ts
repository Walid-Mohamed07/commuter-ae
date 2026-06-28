/**
 * Premium Google Maps style — Uber/Didi-level clarity in the app's colour palette
 *
 *   primary      #0B1E3D  dark navy
 *   secondary    #00C2A8  brand teal
 *   accent       #F5A623  amber
 *   muted        #5A6A7A  slate
 *
 * Visual hierarchy:
 *   base           warm cream  #F0EDE6
 *   local roads    white       #FFFFFF
 *   arterials      off-cream   #F5F2EC
 *   highways       brand teal  #00C2A8  ← stands out strongly
 *   water          google blue #A8C7E8
 *   parks          mint green  #D8EDEA
 *   urban blocks   warm sand   #EAE5DB
 */
export const MAP_STYLE: google.maps.MapTypeStyle[] = [
  // ── base ──────────────────────────────────────────────────────────────────
  { elementType: 'geometry',              stylers: [{ color: '#F0EDE6' }] },
  { elementType: 'labels.text.fill',      stylers: [{ color: '#5A6A7A' }] },
  { elementType: 'labels.text.stroke',    stylers: [{ color: '#ffffff' }, { weight: 3 }] },

  // ── administrative ────────────────────────────────────────────────────────
  { featureType: 'administrative',               elementType: 'geometry',            stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality',      elementType: 'labels.text.fill',    stylers: [{ color: '#0B1E3D' }] },
  { featureType: 'administrative.locality',      elementType: 'labels.text.stroke',  stylers: [{ color: '#ffffff' }, { weight: 4 }] },
  { featureType: 'administrative.neighborhood',  elementType: 'labels.text.fill',    stylers: [{ color: '#7A8A9A' }] },

  // ── poi — fully hidden ────────────────────────────────────────────────────
  { featureType: 'poi',                   stylers: [{ visibility: 'off' }] },

  // ── roads ─────────────────────────────────────────────────────────────────
  { featureType: 'road',                  elementType: 'geometry',            stylers: [{ color: '#ffffff' }] },
  { featureType: 'road',                  elementType: 'geometry.stroke',     stylers: [{ color: '#E0DAD0' }] },
  { featureType: 'road',                  elementType: 'labels.icon',         stylers: [{ visibility: 'off' }] },
  { featureType: 'road',                  elementType: 'labels.text.fill',    stylers: [{ color: '#7A8A9A' }] },
  { featureType: 'road',                  elementType: 'labels.text.stroke',  stylers: [{ color: '#ffffff' }, { weight: 3 }] },

  // local
  { featureType: 'road.local',            elementType: 'geometry',            stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.local',            elementType: 'geometry.stroke',     stylers: [{ color: '#E8E2D8' }] },
  { featureType: 'road.local',            elementType: 'labels.text.fill',    stylers: [{ color: '#8A9AAA' }] },

  // arterials
  { featureType: 'road.arterial',         elementType: 'geometry',            stylers: [{ color: '#F5F2EC' }] },
  { featureType: 'road.arterial',         elementType: 'geometry.stroke',     stylers: [{ color: '#DDD8CC' }] },

  // highways — brand teal, strong presence
  { featureType: 'road.highway',          elementType: 'geometry',            stylers: [{ color: '#00C2A8' }] },
  { featureType: 'road.highway',          elementType: 'geometry.stroke',     stylers: [{ color: '#007A6B' }] },
  { featureType: 'road.highway',          elementType: 'labels.text.fill',    stylers: [{ color: '#0B1E3D' }] },
  { featureType: 'road.highway',          elementType: 'labels.text.stroke',  stylers: [{ color: '#E0FAF6' }, { weight: 3 }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry',   stylers: [{ color: '#009E8A' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry.stroke', stylers: [{ color: '#006658' }] },

  // ── transit — hidden ──────────────────────────────────────────────────────
  { featureType: 'transit',               stylers: [{ visibility: 'off' }] },

  // ── water ─────────────────────────────────────────────────────────────────
  { featureType: 'water',                 elementType: 'geometry',            stylers: [{ color: '#A8C7E8' }] },
  { featureType: 'water',                 elementType: 'labels.text.fill',    stylers: [{ color: '#5B7FA6' }] },
  { featureType: 'water',                 elementType: 'labels.text.stroke',  stylers: [{ color: '#ffffff' }] },

  // ── landscape ─────────────────────────────────────────────────────────────
  { featureType: 'landscape.natural',     elementType: 'geometry',            stylers: [{ color: '#D8EDEA' }] }, // parks — cool mint
  { featureType: 'landscape.man_made',    elementType: 'geometry',            stylers: [{ color: '#EAE5DB' }] }, // urban — warm sand
  { featureType: 'landscape.man_made',    elementType: 'geometry.stroke',     stylers: [{ color: '#DDD8CE' }] },
];
