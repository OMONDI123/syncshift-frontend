import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { users } from "@/data/seed";
import { demoPasswordFor, roleHomePath } from "@/lib/auth";
import { Avatar } from "@/components/common/Avatar";
import { Badge } from "@/components/common/Badge";
import { LockIcon, AlertTriangleIcon, ChevronRightIcon } from "@/components/icons/Icon";
import type { Role } from "@/types";

const roleTabs: { role: Role; label: string }[] = [
  { role: "ADMIN", label: "Admin" },
  { role: "MANAGER", label: "Manager" },
  { role: "STAFF", label: "Staff" },
];

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<Role>("MANAGER");

  const credentialsForTab = users.filter((u) => u.role === activeTab);

  function fillCredentials(userEmail: string, role: Role) {
    setEmail(userEmail);
    setPassword(demoPasswordFor(role));
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (!result.success) {
      setError(result.reason ?? "Couldn't sign in.");
      return;
    }
    const user = useAuthStore.getState().currentUser!;
    navigate(roleHomePath(user.role));
  }

  return (
    <div className="min-h-screen bg-navy-950 bg-[radial-gradient(ellipse_at_top,_rgba(245,166,35,0.08),_transparent_55%)] px-4 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-card bg-gold-500 font-heading text-base font-extrabold text-navy-950">
            CE
          </span>
          <span className="font-heading text-lg font-bold text-white">ShiftSync</span>
        </Link>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          {/* Login form */}
          <div className="panel bg-white p-6">
            <h1 className="font-heading text-xl font-bold text-ink-900">Sign in</h1>
            <p className="mt-1 text-sm text-ink-600">Enter your Coastal Eats credentials.</p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-ink-900" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@coastaleats.com"
                  className="w-full rounded-card border border-ink-900/15 px-3 py-2.5 text-sm focus:border-gold-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-ink-900" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-card border border-ink-900/15 px-3 py-2.5 text-sm focus:border-gold-500"
                />
              </div>

              {error && (
                <p className="flex items-center gap-2 rounded-card bg-signal-redBg px-3 py-2 text-sm text-signal-red">
                  <AlertTriangleIcon size={15} /> {error}
                </p>
              )}

              <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="mt-5 flex items-start gap-2 rounded-card border border-ink-900/10 bg-paper-50 px-3 py-2.5 text-xs text-ink-600">
              <LockIcon size={13} className="mt-0.5 shrink-0" />
              <span>
                Signing in issues a real JWT from the ShiftSync API, checked against a bcrypt-hashed password —
                this is the same auth every environment uses. Every action is still permission-checked
                independently server-side once you're in — see the backend README's "Security" section.
              </span>
            </div>
          </div>

          {/* Demo credentials */}
          <div className="panel bg-white p-6">
            <h2 className="font-heading text-base font-semibold text-ink-900">Demo credentials</h2>
            <p className="mt-1 text-sm text-ink-600">
              Pick a role to see its accounts, then click one to fill the form — you still need to press Sign in.
            </p>

            <div className="mt-4 flex gap-1.5 rounded-card bg-paper-100 p-1">
              {roleTabs.map((t) => (
                <button
                  key={t.role}
                  onClick={() => setActiveTab(t.role)}
                  className={`flex-1 rounded-card px-3 py-1.5 text-sm font-semibold transition ${
                    activeTab === t.role ? "bg-navy-950 text-white shadow-sm" : "text-ink-600 hover:text-ink-900"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              {credentialsForTab.map((u) => (
                <button
                  key={u.id}
                  onClick={() => fillCredentials(u.email, u.role)}
                  className="flex w-full items-center gap-3 rounded-card border border-ink-900/10 px-3 py-2.5 text-left transition hover:border-gold-500 hover:bg-gold-100/30"
                >
                  <Avatar name={u.name} color={u.avatarColor} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-900">{u.name}</span>
                    <span className="block truncate text-xs text-ink-600">{u.email}</span>
                  </span>
                  {u.managedLocationIds.length > 0 && <Badge tone="navy">{u.managedLocationIds.length} locations</Badge>}
                  <ChevronRightIcon size={16} className="shrink-0 text-ink-400" />
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-card bg-navy-950 px-3 py-2.5 text-xs text-white/70">
              Password for every <span className="font-semibold text-white">{roleTabs.find((t) => t.role === activeTab)?.label}</span> account:{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-gold-500">{demoPasswordFor(activeTab)}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
