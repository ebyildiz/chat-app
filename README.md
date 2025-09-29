<div style="background-color:#ffb6c1; color:white; padding:20px; border-radius:10px;">

# MyCuteChat 💬

A small, friendly chat app I built to learn and ship something real.  
The stack: **Vite + React + TypeScript** on the front, **Express + Socket.IO** in the middle, **Postgres (Neon) via Prisma** for data, and **Firebase Auth** for sign-in.

🌸 Live app: [https://mycutechat.netlify.app](https://mycutechat.netlify.app)  
🌸 API server: [https://chat-app-brok.onrender.com](https://chat-app-brok.onrender.com)

---

## What it does

- Sign up / sign in with Firebase (ID tokens).  
- Rooms + direct messages (DMs). DMs use a deterministic room id for a pair of users.  
- Send/receive messages in real time with Socket.IO.  
- Sidebar updates instantly when you get a new message.  
- All `/api/*` routes require a valid Firebase ID token.  
- Messages + memberships live in Postgres; Prisma manages schema + queries.  

Core tables: `User`, `Room`, `Message`, `UserRoom`.

---

## Why I built it

I wanted a hands-on project to practice **full-stack fundamentals**:  
- Structuring a backend API and real-time layer.  
- Managing relational data with Prisma + Postgres.  
- Using Firebase Auth tokens across both frontend and backend.  
- Deploying a client (Netlify) + server (Render) that work together.

It’s simple, but it’s a real, working chat app.

</div>
