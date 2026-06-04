import type { StyleSpecification } from "maplibre-gl";

/** Open DEM (Terrarium) — compatible with MapLibre raster-dem, no API key */
export const LOT_DEM_TILES =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

export const LOT_SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export const LOT_TERRAIN_SOURCE = "lot-terrain-dem";
export const LOT_SATELLITE_SOURCE = "lot-satellite";

/** Keep relief readable without the spiky gray look from high exaggeration + hillshade stacks */
export const LOT_TERRAIN_EXAGGERATION = 1.45;
export const LOT_VIEW_PITCH = 56;
export const LOT_VIEW_BEARING = -28;
export const LOT_TERRAIN_MAX_ZOOM = 17;

export function buildLotProofMapStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      [LOT_SATELLITE_SOURCE]: {
        type: "raster",
        tiles: [LOT_SATELLITE_TILES],
        tileSize: 256,
        maxzoom: 19,
        attribution:
          "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      },
      [LOT_TERRAIN_SOURCE]: {
        type: "raster-dem",
        tiles: [LOT_DEM_TILES],
        tileSize: 256,
        maxzoom: LOT_TERRAIN_MAX_ZOOM,
        encoding: "terrarium",
        attribution: "Terrain &copy; Mapzen / AWS Terrain Tiles",
      },
    },
    layers: [
      {
        id: "lot-satellite",
        type: "raster",
        source: LOT_SATELLITE_SOURCE,
      },
    ],
  };
}
