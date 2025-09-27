import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { io, Socket } from "socket.io-client";
import { auth } from "./lib/firebase";
import { authFetch } from "./lib/authFetch";
import { useEffect, useState } from "react";
import ChatPage from "./ChatPage";
import NewChatModal from "./NewChatModal";
import "./Home.css";

type RoomWire = { id: string; name: string; lastMessageAt: string };
type Room = { id: string; name: string; lastMessageAt: Date };

export default function Home() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [roomId, setRoomId] = useState<string | null>(null);
    const [roomName, setRoomName] = useState<string | null>(null);
    const [showNew, setShowNew] = useState<boolean>(false);
    const user = auth.currentUser;

    const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

    if (user) {
    const uid = user.uid;
    console.log("Current user UID:", uid);
    } else {
    console.log("No user signed in.");
    }

    useEffect(() => {
        let cancelled = false;
        let socket: Socket | null = null;
      
        (async () => {
          const token = await auth.currentUser?.getIdToken();
          if (!token || cancelled) return;
      
          socket = io(API_URL, { auth: { token }, transports: ["websocket"] });
      
          const handler = () => { void getRooms(); }; // reuse your existing getRooms
          socket.on("rooms_refresh", handler);
        })();
      
        return () => {
          cancelled = true;
          if (socket) {
            socket.removeAllListeners("rooms_refresh");
            socket.disconnect();
          }
        };
      }, [auth.currentUser?.uid]);

      useEffect(() => {
        const onVis = () => {
          if (document.visibilityState === "visible") { void getRooms(); }
        };
        document.addEventListener("visibilitychange", onVis);
        return () => document.removeEventListener("visibilitychange", onVis);
      }, []);
      
      


    async function getRooms() {
        try {
            const res = await authFetch("/api/me/rooms");
            if (!res.ok) {
                console.error("rooms error:", res.status);
                return;
            }
            const data = (await res.json()) as RoomWire[];
            const mapped: Room[] = data.map(r => ({
                ...r,
                lastMessageAt: new Date(r.lastMessageAt),
            }));
            setRooms(mapped);
            // auto-select first room if none selected
            if (!roomId && mapped.length) {
                setRoomId(mapped[0].id);
                setRoomName(mapped[0].name);
            }
        } catch (e) {
            console.error(e);
        }
    }

    // create (or open existing) DM and select it
    async function handleSelectUser(u: { uid: string; username: string; displayName: string | null }) {
        const r = await authFetch("/api/rooms/dm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ otherUid: u.uid }),
        });
        if (!r.ok) return;
        const room = (await r.json()) as { id: string; name: string };
        setRooms((prev) => {
            const exists = prev.find((x) => x.id === room.id);
            return exists ? prev : [{ id: room.id, name: room.name, lastMessageAt: new Date() }, ...prev];
        });
        setRoomId(room.id);
        setRoomName(room.name);
        setShowNew(false);
    }

    useEffect(() => { void getRooms(); }, []);

    const navigate = useNavigate();
    async function handleSignOut() {
        try {
            await signOut(auth);
            navigate("/login");
        } catch (error) {
            console.error("Error signing out:", error);
        }
    }

    return (
        <div>
            <div className="home-header">
                <h1>Home Page</h1>
                <button onClick={handleSignOut}>Sign Out</button>
            </div>
            <section className="chat-container">
                <aside className="chat-side-bar">
                    {rooms.length === 0 && <p>No rooms yet.</p>}
                    {rooms.map(r => (
                        <h3
                            key={r.id}
                            onClick={() => { setRoomId(r.id); setRoomName(r.name); setShowNew(false)}}
                            style={{ cursor: "pointer", fontWeight: r.id === roomId ? 700 : 400 }}
                        >
                            {r.name}
                        </h3>
                    ))}
                    <button className="new-chat-button" onClick={() => setShowNew(true)}>+ New Chat</button>
                </aside>

                <NewChatModal
                    open={showNew}
                    onClose={() => setShowNew(false)}
                    onSelect={handleSelectUser} />

                <main className="chat-main">
                    {showNew? null : (roomId && roomName ? (
                        <ChatPage roomId={roomId} roomName={roomName} myUid={user?.uid ?? "other"}/>
                    ) : (
                        <p style={{ padding: 16 }}>Pick a room to start chatting.</p>
                    ))}
                </main>
            </section>
        </div>
    );
}
