/**
 * Real-time transport: STOMP over SockJS, connecting to the backend's
 * `/ws` endpoint (see `ws/WebSocketConfig` on the backend). This replaces
 * the Phase 1 `MockRealtimeClient` in-memory pub/sub — the backend now
 * broadcasts every schedule/swap/notification/presence change itself, so
 * this client's only job is: connect with the same JWT used for REST
 * calls, subscribe to `/topic/...` destinations, and hand parsed JSON
 * payloads to whichever store asked for them.
 *
 * Topics (mirrors `ws/WebSocketConfig` exactly):
 *   /topic/locations/{id}/schedule   -> ShiftResponse | {weekPublished} | {deletedShiftId}
 *   /topic/locations/{id}/swaps      -> SwapResponse
 *   /topic/locations/{id}/presence   -> { type: "clock_in" | "clock_out", record: ClockRecordResponse }
 *   /topic/users/{id}/notifications  -> NotificationResponse
 *   /topic/shifts/{id}/conflict      -> { message: string }
 */
import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { getToken } from "@/lib/api";

export type ConnectionState = "connected" | "connecting" | "disconnected";

const WS_BASE: string =
  (import.meta.env.VITE_WS_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8080/api";

type Handler = (payload: unknown) => void;

class RealtimeClient {
  connectionState: ConnectionState = "disconnected";

  private client: Client | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private stompSubs = new Map<string, StompSubscription>();
  private stateListeners = new Set<(s: ConnectionState) => void>();

  connect() {
    const token = getToken();
    if (!token || this.client?.active) return;

    this.setState("connecting");
    const client = new Client({
      webSocketFactory: () => new SockJS(`${WS_BASE}/ws`) as unknown as WebSocket,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 4000,
      onConnect: () => {
        this.setState("connected");
        for (const topic of this.handlers.keys()) this.subscribeStomp(topic);
      },
      onWebSocketClose: () => this.setState("disconnected"),
      onStompError: () => this.setState("disconnected"),
      onDisconnect: () => this.setState("disconnected"),
    });
    client.activate();
    this.client = client;
  }

  disconnect() {
    this.stompSubs.forEach((sub) => sub.unsubscribe());
    this.stompSubs.clear();
    this.client?.deactivate();
    this.client = null;
    this.setState("disconnected");
  }

  /** Subscribe to a raw `/topic/...` destination. Returns an unsubscribe fn. */
  subscribe(topic: string, handler: Handler): () => void {
    const set = this.handlers.get(topic) ?? new Set<Handler>();
    set.add(handler);
    this.handlers.set(topic, set);
    if (this.client?.connected) this.subscribeStomp(topic);
    return () => {
      set.delete(handler);
      if (set.size === 0) {
        this.stompSubs.get(topic)?.unsubscribe();
        this.stompSubs.delete(topic);
        this.handlers.delete(topic);
      }
    };
  }

  onConnectionChange(cb: (s: ConnectionState) => void): () => void {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  private subscribeStomp(topic: string) {
    if (!this.client || this.stompSubs.has(topic)) return;
    const sub = this.client.subscribe(topic, (message: IMessage) => {
      let payload: unknown = message.body;
      try {
        payload = JSON.parse(message.body);
      } catch {
        // non-JSON body — hand it through as raw text
      }
      this.handlers.get(topic)?.forEach((h) => h(payload));
    });
    this.stompSubs.set(topic, sub);
  }

  private setState(state: ConnectionState) {
    this.connectionState = state;
    this.stateListeners.forEach((l) => l(state));
  }
}

export const realtimeClient = new RealtimeClient();
