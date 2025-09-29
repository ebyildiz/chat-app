# MyCuteChat

![theme](https://img.shields.io/badge/theme-pink-ff4da6?logoColor=white&labelColor=1a1a1a)
![stack](https://img.shields.io/badge/stack-React%20·%20Express%20·%20Postgres%20·%20Socket.IO-ff4da6?labelColor=1a1a1a&color=ff4da6)
![auth](https://img.shields.io/badge/auth-Firebase-ff4da6?labelColor=1a1a1a)

A small, friendly chat app I built to learn full-stack fundamentals and show real, working code:
- **Frontend:** Vite + React + TypeScript (cute, pink UI)
- **Backend:** Node/Express + Socket.IO
- **Auth:** Firebase (ID tokens)
- **DB:** Postgres (Neon) via Prisma

**Live app:** https://mycutechat.netlify.app  
**API:** https://chat-app-brok.onrender.com

---

## What this does (at a glance)

- Sign up / sign in with Firebase.  
- Create rooms and send messages in realtime (Socket.IO).  
- Direct messages use a deterministic room id for a pair of users.  
- Server protects every `/api/*` call by verifying the Firebase ID token.  
- Messages are stored in Postgres; Prisma handles schema + queries.  
- CORS and sockets are locked to the frontend origin.

---

## How it works (short version)

1. The browser signs in with Firebase and gets an **ID token**.  
2. Every request to `/api/*` sends `Authorization: Bearer <token>`.  
3. Express verifies the token with **Firebase Admin** and ensures a `User` row exists in Postgres.  
4. Sending a message writes a `Message` row and updates `Room.lastMessageAt`, then Socket.IO emits `new_message` to that room (and a `rooms_refresh` to members so sidebars update).  

**Core tables:** `User`, `Room`, `Message`, `UserRoom` (membership).

---

## Local dev (quick start)

```bash
# Frontend
npm i
cp .env.example .env  # fill in your VITE_* Firebase + API URL
npm run dev
