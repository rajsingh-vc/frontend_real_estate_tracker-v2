import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { invitationsApi, type InvitationPreview } from "@/lib/api";
import { setTokens } from "@/contexts/AuthContext";

type Step = "loading" | "invalid" | "preview" | "form" | "success";

function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [step, setStep] = useState<Step>("loading");
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError("This invitation link is missing a token.");
      setStep("invalid");
      return;
    }
    let cancelled = false;
    invitationsApi
      .preview(token)
      .then((inv) => {
        if (cancelled) return;
        if (inv.status !== "pending" || inv.is_expired) {
          setLoadError(
            inv.status === "accepted"
              ? "This invitation has already been accepted."
              : inv.status === "revoked"
              ? "This invitation has been revoked."
              : "This invitation has expired."
          );
          setStep("invalid");
          return;
        }
        setInvitation(inv);
        setUsername(inv.username || "");
        setStep("preview");
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("This invitation link is invalid or no longer exists.");
        setStep("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!invitation) return;

    const expectedUsername = (invitation.username || "").trim();
    if (expectedUsername && username.trim() !== expectedUsername) {
      setFormError("Login failed. The username doesn't match this invitation.");
      return;
    }
    if (!username.trim()) {
      setFormError("Username is required.");
      return;
    }
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await invitationsApi.accept({
        token,
        username: username.trim(),
        password,
      });
      setTokens(result.access, result.refresh);
      setStep("success");
      setTimeout(() => navigate("/"), 1200);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "loading") {
    return (
      <CenterCard>
        <Loader2 className="animate-spin text-blue-600 mx-auto" size={28} />
        <p className="text-sm text-gray-500 mt-3">Checking your invitation…</p>
      </CenterCard>
    );
  }

  if (step === "invalid") {
    return (
      <CenterCard>
        <XCircle className="text-red-500 mx-auto" size={32} />
        <p className="text-sm font-medium text-gray-900 mt-3">{loadError}</p>
        <button
          onClick={() => navigate("/login")}
          className="mt-5 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Go to login
        </button>
      </CenterCard>
    );
  }

  if (step === "preview" && invitation) {
    const greetingName = invitation.name || invitation.username || invitation.email;
    return (
      <CenterCard>
        <h1 className="text-xl font-bold text-gray-900 mb-1">You're invited</h1>
        <p className="text-sm text-gray-500 mb-1">Hi {greetingName},</p>
        <p className="text-sm text-gray-500 mb-4">
          You've been invited to join{" "}
          <span className="font-semibold text-gray-700">{invitation.company_name}</span>
          {invitation.role_name && (
            <>
              {" "}
              as <span className="font-semibold text-gray-700">{invitation.role_name}</span>
            </>
          )}
          {invitation.department_name && (
            <>
              {" "}
              in the <span className="font-semibold text-gray-700">{invitation.department_name}</span> department
            </>
          )}
          .
        </p>
        <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 mb-6 text-left">
          <p className="text-xs text-gray-500 mb-0.5">Your username</p>
          <p className="text-sm font-semibold text-gray-800">
            {invitation.username || invitation.email}
          </p>
        </div>
        <button
          onClick={() => setStep("form")}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
        >
          Accept invitation
        </button>
      </CenterCard>
    );
  }

  if (step === "success") {
    return (
      <CenterCard>
        <CheckCircle2 className="text-green-500 mx-auto" size={32} />
        <p className="text-sm font-medium text-gray-900 mt-3">You're all set!</p>
        <p className="text-sm text-gray-500 mt-1">Taking you to your dashboard…</p>
      </CenterCard>
    );
  }

  // step === "form"
  return (
    <CenterCard>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Set up your login</h1>
      <p className="text-sm text-gray-500 mb-6">
        Confirm the username{" "}
        <span className="font-semibold text-gray-700">{invitation?.username}</span> and choose a
        password.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3 text-left">
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">Username</span>
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">New password</span>
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">Confirm password</span>
          <input
            required
            type="password"
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
        </label>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {submitting ? "Setting up…" : "Set password & log in"}
        </button>
      </form>
    </CenterCard>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm p-8 text-center">
        {children}
      </div>
    </div>
  );
}

export default AcceptInvite;