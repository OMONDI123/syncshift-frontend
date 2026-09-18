import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { RequireRole } from "@/router/RequireRole";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { ForbiddenPage } from "@/pages/ForbiddenPage";
import { ScheduleBoardPage } from "@/pages/manager/ScheduleBoardPage";
import { OnDutyPage } from "@/pages/manager/OnDutyPage";
import { OvertimeDashboardPage } from "@/pages/manager/OvertimeDashboardPage";
import { FairnessPage } from "@/pages/manager/FairnessPage";
import { MyShiftsPage } from "@/pages/staff/MyShiftsPage";
import { MarketplacePage } from "@/pages/staff/MarketplacePage";
import { AvailabilityPage } from "@/pages/staff/AvailabilityPage";
import { AdminOverviewPage } from "@/pages/admin/AdminOverviewPage";
import { UserManagementPage } from "@/pages/admin/UserManagementPage";
import { AuditLogPage } from "@/pages/admin/AuditLogPage";
import { SetupPage } from "@/pages/admin/SetupPage";

function SplashScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950">
      <span className="flex h-12 w-12 animate-pulse items-center justify-center rounded-card bg-gold-500 font-heading text-sm font-extrabold text-navy-950">
        CE
      </span>
    </div>
  );
}

export function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) return <SplashScreen />;

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />

      <Route
        path="/schedule"
        element={
          <RequireRole roles={["MANAGER", "ADMIN"]}>
            <ScheduleBoardPage />
          </RequireRole>
        }
      />
      <Route
        path="/on-duty"
        element={
          <RequireRole roles={["MANAGER", "ADMIN"]}>
            <OnDutyPage />
          </RequireRole>
        }
      />
      <Route
        path="/overtime"
        element={
          <RequireRole roles={["MANAGER", "ADMIN"]}>
            <OvertimeDashboardPage />
          </RequireRole>
        }
      />
      <Route
        path="/fairness"
        element={
          <RequireRole roles={["MANAGER", "ADMIN"]}>
            <FairnessPage />
          </RequireRole>
        }
      />

      <Route
        path="/my-shifts"
        element={
          <RequireRole roles={["STAFF"]}>
            <MyShiftsPage />
          </RequireRole>
        }
      />
      <Route
        path="/marketplace"
        element={
          <RequireRole roles={["STAFF"]}>
            <MarketplacePage />
          </RequireRole>
        }
      />
      <Route
        path="/availability"
        element={
          <RequireRole roles={["STAFF"]}>
            <AvailabilityPage />
          </RequireRole>
        }
      />

      <Route
        path="/admin"
        element={
          <RequireRole roles={["ADMIN"]}>
            <AdminOverviewPage />
          </RequireRole>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireRole roles={["ADMIN"]}>
            <UserManagementPage />
          </RequireRole>
        }
      />
      <Route
        path="/admin/setup"
        element={
          <RequireRole roles={["ADMIN"]}>
            <SetupPage />
          </RequireRole>
        }
      />
      <Route
        path="/audit-log"
        element={
          <RequireRole roles={["ADMIN", "MANAGER"]}>
            <AuditLogPage />
          </RequireRole>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
