import { Link } from "react-router-dom";
import { ShieldIcon } from "@/components/icons/Icon";
import { useAuthStore } from "@/store/authStore";

export function ForbiddenPage() {
  const user = useAuthStore((s) => s.currentUser);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper-50 px-6 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-signal-redBg text-signal-red">
        <ShieldIcon size={26} />
      </span>
      <h1 className="font-heading text-xl font-bold text-ink-900">You don't have access to this page</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-600">
        {user ? `${user.name}'s role doesn't include this area.` : "Please sign in to continue."} This attempt was
        recorded in the audit log.
      </p>
      <Link to="/" className="btn-primary mt-6">
        Back to my dashboard
      </Link>
    </div>
  );
}
