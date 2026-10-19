import React from "react";
import { Warehouse, Store, Sun, Layers, Cog } from "lucide-react";

export type FloorType = "basement" | "ground" | "terrace" | "mumty" | "standard";

export interface FloorLike {
  id?: number;
  name?: string;
  number?: number;
  floorNumber?: number;
}

/**
 * Helper to safely extract floor number
 */
function extractNumber(floor: FloorLike): number {
  if (typeof floor.number === "number") return floor.number;
  if (typeof floor.floorNumber === "number") return floor.floorNumber;
  return 0;
}

/**
 * Categorize a floor by its number and name:
 * - Basement: negative number, or name includes "basement", or starts with B/B- followed by digits
 * - Ground: number 0, or name includes "ground", "g", "gf"
 * - Mumty / LMR: number 16 or name includes "mummty", "mumty", "lmr"
 * - Terrace: name includes "terrace" or "roof"
 * - Standard: upper levels (Floor 1, Floor 2...)
 */
export function getFloorType(floor: FloorLike): FloorType {
  const name = (floor.name || "").trim().toLowerCase();
  const num = extractNumber(floor);

  if (num < 0 || name.includes("basement") || /^b\s*-?\d+/i.test(name)) return "basement";
  if (num === 0 || name.includes("ground") || name === "g" || name === "gf") return "ground";
  if (num === 16 || name.includes("mummty") || name.includes("mumty") || name.includes("lmr")) return "mumty";
  if (name.includes("terrace") || name.includes("roof") || name === "t" || name === "tr") return "terrace";
  return "standard";
}

/**
 * Format floor name cleanly:
 * - Mummty / LMR for floor 16 or mumty/lmr
 * - Basement Floor 1, Basement Floor 2, Basement Floor 3...
 * - Ground Floor
 * - Terrace
 * - Floor 1, Floor 2... or custom user-edited name
 */
export function getFloorDisplayName(floor: FloorLike): string {
  const type = getFloorType(floor);
  const num = extractNumber(floor);
  const name = (floor.name || "").trim();

  if (num === 16 || type === "mumty" || name.toLowerCase().includes("mummty") || name.toLowerCase().includes("lmr") || name.toLowerCase().includes("mumty")) {
    return "Mummty / LMR";
  }

  if (type === "basement") {
    let bIndex = 1;
    if (num < 0) {
      bIndex = Math.abs(num);
    } else {
      const match = name.match(/\d+/);
      if (match) bIndex = parseInt(match[0], 10);
    }
    return `Basement Floor ${bIndex}`;
  }

  if (type === "ground") {
    return "Ground Floor";
  }

  if (type === "terrace") {
    return "Terrace";
  }

  // If a custom name was entered by user (e.g. in Edit Floor dialog), display it!
  if (name) {
    return name;
  }
  return `Floor ${num > 0 ? num : 1}`;
}

/**
 * Secondary subtitle description
 */
export function getFloorSubtitle(floor: FloorLike): string {
  const type = getFloorType(floor);
  const num = extractNumber(floor);
  const name = (floor.name || "").trim();

  if (num === 16 || type === "mumty" || name.toLowerCase().includes("mummty") || name.toLowerCase().includes("lmr")) {
    return "Lift Motor Room & Stair Cover · Level 16";
  }
  if (type === "basement") {
    let bIndex = 1;
    if (num < 0) {
      bIndex = Math.abs(num);
    } else {
      const match = name.match(/\d+/);
      if (match) bIndex = parseInt(match[0], 10);
    }
    return `Basement Level ${bIndex}`;
  }
  if (type === "ground") return "Entry Level · Level 0";
  if (type === "terrace") return "Rooftop Level";
  return `Level ${num > 0 ? num : 1}`;
}

/**
 * Sorting rank to guarantee:
 * 1. Basement Floor 1, Basement Floor 2, Basement Floor 3... at the top
 * 2. Ground Floor directly after basements
 * 3. Floor 1, Floor 2, Floor 3...
 * 4. Terrace
 * 5. Mummty / LMR at the very top of tower
 */
export function getFloorSortRank(floor: FloorLike): number {
  const type = getFloorType(floor);
  const num = extractNumber(floor);
  const name = (floor.name || "").trim();

  if (type === "basement") {
    let bIndex = 1;
    if (num < 0) {
      bIndex = Math.abs(num);
    } else {
      const match = name.match(/\d+/);
      if (match) bIndex = parseInt(match[0], 10);
    }
    return 100 + bIndex; // 101, 102, 103, 104, 105...
  }

  if (type === "ground") {
    return 200;
  }

  if (type === "standard") {
    const sNum = num > 0 ? num : (parseInt(name.replace(/\D/g, ""), 10) || 1);
    return 300 + sNum;
  }

  if (type === "terrace") {
    return 9000;
  }

  if (type === "mumty" || num === 16) {
    return 9100;
  }

  return 9200;
}

/**
 * Return distinctive Lucide icon based on floor type
 */
export function getFloorIcon(floor: FloorLike, className = "h-5 w-5") {
  const type = getFloorType(floor);
  switch (type) {
    case "basement":
      return <Warehouse className={className} />;
    case "ground":
      return <Store className={className} />;
    case "terrace":
      return <Sun className={className} />;
    case "mumty":
      return <Cog className={className} />;
    default:
      return <Layers className={className} />;
  }
}

/**
 * Stylized icon container classes
 */
export function getFloorIconColorClass(floor: FloorLike): string {
  const type = getFloorType(floor);
  switch (type) {
    case "basement":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white";
    case "ground":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white";
    case "terrace":
      return "bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:bg-sky-500 group-hover:text-white";
    case "mumty":
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-500 group-hover:text-white";
    default:
      return "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground";
  }
}

/**
 * Returns true if the floor is a proper/standard habitable floor
 * (strictly excluding basement floors, ground floor, terrace, and mummty/lmr)
 */
export function isProperFloor(floor: FloorLike): boolean {
  return getFloorType(floor) === "standard";
}

/**
 * Returns the exact count of proper floors (excluding basement, ground, terrace, mummty/lmr)
 */
export function countProperFloors(floorList: FloorLike[]): number {
  return floorList.filter(isProperFloor).length;
}
