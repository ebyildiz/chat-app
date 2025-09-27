import { PrismaClient } from "@prisma/client";
import express from "express";
import serviceAccount from "./serviceAccount.json" with { type: "json" };
import { randomUUID } from "node:crypto";
import admin from "firebase-admin";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const PORT = 8000;
const app = express();
const prisma = new PrismaClient();

// ---- HTTP + Socket.IO ----
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "http://localhost:5173" } });

// Basic request logger (helps detect double POSTs)
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use(
    cors({
        origin: "http://localhost:5173",
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);
app.use(express.json());

// ---- Socket auth + room subscribe ----
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) return next(new Error("no_token"));
        const user = await admin.auth().verifyIdToken(token);
        socket.data.uid = user.uid;
        next();
    } catch {
        next(new Error("bad_token"));
    }
});

io.on("connection", (socket) => {
    const uid = socket.data.uid;
    console.log("socket connected", socket.id, "uid", uid);

    socket.join(`u:${uid}`); // 👈 join a personal room for this user

    socket.on("subscribe_room", async ({ roomId }) => {
        const member = await prisma.userRoom.findUnique({
            where: { userUid_roomId: { userUid: uid, roomId } },
        });
        if (!member) {
            socket.emit("room_error", { error: "not_a_member", roomId });
            return;
        }
        socket.join(roomId);
        console.log("subscribe", socket.id, "room", roomId);
    });

    socket.on("unsubscribe_room", ({ roomId }) => {
        socket.leave(roomId);
        console.log("unsubscribe", socket.id, "room", roomId);
    });

    socket.on("disconnect", (reason) => {
        console.log("socket disconnected", socket.id, reason);
    });
});





// ---- HTTP auth + bootstrap ----
async function requireAuth(req, res, next) {
    const m = (req.headers.authorization || "").match(/^Bearer (.+)$/);
    if (!m) return res.status(401).json({ error: "missing token" });
    try {
        req.user = await admin.auth().verifyIdToken(m[1]); // { uid, email, ... }
        next();
    } catch {
        res.status(401).json({ error: "invalid token" });
    }
}

async function ensureUser(req, res, next) {
    try {
        const uid = req.user.uid;

        // Read profile you wrote during signup (users/{uid})
        const snap = await admin.firestore().doc(`users/${uid}`).get();
        const profile = snap.exists ? snap.data() : null;

        const username = profile?.username || null;          // your chosen username
        const displayName =
            profile?.displayName ??
            req.user.name /* from ID token if present */ ??
            null;

        // If we have real values, upsert + update placeholders
        await prisma.user.upsert({
            where: { uid },
            create: {
                uid,
                username: username || `user_${uid.slice(0, 8)}`,
                displayName,
            },
            update:
                username || displayName
                    ? {
                        ...(username ? { username } : {}),
                        ...(displayName ? { displayName } : {}),
                    }
                    : {}, // nothing to update if we still don't have real values
        });

        next();
    } catch (e) {
        next(e);
    }
}


// ---- health ----
app.get("/health", (_req, res) => res.json({ ok: true }));

// Protect all /api routes + ensure user row exists
app.use("/api", requireAuth, ensureUser);

// ---- me ----
app.get("/api/me", (req, res) => {
    res.json({ uid: req.user.uid });
});

// Create room
app.post("/api/rooms", async (req, res, next) => {
    try {
        const uid = req.user.uid;
        const name = (req.body?.name ?? "").toString().trim() || "New Room";
        const id = "r_" + randomUUID();

        await prisma.$transaction(async (tx) => {
            await tx.room.create({ data: { id, name } });
            await tx.userRoom.upsert({
                where: { userUid_roomId: { userUid: uid, roomId: id } },
                update: {},
                create: { userUid: uid, roomId: id },
            });
        });

        res.status(201).json({ id, name });
    } catch (e) {
        next(e);
    }
});

// --- my rooms (sorted by latest) ---
// Shows DM rooms as the OTHER person's name for the current viewer
app.get("/api/me/rooms", async (req, res, next) => {
    try {
        const uid = req.user.uid;

        const rows = await prisma.userRoom.findMany({
            where: { userUid: uid },
            include: {
                room: { select: { id: true, name: true, lastMessageAt: true } },
            },
        });

        // Collect all "other" uids for DM rooms to fetch in one query
        const dmOthers = new Set();
        for (const r of rows) {
            const id = r.room.id;
            if (id.startsWith("dm__")) {
                const [a, b] = id.slice(4).split("__");
                const other = a === uid ? b : a;
                if (other) dmOthers.add(other);
            }
        }

        // Batch fetch profiles for those "other" users
        const profiles = dmOthers.size
            ? await prisma.user.findMany({
                where: { uid: { in: Array.from(dmOthers) } },
                select: { uid: true, displayName: true, username: true },
            })
            : [];
        const byUid = new Map(profiles.map(u => [u.uid, u]));

        // Build the final list with per-viewer names for DMs
        const rooms = rows.map(({ room }) => {
            if (room.id.startsWith("dm__")) {
                const [a, b] = room.id.slice(4).split("__");
                const other = a === uid ? b : a;
                const p = byUid.get(other);
                const name = p?.displayName || p?.username || "Direct Message";
                return { id: room.id, name, lastMessageAt: room.lastMessageAt };
            }
            // group rooms keep their saved name
            return room;
        }).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

        res.json(rooms);
    } catch (err) {
        next(err);
    }
});


