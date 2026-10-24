import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Building2, Eye, EyeOff, KeyRound, Lock, Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { passwordResetApi, ApiError } from "@/lib/api";
import AuthBackground from "@/components/auth/AuthBackground";

type Step = "email" | "otp" | "reset" | "done";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await passwordResetApi.forgotPassword(email.trim());
      setInfo(res.detail || "If an account exists for that email, a verification code has been sent.");
      setStep("otp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await passwordResetApi.verifyOtp(email.trim(), otp.trim());
      setStep("reset");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await passwordResetApi.forgotPassword(email.trim());
      setInfo(res.detail || "A new verification code has been sent.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await passwordResetApi.resetPassword(email.trim(), otp.trim(), newPassword, confirmPassword);
      setStep("done");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset your password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-950 font-sans select-none">
      {/* Animated Architecture / Notandas Video Background matching LoginPage */}
      <AuthBackground usernameOrEmail={email} />

      {/* =========================================================================
          FOREGROUND LAYER: Premium Glassmorphism Card
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
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white drop-shadow-sm text-center">
              {step === "email" && "Forgot Password"}
              {step === "otp" && "Verification Code"}
              {step === "reset" && "Create New Password"}
              {step === "done" && "Password Reset"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium text-center mt-1">
              {step === "email" && "Enter your email to receive a verification code"}
              {step === "otp" && `Enter the 6-digit code sent to ${email}`}
              {step === "reset" && "Choose a new password for your account"}
              {step === "done" && "Your password has been reset successfully"}
            </p>
          </div>

          {/* Step 1: Taking email id */}
          {step === "email" && (
            <form onSubmit={handleSendOtp} className="space-y-4 sm:space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your registered email"
                    className="pl-10 h-11 bg-white/10 dark:bg-black/40 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:border-white/40 rounded-xl text-sm transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <div
                  className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-medium text-center backdrop-blur-xs flex items-center justify-center gap-2 animate-in fade-in duration-200"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-300" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-600 text-white font-semibold shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 transition-all active:scale-[0.99] border-0"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Sending code...
                  </span>
                ) : (
                  "Send Verification Code"
                )}
              </Button>

              <Link
                to="/login"
                className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors pt-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </Link>
            </form>
          )}

          {/* Step 2: Entering OTP */}
          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4 sm:space-y-5">
              <div className="flex flex-col items-center gap-3 py-2">
                <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus>
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className="h-11 w-11 rounded-xl border border-white/20 bg-white/10 text-white font-bold text-lg focus-visible:ring-2 focus-visible:ring-blue-500/70"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {info && !error && (
                <p className="text-xs text-blue-300 text-center font-medium bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5">
                  {info}
                </p>
              )}
              {error && (
                <div
                  className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-medium text-center backdrop-blur-xs flex items-center justify-center gap-2 animate-in fade-in duration-200"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-300" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-600 text-white font-semibold shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 transition-all active:scale-[0.99] border-0"
                disabled={loading || otp.trim().length !== 6}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Verifying...
                  </span>
                ) : (
                  "Verify Code"
                )}
              </Button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                    setError("");
                    setInfo("");
                  }}
                  className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Change email
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="text-blue-400 hover:text-blue-300 hover:underline disabled:opacity-50 font-medium"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Reset password */}
          {step === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-4 sm:space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  New Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" />
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    className="pl-10 pr-10 h-11 bg-white/10 dark:bg-black/40 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:border-white/40 rounded-xl text-sm transition-all"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    autoFocus
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

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Confirm Password
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" />
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    className="pl-10 pr-10 h-11 bg-white/10 dark:bg-black/40 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:border-white/40 rounded-xl text-sm transition-all"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-medium text-center backdrop-blur-xs flex items-center justify-center gap-2 animate-in fade-in duration-200"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-300" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-600 text-white font-semibold shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 transition-all active:scale-[0.99] border-0"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Resetting...
                  </span>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          )}

          {/* Step 4: Done */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <p className="text-sm text-slate-200 font-medium mt-2">
                Your password has been reset successfully. Redirecting you to sign in...
              </p>
            </div>
          )}

          {/* Footer Copyright */}
          <p className="text-center text-[11px] text-slate-400/80 mt-6 font-normal">
            kst&copy; {new Date().getFullYear()} — Authorized Access Only
          </p>
        </div>
      </div>
    </div>
  );
}