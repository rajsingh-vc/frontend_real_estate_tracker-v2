import { useState, useEffect, useRef } from "react";
import { Video, Image as ImageIcon } from "lucide-react";

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

export interface AuthBackgroundProps {
  forceMode?: "video" | "photos";
  usernameOrEmail?: string;
  showToggle?: boolean;
}

export default function AuthBackground({
  forceMode,
  usernameOrEmail = "",
  showToggle = false,
}: AuthBackgroundProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [manualMode, setManualMode] = useState<"video" | "photos" | null>(null);
  // Default to video on initial open so video plays first
  const [autoMode, setAutoMode] = useState<"video" | "photos">("video");
  const [, setVideoLoaded] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasTriggeredEndRef = useRef(false);

  // Check URL query parameter if present (?bg=video or ?bg=photos)
  const urlParamMode: "video" | "photos" | null = (() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const bgParam = params.get("bg");
      if (bgParam === "video" || bgParam === "photos") return bgParam;
    }
    return null;
  })();

  // Mode priority:
  // 1. Explicit forceMode prop
  // 2. User-clicked manual toggle
  // 3. URL param
  // 4. Automatic sequential cycle: Video plays first fully -> All photos display -> Video plays fully
  const effectiveMode: "video" | "photos" =
    forceMode || manualMode || urlParamMode || autoMode;

  const SLIDE_DURATION = 6500; // 6.5 seconds per photo slide

  // Manage slideshow timer: advances through all slides, then switches to video
  useEffect(() => {
    if (effectiveMode !== "photos") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // If locked to photos via force/manual mode, loop photos continuously
    if (forceMode === "photos" || manualMode === "photos" || urlParamMode === "photos") {
      timerRef.current = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % NOTAN_SLIDES.length);
      }, SLIDE_DURATION);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }

    // Automatic sequential cycle: advance through all slides, then switch to video
    timerRef.current = setInterval(() => {
      setCurrentSlide((prev) => {
        if (prev >= NOTAN_SLIDES.length - 1) {
          // All images have finished displaying! Switch to video
          setAutoMode("video");
          return prev; // keep current slide rendered during crossfade
        }
        return prev + 1;
      });
    }, SLIDE_DURATION);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [effectiveMode, forceMode, manualMode, urlParamMode]);

  // Video playback management: ensure video plays fully from beginning, and stays paused during photos
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (effectiveMode === "video") {
      hasTriggeredEndRef.current = false;
      try {
        v.currentTime = 0;
      } catch {
        // ignore if not ready
      }
      const playPromise = v.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay policy handled
        });
      }
    } else {
      // Strictly pause and rewind video during photos mode so it never plays or drifts in the background
      v.pause();
      try {
        v.currentTime = 0;
      } catch {
        // ignore
      }
    }
  }, [effectiveMode]);

  const handleVideoEnded = () => {
    // If locked to video, let it loop
    if (forceMode === "video" || manualMode === "video" || urlParamMode === "video") return;
    if (hasTriggeredEndRef.current) return;
    hasTriggeredEndRef.current = true;

    const v = videoRef.current;
    if (v) {
      v.pause();
      try {
        v.currentTime = 0;
      } catch {
        // ignore
      }
    }

    // Transition to photo slideshow starting from first slide
    setCurrentSlide(0);
    setAutoMode("photos");
  };

  const handleTimeUpdate = () => {
    if (forceMode === "video" || manualMode === "video" || urlParamMode === "video") return;
    if (effectiveMode !== "video") return;

    const v = videoRef.current;
    if (!v) return;

    // Detect when the full video has completed playback (near the end of its duration)
    if (v.duration > 0 && v.currentTime >= v.duration - 0.15) {
      handleVideoEnded();
    }
  };

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
          BACKGROUND LAYER: Full-screen Video or Animated Notan Architecture
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

        {/* =====================================================================
            VIDEO BACKGROUND: notandas_video.mp4 (for Admin / Invited users)
            ===================================================================== */}
        <div
          className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
            effectiveMode === "video" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
          }`}
        >
          <video
            ref={videoRef}
            autoPlay
            loop={Boolean(forceMode === "video" || manualMode === "video" || urlParamMode === "video")}
            muted
            playsInline
            preload="auto"
            onLoadedData={() => setVideoLoaded(true)}
            onEnded={handleVideoEnded}
            onTimeUpdate={handleTimeUpdate}
            className="w-full h-full object-cover brightness-[0.78] contrast-[1.08]"
          >
            <source src="/notandas_video.mp4" type="video/mp4" />
          </video>
        </div>

        {/* =====================================================================
            PHOTO ANIMATION SLIDES: notan1-4.png (for SuperAdmin)
            ===================================================================== */}
        <div
          className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
            effectiveMode === "photos" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
          }`}
        >
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
        </div>

        {/* Cinematic Vignette & Ambient Darkness Overlay for Glassmorphic Depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/75 pointer-events-none z-10" />
        <div className="absolute inset-0 bg-radial-[circle_at_center] from-transparent via-slate-950/30 to-slate-950/80 pointer-events-none z-10" />

        {/* Subtle Ambient Architectural Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-40 pointer-events-none z-10" />
      </div>

      {/* =========================================================================
          SLEEK AMBIENT MODE SWITCHER (Bottom-Right: Video & Image Icons Only)
          ========================================================================= */}
      {showToggle && (
        <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-30 pointer-events-auto">
          <div className="flex items-center gap-1 p-1 rounded-full bg-slate-950/75 border border-white/15 backdrop-blur-md shadow-xl">
            {/* Image Icon Button */}
            <button
              type="button"
              onClick={() => {
                setManualMode("photos");
                setCurrentSlide(0);
              }}
              title="Show Image Animation"
              aria-label="Show Image Animation"
              className={`p-2 rounded-full transition-all active:scale-95 ${
                effectiveMode === "photos"
                  ? "bg-amber-500/25 text-amber-300 border border-amber-400/50 shadow-[0_0_12px_rgba(251,191,36,0.35)]"
                  : "text-slate-400 hover:text-white hover:bg-white/10 border border-transparent"
              }`}
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            {/* Video Icon Button */}
            <button
              type="button"
              onClick={() => setManualMode("video")}
              title="Play Video"
              aria-label="Play Video"
              className={`p-2 rounded-full transition-all active:scale-95 ${
                effectiveMode === "video"
                  ? "bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 shadow-[0_0_12px_rgba(34,211,238,0.35)]"
                  : "text-slate-400 hover:text-white hover:bg-white/10 border border-transparent"
              }`}
            >
              <Video className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