// Messages in a room
app.get("/api/rooms/:id/messages", async (req, res, next) => {
    try {
        const uid = req.user.uid;
        const roomId = req.params.id;
        const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);

        const member = await prisma.userRoom.findUnique({
            where: { userUid_roomId: { userUid: uid, roomId } },
            select: { userUid: true },
        });
        if (!member) return res.status(403).json({ error: "not_a_member" });

        const room = await prisma.room.findUnique({
            where: { id: roomId },
            select: {
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: limit,
                    include: {
                        sender: { select: { uid: true, displayName: true, username: true } },
                    },
                },
            },
        });
        if (!room) return res.status(404).json({ error: "room_not_found" });

        res.json(room.messages.reverse()); // oldest → newest
    } catch (err) {
        next(err);
    }
});

// Send message (atomic)
app.post("/api/messages", async (req, res, next) => {
    try {
        const uid = req.user.uid;
        const { roomId, text } = req.body ?? {};
        if (typeof roomId !== "string" || !roomId.trim())
            return res.status(400).json({ error: "roomId required" });
        if (typeof text !== "string" || !text.trim())
            return res.status(400).json({ error: "text required" });
        if (text.length > 2000)
            return res.status(400).json({ error: "text_too_long" });

        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (!room) return res.status(404).json({ error: "room_not_found" });

        const now = new Date();
        const msg = await prisma.$transaction(async (tx) => {
            await tx.userRoom.upsert({
                where: { userUid_roomId: { userUid: uid, roomId } },
                update: {},
                create: { userUid: uid, roomId },
            });
            await tx.room.update({
                where: { id: roomId },
                data: { lastMessageAt: now },
            });
            return tx.message.create({
                data: { roomId, senderUid: uid, text: text.trim() },
                include: { sender: { select: { uid: true, displayName: true, username: true } } },
            });
        });

        console.log("emit new_message", msg.id, "to", roomId);
        io.to(roomId).emit("new_message", msg);  // emit ONCE, after write
        // 🔽 ADD THIS BLOCK (push sidebar refresh to every member)
        const members = await prisma.userRoom.findMany({
            where: { roomId: msg.roomId },
            select: { userUid: true },
        });
        for (const m of members) {
            io.to(`u:${m.userUid}`).emit("rooms_refresh");
        }
        return res.status(201).json(msg);        // respond ONCE
    } catch (e) {
        next(e);
    }
});

// Rename room (member-only)
app.patch("/api/rooms/:id/name", async (req, res, next) => {
    try {
        const roomId = req.params.id;
        const name = (req.body?.roomName ?? "").toString().trim();
        if (!name || name.length > 80)
            return res.status(400).json({ error: "room name must be 1–80 chars" });

        const member = await prisma.userRoom.findUnique({
            where: { userUid_roomId: { userUid: req.user.uid, roomId } },
            select: { userUid: true },
        });
        if (!member) return res.status(403).json({ error: "not_a_member" });

        const room = await prisma.room.update({
            where: { id: roomId },
            data: { name },
            select: { id: true, name: true, lastMessageAt: true },
        });
        res.json(room);
    } catch (e) {
        if (e?.code === "P2025")
            return res.status(404).json({ error: "room_not_found" });
        next(e);
    }
});

// Users search
app.get("/api/users/search", async (req, res, next) => {
    try {
        const q = (req.query.query ?? "").toString().trim();
        if (!q) return res.json([]);
        const rows = await prisma.user.findMany({
            where: {
                OR: [
                    { username: { contains: q, mode: "insensitive" } },
                    { displayName: { contains: q, mode: "insensitive" } },
                ],
            },
            take: 20,
            select: { uid: true, username: true, displayName: true },
        });
        res.json(rows.filter((u) => u.uid !== req.user.uid)); // hide self
    } catch (e) {
        next(e);
    }
});

// Create/ensure DM room
app.post("/api/rooms/dm", async (req, res, next) => {
    try {
        const me = req.user.uid;
        const other = (req.body?.otherUid ?? "").toString();
        if (!other || other === me) return res.status(400).json({ error: "bad_other" });

        const id = "dm__" + [me, other].sort().join("__"); // deterministic
        const now = new Date();

        const room = await prisma.$transaction(async (tx) => {
            await tx.user.upsert({
                where: { uid: other },
                update: {},
                create: { uid: other, username: `user_${other.slice(0, 8)}` },
            });

            await tx.room.upsert({
                where: { id },
                update: { lastMessageAt: now },
                create: { id, name: "Direct Message", lastMessageAt: now },
            });
            await tx.userRoom.upsert({
                where: { userUid_roomId: { userUid: me, roomId: id } },
                update: {},
                create: { userUid: me, roomId: id },
            });
            await tx.userRoom.upsert({
                where: { userUid_roomId: { userUid: other, roomId: id } },
                update: {},
                create: { userUid: other, roomId: id },
            });

            const otherUser = await tx.user.findUnique({
                where: { uid: other },
                select: { uid: true, username: true, displayName: true },
            });

            return { id, name: otherUser?.displayName || otherUser?.username || "Direct Message" };
        });

        // 🔽 ADD THESE TWO LINES (after DB write, before res.json)
        io.to(`u:${other}`).emit("rooms_refresh");
        io.to(`u:${me}`).emit("rooms_refresh");
        res.status(201).json(room);
    } catch (e) {
        next(e);
    }
});

// ---- error + shutdown ----
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "server_error" });
});

process.on("SIGINT", async () => {
    await prisma.$disconnect();
    process.exit(0);
});
process.on("SIGTERM", async () => {
    await prisma.$disconnect();
    process.exit(0);
});

httpServer.listen(PORT, () => console.log("server is running"));
