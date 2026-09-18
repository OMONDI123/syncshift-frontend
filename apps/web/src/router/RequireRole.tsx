import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useScheduleStore } from "@/store/scheduleStore";
import type { Role } from "@/types";

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = useAuthStore((s) => s.currentUser);
  const hydrated = useAuthStore((s) => s.hydrated);
  const logSecurityEvent = useScheduleStore((s) => s.logSecurityEvent);

  if (!hydrated) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    logSecurityEvent(user.id, "denied_route_access", roles.join("|"));
    return <Navigate to="/forbidden" replace />;
  }
  return <>{children}</>;
}
