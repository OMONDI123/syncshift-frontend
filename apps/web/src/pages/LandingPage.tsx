import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { roleHomePath } from "@/lib/auth";
import { HeroBoard } from "@/components/landing/HeroBoard";
import { CyclingWord } from "@/components/landing/CyclingWord";
import { EngineTeaser } from "@/components/landing/EngineTeaser";
import {
  CalendarIcon,
  ShuffleIcon,
  ClockIcon,
  ScaleIcon,
  BellIconGlyph,
  ShieldIcon,
  UsersIcon,
  BuildingIcon,
  MoonIcon,
  CheckIcon,
} from "@/components/icons/Icon";

const painPoints = [
  {
    icon: <ShuffleIcon size={18} />,
    before: "A server calls out at 6pm for a 7pm shift",
    after: "Drop it, and every qualified coworker sees it open instantly",
  },
  {
    icon: <ClockIcon size={18} />,
    before: "Overtime costs spiral with no one noticing until payroll",
    after: "Live projected cost + who's pushing into overtime, before you confirm",
  },
  {
    icon: <ScaleIcon size={18} />,
    before: "\u201cI never get good shifts\u201d complaints with no way to check",
    after: "A fairness report that sorts premium shifts by staff member, instantly",
  },
  {
    icon: <BuildingIcon size={18} />,
    before: "Managers quietly hoard their best people across locations",
    after: "Cross-location visibility for admins, scoped permissions for managers",
  },
  {
    icon: <UsersIcon size={18} />,
    before: "No one knows who's actually working where, right now",
    after: "A live On Duty Now board, updating the moment someone clocks in",
  },
];

const features = [
  { icon: <UsersIcon size={20} />, title: "Roles & certifications", blurb: "Admins, managers, and staff — each scoped to the locations and skills they actually have." },
  { icon: <CalendarIcon size={20} />, title: "Constraint-checked scheduling", blurb: "Skill, certification, rest periods, and daily/weekly hour limits enforced the moment you try to assign." },
  { icon: <ShuffleIcon size={20} />, title: "Swaps, drops & pickups", blurb: "A full approval chain — requester, partner, manager — with automatic cleanup when plans change." },
  { icon: <ClockIcon size={20} />, title: "Overtime & labor compliance", blurb: "6th/7th consecutive day tracking, projected cost, and a documented override trail." },
  { icon: <ScaleIcon size={20} />, title: "Fairness analytics", blurb: "Premium-shift distribution and hours-vs-desired, so complaints get answered with data." },
  { icon: <MoonIcon size={20} />, title: "Real-time everything", blurb: "Live schedule updates, live on-duty presence, instant conflict detection between managers." },
  { icon: <BellIconGlyph size={20} />, title: "Notifications", blurb: "Every party is told at every step — assigned, changed, published, approved, rejected." },
  { icon: <ShieldIcon size={20} />, title: "Audit trail & security", blurb: "Every change and every denied action is logged — who, when, before and after." },
];

const steps = [
  { title: "Build the week", blurb: "Create shifts per location and skill. The engine blocks bad assignments before they happen and suggests who'd actually work." },
  { title: "Publish — then let it flex", blurb: "Staff swap, drop, and pick up shifts live. Every change routes through the right approvals automatically." },
  { title: "Watch the numbers", blurb: "Overtime, fairness, and on-duty status update in real time, so nothing surprises you at payroll." },
];

export function LandingPage() {
  const user = useAuthStore((s) => s.currentUser);

  return (
    <div className="bg-navy-950">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-navy-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-card bg-gold-500 font-heading text-sm font-extrabold text-navy-950">
              CE
            </span>
            <span className="font-heading text-sm font-bold text-white">ShiftSync</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-white/60 sm:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#how-it-works" className="hover:text-white">How it works</a>
            <a href="#engine" className="hover:text-white">Live demo</a>
          </nav>
          {user ? (
            <Link to={roleHomePath(user.role)} className="btn-primary">
              Go to my dashboard
            </Link>
          ) : (
            <Link to="/login" className="btn-primary">
              Sign in
            </Link>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(245,166,35,0.12),_transparent_50%)]" />
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/60">
              Built for Coastal Eats · 4 locations, 2 timezones
            </span>
            <h1 className="mt-5 font-heading text-4xl font-bold leading-tight text-white sm:text-5xl">
              Stop fighting <CyclingWord words={["no-shows.", "overtime.", "unfair shifts.", "double-bookings."]} />
              <br />
              Start running the floor.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/60">
              ShiftSync is the scheduling platform built around what actually breaks restaurant scheduling: last-minute
              call-outs, invisible overtime, and managers who can't see past their own location.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/login" className="btn-primary px-5 py-3 text-base">
                Sign in to the demo
              </Link>
              <a href="#engine" className="btn-secondary bg-transparent px-5 py-3 text-base text-white hover:bg-white/10">
                Try the engine, no login
              </a>
            </div>
          </div>
          <HeroBoard />
        </div>
      </section>

      {/* Pain points */}
      <section className="border-t border-white/10 bg-navy-900/40 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-heading text-2xl font-bold text-white sm:text-3xl">What Coastal Eats was dealing with</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/50">
            Five real pain points, five direct answers — not generic feature bullets.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {painPoints.map((p, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-card bg-white/5 text-gold-500">
                  {p.icon}
                </span>
                <p className="mt-3 text-sm font-medium text-white/50 line-through decoration-signal-red/60">
                  {p.before}
                </p>
                <p className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-white">
                  <CheckIcon size={15} className="mt-0.5 shrink-0 text-signal-green" />
                  {p.after}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live engine demo */}
      <section id="engine" className="border-t border-white/10 bg-navy-950 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <EngineTeaser />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-white/10 bg-navy-900/40 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-heading text-2xl font-bold text-white sm:text-3xl">Everything the floor actually needs</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-card bg-gold-500/10 text-gold-500">
                  {f.icon}
                </span>
                <p className="mt-3 font-heading text-sm font-semibold text-white">{f.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/50">{f.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-white/10 bg-navy-950 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-heading text-2xl font-bold text-white sm:text-3xl">How it works</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <span className="font-heading text-4xl font-extrabold text-white/10">0{i + 1}</span>
                <p className="mt-2 font-heading text-lg font-semibold text-white">{s.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{s.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="border-t border-white/10 bg-navy-900/40 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="font-heading text-xl font-medium leading-relaxed text-white sm:text-2xl">
            "We stopped finding out about overtime on payday, and Saturday nights stopped being a group chat fire
            drill."
          </p>
          <p className="mt-4 text-sm text-white/50">— Ops Director, Coastal Eats (4 locations)</p>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-white/10 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="font-heading text-2xl font-bold text-white sm:text-3xl">See it as an admin, a manager, or staff</h2>
          <p className="mt-2 text-sm text-white/50">
            Every role has its own demo account and its own view — sign in to try any of them.
          </p>
          <Link to="/login" className="btn-primary mt-6 inline-flex px-6 py-3 text-base">
            Sign in
          </Link>
        </div>
        <p className="mt-10 text-center text-xs text-white/30">ShiftSync — a Coastal Eats scheduling platform.</p>
      </section>
    </div>
  );
}
