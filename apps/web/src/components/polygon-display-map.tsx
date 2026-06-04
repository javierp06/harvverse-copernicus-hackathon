"use client";

import "leaflet/dist/leaflet.css";

import type { Polygon } from "geojson";
import { MapContainer, Polygon as LeafletPolygon, TileLayer, useMap } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import { useTranslations } from "next-intl";

interface Props {
  polygon: Polygon;
  className?: string;
  color?: string;
  fillOpacity?: number;
  expectedCenter?: { lat: number; lng: number } | null;
  mapLabel?: string;
  invalidPolygonMessage?: string;
  tileErrorMessage?: string;
  contextPolygon?: Polygon;
  contextColor?: string;
  contextLabel?: string;
}

function geoToLeaflet(coords: number[][]): LatLngExpression[] {
  return coords
    .map((c) => [Number(c[1]), Number(c[0])] as [number, number])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180);
}

function FitBounds({ allRings }: { allRings: LatLngExpression[][] }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();

    const flat = allRings.flat();
    if (flat.length > 0) {
      map.fitBounds(flat as LatLngBoundsExpression, { padding: [20, 20] });
    }

    const container = map.getContainer();
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
      const refreshed = allRings.flat();
      if (refreshed.length > 0) {
        map.fitBounds(refreshed as LatLngBoundsExpression, { padding: [20, 20] });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [map, allRings]);
  return null;
}

export default function PolygonDisplayMap({
  polygon,
  className,
  color = "#93d832",
  fillOpacity = 0.3,
  mapLabel,
  invalidPolygonMessage,
  tileErrorMessage,
  contextPolygon,
  contextColor = "#4a9eff",
  contextLabel,
}: Props) {
  const t = useTranslations("polygon");
  const resolvedMapLabel = mapLabel ?? t("map_label_satellite");
  const resolvedInvalid = invalidPolygonMessage ?? t("invalid_polygon_map");
  const resolvedTileError = tileErrorMessage ?? t("tile_error_map");
  const resolvedContextLabel =
    contextLabel ?? (contextPolygon ? t("farm_boundary_context") : undefined);

  const outerRing = polygon.coordinates[0] ?? [];
  const positions = useMemo(() => geoToLeaflet(outerRing), [outerRing]);
  const contextPositions = useMemo(() => {
    if (!contextPolygon?.coordinates[0]) return null;
    const ring = geoToLeaflet(contextPolygon.coordinates[0]);
    return ring.length >= 3 ? ring : null;
  }, [contextPolygon]);
  const fitRings = useMemo(() => [positions], [positions]);
  const [tileError, setTileError] = useState(false);

  if (positions.length < 3) {
    return (
      <div className={className} style={{ height: "100%", width: "100%", minHeight: 320 }}>
        <div className="flex h-full min-h-[320px] items-center justify-center bg-white/5 px-6 text-center text-sm text-white/45">
          {resolvedInvalid}
        </div>
      </div>
    );
  }

  const satelliteTiles =
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const fallbackTiles = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <div
      className={className}
      style={{ height: "100%", width: "100%", minHeight: 320, position: "relative" }}
    >
      <MapContainer
        center={positions[0] as LatLngExpression}
        zoom={16}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        className="z-0 h-full w-full"
        style={{ height: "100%", width: "100%", minHeight: 320 }}
      >
        <TileLayer
          key={tileError ? "osm-fallback" : "esri-satellite"}
          url={tileError ? fallbackTiles : satelliteTiles}
          attribution={
            tileError
              ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              : "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
          }
          eventHandlers={{
            tileerror: () => setTileError(true),
          }}
        />
        {contextPositions ? (
          <LeafletPolygon
            positions={contextPositions}
            pathOptions={{
              color: contextColor,
              fillColor: contextColor,
              fillOpacity: 0.06,
              weight: 2,
              dashArray: "6 4",
            }}
          />
        ) : null}
        <LeafletPolygon
          positions={positions}
          pathOptions={{
            color,
            fillColor: color,
            fillOpacity,
            weight: 2,
          }}
        />
        <FitBounds allRings={fitRings} />
      </MapContainer>
      <div className="pointer-events-none absolute left-4 top-4 z-[500] flex flex-col gap-2">
        <div className="rounded-full border border-cyan-300/30 bg-[#001120]/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100 shadow-lg backdrop-blur">
          {resolvedMapLabel}
        </div>
        {contextPositions && resolvedContextLabel ? (
          <div className="rounded-full border border-sky-400/30 bg-[#001120]/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-200/90 shadow-lg backdrop-blur">
            {resolvedContextLabel}
          </div>
        ) : null}
      </div>
      {tileError ? (
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-[500] rounded-lg border border-yellow-300/25 bg-[#001120]/85 px-3 py-2 text-xs leading-5 text-yellow-100/80 shadow-lg backdrop-blur">
          {resolvedTileError}
        </div>
      ) : null}
    </div>
  );
}
