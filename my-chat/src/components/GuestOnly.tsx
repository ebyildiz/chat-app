// GuestOnly.tsx
import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { auth } from "../lib/firebase";

export default function GuestOnly() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHydrated(true), 300); 
    return () => clearTimeout(t);
  }, []);
  if (!hydrated) return null;
  return auth.currentUser ? <Navigate to="/" replace /> : <Outlet />;
}
