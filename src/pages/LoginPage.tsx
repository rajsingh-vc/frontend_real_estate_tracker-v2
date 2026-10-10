import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, Eye, EyeOff, Lock, User, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NotanSlide {
  id: number;
  src: string;
  alt: string;
  animationClass: string;
}

const NOTAN_SLIDES: NotanSlide[] = [
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

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Background slide rotation state
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const success = await login(username, password);
    if (!success) {
      setError("Invalid username or password. Please try again.");
    } else {
      navigate("/");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-950 font-sans select-none">
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
          1. BACKGROUND LAYER: Full-screen Animated Notan Architecture
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

      {/* =========================================================================
          2. FOREGROUND LAYER: Premium Glassmorphism Login Card
          ========================================================================= */}
      <div className="relative z-20 w-full max-w-md px-4 sm:px-6 my-auto">
        <div className="relative rounded-3xl border border-white/20 bg-slate-950/50 dark:bg-black/55 backdrop-blur-xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),inset_0_1px_1px_0_rgba(255,255,255,0.2)] p-7 sm:p-9 overflow-hidden transition-all duration-300">
          {/* Subtle Top Glass Reflection Shimmer Line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

          {/* Logo & Header */}
          <div className="flex flex-col items-center mb-7">
            <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center mb-3.5 shadow-xl shadow-blue-500/30 ring-1 ring-white/25">
              <Building2 className="h-7 w-7 text-white drop-shadow-md" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm text-center">
              Real Estate Tracker
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium text-center mt-1">
              Project &amp; Construction Management
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Username or Email Field */}
            <div className="space-y-1.5">
              <Label
                htmlFor="username"
                className="text-xs font-semibold uppercase tracking-wider text-slate-200"
              >
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username or email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="pl-10 h-11 bg-white/10 dark:bg-black/40 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:border-white/40 rounded-xl text-sm transition-all"
                />
              </div>
            </div>

            {/* Password Field with Visibility Toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-200"
                >
                  Password
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                  tabIndex={-1}
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pl-10 pr-10 h-11 bg-white/10 dark:bg-black/40 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:border-white/40 rounded-xl text-sm transition-all"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error Message Display */}
            {error && (
              <div
                className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-medium text-center backdrop-blur-xs flex items-center justify-center gap-2 animate-in fade-in duration-200"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-300" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-600 text-white font-semibold shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 transition-all active:scale-[0.99] border-0"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* Footer Copyright */}
          <p className="text-center text-[11px] text-slate-400/80 mt-6 font-normal">
            rst&copy; {new Date().getFullYear()} — Authorized Access Only
          </p>
        </div>
      </div>
    </div>
  );
}