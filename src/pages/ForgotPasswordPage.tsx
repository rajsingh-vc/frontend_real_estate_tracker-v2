import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Building2, Eye, EyeOff, KeyRound, Lock, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { passwordResetApi } from "@/lib/api";
import { ApiError } from "@/lib/api";

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
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-30" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="rounded-2xl border bg-card/80 backdrop-blur-md shadow-2xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="h-14 w-14 rounded-xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/30">
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Vibe</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              {step === "email" && "Reset your password"}
              {step === "otp" && "Enter the verification code"}
              {step === "reset" && "Choose a new password"}
              {step === "done" && "Password reset"}
            </p>
          </div>

          {step === "email" && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <p className="text-sm text-muted-foreground text-center">
                Enter the email address on your account and we'll send you a verification code.
              </p>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              {error && <p className="text-sm text-destructive font-medium text-center">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending code..." : "Send verification code"}
              </Button>

              <Link
                to="/login"
                className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </Link>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <p className="text-sm text-muted-foreground text-center">
                We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>. Enter it below.
              </p>

              <div className="flex flex-col items-center gap-2">
                <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {info && !error && <p className="text-sm text-muted-foreground text-center">{info}</p>}
              {error && <p className="text-sm text-destructive font-medium text-center">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading || otp.trim().length !== 6}>
                {loading ? "Verifying..." : "Verify code"}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                    setError("");
                    setInfo("");
                  }}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Change email
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="text-primary hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}

          {step === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    className="pl-9 pr-9"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    className="pl-9 pr-9"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-destructive font-medium text-center">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Resetting..." : "Reset password"}
              </Button>
            </form>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-2">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <p className="text-sm text-muted-foreground text-center">
                Your password has been reset successfully. Redirecting you to sign in...
              </p>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground mt-6">
            vibe&copy; {new Date().getFullYear()} — Authorized access only
          </p>
        </div>
      </div>
    </div>
  );
}