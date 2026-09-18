import { useEffect, useState } from "react";
import { realtimeClient, type ConnectionState } from "@/lib/realtime";
import { CircleDotIcon } from "@/components/icons/Icon";

const COPY: Record<ConnectionState, { label: string; tone: string }> = {
  connected: { label: "Live", tone: "border-signal-green/30 bg-signal-greenBg text-signal-green" },
  connecting: { label: "Connecting…", tone: "border-signal-amber/30 bg-signal-amberBg text-signal-amber" },
  disconnected: { label: "Offline", tone: "border-ink-900/10 bg-paper-100 text-ink-400" },
};

export function ConnectionStatus() {
  const [state, setState] = useState<ConnectionState>(realtimeClient.connectionState);

  useEffect(() => realtimeClient.onConnectionChange(setState), []);

  const { label, tone } = COPY[state];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      <CircleDotIcon size={10} className={state === "connected" ? "animate-pulse" : ""} />
      {label}
    </span>
  );
}
