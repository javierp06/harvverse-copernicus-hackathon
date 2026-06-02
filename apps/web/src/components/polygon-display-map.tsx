"use client";

import "leaflet/dist/leaflet.css";
import type { Polygon } from "geojson";
import { MapContainer, Polygon as LeafletPolygon, TileLayer, useMap } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";

interface Props {
  polygon: Polygon;
  className?: string;
  color?: string;
  fillOpacity?: number;
  expectedCenter?: { lat: number; lng: number } | null;
  mapLabel?: string;
  invalidPolygonMessage?: string;
  tileErrorMessage?: string;
}

function geoToLeaflet(coords: number[][]): LatLngExpression[] {
  return coords
    .map((c) => [Number(c[1]), Number(c[0])] as [number, number])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180);
}

function FitBounds({ positions }: { positions: LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();

    if (positions.length > 0) {
      map.fitBounds(positions as LatLngBoundsExpression, { padding: [16, 16] });
    }

    const container = map.getContainer();
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
      if (positions.length > 0) {
        map.fitBounds(positions as LatLngBoundsExpression, { padding: [16, 16] });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [map, positions]);
  return null;
}

export default function PolygonDisplayMap({
  polygon,
  className,
  color = "#93d832",
  fillOpacity = 0.3,
  mapLabel = "Satellite lot map",
  invalidPolygonMessage = "Lot polygon coordinates are not valid enough to draw the satellite map.",
  tileErrorMessage = "Satellite basemap tiles did not load, but the registered polygon proof is still drawn from the lot GPS coordinates.",
}: Props) {
  const outerRing = polygon.coordinates[0] ?? [];
  const positions = useMemo(() => geoToLeaflet(outerRing), [outerRing]);
  const [tileError, setTileError] = useState(false);

  if (positions.length < 3) {
    return (
      <div className={className} style={{ height: "100%", width: "100%" }}>
        <div className="flex h-full min-h-[320px] items-center justify-center bg-white/5 px-6 text-center text-sm text-white/45">
          {invalidPolygonMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ height: "100%", width: "100%", position: "relative" }}>
      <MapContainer
        center={[0, 0]}
        zoom={13}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        className="z-0"
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
          eventHandlers={{
            tileerror: () => setTileError(true),
          }}
        />
        <LeafletPolygon
          positions={positions}
          pathOptions={{
            color,
            fillColor: color,
            fillOpacity,
            weight: 2,
          }}
        />
        <FitBounds positions={positions} />
      </MapContainer>
      <div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-full border border-cyan-300/30 bg-[#001120]/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100 shadow-lg backdrop-blur">
        {mapLabel}
      </div>
      {tileError ? (
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-[500] rounded-lg border border-yellow-300/25 bg-[#001120]/85 px-3 py-2 text-xs leading-5 text-yellow-100/80 shadow-lg backdrop-blur">
          {tileErrorMessage}
        </div>
      ) : null}
    </div>
  );
}
