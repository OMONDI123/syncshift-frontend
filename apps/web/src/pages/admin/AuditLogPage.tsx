import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/authStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { useUiStore } from "@/store/uiStore";
import { EmptyState } from "@/components/common/EmptyState";
import { ShieldIcon, DocumentIcon } from "@/components/icons/Icon";
import { format } from "date-fns";
import { auditApi } from "@/lib/api";
import { mapAuditEntry } from "@/lib/mappers";
import type { AuditLogEntry } from "@/types";

export function AuditLogPage() {
  const user = useAuthStore((s) => s.currentUser)!;
  const locations = useScheduleStore((s) => s.locations);
  const staff = useScheduleStore((s) => s.staff);
  const showToast = useUiStore((s) => s.showToast);

  const isAdmin = user.role === "ADMIN";
  const visibleLocationIds = isAdmin ? locations.map((l) => l.id) : user.managedLocationIds;

  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    auditApi
      .search({ locationId: locationFilter !== "all" ? Number(locationFilter) : undefined, size: 200 })
      .then((page) => {
        if (!cancelled) setEntries(page.content.map(mapAuditEntry));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locationFilter]);

  function actorName(id: string) {
    return staff.find((u) => u.id === id)?.name ?? id;
  }

  async function handleExport() {
    try {
      const blob = await auditApi.exportCsv({ locationId: locationFilter !== "all" ? Number(locationFilter) : undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "shiftsync-audit-log.csv";
      a.click();
      URL.revokeObjectURL(url);
      showToast("success", "Audit log exported.");
    } catch {
      showToast("error", "Couldn't export the audit log.");
    }
  }

  return (
    <AppShell title="Audit log" subtitle="Every schedule change and access attempt, who made it, and what changed">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="rounded-card border border-ink-900/15 px-3 py-2 text-sm"
        >
          <option value="all">All locations</option>
          {locations
            .filter((l) => visibleLocationIds.includes(l.id))
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
        </select>
        {isAdmin && (
          <button className="btn-secondary" onClick={handleExport}>
            Export CSV
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : entries.length === 0 ? (
        <EmptyState title="No activity yet" body="Schedule changes will be recorded here as they happen." />
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper-100 text-xs font-semibold uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Who</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const isSecurity = e.entity === "security";
                return (
                  <tr key={e.id} className={`border-t border-ink-900/5 ${isSecurity ? "bg-signal-redBg/30" : ""}`}>
                    <td className="px-4 py-3 tabular-nums text-ink-600">{format(new Date(e.atUtc), "MMM d, h:mm a")}</td>
                    <td className="px-4 py-3 font-medium text-ink-900">{actorName(e.actorUserId)}</td>
                    <td className={`flex items-center gap-1.5 px-4 py-3 ${isSecurity ? "text-signal-red" : "text-ink-600"}`}>
                      {isSecurity ? <ShieldIcon size={13} /> : <DocumentIcon size={13} />}
                      {e.action.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-ink-400">
                      {e.entity} · {e.entityId.slice(0, 18)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
