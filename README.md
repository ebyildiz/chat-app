<!-- Pink wrapper (note: GitHub won't let us change the whole page bg, but this keeps the theme) -->
<div style="background:#ff4da6;color:#ffffff;padding:24px 24px 12px;border-radius:14px">

<!-- Hero -->
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="120">
  <rect width="100%" height="100%" fill="#ff4da6"/>
  <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
        font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-size="38" fill="#fff" font-weight="700">MyCuteChat</text>
  <text x="50%" y="82%" dominant-baseline="middle" text-anchor="middle"
        font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-size="14" fill="#fff" opacity="0.9">React + Express + Postgres + Socket.IO · Firebase Auth</text>
</svg>

<br />

<p>
  <a href="https://img.shields.io/badge/theme-pink-ff4da6?labelColor=1a1a1a"><img alt="theme" src="https://img.shields.io/badge/theme-pink-ff4da6?labelColor=1a1a1a"></a>
  <a href="https://img.shields.io/badge/stack-React·Express·Postgres·Socket.IO-ff4da6?labelColor=1a1a1a"><img alt="stack" src="https://img.shields.io/badge/stack-React·Express·Postgres·Socket.IO-ff4da6?labelColor=1a1a1a"></a>
  <a href="https://img.shields.io/badge/auth-Firebase-ff4da6?labelColor=1a1a1a"><img alt="auth" src="https://img.shields.io/badge/auth-Firebase-ff4da6?labelColor=1a1a1a"></a>
</p>

A small, friendly chat app I built to learn full-stack fundamentals and ship something real:
**Vite + React + TypeScript** on the front, **Express + Socket.IO** in the middle, **Postgres (Neon) via Prisma** for data, and **Firebase Auth** for sign-in.

**Live:** https://mycutechat.netlify.app  
**API:** https://chat-app-brok.onrender.com

---

## What it does (quick)
- Sign up / sign in with Firebase (ID tokens).
- Rooms + direct messages (DMs). DMs use a deterministic room id for a pair of users.
- Send/receive messages in real time with Socket.IO.
- All `/api/*` routes require a valid Firebase ID token.
- Messages + memberships live in Postgres; Prisma manages the schema and queries.

**Core tables:** `User`, `Room`, `Message`, `UserRoom`.

---

## How it works (short)
1. Browser signs in with Firebase → gets an **ID token**.  
2. Every request to `/api/*` includes `Authorization: Bearer <token>`.  
3. Express verifies with **Firebase Admin** and ensures a `User` row exists.  
4. Posting a message inserts a `Message`, updates `Room.lastMessageAt`, then emits `new_message` to the room (and `rooms_refresh` to members so sidebars update).

---

## Local dev

### Frontend
```bash
npm i
cp .env.example .env
# Fill in VITE_* and API URL
npm run dev
