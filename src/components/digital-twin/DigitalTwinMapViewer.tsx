import React, { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ProjectRollup, DigitalTwinSelection } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Compass,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Navigation,
  Edit3,
  Search,
  Check,
  AlertTriangle,
  ExternalLink,
  Building2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { projectsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface DigitalTwinMapViewerProps {
  projectRollup: ProjectRollup;
  selection: DigitalTwinSelection;
  onSelect: (sel: DigitalTwinSelection) => void;
  onProjectUpdated?: () => void;
  className?: string;
}

type MapTheme = "dark" | "voyager" | "satellite";

// Free, reliable tile styles without requiring an API key
const MAP_STYLES: Record<MapTheme, { name: string; style: any }> = {
  dark: {
    name: "Dark Canvas",
    style: {
      version: 8,
      sources: {
        "carto-dark": {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
            "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
            "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
          ],
          tileSize: 256,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
      },
      layers: [
        {
          id: "carto-dark-layer",
          type: "raster",
          source: "carto-dark",
          minzoom: 0,
          maxzoom: 20,
        },
      ],
    },
  },
  voyager: {
    name: "Streets / Voyager",
    style: {
      version: 8,
      sources: {
        "carto-voyager": {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
            "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
            "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
          ],
          tileSize: 256,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
      },
      layers: [
        {
          id: "carto-voyager-layer",
          type: "raster",
          source: "carto-voyager",
          minzoom: 0,
          maxzoom: 20,
        },
      ],
    },
  },
  satellite: {
    name: "Satellite Imagery",
    style: {
      version: 8,
      sources: {
        "esri-satellite": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
        },
      },
      layers: [
        {
          id: "esri-satellite-layer",
          type: "raster",
          source: "esri-satellite",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
};

export const DigitalTwinMapViewer: React.FC<DigitalTwinMapViewerProps> = ({
  projectRollup,
  selection,
  onSelect,
  onProjectUpdated,
  className = "",
}) => {
  const { toast } = useToast();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [mapTheme, setMapTheme] = useState<MapTheme>("dark");
  const [pitch, setPitch] = useState<number>(60);
  const [bearing, setBearing] = useState<number>(-20);
  const [zoom, setZoom] = useState<number>(16.5);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);
  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Form states for location editor
  const project = projectRollup.project;
  const [inputLat, setInputLat] = useState<string>(
    project.latitude !== undefined && project.latitude !== null ? String(project.latitude) : ""
  );
  const [inputLng, setInputLng] = useState<string>(
    project.longitude !== undefined && project.longitude !== null ? String(project.longitude) : ""
  );
  const [inputAddress, setInputAddress] = useState<string>(project.address || "");
  const [inputCity, setInputCity] = useState<string>(project.city || "");
  const [inputState, setInputState] = useState<string>(project.state || "");
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [isSavingLoc, setIsSavingLoc] = useState<boolean>(false);

  // Resolve project coordinates or fallback
  const resolvedCoords = React.useMemo(() => {
    if (
      project.latitude !== null &&
      project.latitude !== undefined &&
      !isNaN(project.latitude) &&
      project.longitude !== null &&
      project.longitude !== undefined &&
      !isNaN(project.longitude)
    ) {
      return {
        lat: project.latitude,
        lng: project.longitude,
        isExact: true,
      };
    }

    // Known city default coordinates or Bandra/Mumbai reference
    const city = (project.city || "").toLowerCase().trim();
    if (city.includes("mumbai") || city.includes("bandra") || city.includes("malad")) {
      return { lat: 19.1874, lng: 72.8484, isExact: false, fallbackName: "Mumbai Region" };
    }
    if (city.includes("delhi") || city.includes("noida") || city.includes("gurugram")) {
      return { lat: 28.5355, lng: 77.391, isExact: false, fallbackName: "NCR Region" };
    }
    if (city.includes("bangalore") || city.includes("bengaluru")) {
      return { lat: 12.9716, lng: 77.5946, isExact: false, fallbackName: "Bengaluru Region" };
    }
    if (city.includes("pune")) {
      return { lat: 18.5204, lng: 73.8567, isExact: false, fallbackName: "Pune Region" };
    }

    // Default reference
    return { lat: 19.1874, lng: 72.8484, isExact: false, fallbackName: "Default Coordinates" };
  }, [project.latitude, project.longitude, project.city]);

  // Update input fields whenever project prop changes
  useEffect(() => {
    setInputLat(
      project.latitude !== undefined && project.latitude !== null ? String(project.latitude) : ""
    );
    setInputLng(
      project.longitude !== undefined && project.longitude !== null ? String(project.longitude) : ""
    );
    setInputAddress(project.address || "");
    setInputCity(project.city || "");
    setInputState(project.state || "");
  }, [project]);

  // Generate GeoJSON polygons for each tower in the project hierarchy
  const generateTowerGeoJson = useCallback(() => {
    const { lat, lng } = resolvedCoords;
    const towerFeatures: any[] = [];

    // Base coordinate offset (approx. meters to degrees: 0.0001 deg ~ 11m)
    const towerCount = Math.max(projectRollup.towers.length, 1);
    const spacing = 0.00035; // ~38 meters separation
    const boxSize = 0.00022; // ~24 meters building width

    projectRollup.towers.forEach((towerRollup, idx) => {
      // Offset towers in a grid or row
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const centerLng = lng + (col - (Math.min(towerCount, 3) - 1) / 2) * spacing;
      const centerLat = lat + (row - Math.floor(towerCount / 3) / 2) * spacing;

      const half = boxSize / 2;
      const coordinates = [
        [
          [centerLng - half, centerLat - half],
          [centerLng + half, centerLat - half],
          [centerLng + half, centerLat + half],
          [centerLng - half, centerLat + half],
          [centerLng - half, centerLat - half],
        ],
      ];

      // Height derived directly from floor count (3.5 meters per floor + roof element)
      const floorCount = Math.max(towerRollup.floors.length, 3);
      const height = floorCount * 3.5 + 4;

      // Color coding based on completion / status
      let color = "#3b82f6"; // default blue
      if (towerRollup.progress >= 90) color = "#10b981"; // emerald
      else if (towerRollup.hasBlockers) color = "#ef4444"; // red
      else if (towerRollup.progress > 50) color = "#06b6d4"; // cyan
      else if (towerRollup.progress > 20) color = "#f59e0b"; // amber

      const isSelected = selection.towerId === towerRollup.tower.id;

      towerFeatures.push({
        type: "Feature",
        properties: {
          id: towerRollup.tower.id,
          name: towerRollup.tower.name,
          floors: floorCount,
          progress: towerRollup.progress,
          height: height,
          base_height: 0,
          color: isSelected ? "#a855f7" : color, // purple when selected
          isSelected,
        },
        geometry: {
          type: "Polygon",
          coordinates,
        },
      });
    });

    return {
      type: "FeatureCollection",
      features: towerFeatures,
    };
  }, [resolvedCoords, projectRollup.towers, selection.towerId]);

  // Initialize or re-create MapLibre Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: MAP_STYLES[mapTheme].style,
        center: [resolvedCoords.lng, resolvedCoords.lat],
        zoom: zoom,
        pitch: pitch,
        bearing: bearing,
        maxPitch: 80,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

      map.on("load", () => {
        setIsMapLoaded(true);
        setMapError(null);

        // Add 3D Tower Models Source & Fill-Extrusion Layer
        const geojsonData = generateTowerGeoJson();
        map.addSource("project-towers", {
          type: "geojson",
          data: geojsonData as any,
        });

        map.addLayer({
          id: "towers-3d",
          type: "fill-extrusion",
          source: "project-towers",
          paint: {
            "fill-extrusion-color": ["get", "color"],
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "base_height"],
            "fill-extrusion-opacity": 0.88,
          },
        });

        // Add interactive tower click listener
        map.on("click", "towers-3d", (e) => {
          if (e.features && e.features.length > 0) {
            const feat = e.features[0];
            const towerId = feat.properties?.id;
            if (towerId) {
              onSelect({
                scope: "tower",
                projectId: project.id,
                towerId: Number(towerId),
                floorId: null,
                unitId: null,
              });
              toast({
                title: `Selected Tower: ${feat.properties?.name}`,
                description: `${feat.properties?.floors} Floors · ${feat.properties?.progress}% Progress`,
              });
            }
          }
        });

        map.on("mouseenter", "towers-3d", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "towers-3d", () => {
          map.getCanvas().style.cursor = "";
        });

        // Create Custom Project Marker Pin
        const markerEl = document.createElement("div");
        markerEl.className = "cursor-pointer group flex flex-col items-center";
        markerEl.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-blue-400 opacity-75"></span>
            <div class="relative flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white shadow-lg border-2 border-white">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          </div>
          <div class="mt-1 bg-gray-900/90 text-white text-[11px] font-semibold px-2 py-0.5 rounded shadow-md border border-white/20 whitespace-nowrap">
            ${project.name} (${projectRollup.progress}%)
          </div>
        `;

        const marker = new maplibregl.Marker({ element: markerEl })
          .setLngLat([resolvedCoords.lng, resolvedCoords.lat])
          .addTo(map);

        markerRef.current = marker;
      });

      map.on("moveend", () => {
        setPitch(Math.round(map.getPitch()));
        setBearing(Math.round(map.getBearing()));
        setZoom(Number(map.getZoom().toFixed(2)));
      });

      map.on("error", (e) => {
        console.warn("MapLibre event error:", e);
      });

      mapInstanceRef.current = map;

      return () => {
        markerRef.current?.remove();
        map.remove();
        mapInstanceRef.current = null;
      };
    } catch (err) {
      console.error("Map initialization failed:", err);
      setMapError(err instanceof Error ? err.message : "Failed to load mapping canvas.");
    }
  }, [mapTheme]);

  // Keep map centered on resolved coordinates when project changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoaded) return;

    map.flyTo({
      center: [resolvedCoords.lng, resolvedCoords.lat],
      zoom: 16.5,
      pitch: 60,
      bearing: -20,
      essential: true,
      duration: 1500,
    });

    if (markerRef.current) {
      markerRef.current.setLngLat([resolvedCoords.lng, resolvedCoords.lat]);
    }

    // Refresh tower 3D GeoJSON source
    const source = map.getSource("project-towers") as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(generateTowerGeoJson() as any);
    }
  }, [resolvedCoords.lat, resolvedCoords.lng, projectRollup, selection.towerId, isMapLoaded, generateTowerGeoJson]);

  // Change camera pitch & bearing presets
  const handleCameraPreset = (type: "3d" | "top" | "reset") => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (type === "3d") {
      map.easeTo({ pitch: 65, bearing: -25, zoom: 17, duration: 800 });
    } else if (type === "top") {
      map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
    } else if (type === "reset") {
      map.flyTo({
        center: [resolvedCoords.lng, resolvedCoords.lat],
        pitch: 60,
        bearing: -20,
        zoom: 16.5,
        duration: 800,
      });
    }
  };

  // Geocode address via OpenStreetMap Nominatim
  const handleGeocodeAddress = async () => {
    const query = [inputAddress, inputCity, inputState, "India"]
      .filter((s) => s && s.trim())
      .join(", ");

    if (!query) {
      toast({
        title: "Please enter address or city",
        description: "Specify at least a city or address to geocode.",
        variant: "destructive",
      });
      return;
    }

    setIsGeocoding(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data = await res.json();

      if (data && data.length > 0) {
        const result = data[0];
        const newLat = parseFloat(result.lat);
        const newLng = parseFloat(result.lon);
        setInputLat(newLat.toFixed(6));
        setInputLng(newLng.toFixed(6));

        toast({
          title: "Location coordinates resolved!",
          description: `Found: ${result.display_name.split(",").slice(0, 3).join(",")}`,
        });
      } else {
        toast({
          title: "Address not found",
          description: "Could not find precise coordinates. You can enter lat/lng manually.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Geocoding service unavailable",
        description: "Please enter coordinates manually.",
        variant: "destructive",
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  // Save location to backend
  const handleSaveLocation = async () => {
    const lat = parseFloat(inputLat);
    const lng = parseFloat(inputLng);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast({
        title: "Invalid Coordinates",
        description: "Latitude must be between -90 and 90, Longitude between -180 and 180.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingLoc(true);
    try {
      await projectsApi.update(project.id, {
        latitude: lat,
        longitude: lng,
        address: inputAddress.trim(),
        city: inputCity.trim(),
        state: inputState.trim(),
      });

      toast({
        title: "Location Saved Successfully",
        description: `Project coordinates updated to ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      });
      setShowLocationModal(false);
      onProjectUpdated?.();
    } catch (err) {
      toast({
        title: "Failed to save location",
        description: err instanceof Error ? err.message : "Please check permissions.",
        variant: "destructive",
      });
    } finally {
      setIsSavingLoc(false);
    }
  };

  return (
    <div
      className={`relative w-full h-full min-h-[500px] rounded-xl overflow-hidden border border-border bg-background shadow-inner flex flex-col ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none h-screen min-h-screen" : ""
      } ${className}`}
    >
      {/* Top Map Overlay: Location Info & View Options */}
      <div className="absolute top-3 left-3 right-14 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Location Badge */}
        <div className="pointer-events-auto bg-card/90 backdrop-blur-md border border-border/80 px-3 py-2 rounded-xl shadow-lg flex items-center gap-2.5 max-w-md">
          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-foreground truncate">
                {project.name}
              </span>
              {resolvedCoords.isExact ? (
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  Exact GPS
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                  {resolvedCoords.fallbackName}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {project.address ? `${project.address}, ` : ""}
              {project.city || "Mumbai"} {project.state ? `, ${project.state}` : ""}
              {" · "}
              <span className="font-mono text-[10px]">
                {resolvedCoords.lat.toFixed(4)}°N, {resolvedCoords.lng.toFixed(4)}°E
              </span>
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowLocationModal(true)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
            title="Configure / Update Project Location"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Map Controls: Style Switcher & 3D Presets */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-card/90 backdrop-blur-md border border-border/80 p-1 rounded-xl shadow-lg">
          {(["dark", "voyager", "satellite"] as MapTheme[]).map((theme) => (
            <Button
              key={theme}
              variant={mapTheme === theme ? "default" : "ghost"}
              size="sm"
              onClick={() => setMapTheme(theme)}
              className="h-7 text-[11px] px-2.5 capitalize"
            >
              {theme}
            </Button>
          ))}

          <div className="h-4 w-px bg-border mx-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCameraPreset("3d")}
            className="h-7 w-7"
            title="Perspective 3D Pitch (65°)"
          >
            <Building2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCameraPreset("top")}
            className="h-7 w-7"
            title="Top-Down Plan View (0°)"
          >
            <Compass className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCameraPreset("reset")}
            className="h-7 w-7"
            title="Reset Camera Orientation"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-7 w-7"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Main Map Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full flex-1 bg-secondary/30" />

      {/* Bottom Floating Legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-card/90 backdrop-blur-md border border-border/80 px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-3 text-[11px] text-muted-foreground pointer-events-auto">
        <span className="font-semibold text-foreground">3D Building Legend:</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
          <span>&gt;90% Complete</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block" />
          <span>In Progress</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
          <span>Early Stage</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block" />
          <span>Selected</span>
        </span>
        <span className="text-[10px] font-mono text-muted-foreground pl-2 border-l border-border">
          Pitch: {pitch}° | Bear: {bearing}°
        </span>
      </div>

      {/* Error Boundary / Fallback View */}
      {mapError && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-3 z-20">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <h3 className="font-bold text-base">Mapping Canvas Notice</h3>
          <p className="text-xs text-muted-foreground max-w-md">
            {mapError}. Your project construction hierarchy, 3D model, and task records remain fully accessible in the 3D Building Twin view.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMapError(null);
                setMapTheme("voyager");
              }}
            >
              Try Alternative Map Provider
            </Button>
          </div>
        </div>
      )}

      {/* Location Configuration Popover / Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-base">Configure Project Location</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLocationModal(false)}
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Configure the exact geographical coordinates for &ldquo;{project.name}&rdquo;. The Digital Twin will automatically center its 3D environment and surrounding terrain at this location.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Street Address / Locality
                </label>
                <input
                  type="text"
                  value={inputAddress}
                  onChange={(e) => setInputAddress(e.target.value)}
                  placeholder="e.g. Plot 42, Bandra West, Linking Road"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={inputCity}
                    onChange={(e) => setInputCity(e.target.value)}
                    placeholder="e.g. Mumbai"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    State / Region
                  </label>
                  <input
                    type="text"
                    value={inputState}
                    onChange={(e) => setInputState(e.target.value)}
                    placeholder="e.g. Maharashtra"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleGeocodeAddress}
                disabled={isGeocoding}
                className="w-full text-xs gap-1.5 h-8"
              >
                <Search className={`h-3.5 w-3.5 ${isGeocoding ? "animate-spin" : ""}`} />
                <span>{isGeocoding ? "Resolving via Geocoding..." : "Auto-Resolve GPS from Address"}</span>
              </Button>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Latitude (°N)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={inputLat}
                    onChange={(e) => setInputLat(e.target.value)}
                    placeholder="19.187400"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Longitude (°E)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={inputLng}
                    onChange={(e) => setInputLng(e.target.value)}
                    placeholder="72.848400"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLocationModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveLocation}
                disabled={isSavingLoc}
                className="text-xs gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{isSavingLoc ? "Saving..." : "Save Location Coordinates"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
