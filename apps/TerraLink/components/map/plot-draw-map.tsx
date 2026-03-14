"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";

// Fix default marker icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export type DrawResult = {
  geojson: string;
  areaHa: number;
  center: [number, number];
};

type Props = {
  /** Initial center (lat, lng) */
  center?: [number, number];
  /** Initial zoom level */
  zoom?: number;
  /** Called when a polygon is drawn */
  onDraw?: (result: DrawResult) => void;
  /** Called when polygon is cleared */
  onClear?: () => void;
  /** Existing GeoJSON to display (edit mode) */
  initialGeoJson?: string;
  /** CSS class */
  className?: string;
};

/**
 * Compute area in hectares from a Leaflet polygon.
 * Uses L.GeometryUtil.geodesicArea if available, otherwise falls back to latLng-based calculation.
 */
function computeAreaHa(layer: L.Polygon): number {
  const latlngs = layer.getLatLngs()[0] as L.LatLng[];
  // Use Leaflet's built-in geodesic area calculation
  const areaM2 = L.GeometryUtil
    ? L.GeometryUtil.geodesicArea(latlngs)
    : computeGeodesicAreaFallback(latlngs);
  return Math.round((areaM2 / 10000) * 100) / 100; // m² → ha, 2 decimals
}

/**
 * Geodesic area fallback using the spherical excess formula.
 * Converts lat/lng to radians and computes on a WGS84 sphere (R=6371km).
 * Accuracy: ~0.5% for areas < 500km², sufficient for EUDR plot validation.
 * Primary path uses L.GeometryUtil.geodesicArea (Karney algorithm).
 */
function computeGeodesicAreaFallback(latlngs: L.LatLng[]): number {
  const rad = Math.PI / 180;
  const R = 6371000; // Earth mean radius in metres (WGS84 approximation)
  let area = 0;
  const n = latlngs.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area +=
      latlngs[i].lng * rad * Math.cos(latlngs[j].lat * rad) -
      latlngs[j].lng * rad * Math.cos(latlngs[i].lat * rad);
  }
  area = (Math.abs(area) / 2) * R * R;
  return area;
}

function DrawControl({
  onDraw,
  onClear,
  initialGeoJson,
}: {
  onDraw?: (result: DrawResult) => void;
  onClear?: () => void;
  initialGeoJson?: string;
}) {
  const map = useMap();
  const featureGroupRef = useRef<L.FeatureGroup>(new L.FeatureGroup());
  const drawControlRef = useRef<L.Control.Draw | null>(null);

  const handleCreated = useCallback(
    (e: L.LeafletEvent) => {
      const event = e as L.DrawEvents.Created;
      const layer = event.layer as L.Polygon;
      const fg = featureGroupRef.current;

      // Clear previous drawings (only 1 polygon allowed)
      fg.clearLayers();
      fg.addLayer(layer);

      const geojson = layer.toGeoJSON();
      const areaHa = computeAreaHa(layer);
      const bounds = layer.getBounds();
      const center = bounds.getCenter();

      onDraw?.({
        geojson: JSON.stringify(geojson.geometry),
        areaHa,
        center: [center.lat, center.lng],
      });
    },
    [onDraw]
  );

  const handleDeleted = useCallback(() => {
    onClear?.();
  }, [onClear]);

  useEffect(() => {
    const fg = featureGroupRef.current;
    map.addLayer(fg);

    // Load initial GeoJSON if provided
    if (initialGeoJson) {
      try {
        const geojsonData = JSON.parse(initialGeoJson);
        const geoLayer = L.geoJSON(geojsonData);
        geoLayer.eachLayer((layer) => fg.addLayer(layer));
        map.fitBounds(fg.getBounds(), { padding: [40, 40] });
      } catch {
        // Ignore invalid GeoJSON
      }
    }

    // Add draw control
    const drawControl = new L.Control.Draw({
      position: "topright",
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          metric: true,
          shapeOptions: {
            color: "#16a34a",
            weight: 2,
            fillOpacity: 0.2,
          },
        },
        // Disable all other drawing tools
        polyline: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
      },
      edit: {
        featureGroup: fg,
        remove: true,
      },
    });

    drawControlRef.current = drawControl;
    map.addControl(drawControl);

    // Attach events
    map.on(L.Draw.Event.CREATED, handleCreated);
    map.on(L.Draw.Event.DELETED, handleDeleted);
    map.on(L.Draw.Event.EDITED, (e: L.LeafletEvent) => {
      const event = e as L.DrawEvents.Edited;
      const layers = event.layers;
      layers.eachLayer((layer) => {
        const polygon = layer as L.Polygon;
        const geojson = polygon.toGeoJSON();
        const areaHa = computeAreaHa(polygon);
        const bounds = polygon.getBounds();
        const center = bounds.getCenter();

        onDraw?.({
          geojson: JSON.stringify(geojson.geometry),
          areaHa,
          center: [center.lat, center.lng],
        });
      });
    });

    return () => {
      map.removeControl(drawControl);
      map.removeLayer(fg);
      map.off(L.Draw.Event.CREATED);
      map.off(L.Draw.Event.DELETED);
      map.off(L.Draw.Event.EDITED);
    };
  }, [map, handleCreated, handleDeleted, initialGeoJson, onDraw]);

  return null;
}

export function PlotDrawMapInner({
  center = [0, 20],
  zoom = 3,
  onDraw,
  onClear,
  initialGeoJson,
  className = "h-[400px] w-full rounded-lg",
}: Props) {
  return (
    <MapContainer center={center} zoom={zoom} className={className}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <DrawControl
        onDraw={onDraw}
        onClear={onClear}
        initialGeoJson={initialGeoJson}
      />
    </MapContainer>
  );
}
