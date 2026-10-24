import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type {
  ProjectRollup,
  TowerRollup,
  FloorRollup,
  UnitRollup,
  VisualizationMode,
  DigitalTwinSelection,
  HoveredElementInfo,
  CameraPreset,
} from "./types";
import { getElementColor, DIGITAL_TWIN_COLORS } from "./digitalTwinUtils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock, AlertTriangle, Layers, Grid3X3, Eye } from "lucide-react";

interface DigitalTwinCanvas3DProps {
  projectRollup: ProjectRollup;
  visualizationMode: VisualizationMode;
  selection: DigitalTwinSelection;
  onSelect: (sel: DigitalTwinSelection) => void;
  isolatedTowerId: number | null;
  explosionFactor: number; // 0 to 1
  isXRayMode: boolean;
  cameraPreset: CameraPreset;
  onCameraPresetHandled?: () => void;
}

export const DigitalTwinCanvas3D: React.FC<DigitalTwinCanvas3DProps> = ({
  projectRollup,
  visualizationMode,
  selection,
  onSelect,
  isolatedTowerId,
  explosionFactor,
  isXRayMode,
  cameraPreset,
  onCameraPresetHandled,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredInfo, setHoveredInfo] = useState<HoveredElementInfo | null>(null);

  // References for Three.js state
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const interactiveObjectsRef = useRef<THREE.Mesh[]>([]);
  const hoveredMeshRef = useRef<THREE.Mesh | null>(null);
  const hoveredOrigColorRef = useRef<number | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Helper to get element key
  const getMeshKey = (type: string, id: number) => `${type}_${id}`;

  // Procedural Architectural Helpers for Digital Twin Realism
  const createArchitecturalTree = (x: number, z: number, scale = 1): THREE.Group => {
    const treeGroup = new THREE.Group();
    treeGroup.userData = { isBuildingPart: true };

    const trunkGeo = new THREE.CylinderGeometry(0.12 * scale, 0.18 * scale, 1.2 * scale, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(0, 0.6 * scale, 0);
    trunk.castShadow = true;
    treeGroup.add(trunk);

    const foliageGeo1 = new THREE.ConeGeometry(0.9 * scale, 1.8 * scale, 7);
    const foliageMat1 = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.8 });
    const foliage1 = new THREE.Mesh(foliageGeo1, foliageMat1);
    foliage1.position.set(0, 1.6 * scale, 0);
    foliage1.castShadow = true;
    treeGroup.add(foliage1);

    const foliageGeo2 = new THREE.ConeGeometry(0.7 * scale, 1.4 * scale, 7);
    const foliageMat2 = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 });
    const foliage2 = new THREE.Mesh(foliageGeo2, foliageMat2);
    foliage2.position.set(0, 2.3 * scale, 0);
    foliage2.castShadow = true;
    treeGroup.add(foliage2);

    treeGroup.position.set(x, 0.35, z);
    return treeGroup;
  };

  const createTowerCrane = (x: number, yBase: number, z: number, height: number): THREE.Group => {
    const craneGroup = new THREE.Group();
    craneGroup.userData = { isBuildingPart: true };

    const craneMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Vibrant Construction Yellow
      metalness: 0.65,
      roughness: 0.35,
    });

    // Vertical Lattice Mast
    const mastGeo = new THREE.BoxGeometry(0.85, height, 0.85);
    const mast = new THREE.Mesh(mastGeo, craneMat);
    mast.position.set(0, height / 2, 0);
    mast.castShadow = true;
    craneGroup.add(mast);

    // Slewing Ring & Cab
    const cabGeo = new THREE.BoxGeometry(1.3, 1.1, 1.3);
    const cabMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.5, roughness: 0.3 });
    const cab = new THREE.Mesh(cabGeo, cabMat);
    cab.position.set(0.3, height + 0.55, 0);
    craneGroup.add(cab);

    // Tower Peak / Apex
    const apexGeo = new THREE.ConeGeometry(0.65, 2.4, 4);
    const apex = new THREE.Mesh(apexGeo, craneMat);
    apex.position.set(0, height + 1.9, 0);
    craneGroup.add(apex);

    // Flashing Red Aviation Warning Beacon
    const beaconGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, height + 3.1, 0);
    beacon.userData = { isBeacon: true };
    craneGroup.add(beacon);

    // Horizontal Working Jib
    const jibLength = 17;
    const jibGeo = new THREE.BoxGeometry(jibLength, 0.55, 0.55);
    const jib = new THREE.Mesh(jibGeo, craneMat);
    jib.position.set(jibLength / 2 - 2, height + 1.1, 0);
    jib.castShadow = true;
    craneGroup.add(jib);

    // Counter-Jib & Counterweight
    const counterJibGeo = new THREE.BoxGeometry(5.5, 0.55, 0.55);
    const counterJib = new THREE.Mesh(counterJibGeo, craneMat);
    counterJib.position.set(-2.75, height + 1.1, 0);
    craneGroup.add(counterJib);

    const counterWeightGeo = new THREE.BoxGeometry(2.0, 1.1, 1.1);
    const counterWeightMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
    const counterWeight = new THREE.Mesh(counterWeightGeo, counterWeightMat);
    counterWeight.position.set(-4.2, height + 0.7, 0);
    craneGroup.add(counterWeight);

    // Cable & Hook
    const cableGeo = new THREE.CylinderGeometry(0.02, 0.02, 5, 4);
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const cable = new THREE.Mesh(cableGeo, cableMat);
    cable.position.set(jibLength * 0.55, height - 1.4, 0);
    craneGroup.add(cable);

    const hookGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const hookMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 });
    const hook = new THREE.Mesh(hookGeo, hookMat);
    hook.position.set(jibLength * 0.55, height - 3.9, 0);
    craneGroup.add(hook);

    craneGroup.position.set(x, yBase, z);
    return craneGroup;
  };

  // Set up Three.js Scene, Camera, Renderer, Controls
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0b0f19); // Deep dark sleek background
    scene.fog = new THREE.FogExp2(0x0b0f19, 0.008);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(32, 28, 42);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't clip below ground
    controls.minDistance = 6;
    controls.maxDistance = 180;
    controls.target.set(0, 10, 0);
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight1.position.set(40, 65, 35);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    dirLight1.shadow.camera.near = 10;
    dirLight1.shadow.camera.far = 150;
    const d = 35;
    dirLight1.shadow.camera.left = -d;
    dirLight1.shadow.camera.right = d;
    dirLight1.shadow.camera.top = d;
    dirLight1.shadow.camera.bottom = -d;
    dirLight1.shadow.bias = -0.0005;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.5); // Cool blue accent rim light
    dirLight2.position.set(-30, 20, -30);
    scene.add(dirLight2);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.4);
    scene.add(hemiLight);

    // 6. Ground & Architectural Site Podium
    const groundGeo = new THREE.PlaneGeometry(160, 160);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    // Architectural grid
    const grid = new THREE.GridHelper(160, 40, 0x334155, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);

    // 7. Animation Loop with Beacon Light Pulse
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const time = Date.now() * 0.003;
      if (sceneRef.current) {
        sceneRef.current.traverse((obj) => {
          if (obj.userData?.isBeacon) {
            const bMat = (obj as THREE.Mesh).material as THREE.MeshBasicMaterial;
            if (bMat && bMat.color) {
              bMat.color.setHex(Math.sin(time * 3) > 0 ? 0xef4444 : 0x7f1d1d);
            }
          }
        });
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 8. Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
      container.innerHTML = "";
    };
  }, []);

  // Handle Camera Presets
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    switch (cameraPreset) {
      case "orbit":
        camera.position.set(30, 24, 38);
        controls.target.set(0, 8, 0);
        break;
      case "top":
        camera.position.set(0, 55, 0.1);
        controls.target.set(0, 0, 0);
        break;
      case "front":
        camera.position.set(0, 15, 48);
        controls.target.set(0, 10, 0);
        break;
      case "isometric":
        camera.position.set(35, 35, 35);
        controls.target.set(0, 8, 0);
        break;
    }
    controls.update();
    onCameraPresetHandled?.();
  }, [cameraPreset, onCameraPresetHandled]);

  // Build Procedural 3D Towers, Floors, and Units dynamically from DB hierarchy
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove existing building meshes
    const toRemove: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj.userData?.isBuildingPart) {
        toRemove.push(obj);
      }
    });
    toRemove.forEach((obj) => {
      scene.remove(obj);
      if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
      if ((obj as THREE.Mesh).material) {
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });

    meshMapRef.current.clear();
    interactiveObjectsRef.current = [];

    const towers = projectRollup.towers;
    if (towers.length === 0) return;

    // Filter to isolated tower if selected
    const activeTowers = isolatedTowerId
      ? towers.filter((t) => t.tower.id === isolatedTowerId)
      : towers;

    // Calculate site geometry dynamically depending on project information
    const towerSpacing = 24;
    const totalTowers = activeTowers.length;
    const startX = -((totalTowers - 1) * towerSpacing) / 2;

    // 1. Dynamic Landscaped Site Podium & Surrounding Infrastructure
    const siteW = Math.max(76, totalTowers * towerSpacing + 28);
    const siteD = 58;

    // Main site podium
    const sitePlateGeo = new THREE.BoxGeometry(siteW, 0.6, siteD);
    const sitePlateMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.75,
      metalness: 0.2,
    });
    const sitePlate = new THREE.Mesh(sitePlateGeo, sitePlateMat);
    sitePlate.position.set(0, 0.1, 0);
    sitePlate.receiveShadow = true;
    sitePlate.userData = { isBuildingPart: true };
    scene.add(sitePlate);

    // Front approach road / asphalt driveway
    const roadGeo = new THREE.PlaneGeometry(siteW - 6, 8.5);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.9 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.41, 17);
    road.receiveShadow = true;
    road.userData = { isBuildingPart: true };
    scene.add(road);

    // White dashed road centerline
    const dashLength = 2.5;
    const dashGap = 2.0;
    const numDashes = Math.floor((siteW - 12) / (dashLength + dashGap));
    const startDashX = -((numDashes - 1) * (dashLength + dashGap)) / 2;
    for (let di = 0; di < numDashes; di++) {
      const dashGeo = new THREE.PlaneGeometry(dashLength, 0.22);
      const dashMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(startDashX + di * (dashLength + dashGap), 0.42, 17);
      dash.userData = { isBuildingPart: true };
      scene.add(dash);
    }

    // Landscaped Green Lawn Belts around the site
    const lawnGeoFront = new THREE.PlaneGeometry(siteW - 6, 6.5);
    const lawnMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.85 });
    const lawnFront = new THREE.Mesh(lawnGeoFront, lawnMat);
    lawnFront.rotation.x = -Math.PI / 2;
    lawnFront.position.set(0, 0.41, 8.5);
    lawnFront.receiveShadow = true;
    lawnFront.userData = { isBuildingPart: true };
    scene.add(lawnFront);

    const lawnGeoBack = new THREE.PlaneGeometry(siteW - 6, 12);
    const lawnBack = new THREE.Mesh(lawnGeoBack, lawnMat);
    lawnBack.rotation.x = -Math.PI / 2;
    lawnBack.position.set(0, 0.41, -19);
    lawnBack.receiveShadow = true;
    lawnBack.userData = { isBuildingPart: true };
    scene.add(lawnBack);

    // Add perimeter architectural trees
    const treePositions = [
      [-siteW / 2 + 5, 8.5],
      [-siteW / 2 + 10, 8.5],
      [siteW / 2 - 5, 8.5],
      [siteW / 2 - 10, 8.5],
      [-siteW / 2 + 5, 23],
      [siteW / 2 - 5, 23],
      [-siteW / 2 + 5, -19],
      [-siteW / 2 + 14, -19],
      [siteW / 2 - 5, -19],
      [siteW / 2 - 14, -19],
      [0, -19],
    ];
    treePositions.forEach(([tx, tz]) => {
      const tree = createArchitecturalTree(tx, tz, 1.25);
      scene.add(tree);
    });

    // 2. Build Each Tower with Realistic Architectural Facades & Details
    activeTowers.forEach((towerRollup, tIndex) => {
      const towerX = startX + tIndex * towerSpacing;
      const towerZ = -1.5;
      const towerFloors = towerRollup.floors;
      const numFloors = towerFloors.length;

      // Realistic Tower Dimensions
      const towerWidth = 15;
      const towerDepth = 13;
      const floorHeight = 1.45;
      const floorSeparation = explosionFactor * 2.4; // Vertical explosion gap

      // Foundation Plinth
      const plinthGeo = new THREE.BoxGeometry(towerWidth + 2.5, 0.65, towerDepth + 2.5);
      const plinthMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.75,
        metalness: 0.25,
      });
      const plinth = new THREE.Mesh(plinthGeo, plinthMat);
      plinth.position.set(towerX, 0.4, towerZ);
      plinth.receiveShadow = true;
      plinth.userData = { isBuildingPart: true, type: "tower_base", towerId: towerRollup.tower.id };
      scene.add(plinth);

      // Architectural 3D Plinth Monument in front of Tower Entrance
      const monumentGeo = new THREE.BoxGeometry(4.8, 0.75, 0.45);
      const monumentMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.3,
        metalness: 0.7,
      });
      const monument = new THREE.Mesh(monumentGeo, monumentMat);
      monument.position.set(towerX, 0.7, towerZ + towerDepth / 2 + 3.2);
      monument.castShadow = true;
      monument.userData = { isBuildingPart: true };
      scene.add(monument);

      // Monument status accent stripe
      const stripeGeo = new THREE.BoxGeometry(4.4, 0.12, 0.05);
      const stripeMat = new THREE.MeshBasicMaterial({
        color: towerRollup.progress === 100 ? 0x10b981 : 0x0ea5e9,
      });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.set(towerX, 0.9, towerZ + towerDepth / 2 + 3.44);
      stripe.userData = { isBuildingPart: true };
      scene.add(stripe);

      // Grand Entrance Canopy on Ground Floor (Floor 0)
      const canopyGeo = new THREE.BoxGeometry(7.2, 0.28, 4.2);
      const canopyMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.85,
        roughness: 0.2,
      });
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.set(towerX, 0.6 + floorHeight * 0.92, towerZ + towerDepth / 2 + 2.1);
      canopy.castShadow = true;
      canopy.userData = { isBuildingPart: true };
      scene.add(canopy);

      // Canopy Stainless Steel Support Columns
      const postGeo = new THREE.CylinderGeometry(0.12, 0.12, floorHeight * 0.92, 10);
      const postMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.9,
        roughness: 0.2,
      });
      const post1 = new THREE.Mesh(postGeo, postMat);
      post1.position.set(towerX - 3.1, 0.6 + (floorHeight * 0.92) / 2, towerZ + towerDepth / 2 + 3.8);
      post1.castShadow = true;
      post1.userData = { isBuildingPart: true };
      scene.add(post1);

      const post2 = new THREE.Mesh(postGeo, postMat);
      post2.position.set(towerX + 3.1, 0.6 + (floorHeight * 0.92) / 2, towerZ + towerDepth / 2 + 3.8);
      post2.castShadow = true;
      post2.userData = { isBuildingPart: true };
      scene.add(post2);

      // Partition floors dynamically from DB hierarchy
      const regularFloors = towerFloors.filter(
        (f) => f.floorType !== "terrace" && f.floorType !== "mumty"
      );
      const terraceFloors = towerFloors.filter((f) => f.floorType === "terrace");
      const mumtyFloors = towerFloors.filter((f) => f.floorType === "mumty");
      const terraceFloor = terraceFloors[0] || null;
      const mumtyFloor = mumtyFloors[0] || null;
      const hasTerrace = Boolean(terraceFloor);
      const hasMumty = Boolean(mumtyFloor);
      const numRegular = regularFloors.length;

      // Build each regular floor
      regularFloors.forEach((floorRollup, fIndex) => {
        const floorBaseY = 0.6 + fIndex * (floorHeight + floorSeparation);
        const isFloorSelected = selection.floorId === floorRollup.floor.id;

        // Architectural Concrete Floor Slab with chamfered edge trim
        const slabThickness = 0.22;
        const slabGeo = new THREE.BoxGeometry(towerWidth + 0.15, slabThickness, towerDepth + 0.15);
        const slabMat = new THREE.MeshStandardMaterial({
          color: isFloorSelected ? 0x6366f1 : 0x1e293b,
          roughness: 0.6,
          metalness: 0.3,
        });
        const slab = new THREE.Mesh(slabGeo, slabMat);
        slab.position.set(towerX, floorBaseY + slabThickness / 2, towerZ);
        slab.castShadow = true;
        slab.receiveShadow = true;
        slab.userData = {
          isBuildingPart: true,
          type: "floor_slab",
          floorId: floorRollup.floor.id,
          towerId: towerRollup.tower.id,
          floorRollup,
        };
        scene.add(slab);
        meshMapRef.current.set(getMeshKey("floor_slab", floorRollup.floor.id), slab);

        const units = floorRollup.units;
        const numUnits = units.length;

        if (numUnits > 0) {
          // Subdivide floor into realistic unit configurations
          const cols = Math.min(numUnits, 4);
          const rows = Math.ceil(numUnits / cols);
          const unitMargin = 0.35;
          const usableW = towerWidth - 1.2;
          const usableD = towerDepth - 1.2;
          const unitW = (usableW - (cols - 1) * unitMargin) / cols;
          const unitD = (usableD - (rows - 1) * unitMargin) / rows;
          const unitH = floorHeight - slabThickness - 0.08;

          units.forEach((unitRollup, uIndex) => {
            const col = uIndex % cols;
            const row = Math.floor(uIndex / cols);

            const ux = towerX - usableW / 2 + col * (unitW + unitMargin) + unitW / 2;
            const uz = towerZ - usableD / 2 + row * (unitD + unitMargin) + unitD / 2;
            const uy = floorBaseY + slabThickness + unitH / 2;

            const isUnitSelected = selection.unitId === unitRollup.unit.id;
            const colorHex = getElementColor(unitRollup, visualizationMode);
            const isWhite = colorHex.toLowerCase() === "#ffffff" || colorHex.toLowerCase() === "#fff";
            const isRed = colorHex.toLowerCase() === DIGITAL_TWIN_COLORS.delayed.toLowerCase() || colorHex === "#ef4444";
            const isGreen = colorHex.toLowerCase() === DIGITAL_TWIN_COLORS.completed.toLowerCase() || colorHex === "#10b981";

            // Modern architectural glazed unit material
            const unitGeo = new THREE.BoxGeometry(unitW, unitH, unitD);
            const unitMat = new THREE.MeshStandardMaterial({
              color: new THREE.Color(colorHex),
              roughness: isWhite ? 0.25 : isXRayMode ? 0.15 : 0.25,
              metalness: isWhite ? 0.05 : isXRayMode ? 0.1 : 0.45,
              transparent: isXRayMode || (selection.unitId !== null && !isUnitSelected),
              opacity: isUnitSelected ? 1.0 : isXRayMode ? 0.35 : selection.unitId !== null ? 0.35 : 0.95,
              emissive: isUnitSelected
                ? new THREE.Color(DIGITAL_TWIN_COLORS.highlight)
                : isRed
                ? new THREE.Color(0xef4444)
                : isGreen
                ? new THREE.Color(0x059669)
                : isWhite
                ? new THREE.Color(0xffffff)
                : new THREE.Color(0x000000),
              emissiveIntensity: isUnitSelected ? 0.45 : isRed ? 0.35 : isGreen ? 0.18 : isWhite ? 0.22 : 0,
            });

            const unitMesh = new THREE.Mesh(unitGeo, unitMat);
            unitMesh.position.set(ux, uy, uz);
            unitMesh.castShadow = true;
            unitMesh.receiveShadow = true;
            unitMesh.userData = {
              isBuildingPart: true,
              isInteractive: true,
              type: "unit",
              unitId: unitRollup.unit.id,
              floorId: floorRollup.floor.id,
              towerId: towerRollup.tower.id,
              unitRollup,
              floorRollup,
              towerRollup,
            };

            scene.add(unitMesh);
            interactiveObjectsRef.current.push(unitMesh);
            meshMapRef.current.set(getMeshKey("unit", unitRollup.unit.id), unitMesh);

            // Architectural Window Mullion Edges
            const edgesGeo = new THREE.EdgesGeometry(unitGeo);
            const edgesMat = new THREE.LineBasicMaterial({
              color: isUnitSelected ? 0x38bdf8 : 0x0f172a,
              transparent: true,
              opacity: isXRayMode ? 0.35 : 0.8,
            });
            const edgeLine = new THREE.LineSegments(edgesGeo, edgesMat);
            unitMesh.add(edgeLine);

            // Cantilevered Glass Balconies on perimeter units
            const isFrontUnit = row === rows - 1;
            const isBackUnit = row === 0;
            if ((isFrontUnit || isBackUnit) && fIndex > 0) {
              const balconyDepth = 0.75;
              const balconyWidth = unitW * 0.88;
              const balconySlabGeo = new THREE.BoxGeometry(balconyWidth, 0.12, balconyDepth);
              const balconySlabMat = new THREE.MeshStandardMaterial({
                color: 0x334155,
                roughness: 0.6,
                metalness: 0.25,
              });
              const balconySlab = new THREE.Mesh(balconySlabGeo, balconySlabMat);
              const bz = isFrontUnit ? unitD / 2 + balconyDepth / 2 : -unitD / 2 - balconyDepth / 2;
              balconySlab.position.set(0, -unitH / 2 + 0.06, bz);
              unitMesh.add(balconySlab);

              // Tempered glass balustrade railing
              const railingGeo = new THREE.BoxGeometry(balconyWidth, 0.48, 0.04);
              const railingMat = new THREE.MeshStandardMaterial({
                color: 0x93c5fd,
                transparent: true,
                opacity: 0.65,
                roughness: 0.1,
                metalness: 0.85,
              });
              const railing = new THREE.Mesh(railingGeo, railingMat);
              const rz = isFrontUnit ? unitD / 2 + balconyDepth - 0.02 : -unitD / 2 - balconyDepth + 0.02;
              railing.position.set(0, -unitH / 2 + 0.36, rz);
              unitMesh.add(railing);
            }
          });
        } else {
          // Whole floor volume when unit details are not available
          const floorH = floorHeight - slabThickness - 0.05;
          const floorGeo = new THREE.BoxGeometry(towerWidth - 0.3, floorH, towerDepth - 0.3);
          const colorHex = getElementColor(floorRollup, visualizationMode);
          const isWhite = colorHex.toLowerCase() === "#ffffff" || colorHex.toLowerCase() === "#fff";
          const isRed = colorHex.toLowerCase() === DIGITAL_TWIN_COLORS.delayed.toLowerCase() || colorHex === "#ef4444";
          const isGreen = colorHex.toLowerCase() === DIGITAL_TWIN_COLORS.completed.toLowerCase() || colorHex === "#10b981";

          const floorMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(colorHex),
            roughness: isWhite ? 0.25 : 0.45,
            metalness: isWhite ? 0.05 : 0.3,
            transparent: isXRayMode,
            opacity: isFloorSelected ? 1.0 : isXRayMode ? 0.35 : 0.92,
            emissive: isFloorSelected
              ? new THREE.Color(DIGITAL_TWIN_COLORS.highlight)
              : isRed
              ? new THREE.Color(0xef4444)
              : isGreen
              ? new THREE.Color(0x059669)
              : isWhite
              ? new THREE.Color(0xffffff)
              : new THREE.Color(0x000000),
            emissiveIntensity: isFloorSelected ? 0.4 : isRed ? 0.35 : isGreen ? 0.18 : isWhite ? 0.22 : 0,
          });

          const floorMesh = new THREE.Mesh(floorGeo, floorMat);
          floorMesh.position.set(towerX, floorBaseY + slabThickness + floorH / 2, towerZ);
          floorMesh.castShadow = true;
          floorMesh.receiveShadow = true;
          floorMesh.userData = {
            isBuildingPart: true,
            isInteractive: true,
            type: "floor",
            floorId: floorRollup.floor.id,
            towerId: towerRollup.tower.id,
            floorRollup,
            towerRollup,
          };

          scene.add(floorMesh);
          interactiveObjectsRef.current.push(floorMesh);
          meshMapRef.current.set(getMeshKey("floor", floorRollup.floor.id), floorMesh);

          // Window Mullions on whole floor
          const edgesGeo = new THREE.EdgesGeometry(floorGeo);
          const edgesMat = new THREE.LineBasicMaterial({
            color: isFloorSelected ? 0x38bdf8 : 0x0f172a,
            transparent: true,
            opacity: 0.7,
          });
          const edgeLine = new THREE.LineSegments(edgesGeo, edgesMat);
          floorMesh.add(edgeLine);
        }

        // Structural corner architectural pillars
        const pillarGeo = new THREE.BoxGeometry(0.38, floorHeight, 0.38);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.75 });
        const corners = [
          [-towerWidth / 2 + 0.22, -towerDepth / 2 + 0.22],
          [towerWidth / 2 - 0.22, -towerDepth / 2 + 0.22],
          [-towerWidth / 2 + 0.22, towerDepth / 2 - 0.22],
          [towerWidth / 2 - 0.22, towerDepth / 2 - 0.22],
        ];
        corners.forEach(([cx, cz]) => {
          const pillar = new THREE.Mesh(pillarGeo, pillarMat);
          pillar.position.set(towerX + cx, floorBaseY + floorHeight / 2, towerZ + cz);
          pillar.userData = { isBuildingPart: true };
          scene.add(pillar);
        });
      });

      // Top of regular floors
      const topRegularSlabY = 0.6 + numRegular * (floorHeight + floorSeparation);

      // ==========================================
      // 1. DYNAMIC ROOFTOP TERRACE FLOOR
      // ==========================================
      const terraceIndex = numRegular;
      const terraceBaseY = 0.6 + terraceIndex * (floorHeight + floorSeparation);
      const terraceSlabThickness = 0.28;

      if (hasTerrace && terraceFloor) {
        const isTerraceSelected = selection.floorId === terraceFloor.floor.id;
        const colorHex = getElementColor(terraceFloor, visualizationMode);
        const isWhite = colorHex.toLowerCase() === "#ffffff" || colorHex.toLowerCase() === "#fff";
        const isRed = colorHex.toLowerCase() === DIGITAL_TWIN_COLORS.delayed.toLowerCase() || colorHex === "#ef4444";
        const isGreen = colorHex.toLowerCase() === DIGITAL_TWIN_COLORS.completed.toLowerCase() || colorHex === "#10b981";

        // A. Primary Terrace Structural Slab (Interactive Floor Entity)
        const tSlabGeo = new THREE.BoxGeometry(towerWidth + 0.35, terraceSlabThickness, towerDepth + 0.35);
        const tSlabMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(colorHex),
          roughness: isWhite ? 0.3 : 0.65,
          metalness: isWhite ? 0.05 : 0.25,
          transparent: isXRayMode,
          opacity: isTerraceSelected ? 1.0 : isXRayMode ? 0.4 : 0.96,
          emissive: isTerraceSelected
            ? new THREE.Color(DIGITAL_TWIN_COLORS.highlight)
            : isRed
            ? new THREE.Color(0xef4444)
            : isGreen
            ? new THREE.Color(0x059669)
            : isWhite
            ? new THREE.Color(0xffffff)
            : new THREE.Color(0x000000),
          emissiveIntensity: isTerraceSelected ? 0.45 : isRed ? 0.35 : isGreen ? 0.18 : isWhite ? 0.22 : 0,
        });

        const tSlabMesh = new THREE.Mesh(tSlabGeo, tSlabMat);
        tSlabMesh.position.set(towerX, terraceBaseY + terraceSlabThickness / 2, towerZ);
        tSlabMesh.castShadow = true;
        tSlabMesh.receiveShadow = true;
        tSlabMesh.userData = {
          isBuildingPart: true,
          isInteractive: true,
          type: "floor",
          floorId: terraceFloor.floor.id,
          towerId: towerRollup.tower.id,
          floorRollup: terraceFloor,
          towerRollup,
          isTerrace: true,
        };
        scene.add(tSlabMesh);
        interactiveObjectsRef.current.push(tSlabMesh);
        meshMapRef.current.set(getMeshKey("floor", terraceFloor.floor.id), tSlabMesh);

        // Terrace Slab Architectural Chamfer Rim Line
        const tEdgesGeo = new THREE.EdgesGeometry(tSlabGeo);
        const tEdgesMat = new THREE.LineBasicMaterial({
          color: isTerraceSelected ? 0x38bdf8 : 0x0f172a,
          transparent: true,
          opacity: 0.75,
        });
        const tEdges = new THREE.LineSegments(tEdgesGeo, tEdgesMat);
        tSlabMesh.add(tEdges);

        // B. Terrace Weatherproof Pavers Deck Surface
        const deckSurfaceY = terraceBaseY + terraceSlabThickness;
        const deckGeo = new THREE.BoxGeometry(towerWidth - 0.1, 0.03, towerDepth - 0.1);
        const deckMat = new THREE.MeshStandardMaterial({
          color: 0x334155, // Weatherproof architectural slate/travertine roof paver tone
          roughness: 0.85,
          metalness: 0.1,
        });
        const deckMesh = new THREE.Mesh(deckGeo, deckMat);
        deckMesh.position.set(towerX, deckSurfaceY + 0.015, towerZ);
        deckMesh.receiveShadow = true;
        deckMesh.userData = { isBuildingPart: true };
        scene.add(deckMesh);

        // C. Designated Non-Slip Access Walkway (leading from Mumty entrance to viewing edge)
        const walkwayGeo = new THREE.BoxGeometry(2.4, 0.035, towerDepth * 0.45);
        const walkwayMat = new THREE.MeshStandardMaterial({
          color: 0x475569, // Contrasting architectural paved walkway
          roughness: 0.7,
        });
        const walkwayMesh = new THREE.Mesh(walkwayGeo, walkwayMat);
        walkwayMesh.position.set(towerX - towerWidth * 0.04, deckSurfaceY + 0.018, towerZ + towerDepth * 0.22);
        walkwayMesh.userData = { isBuildingPart: true };
        scene.add(walkwayMesh);

        // D. Terrace Perimeter Parapet Walls & Stone Coping Caps
        const parapetHeight = 0.5;
        const parapetThickness = 0.22;
        const parapetMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.75,
          metalness: 0.2,
        });
        const copingMat = new THREE.MeshStandardMaterial({
          color: 0x475569,
          roughness: 0.6,
        });

        // 4 Parapet Wall Segments
        const pDefs = [
          // Front (South)
          { w: towerWidth + 0.25, h: parapetHeight, d: parapetThickness, x: towerX, z: towerZ + towerDepth / 2 + 0.05 },
          // Back (North)
          { w: towerWidth + 0.25, h: parapetHeight, d: parapetThickness, x: towerX, z: towerZ - towerDepth / 2 - 0.05 },
          // Left (West)
          { w: parapetThickness, h: parapetHeight, d: towerDepth - 0.19, x: towerX - towerWidth / 2 - 0.05, z: towerZ },
          // Right (East)
          { w: parapetThickness, h: parapetHeight, d: towerDepth - 0.19, x: towerX + towerWidth / 2 + 0.05, z: towerZ },
        ];

        pDefs.forEach((p) => {
          // Concrete wall base
          const wallGeo = new THREE.BoxGeometry(p.w, p.h, p.d);
          const wallMesh = new THREE.Mesh(wallGeo, parapetMat);
          wallMesh.position.set(p.x, deckSurfaceY + p.h / 2, p.z);
          wallMesh.castShadow = true;
          wallMesh.receiveShadow = true;
          wallMesh.userData = { isBuildingPart: true };
          scene.add(wallMesh);

          // Coping cap stone with overhang
          const capGeo = new THREE.BoxGeometry(
            p.w > p.d ? p.w + 0.06 : p.w + 0.06,
            0.06,
            p.d > p.w ? p.d + 0.06 : p.d + 0.06
          );
          const capMesh = new THREE.Mesh(capGeo, copingMat);
          capMesh.position.set(p.x, deckSurfaceY + p.h + 0.03, p.z);
          capMesh.userData = { isBuildingPart: true };
          scene.add(capMesh);
        });

        // E. Modern Tempered Glass Balustrades atop Parapet Walls
        const glassGeo = new THREE.BoxGeometry(towerWidth + 0.2, 0.45, towerDepth + 0.2);
        const glassEdges = new THREE.EdgesGeometry(glassGeo);
        const glassRail = new THREE.LineSegments(
          glassEdges,
          new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.65 })
        );
        glassRail.position.set(towerX, deckSurfaceY + parapetHeight + 0.22, towerZ);
        glassRail.userData = { isBuildingPart: true };
        scene.add(glassRail);

        // Stainless steel perimeter handrail tube
        const railMat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          metalness: 0.9,
          roughness: 0.2,
        });
        const railGeoN = new THREE.BoxGeometry(towerWidth + 0.25, 0.05, 0.05);
        const railN = new THREE.Mesh(railGeoN, railMat);
        railN.position.set(towerX, deckSurfaceY + parapetHeight + 0.45, towerZ - towerDepth / 2 - 0.05);
        railN.userData = { isBuildingPart: true };
        scene.add(railN);

        const railS = new THREE.Mesh(railGeoN, railMat);
        railS.position.set(towerX, deckSurfaceY + parapetHeight + 0.45, towerZ + towerDepth / 2 + 0.05);
        railS.userData = { isBuildingPart: true };
        scene.add(railS);

        // F. Terrace Rooftop Architectural Elements
        // 1. Mechanical HVAC / VRV Chillers Zone (rear-left quadrant)
        const hvacPadGeo = new THREE.BoxGeometry(3.8, 0.12, 3.0);
        const hvacPadMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
        const hvacPad = new THREE.Mesh(hvacPadGeo, hvacPadMat);
        hvacPad.position.set(towerX - towerWidth / 2 + 2.6, deckSurfaceY + 0.06, towerZ - towerDepth / 2 + 2.2);
        hvacPad.userData = { isBuildingPart: true };
        scene.add(hvacPad);

        // Dual VRV Condenser Chiller Units
        for (let ci = 0; ci < 2; ci++) {
          const chillerGeo = new THREE.BoxGeometry(1.3, 1.1, 0.85);
          const chillerMat = new THREE.MeshStandardMaterial({
            color: 0x475569,
            metalness: 0.5,
            roughness: 0.35,
          });
          const chiller = new THREE.Mesh(chillerGeo, chillerMat);
          chiller.position.set(
            towerX - towerWidth / 2 + 2.0 + ci * 1.5,
            deckSurfaceY + 0.12 + 0.55,
            towerZ - towerDepth / 2 + 2.2
          );
          chiller.castShadow = true;
          chiller.userData = { isBuildingPart: true };
          scene.add(chiller);

          // Fan grilles
          const fanGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.04, 12);
          const fanMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
          const fan = new THREE.Mesh(fanGeo, fanMat);
          fan.position.set(
            towerX - towerWidth / 2 + 2.0 + ci * 1.5,
            deckSurfaceY + 0.12 + 1.12,
            towerZ - towerDepth / 2 + 2.2
          );
          fan.userData = { isBuildingPart: true };
          scene.add(fan);
        }

        // Louvered Screen Shield for HVAC Equipment
        const screenGeo = new THREE.BoxGeometry(4.0, 1.35, 0.06);
        const screenMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
        const screen = new THREE.Mesh(screenGeo, screenMat);
        screen.position.set(towerX - towerWidth / 2 + 2.6, deckSurfaceY + 0.67, towerZ - towerDepth / 2 + 3.8);
        screen.userData = { isBuildingPart: true };
        scene.add(screen);

        // 2. Modern Photovoltaic Solar Canopy Pergola (rear-right quadrant)
        const pvCanopyGeo = new THREE.BoxGeometry(4.2, 0.06, 2.8);
        const pvCanopyMat = new THREE.MeshStandardMaterial({
          color: 0x090d16, // Solar dark glass
          metalness: 0.9,
          roughness: 0.15,
        });
        const pvCanopy = new THREE.Mesh(pvCanopyGeo, pvCanopyMat);
        pvCanopy.rotation.x = -0.22; // 12-degree solar pitch
        pvCanopy.position.set(towerX + towerWidth / 2 - 2.8, deckSurfaceY + 1.45, towerZ - towerDepth / 2 + 2.4);
        pvCanopy.castShadow = true;
        pvCanopy.userData = { isBuildingPart: true };
        scene.add(pvCanopy);

        // PV Support Frame Posts
        const pvPostMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.2 });
        const pvPosts = [
          [towerX + towerWidth / 2 - 4.6, towerZ - towerDepth / 2 + 1.2, 1.2],
          [towerX + towerWidth / 2 - 1.0, towerZ - towerDepth / 2 + 1.2, 1.2],
          [towerX + towerWidth / 2 - 4.6, towerZ - towerDepth / 2 + 3.6, 1.7],
          [towerX + towerWidth / 2 - 1.0, towerZ - towerDepth / 2 + 3.6, 1.7],
        ];
        pvPosts.forEach(([px, pz, ph]) => {
          const postGeo = new THREE.CylinderGeometry(0.04, 0.04, ph, 8);
          const post = new THREE.Mesh(postGeo, pvPostMat);
          post.position.set(px, deckSurfaceY + ph / 2, pz);
          post.userData = { isBuildingPart: true };
          scene.add(post);
        });

        // 3. Terrace Landscaped Planters (along front parapet)
        const planterGeo = new THREE.BoxGeometry(3.5, 0.38, 0.65);
        const planterMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
        const hedgeGeo = new THREE.BoxGeometry(3.4, 0.45, 0.55);
        const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 });

        [-1, 1].forEach((dir) => {
          const planter = new THREE.Mesh(planterGeo, planterMat);
          planter.position.set(towerX + dir * 4.2, deckSurfaceY + 0.19, towerZ + towerDepth / 2 - 0.5);
          planter.userData = { isBuildingPart: true };
          scene.add(planter);

          const hedge = new THREE.Mesh(hedgeGeo, hedgeMat);
          hedge.position.set(towerX + dir * 4.2, deckSurfaceY + 0.38 + 0.22, towerZ + towerDepth / 2 - 0.5);
          hedge.userData = { isBuildingPart: true };
          scene.add(hedge);
        });

        // 4. Corner Rainwater Drainage Scuppers
        const scupperMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6 });
        const scupperCorners = [
          [-towerWidth / 2, -towerDepth / 2],
          [towerWidth / 2, -towerDepth / 2],
          [-towerWidth / 2, towerDepth / 2],
          [towerWidth / 2, towerDepth / 2],
        ];
        scupperCorners.forEach(([cx, cz]) => {
          const scupperGeo = new THREE.BoxGeometry(0.18, 0.15, 0.18);
          const scupper = new THREE.Mesh(scupperGeo, scupperMat);
          scupper.position.set(towerX + cx, deckSurfaceY + 0.08, towerZ + cz);
          scupper.userData = { isBuildingPart: true };
          scene.add(scupper);
        });
      }

      // ==========================================
      // 2. DYNAMIC MUMTY (ROOFTOP STAIRHEAD / LMR / OHT)
      // ==========================================
      // Placement derived dynamically from hierarchy and explosion factor
      const mumtyIndex = hasTerrace ? numRegular + 1 : numRegular;
      const mumtyBaseY =
        explosionFactor > 0
          ? 0.6 + mumtyIndex * (floorHeight + floorSeparation)
          : hasTerrace
          ? terraceBaseY + terraceSlabThickness
          : topRegularSlabY + 0.28;

      const mumtyWidth = Math.max(5.5, towerWidth * 0.38);
      const mumtyDepth = Math.max(5.0, towerDepth * 0.40);
      const mumtyHeight = 2.45; // Realistic headroom for staircase headhouse & lift overrun
      const mumtyX = towerX - towerWidth * 0.05;
      const mumtyZ = towerZ - towerDepth * 0.04;

      if (hasMumty && mumtyFloor) {
        const isMumtySelected = selection.floorId === mumtyFloor.floor.id;
        const colorHex = getElementColor(mumtyFloor, visualizationMode);
        const isWhite = colorHex.toLowerCase() === "#ffffff" || colorHex.toLowerCase() === "#fff";
        const isRed = colorHex.toLowerCase() === DIGITAL_TWIN_COLORS.delayed.toLowerCase() || colorHex === "#ef4444";
        const isGreen = colorHex.toLowerCase() === DIGITAL_TWIN_COLORS.completed.toLowerCase() || colorHex === "#10b981";
        const isNotStarted = !isWhite && !isRed && !isGreen;

        // A. Architectural Concrete Footing Plinth (Prevents sticking into terrace floor)
        const plinthH = 0.16;
        const plinthGeo = new THREE.BoxGeometry(mumtyWidth + 0.35, plinthH, mumtyDepth + 0.35);
        const plinthMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b, // Dark contrasting architectural plinth band
          roughness: 0.85,
          metalness: 0.25,
        });
        const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
        plinthMesh.position.set(mumtyX, mumtyBaseY + plinthH / 2, mumtyZ);
        plinthMesh.receiveShadow = true;
        plinthMesh.userData = { isBuildingPart: true };
        scene.add(plinthMesh);

        // Plinth top reveal border
        const plinthEdgeGeo = new THREE.EdgesGeometry(plinthGeo);
        const plinthEdge = new THREE.LineSegments(
          plinthEdgeGeo,
          new THREE.LineBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.85 })
        );
        plinthMesh.add(plinthEdge);

        // Body base height resting crisply on the plinth
        const bodyBaseY = mumtyBaseY + plinthH;

        // B. Primary Stairhead Structure Enclosure (Interactive Entity)
        // In "Not Started" mode, use sleek modern light-concrete (0x94a3b8) instead of dark blob
        const mumtyColor = isNotStarted
          ? new THREE.Color(0x94a3b8) // Crisp modern architectural concrete
          : new THREE.Color(colorHex);

        const mumtyGeo = new THREE.BoxGeometry(mumtyWidth, mumtyHeight, mumtyDepth);
        const mumtyMat = new THREE.MeshStandardMaterial({
          color: mumtyColor,
          roughness: isWhite ? 0.3 : isNotStarted ? 0.45 : 0.65,
          metalness: isWhite ? 0.05 : isNotStarted ? 0.2 : 0.25,
          transparent: isXRayMode,
          opacity: isMumtySelected ? 1.0 : isXRayMode ? 0.4 : 0.96,
          emissive: isMumtySelected
            ? new THREE.Color(DIGITAL_TWIN_COLORS.highlight)
            : isRed
            ? new THREE.Color(0xef4444)
            : isGreen
            ? new THREE.Color(0x059669)
            : isWhite
            ? new THREE.Color(0xffffff)
            : new THREE.Color(0x000000),
          emissiveIntensity: isMumtySelected ? 0.45 : isRed ? 0.35 : isGreen ? 0.18 : isWhite ? 0.22 : 0,
        });

        const mumtyMesh = new THREE.Mesh(mumtyGeo, mumtyMat);
        mumtyMesh.position.set(mumtyX, bodyBaseY + mumtyHeight / 2, mumtyZ);
        mumtyMesh.castShadow = true;
        mumtyMesh.receiveShadow = true;
        mumtyMesh.userData = {
          isBuildingPart: true,
          isInteractive: true,
          type: "floor",
          floorId: mumtyFloor.floor.id,
          towerId: towerRollup.tower.id,
          floorRollup: mumtyFloor,
          towerRollup,
          isMumty: true,
        };
        scene.add(mumtyMesh);
        interactiveObjectsRef.current.push(mumtyMesh);
        meshMapRef.current.set(getMeshKey("floor", mumtyFloor.floor.id), mumtyMesh);

        // Mumty Architectural Edge Reveal Lines
        const mEdgesGeo = new THREE.EdgesGeometry(mumtyGeo);
        const mEdgesMat = new THREE.LineBasicMaterial({
          color: isMumtySelected ? 0x38bdf8 : 0x0f172a,
          transparent: true,
          opacity: 0.85,
        });
        const mEdges = new THREE.LineSegments(mEdgesGeo, mEdgesMat);
        mumtyMesh.add(mEdges);

        // C. Realistic Rooftop Stairhead Access Door (Opening onto Terrace Deck)
        const doorW = 0.95;
        const doorH = 1.85;
        const doorGeo = new THREE.BoxGeometry(doorW, doorH, 0.08);
        const doorMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a, // Industrial weather-rated metal fire door
          metalness: 0.8,
          roughness: 0.25,
        });
        const doorMesh = new THREE.Mesh(doorGeo, doorMat);
        doorMesh.position.set(mumtyX, bodyBaseY + doorH / 2, mumtyZ + mumtyDepth / 2 + 0.04);
        doorMesh.userData = { isBuildingPart: true };
        scene.add(doorMesh);

        // Stainless Steel Push Bar Handle
        const handleGeo = new THREE.BoxGeometry(0.7, 0.04, 0.05);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.1 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.set(mumtyX, bodyBaseY + doorH * 0.52, mumtyZ + mumtyDepth / 2 + 0.09);
        handle.userData = { isBuildingPart: true };
        scene.add(handle);

        // Concrete Cantilevered Door Canopy Hood (Eyebrow with Drip Mold)
        const canopyGeo = new THREE.BoxGeometry(1.5, 0.12, 0.65);
        const canopyMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
        const canopy = new THREE.Mesh(canopyGeo, canopyMat);
        canopy.position.set(mumtyX, bodyBaseY + doorH + 0.08, mumtyZ + mumtyDepth / 2 + 0.32);
        canopy.castShadow = true;
        canopy.userData = { isBuildingPart: true };
        scene.add(canopy);

        // Exterior Bulkhead Security Light above Canopy
        const lightGeo = new THREE.SphereGeometry(0.08, 8, 8);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a }); // Warm welcoming glow
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(mumtyX, bodyBaseY + doorH + 0.22, mumtyZ + mumtyDepth / 2 + 0.1);
        light.userData = { isBuildingPart: true };
        scene.add(light);

        // D. Overhead Water Tank (OHT) - Modeled per Konstruct Tracker DB Tasks
        // Foundation plinth on Mumty roof
        const ohtWidth = mumtyWidth * 0.52;
        const ohtDepth = mumtyDepth * 0.55;
        const ohtHeight = 1.25;
        const ohtX = mumtyX - mumtyWidth * 0.18;
        const ohtZ = mumtyZ;
        const ohtBaseY = bodyBaseY + mumtyHeight;

        const ohtGeo = new THREE.BoxGeometry(ohtWidth, ohtHeight, ohtDepth);
        const ohtMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b, // Industrial RCC waterproofing tank coating
          roughness: 0.7,
          metalness: 0.2,
        });
        const ohtMesh = new THREE.Mesh(ohtGeo, ohtMat);
        ohtMesh.position.set(ohtX, ohtBaseY + 0.1 + ohtHeight / 2, ohtZ);
        ohtMesh.castShadow = true;
        ohtMesh.receiveShadow = true;
        ohtMesh.userData = { isBuildingPart: true };
        scene.add(ohtMesh);

        // OHT Top Slab & Raised Inspection Hatch
        const hatchGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 16);
        const hatchMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 });
        const hatch = new THREE.Mesh(hatchGeo, hatchMat);
        hatch.position.set(ohtX, ohtBaseY + 0.1 + ohtHeight + 0.04, ohtZ);
        hatch.userData = { isBuildingPart: true };
        scene.add(hatch);

        // OHT Water Supply & Overflow Pipe Manifold
        const pipeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });
        const pipeGeo1 = new THREE.CylinderGeometry(0.04, 0.04, ohtHeight + 0.8, 8);
        const pipe1 = new THREE.Mesh(pipeGeo1, pipeMat);
        pipe1.position.set(ohtX + ohtWidth / 2 + 0.08, ohtBaseY + (ohtHeight + 0.8) / 2, ohtZ + ohtDepth * 0.2);
        pipe1.userData = { isBuildingPart: true };
        scene.add(pipe1);

        // E. Lift Machine Room (LMR) Ventilation Louvers (Side Walls)
        const louverMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
        const louverGeo = new THREE.BoxGeometry(0.06, 0.85, 1.4);
        const louverE = new THREE.Mesh(louverGeo, louverMat);
        louverE.position.set(mumtyX + mumtyWidth / 2 + 0.03, bodyBaseY + mumtyHeight * 0.65, mumtyZ);
        louverE.userData = { isBuildingPart: true };
        scene.add(louverE);

        const louverW = new THREE.Mesh(louverGeo, louverMat);
        louverW.position.set(mumtyX - mumtyWidth / 2 - 0.03, bodyBaseY + mumtyHeight * 0.65, mumtyZ);
        louverW.userData = { isBuildingPart: true };
        scene.add(louverW);

        // F. Mumty Cantilevered Roof Slab with Overhang
        const mRoofGeo = new THREE.BoxGeometry(mumtyWidth + 0.45, 0.18, mumtyDepth + 0.45);
        const mRoofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65 });
        const mRoof = new THREE.Mesh(mRoofGeo, mRoofMat);
        mRoof.position.set(mumtyX, bodyBaseY + mumtyHeight + 0.09, mumtyZ);
        mRoof.castShadow = true;
        mRoof.userData = { isBuildingPart: true };
        scene.add(mRoof);

        // G. Vertical Steel Safety Cat Ladder (Connecting Terrace Deck to Mumty Roof)
        const ladderH = mumtyHeight + 0.3;
        const ladderMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.3 });
        const railGeo = new THREE.CylinderGeometry(0.02, 0.02, ladderH, 6);
        [-0.22, 0.22].forEach((offset) => {
          const lRail = new THREE.Mesh(railGeo, ladderMat);
          lRail.position.set(
            mumtyX + mumtyWidth / 2 + 0.12,
            bodyBaseY + ladderH / 2,
            mumtyZ - mumtyDepth * 0.2 + offset
          );
          lRail.userData = { isBuildingPart: true };
          scene.add(lRail);
        });

        // Ladder Rungs
        const numRungs = 7;
        for (let ri = 0; ri < numRungs; ri++) {
          const rungGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.44, 6);
          const rung = new THREE.Mesh(rungGeo, ladderMat);
          rung.rotation.x = Math.PI / 2;
          rung.position.set(
            mumtyX + mumtyWidth / 2 + 0.12,
            bodyBaseY + 0.35 + ri * (ladderH / (numRungs + 1)),
            mumtyZ - mumtyDepth * 0.2
          );
          rung.userData = { isBuildingPart: true };
          scene.add(rung);
        }

        // H. Pulsing Red Aviation Warning Beacon & Lightning Arrester
        const beaconGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        const beaconY = ohtBaseY + ohtHeight + 0.3;
        beacon.position.set(ohtX, beaconY, ohtZ);
        beacon.userData = { isBeacon: true, isBuildingPart: true };
        scene.add(beacon);

        // Copper Lightning Arrester Rod
        const arresterGeo = new THREE.CylinderGeometry(0.02, 0.06, 1.8, 8);
        const arresterMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });
        const arrester = new THREE.Mesh(arresterGeo, arresterMat);
        arrester.position.set(ohtX, beaconY + 0.9, ohtZ);
        arrester.userData = { isBuildingPart: true };
        scene.add(arrester);
      }

      // ==========================================
      // 3. FALLBACK FOR PROJECTS WITHOUT TERRACE OR MUMTY
      // ==========================================
      if (!hasTerrace && !hasMumty) {
        const roofY = topRegularSlabY;
        const roofGeo = new THREE.BoxGeometry(towerWidth + 0.6, 0.35, towerDepth + 0.6);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(towerX, roofY + 0.175, towerZ);
        roof.userData = { isBuildingPart: true };
        scene.add(roof);

        // Glass Parapet Railing around the rooftop
        const parapetGeo = new THREE.BoxGeometry(towerWidth + 0.5, 0.55, towerDepth + 0.5);
        const parapetEdges = new THREE.EdgesGeometry(parapetGeo);
        const parapetLine = new THREE.LineSegments(
          parapetEdges,
          new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.7 })
        );
        parapetLine.position.set(towerX, roofY + 0.35 + 0.27, towerZ);
        parapetLine.userData = { isBuildingPart: true };
        scene.add(parapetLine);

        // Standard mechanical penthouse
        const penthouseGeo = new THREE.BoxGeometry(towerWidth * 0.42, 1.4, towerDepth * 0.42);
        const penthouseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
        const penthouse = new THREE.Mesh(penthouseGeo, penthouseMat);
        penthouse.position.set(towerX, roofY + 0.35 + 0.7, towerZ);
        penthouse.userData = { isBuildingPart: true };
        scene.add(penthouse);
      }

      // ==========================================
      // 4. PROGRESS-DRIVEN FEATURES (CRANE VS SPIRE)
      // ==========================================
      const isUnderConstruction = towerRollup.progress < 100;
      // Derive apex height dynamically based on true building geometry
      const apexY = hasMumty
        ? mumtyBaseY + mumtyHeight + 1.4
        : hasTerrace
        ? terraceBaseY + 2.2
        : topRegularSlabY + 1.8;

      if (isUnderConstruction) {
        // Active Tower Construction Crane beside the building (clearing the apex)
        const craneX = towerX + towerWidth / 2 + 2.8;
        const craneZ = towerZ - towerDepth / 2 + 1.5;
        const craneHeight = apexY + 7.5;
        const crane = createTowerCrane(craneX, 0.3, craneZ, craneHeight);
        scene.add(crane);

        // Exposed structural rebar columns rising from the top level
        const rebarMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
        const roofCorners = [
          [-towerWidth / 2 + 0.3, -towerDepth / 2 + 0.3],
          [towerWidth / 2 - 0.3, -towerDepth / 2 + 0.3],
          [-towerWidth / 2 + 0.3, towerDepth / 2 - 0.3],
          [towerWidth / 2 - 0.3, towerDepth / 2 - 0.3],
        ];
        roofCorners.forEach(([cx, cz]) => {
          const rebarGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 5);
          const rebar = new THREE.Mesh(rebarGeo, rebarMat);
          const rebarBaseY = hasTerrace ? terraceBaseY + 0.28 : topRegularSlabY + 0.35;
          rebar.position.set(towerX + cx, rebarBaseY + 0.6, towerZ + cz);
          rebar.userData = { isBuildingPart: true };
          scene.add(rebar);
        });
      } else {
        // Completed Tower: Architectural Crown / Communications Spire
        const spireGeo = new THREE.CylinderGeometry(0.06, 0.22, 5.0, 8);
        const spireMat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          metalness: 0.9,
          roughness: 0.2,
        });
        const spire = new THREE.Mesh(spireGeo, spireMat);
        spire.position.set(towerX, apexY + 2.5, towerZ);
        spire.userData = { isBuildingPart: true };
        scene.add(spire);

        const beaconGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(towerX, apexY + 5.1, towerZ);
        beacon.userData = { isBeacon: true, isBuildingPart: true };
        scene.add(beacon);
      }
    });
  }, [projectRollup, visualizationMode, selection, isolatedTowerId, explosionFactor, isXRayMode]);

  // Handle Raycasting for Hover & Click selection
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const container = mountRef.current;
      const camera = cameraRef.current;
      if (!container || !camera) return;

      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      const intersects = raycaster.intersectObjects(interactiveObjectsRef.current, false);

      if (intersects.length > 0) {
        const topHit = intersects[0];
        const mesh = topHit.object as THREE.Mesh;
        const data = mesh.userData;

        // Reset previous hover
        if (hoveredMeshRef.current && hoveredMeshRef.current !== mesh) {
          const prevMat = hoveredMeshRef.current.material as THREE.MeshStandardMaterial;
          if (prevMat && hoveredOrigColorRef.current !== null) {
            prevMat.emissive.setHex(hoveredOrigColorRef.current);
          }
        }

        // Apply hover highlight
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat) {
          if (hoveredMeshRef.current !== mesh) {
            hoveredOrigColorRef.current = mat.emissive.getHex();
          }
          mat.emissive.setHex(0x38bdf8); // Sky blue hover glow
          mat.emissiveIntensity = 0.35;
          hoveredMeshRef.current = mesh;
        }

        container.style.cursor = "pointer";

        if (data.type === "unit" && data.unitRollup) {
          const u: UnitRollup = data.unitRollup;
          const f: FloorRollup = data.floorRollup;
          const t: TowerRollup = data.towerRollup;
          setHoveredInfo({
            type: "unit",
            id: u.unit.id,
            name: `Unit ${u.unit.unitNumber || u.unit.id}`,
            floorName: f?.floor.name,
            towerName: t?.tower.name,
            progress: u.progress,
            status: u.status,
            totalTasks: u.totalTasks,
            completedTasks: u.completedTasks,
            overdueTasks: u.overdueTasks,
            totalChecklists: u.checklists.length,
            completedChecklists: u.checklists.filter((c) => c.status === "completed").length,
            unitType: u.unit.type,
            screenX: e.clientX,
            screenY: e.clientY,
          });
        } else if (data.type === "floor" && data.floorRollup) {
          const f: FloorRollup = data.floorRollup;
          const t: TowerRollup = data.towerRollup;
          const isMumty = f.floorType === "mumty";
          const isTerrace = f.floorType === "terrace";
          setHoveredInfo({
            type: "floor",
            id: f.floor.id,
            name: f.floor.name,
            towerName: t?.tower.name,
            floorName: isMumty
              ? "Rooftop Stairhead / LMR"
              : isTerrace
              ? "Open Rooftop Terrace"
              : f.floor.name,
            floorType: f.floorType,
            progress: f.progress,
            status: f.status,
            totalTasks: f.totalTasks,
            completedTasks: f.completedTasks,
            overdueTasks: f.overdueTasks,
            screenX: e.clientX,
            screenY: e.clientY,
          });
        }
      } else {
        // Reset hover
        if (hoveredMeshRef.current) {
          const prevMat = hoveredMeshRef.current.material as THREE.MeshStandardMaterial;
          if (prevMat && hoveredOrigColorRef.current !== null) {
            prevMat.emissive.setHex(hoveredOrigColorRef.current);
          }
          hoveredMeshRef.current = null;
        }
        container.style.cursor = "default";
        setHoveredInfo(null);
      }
    },
    []
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = mountRef.current;
      const camera = cameraRef.current;
      if (!container || !camera) return;

      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      const intersects = raycaster.intersectObjects(interactiveObjectsRef.current, false);

      if (intersects.length > 0) {
        const topHit = intersects[0];
        const data = topHit.object.userData;

        if (data.type === "unit") {
          onSelect({
            scope: "unit",
            projectId: projectRollup.project.id,
            towerId: data.towerId,
            floorId: data.floorId,
            unitId: data.unitId,
          });
        } else if (data.type === "floor") {
          onSelect({
            scope: "floor",
            projectId: projectRollup.project.id,
            towerId: data.towerId,
            floorId: data.floorId,
            unitId: null,
          });
        }
      }
    },
    [onSelect, projectRollup.project.id]
  );

  const handlePointerLeave = useCallback(() => {
    if (hoveredMeshRef.current && hoveredOrigColorRef.current !== null) {
      const prevMat = hoveredMeshRef.current.material as THREE.MeshStandardMaterial;
      if (prevMat) prevMat.emissive.setHex(hoveredOrigColorRef.current);
      hoveredMeshRef.current = null;
    }
    setHoveredInfo(null);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[520px] rounded-xl overflow-hidden border border-border/60 shadow-xl bg-slate-950">
      {/* Three.js canvas container */}
      <div
        ref={mountRef}
        className="w-full h-full select-none"
        onPointerMove={handlePointerMove}
        onClick={handleClick}
        onPointerLeave={handlePointerLeave}
      />

      {/* Schematic disclaimer badge */}
      <div className="absolute top-3 left-3 pointer-events-none z-10 flex items-center gap-2 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border/60 text-xs">
        <Eye className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium text-foreground">Procedural Digital Twin</span>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          (Generated live from active DB hierarchy)
        </span>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredInfo && (
        <div
          className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-full mb-3 bg-slate-900/95 text-white border border-slate-700/80 rounded-xl p-3.5 shadow-2xl backdrop-blur-md w-72 space-y-2.5 transition-all duration-75"
          style={{
            left: `${hoveredInfo.screenX}px`,
            top: `${hoveredInfo.screenY - 12}px`,
          }}
        >
          {/* Header Row: Title on Left, Status Pill on Right */}
          <div className="border-b border-slate-800 pb-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {hoveredInfo.type === "unit" ? (
                  <Grid3X3 className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Layers className="h-4 w-4 text-primary shrink-0" />
                )}
                <span className="font-bold text-sm text-white truncate">
                  {hoveredInfo.name}
                </span>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize shrink-0 ml-1 ${
                  hoveredInfo.status === "completed"
                    ? "border-emerald-500/50 text-emerald-300 bg-emerald-500/15"
                    : hoveredInfo.status === "in_progress"
                    ? "border-amber-500/50 text-amber-300 bg-amber-500/15"
                    : hoveredInfo.status === "delayed"
                    ? "border-rose-500/50 text-rose-300 bg-rose-500/15"
                    : "border-slate-600 text-slate-300 bg-slate-800/80"
                }`}
              >
                {hoveredInfo.status.replace("_", " ")}
              </Badge>
            </div>

            {/* Sub-label & Type Badge Row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {hoveredInfo.floorType === "mumty" && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-medium px-2 py-0.5 bg-purple-500/20 text-purple-300 border-purple-500/40"
                >
                  Rooftop Stairhead / LMR
                </Badge>
              )}
              {hoveredInfo.floorType === "terrace" && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-medium px-2 py-0.5 bg-sky-500/20 text-sky-300 border-sky-500/40"
                >
                  Open Rooftop Terrace
                </Badge>
              )}
              {hoveredInfo.towerName && (
                <span className="text-[11px] text-slate-400">
                  {hoveredInfo.towerName}
                </span>
              )}
              {hoveredInfo.floorName &&
                hoveredInfo.floorName !== hoveredInfo.name &&
                !hoveredInfo.floorType && (
                  <span className="text-[11px] text-slate-400">
                    • {hoveredInfo.floorName}
                  </span>
                )}
              {hoveredInfo.unitType && (
                <span className="text-[11px] text-slate-400">
                  • {hoveredInfo.unitType}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Progress</span>
              <span className="font-medium text-slate-200">{hoveredInfo.progress}%</span>
            </div>
            <Progress value={hoveredInfo.progress} className="h-1.5 bg-slate-800" />
          </div>

          <div className="grid grid-cols-2 gap-1 text-[11px] pt-1 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              <span>
                {hoveredInfo.completedTasks}/{hoveredInfo.totalTasks} Tasks
              </span>
            </div>
            {hoveredInfo.overdueTasks > 0 ? (
              <div className="flex items-center gap-1.5 text-rose-400 font-medium">
                <AlertTriangle className="h-3 w-3" />
                <span>{hoveredInfo.overdueTasks} Overdue</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-slate-400">
                <Clock className="h-3 w-3" />
                <span>On Track</span>
              </div>
            )}
          </div>

          {hoveredInfo.totalChecklists !== undefined && hoveredInfo.totalChecklists > 0 && (
            <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-slate-800/60">
              <span>Checklists:</span>
              <span className="text-slate-200">
                {hoveredInfo.completedChecklists}/{hoveredInfo.totalChecklists} done
              </span>
            </div>
          )}
        </div>
      )}

      {/* Interactive HUD helper in bottom left */}
      <div className="absolute bottom-3 left-3 z-10 pointer-events-none hidden md:flex items-center gap-3 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border/60 text-[11px] text-muted-foreground">
        <span>🖱 Left-drag: Rotate</span>
        <span>•</span>
        <span>Scroll: Zoom</span>
        <span>•</span>
        <span>Right-drag: Pan</span>
        <span>•</span>
        <span className="text-foreground font-medium">Click unit to inspect</span>
      </div>
    </div>
  );
};
