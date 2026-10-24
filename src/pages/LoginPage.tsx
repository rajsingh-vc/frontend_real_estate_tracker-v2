import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, Eye, EyeOff, Lock, User, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthBackground from "@/components/auth/AuthBackground";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      {/* Animated Architecture / Notandas Video Background */}
      <AuthBackground usernameOrEmail={username} />

      {/* =========================================================================
          FOREGROUND LAYER: Premium Glassmorphism Login Card
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
              Konstruct Tracker
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
            kst&copy; {new Date().getFullYear()} — Authorized Access Only
          </p>
        </div>
      </div>
    </div>
  );
}