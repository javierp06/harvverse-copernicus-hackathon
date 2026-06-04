"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { FeatureCollection, Polygon } from "geojson";
import maplibregl from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, NavigationControl, Source, type MapRef } from "react-map-gl/maplibre";

import { polygonBbox, polygonCentroid } from "@/lib/geo";
import {
  buildLotProofMapStyle,
  LOT_TERRAIN_EXAGGERATION,
  LOT_TERRAIN_MAX_ZOOM,
  LOT_TERRAIN_SOURCE,
  LOT_VIEW_BEARING,
  LOT_VIEW_PITCH,
} from "@/lib/lot-proof-maplibre";

const MAP_STYLE = buildLotProofMapStyle();
const LOAD_TIMEOUT_MS = 12_000;

interface SnapshotOverlay {
  riskScore?: number;
  ndvi?: number;
  altitudeMasl?: number | null;
}

interface Props {
  lotPolygon: Polygon;
  color?: string;
  fillOpacity?: number;
  mapLabel: string;
  rotateHint: string;
  snapshotOverlay?: SnapshotOverlay;
  onFallback: () => void;
  className?: string;
}

function toGeoJson(
  lotPolygon: Polygon,
  color: string,
  fillOpacity: number,
): FeatureCollection {
  const features: FeatureCollection["features"] = [
    {
      type: "Feature",
      properties: {
        role: "lot",
        strokeColor: color,
        fillColor: `rgba(103, 232, 249, ${fillOpacity})`,
      },
      geometry: lotPolygon,
    },
  ];

  return { type: "FeatureCollection", features };
}

function fitLotView(map: maplibregl.Map, bbox: [number, number, number, number]) {
  map.resize();
  map.fitBounds(
    [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]],
    ],
    {
      padding: { top: 48, bottom: 72, left: 40, right: 40 },
      duration: 700,
      maxZoom: LOT_TERRAIN_MAX_ZOOM,
      pitch: LOT_VIEW_PITCH,
      bearing: LOT_VIEW_BEARING,
    },
  );
}

export default function LotProofTerrainMap({
  lotPolygon,
  color = "#67E8F9",
  fillOpacity = 0.28,
  mapLabel,
  rotateHint,
  snapshotOverlay,
  onFallback,
  className,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const fallbackTriggered = useRef(false);
  const [ready, setReady] = useState(false);

  const geojson = useMemo(
    () => toGeoJson(lotPolygon, color, fillOpacity),
    [lotPolygon, color, fillOpacity],
  );

  const bbox = useMemo(() => {
    const lotBox = polygonBbox(lotPolygon);
    return lotBox;
  }, [lotPolygon]);

  const { lat, lng } = useMemo(() => polygonCentroid(lotPolygon), [lotPolygon]);

  const triggerFallback = () => {
    if (fallbackTriggered.current) return;
    fallbackTriggered.current = true;
    onFallback();
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!ready) triggerFallback();
    }, LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [ready]);

  const handleLoad = () => {
    const map = mapRef.current?.getMap();
    if (!map) {
      triggerFallback();
      return;
    }

    const apply = () => {
      try {
        if (!map.getSource(LOT_TERRAIN_SOURCE)) {
          triggerFallback();
          return;
        }
        map.setTerrain({ source: LOT_TERRAIN_SOURCE, exaggeration: LOT_TERRAIN_EXAGGERATION });
        if (bbox) fitLotView(map, bbox);
        setReady(true);
      } catch {
        triggerFallback();
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("idle", apply);
  };

  return (
    <div
      className={className}
      style={{ height: "100%", width: "100%", position: "relative" }}
    >
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        mapStyle={MAP_STYLE}
        initialViewState={{
          longitude: lng,
          latitude: lat,
          zoom: 14,
          pitch: LOT_VIEW_PITCH,
          bearing: LOT_VIEW_BEARING,
        }}
        style={{ width: "100%", height: "100%" }}
        terrain={{ source: LOT_TERRAIN_SOURCE, exaggeration: LOT_TERRAIN_EXAGGERATION }}
        maxZoom={LOT_TERRAIN_MAX_ZOOM}
        maxPitch={72}
        dragRotate
        scrollZoom
        touchZoomRotate
        onLoad={handleLoad}
        onError={() => triggerFallback()}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" visualizePitch showCompass />
        <Source id="lot-proof-polygons" type="geojson" data={geojson}>
          <Layer
            id="lot-proof-fill"
            type="fill"
            filter={["==", ["get", "role"], "lot"]}
            paint={{ "fill-color": ["get", "fillColor"], "fill-antialias": true }}
          />
          <Layer
            id="lot-proof-line"
            type="line"
            filter={["==", ["get", "role"], "lot"]}
            paint={{
              "line-color": ["get", "strokeColor"],
              "line-width": 3,
              "line-opacity": 1,
            }}
          />
        </Source>
      </Map>

      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-2">
        <div className="rounded-full border border-cyan-300/30 bg-[#001120]/85 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100 shadow-lg backdrop-blur">
          {mapLabel}
        </div>
        {snapshotOverlay?.riskScore != null ? (
          <div className="rounded-full border border-primary/30 bg-[#001120]/85 px-3 py-1 text-[10px] font-bold text-primary shadow-lg backdrop-blur">
            Risk {snapshotOverlay.riskScore}/100
          </div>
        ) : null}
        {snapshotOverlay?.ndvi != null ? (
          <div className="rounded-full border border-emerald-400/30 bg-[#001120]/85 px-3 py-1 text-[10px] font-bold text-emerald-200 shadow-lg backdrop-blur">
            NDVI {snapshotOverlay.ndvi.toFixed(2)}
          </div>
        ) : null}
        {snapshotOverlay?.altitudeMasl != null ? (
          <div className="rounded-full border border-white/15 bg-[#001120]/85 px-3 py-1 text-[10px] text-white/70 shadow-lg backdrop-blur">
            {snapshotOverlay.altitudeMasl} msnm
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-lg border border-white/10 bg-[#001120]/75 px-3 py-1.5 text-[10px] text-white/50 shadow backdrop-blur">
        {rotateHint}
      </div>
    </div>
  );
}
