import { PrismaClient } from "@prisma/client";
import express from "express";
import serviceAccount from "./serviceAccount.json" with { type: "json" };
import { randomUUID } from "node:crypto";
import admin from "firebase-admin";
import cors from "cors";

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const PORT = 8000;
const app = express();
const prisma = new PrismaClient();

app.use(
  cors({
    origin: "http://localhost:5173",
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// --- auth + user bootstrap ---
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
    await prisma.user.upsert({
      where: { uid },
      update: {},
      create: {
        uid,
        username: `user_${uid.slice(0, 8)}`,
        displayName: null,
      },
    });
    next();
  } catch (e) {
    next(e);
  }
}

// --- health ---
app.get("/health", (_req, res) => res.json({ ok: true }));

// Protect all /api routes + ensure user row exists
app.use("/api", requireAuth, ensureUser);

// --- me ---
app.get("/api/me", (req, res) => {
  res.json({ uid: req.user.uid });
});

app.post("/api/rooms", async (req, res, next) => {
    try {
      const uid = req.user.uid;
      const name = (req.body?.name ?? "").toString().trim() || "New Room";
      const id = "r_" + randomUUID(); // unique, opaque id
  
      // create room + membership
      await prisma.$transaction(async (tx) => {
        await tx.room.create({ data: { id, name } });
        await tx.userRoom.upsert({
          where: { userUid_roomId: { userUid: uid, roomId: id } },
          update: {},
          create: { userUid: uid, roomId: id },
        });
      });
  
      res.status(201).json({ id, name });
    } catch (e) { next(e); }
  });

// --- my rooms (sorted by latest) ---
app.get("/api/me/rooms", async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const rows = await prisma.userRoom.findMany({
      where: { userUid: uid },
      include: {
        room: { select: { id: true, name: true, lastMessageAt: true } },
      },
    });
    const rooms = rows
      .map((r) => r.room)
      .sort(
        (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
      );
    res.json(rooms);
  } catch (err) {
    next(err);
  }
});

// --- messages in a room (latest page) ---
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
              sender: { select: { uid: true, displayName: true, username: true } }
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

// --- send a message (atomic: room + membership + message) ---
app.post("/api/messages", async (req, res, next) => {
    try {
      const uid = req.user.uid;
      const { roomId, text } = req.body ?? {};
      if (typeof roomId !== "string" || !roomId.trim()) return res.status(400).json({ error: "roomId required" });
      if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "text required" });
  
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
  
      res.status(201).json(msg);
    } catch (e) { next(e); }
  });

// --- rename room (member-only) ---
app.patch("/api/rooms/:id/name", async (req, res, next) => {
  try {
    const roomId = req.params.id;
    const name = (req.body?.roomName ?? "").toString().trim();
    if (!name || name.length > 80)
      return res
        .status(400)
        .json({ error: "room name must be 1–80 chars" });

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

// GET /api/users/search?query=eli  -> [{uid, username, displayName}]
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
      // don’t show yourself
      res.json(rows.filter(u => u.uid !== req.user.uid));
    } catch (e) { next(e); }
  });
  
// POST /api/rooms/dm  { otherUid }
app.post("/api/rooms/dm", async (req, res, next) => {
    try {
      const me = req.user.uid;
      const other = (req.body?.otherUid ?? "").toString();
      if (!other || other === me) return res.status(400).json({ error: "bad_other" });
  
      const id = "dm__" + [me, other].sort().join("__"); // deterministic
  
      const now = new Date();
      const room = await prisma.$transaction(async (tx) => {
        // make sure both users exist (lazy bootstrap)
        await tx.user.upsert({
          where: { uid: other },
          update: {},
          create: { uid: other, username: `user_${other.slice(0,8)}` },
        });
  
        // room + memberships
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
  
        // return room + the other user’s display for naming
        const otherUser = await tx.user.findUnique({
          where: { uid: other },
          select: { uid: true, username: true, displayName: true },
        });
        return { id, name: otherUser?.displayName || otherUser?.username || "Direct Message" };
      });
  
      res.status(201).json(room); // { id, name }
    } catch (e) { next(e); }
  });
  

// --- error + shutdown ---
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

app.listen(PORT, () => console.log("server is running"));
