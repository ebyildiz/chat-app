import { auth } from "./firebase";

export async function authFetch(path: string, init: RequestInit = {}) {
  const token = await auth.currentUser!.getIdToken(); // user must be signed in
  return fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
}
