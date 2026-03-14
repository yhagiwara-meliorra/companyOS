"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons (Leaflet's webpack issue)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Site = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

function FitBounds({ sites }: { sites: Site[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (sites.length > 0 && !fitted.current) {
      fitted.current = true;
      const bounds = L.latLngBounds(sites.map((s) => [s.lat, s.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [map, sites]);
  return null;
}

/** World bounds — prevent panning beyond one globe width */
const WORLD_BOUNDS = L.latLngBounds(
  [-85, -180], // SW corner
  [85, 180]    // NE corner
);

export function SiteMapInner({
  sites,
  center,
  zoom = 2,
  className = "h-[420px] w-full rounded-lg",
}: {
  sites: Site[];
  center?: [number, number];
  zoom?: number;
  className?: string;
}) {
  const defaultCenter: [number, number] = center ?? [20, 0]; // World-centered
  return (
    <MapContainer
      center={defaultCenter}
      zoom={zoom}
      className={className}
      scrollWheelZoom={false}
      minZoom={2}
      maxBounds={WORLD_BOUNDS}
      maxBoundsViscosity={1.0}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        noWrap
      />
      {sites.map((site) => (
        <Marker key={site.id} position={[site.lat, site.lng]}>
          <Popup>{site.name}</Popup>
        </Marker>
      ))}
      {!center && <FitBounds sites={sites} />}
    </MapContainer>
  );
}
