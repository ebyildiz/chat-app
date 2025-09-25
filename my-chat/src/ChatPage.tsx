import { useEffect, useRef, useState } from "react";
import { authFetch } from "./lib/authFetch";
import "./ChatPage.css";
import { auth } from "./lib/firebase";
import { io, Socket } from "socket.io-client";

type ChatPageProps = { roomId: string; roomName: string };

type MessageWire = {
  id: string; roomId: string; senderUid: string; text: string; createdAt: string;
  sender?: { uid: string; displayName: string | null; username: string };
};
type Message = Omit<MessageWire, "createdAt"> & { createdAt: Date };

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export default function ChatPage({ roomId, roomName }: ChatPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");

  const socketRef = useRef<Socket | null>(null);
  const me = auth.currentUser?.uid ?? null;

  function scrollToBottom() {
    requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  // Load latest messages
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch(`/api/rooms/${encodeURIComponent(roomId)}/messages?limit=50`);
        if (res.status === 403) { if (alive) setError("You’re not a member of this room."); return; }
        if (res.status === 404) { if (alive) setError("Room not found."); return; }
        if (!res.ok)          { if (alive) setError(`Error ${res.status}`); return; }

        const data = (await res.json()) as MessageWire[];
        if (!alive) return;
        setMessages(data.map(m => ({ ...m, createdAt: new Date(m.createdAt) })));
        scrollToBottom();
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load messages");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [roomId]);

  // Socket subscribe (StrictMode-safe)
  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    (async () => {
      const token = await auth.currentUser?.getIdToken();
      if (!token || cancelled) return;

      socket = io(API_URL, { auth: { token }, transports: ["websocket"] });
      socketRef.current = socket;

      const onNew = (msg: MessageWire) => {
        if (cancelled) return;
        setMessages(prev => {
          // de-dupe by id (prevents double when POST and socket race)
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, { ...msg, createdAt: new Date(msg.createdAt) }];
        });
        scrollToBottom();
      };

      const onErr = (err: any) => {
        if (cancelled) return;
        console.error("socket error:", err?.message ?? err);
      };

      socket.on("new_message", onNew);
      socket.on("connect_error", onErr);
      socket.emit("subscribe_room", { roomId });
    })();

    return () => {
      cancelled = true;
      if (socket) {
        socket.emit("unsubscribe_room", { roomId });
        socket.removeAllListeners();
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [roomId]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    setError(null);
    try {
      const res = await authFetch(`/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, text }),
      });
      if (!res.ok) {
        if (res.status === 404) setError("Room not found.");
        else if (res.status === 403) setError("You’re not a member of this room.");
        else setError(`Send failed (HTTP ${res.status})`);
        return;
      }
      const msgWire = (await res.json()) as MessageWire;

      // 🔑 De-dupe here too in case the socket broadcast arrived first
      setMessages(prev => {
        if (prev.some(m => m.id === msgWire.id)) return prev;
        return [...prev, { ...msgWire, createdAt: new Date(msgWire.createdAt) }];
      });

      setDraft("");
      scrollToBottom();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setPosting(false);
      inputRef.current?.focus();
    }
  }

  // Enter to send, Shift+Enter newline
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  function displayName(m: Message, myUid?: string | null) {
    if (myUid && m.sender?.uid === myUid) return "You";
    return m.sender?.displayName || m.sender?.username || m.senderUid.slice(0, 6);
  }

  return (
    <section className="texts-page" style={{ display: "grid", gridTemplateRows: "auto 1fr auto", height: "100%" }}>
      <header style={{ padding: "8px 12px", borderBottom: "1px solid #eee" }}>
        <h1 style={{ margin: 0, fontSize: "1.1rem" }}>{roomName}</h1>
      </header>

      <div ref={scrollerRef} style={{ overflowY: "auto", padding: "12px" }}>
        {loading && messages.length === 0 && <p>Loading…</p>}
        {error && <p className="error-message">{error}</p>}

        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              <span>{displayName(m, me)}</span>{" · "}
              <time dateTime={m.createdAt.toISOString()}>
                {new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(m.createdAt)}
              </time>
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
          </div>
        ))}

        {!loading && messages.length === 0 && !error && <p>No messages yet.</p>}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); }}
        style={{ borderTop: "1px solid #eee", padding: 12, display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message…"
          disabled={posting}
          style={{ resize: "none", padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", outline: "none" }}
        />
        <button
          className="send-button"
          type="button"
          onClick={() => void sendMessage()}
          disabled={posting || draft.trim().length === 0}
        >
          {posting ? "Sending…" : "Send"}
        </button>
      </form>
    </section>
  );
}
