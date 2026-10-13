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

      // Build each floor
      towerFloors.forEach((floorRollup, fIndex) => {
        const floorBaseY = 0.6 + fIndex * (floorHeight + floorSeparation);
        const isFloorSelected = selection.floorId === floorRollup.floor.id;
        const isTopFloor = fIndex === numFloors - 1;

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

            // Modern architectural glazed unit material
            const unitGeo = new THREE.BoxGeometry(unitW, unitH, unitD);
            const unitMat = new THREE.MeshStandardMaterial({
              color: new THREE.Color(colorHex),
              roughness: isXRayMode ? 0.15 : 0.25,
              metalness: isXRayMode ? 0.1 : 0.65,
              transparent: isXRayMode || (selection.unitId !== null && !isUnitSelected),
              opacity: isUnitSelected ? 1.0 : isXRayMode ? 0.35 : selection.unitId !== null ? 0.35 : 0.92,
              emissive: isUnitSelected
                ? new THREE.Color(DIGITAL_TWIN_COLORS.highlight)
                : new THREE.Color(0x000000),
              emissiveIntensity: isUnitSelected ? 0.45 : 0,
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

            // Cantilevered Glass Balconies on perimeter units (adds real architectural high-rise depth)
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

          const floorMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(colorHex),
            roughness: 0.45,
            metalness: 0.3,
            transparent: isXRayMode,
            opacity: isFloorSelected ? 1.0 : isXRayMode ? 0.35 : 0.88,
            emissive: isFloorSelected
              ? new THREE.Color(DIGITAL_TWIN_COLORS.highlight)
              : new THREE.Color(0x000000),
            emissiveIntensity: isFloorSelected ? 0.4 : 0,
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

      // Top Roof Slab
      const roofY = 0.6 + numFloors * (floorHeight + floorSeparation);
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

      // Parapet & Mechanical Penthouse (HVAC & Lift Machine Room)
      const penthouseGeo = new THREE.BoxGeometry(towerWidth * 0.42, 1.4, towerDepth * 0.42);
      const penthouseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
      const penthouse = new THREE.Mesh(penthouseGeo, penthouseMat);
      penthouse.position.set(towerX, roofY + 0.35 + 0.7, towerZ);
      penthouse.userData = { isBuildingPart: true };
      scene.add(penthouse);

      // 3. Realistic Progress-Driven Features (Crane vs Helipad / Crown)
      const isUnderConstruction = towerRollup.progress < 100;

      if (isUnderConstruction) {
        // Active Tower Construction Crane beside the building
        const craneX = towerX + towerWidth / 2 + 2.8;
        const craneZ = towerZ - towerDepth / 2 + 1.5;
        const craneHeight = roofY + 7.5;
        const crane = createTowerCrane(craneX, 0.3, craneZ, craneHeight);
        scene.add(crane);

        // Exposed structural rebar columns rising from the top slab
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
          rebar.position.set(towerX + cx, roofY + 0.35 + 0.6, towerZ + cz);
          rebar.userData = { isBuildingPart: true };
          scene.add(rebar);
        });
      } else {
        // Completed Tower: Luxury Rooftop Helipad & Architectural Spire
        const helipadGeo = new THREE.CylinderGeometry(3.6, 3.6, 0.1, 32);
        const helipadMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
        const helipad = new THREE.Mesh(helipadGeo, helipadMat);
        helipad.position.set(towerX, roofY + 0.35 + 0.05, towerZ);
        helipad.userData = { isBuildingPart: true };
        scene.add(helipad);

        // Helipad Yellow Circle Ring
        const ringGeo = new THREE.RingGeometry(3.0, 3.25, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(towerX, roofY + 0.35 + 0.11, towerZ);
        ring.userData = { isBuildingPart: true };
        scene.add(ring);

        // Architectural Communications Spire with Flashing Red Beacon
        const spireGeo = new THREE.CylinderGeometry(0.06, 0.22, 5.0, 8);
        const spireMat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          metalness: 0.9,
          roughness: 0.2,
        });
        const spire = new THREE.Mesh(spireGeo, spireMat);
        spire.position.set(towerX, roofY + 0.35 + 1.4 + 2.5, towerZ);
        spire.userData = { isBuildingPart: true };
        scene.add(spire);

        const beaconGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(towerX, roofY + 0.35 + 1.4 + 5.1, towerZ);
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
          setHoveredInfo({
            type: "floor",
            id: f.floor.id,
            name: f.floor.name,
            towerName: t?.tower.name,
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
          className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-full mb-3 bg-slate-900/95 text-white border border-slate-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md w-64 space-y-2 transition-all duration-75"
          style={{
            left: `${hoveredInfo.screenX}px`,
            top: `${hoveredInfo.screenY - 12}px`,
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <div className="flex items-center gap-1.5">
              {hoveredInfo.type === "unit" ? (
                <Grid3X3 className="h-4 w-4 text-primary" />
              ) : (
                <Layers className="h-4 w-4 text-primary" />
              )}
              <span className="font-semibold text-sm">{hoveredInfo.name}</span>
            </div>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 capitalize ${
                hoveredInfo.status === "completed"
                  ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                  : hoveredInfo.status === "in_progress"
                  ? "border-amber-500 text-amber-400 bg-amber-500/10"
                  : hoveredInfo.status === "delayed"
                  ? "border-rose-500 text-rose-400 bg-rose-500/10"
                  : "border-slate-500 text-slate-400"
              }`}
            >
              {hoveredInfo.status.replace("_", " ")}
            </Badge>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            {hoveredInfo.towerName && <span>{hoveredInfo.towerName}</span>}
            {hoveredInfo.floorName && <span>• {hoveredInfo.floorName}</span>}
            {hoveredInfo.unitType && <span>• {hoveredInfo.unitType}</span>}
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
