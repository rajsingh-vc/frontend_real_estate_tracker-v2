import { useState, useEffect, useRef } from "react";

export interface NotanSlide {
  id: number;
  src: string;
  alt: string;
  animationClass: string;
}

export const NOTAN_SLIDES: NotanSlide[] = [
  {
    id: 1,
    src: "/notan1.png",
    alt: "Notan Architectural Horizon",
    animationClass: "animate-notan-zoom",
  },
  {
    id: 2,
    src: "/notan2.png",
    alt: "Notan Elevation & Structural Vista",
    animationClass: "animate-notan-slide-x",
  },
  {
    id: 3,
    src: "/notan3.png",
    alt: "Notan High-Rise Verticality",
    animationClass: "animate-notan-reveal-y",
  },
  {
    id: 4,
    src: "/notan4.png",
    alt: "Notan Civic Masterplan & Perspective",
    animationClass: "animate-notan-3d-perspective",
  },
];

export default function AuthBackground() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 7 seconds per slide with smooth 1.5s crossfade
    timerRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % NOTAN_SLIDES.length);
    }, 7000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <>
      {/* =========================================================================
          CUSTOM CSS KEYFRAMES FOR EACH NOTAN IMAGE (Tailored Distinct Animations)
          ========================================================================= */}
      <style>{`
        /* 1. notan1.png: Smooth fade-in combined with a gentle zoom */
        @keyframes notanZoom {
          0% {
            transform: scale(1.0);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.04);
            opacity: 1;
          }
          100% {
            transform: scale(1.08);
            opacity: 0.95;
          }
        }
        .animate-notan-zoom {
          animation: notanZoom 7.5s cubic-bezier(0.25, 1, 0.5, 1) infinite alternate;
          will-change: transform, opacity;
        }

        /* 2. notan2.png: Horizontal slide with a subtle opacity transition */
        @keyframes notanSlideX {
          0% {
            transform: translateX(-35px) scale(1.04);
            opacity: 0.8;
          }
          50% {
            transform: translateX(0px) scale(1.04);
            opacity: 1;
          }
          100% {
            transform: translateX(25px) scale(1.04);
            opacity: 0.9;
          }
        }
        .animate-notan-slide-x {
          animation: notanSlideX 7.5s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate;
          will-change: transform, opacity;
        }

        /* 3. notan3.png: Vertical reveal with a slow upward movement */
        @keyframes notanRevealY {
          0% {
            transform: translateY(30px) scale(1.03);
            opacity: 0.85;
          }
          50% {
            transform: translateY(0px) scale(1.03);
            opacity: 1;
          }
          100% {
            transform: translateY(-22px) scale(1.03);
            opacity: 0.95;
          }
        }
        .animate-notan-reveal-y {
          animation: notanRevealY 7.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite alternate;
          will-change: transform, opacity;
        }

        /* 4. notan4.png: Subtle 3D perspective rotation followed by a smooth settling effect */
        @keyframes notan3DPerspective {
          0% {
            transform: rotateY(4deg) rotateX(-2deg) scale(1.06);
            opacity: 0.85;
          }
          45% {
            transform: rotateY(0deg) rotateX(0deg) scale(1.03);
            opacity: 1;
          }
          100% {
            transform: rotateY(-2deg) rotateX(1deg) scale(1.01);
            opacity: 0.92;
          }
        }
        .animate-notan-3d-perspective {
          animation: notan3DPerspective 7.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite alternate;
          transform-style: preserve-3d;
          will-change: transform, opacity;
        }

        /* Respect accessibility prefers-reduced-motion */
        @media (prefers-reduced-motion: reduce) {
          .animate-notan-zoom,
          .animate-notan-slide-x,
          .animate-notan-reveal-y,
          .animate-notan-3d-perspective {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* =========================================================================
          BACKGROUND LAYER: Full-screen Animated Notan Architecture
          ========================================================================= */}
      <div
        className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none z-0"
        style={{ perspective: "1200px" }}
        aria-hidden="true"
      >
        {/* Permanent Fallback Base Image to eliminate any white flash */}
        <div className="absolute inset-0 w-full h-full">
          <img
            src="/notan1.png"
            alt=""
            className="w-full h-full object-cover brightness-[0.7] contrast-[1.05]"
          />
        </div>

        {/* All 4 Notan Images Staggered & Crossfaded */}
        {NOTAN_SLIDES.map((slide, index) => {
          const isActive = currentSlide === index;
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 w-full h-full transition-opacity duration-1500 ease-in-out ${
                isActive ? "opacity-100 z-10" : "opacity-0 z-0"
              }`}
            >
              <img
                src={slide.src}
                alt={slide.alt}
                className={`w-full h-full object-cover brightness-[0.8] contrast-[1.08] ${
                  isActive ? slide.animationClass : ""
                }`}
              />
            </div>
          );
        })}

        {/* Cinematic Vignette & Ambient Darkness Overlay for Glassmorphic Depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/75 pointer-events-none z-10" />
        <div className="absolute inset-0 bg-radial-[circle_at_center] from-transparent via-slate-950/30 to-slate-950/80 pointer-events-none z-10" />

        {/* Subtle Ambient Architectural Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-40 pointer-events-none z-10" />
      </div>
    </>
  );
}
