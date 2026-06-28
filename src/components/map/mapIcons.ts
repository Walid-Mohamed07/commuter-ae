import L from 'leaflet';

/** Numbered pickup marker (1, 2, 3…) */
export function pickupIcon(index: number): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width:32px;height:32px;
      background:#0B1E3D;
      border:2.5px solid #00C2A8;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:13px;
      font-family:Inter,sans-serif;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
    ">${index + 1}</div>`,
    className: '',
    iconSize:    [32, 32],
    iconAnchor:  [16, 16],
    popupAnchor: [0, -18],
  });
}

/** Destination teardrop marker */
export const destinationIcon: L.DivIcon = L.divIcon({
  html: `<div style="position:relative;width:32px;height:40px;">
    <div style="
      width:32px;height:32px;
      background:#00C2A8;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:2.5px solid #0B1E3D;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
    "></div>
  </div>`,
  className: '',
  iconSize:    [32, 40],
  iconAnchor:  [16, 40],
  popupAnchor: [0, -42],
});
