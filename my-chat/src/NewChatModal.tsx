import { useEffect, useRef, useState } from "react";
import { authFetch } from "./lib/authFetch";

type UserLite = { uid: string; username: string; displayName: string | null };

type Props = {
    open: boolean;
    onClose: () => void;
    onSelect: (user: UserLite) => void; // parent will start the DM
};

export default function NewChatModal({ open, onClose, onSelect }: Props) {
    const [q, setQ] = useState("");
    const [results, setResults] = useState<UserLite[]>([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // close on Esc
    useEffect(() => {
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // focus input when opened
    useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 0); }, [open]);

    // search (debounced)
    useEffect(() => {
        if (!open) return;
        const t = setTimeout(async () => {
            const term = q.trim();
            if (!term) { setResults([]); return; }
            setLoading(true);
            try {
                const r = await authFetch(`/api/users/search?query=${encodeURIComponent(term)}`);
                if (r.ok) setResults(await r.json());
            } finally { setLoading(false); }
        }, 250);
        return () => clearTimeout(t);
    }, [q, open]);

    if (!open) return null;

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                <h3>Who do you want to message?</h3>
                <input
                    ref={inputRef}
                    placeholder="Search username or name…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                {loading && <p>Searching…</p>}
                {!loading && q && results.length === 0 && <p>No users found.</p>}
                <ul className="search-username-results">
                    {results.map((u) => (
                        <li style={{ listStyleType: "none", margin:"30px", marginLeft:"-10px"}}>
                            <button
                                key={u.uid}
                                className="user-item"
                                onClick={() => onSelect(u)}
                                type="button"
                            >
                                <strong>{u.displayName ?? u.username}</strong>
                                <div style={{ opacity: 0.6, fontSize: 12 }}>@{u.username}</div>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
