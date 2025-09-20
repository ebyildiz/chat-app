import { Navigate } from "react-router-dom";
import { useState, useId } from "react";
import "./SignUp.css";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "./lib/firebase";
import { FirebaseError } from "firebase/app";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";

export default function SignUp() {
  // form state
  const [username, setUserName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [name, setName] = useState<string>("");

  // flow state
  const [signedUp, setSignedUp] = useState<boolean>(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // username validation / availability UI
  const [availability, setAvailability] = useState<
    "idle" | "checking" | "available" | "taken" | "error"
  >("idle");
  const [usernameErr, setUsernameErr] = useState<string | null>(null);

  // ids for labels
  const nameId = useId();
  const usernameId = useId();
  const emailId = useId();
  const passwordId = useId();

  // ---- config / helpers ----
  const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

  const AUTH_ERROR_MESSAGES: Record<string, string> = {
    "auth/email-already-in-use": "There’s already an account for this email. Try logging in.",
    "auth/weak-password": "Password must have at least 6 characters.",
    "auth/operation-not-allowed": "Email/password sign-up is disabled.",
    "auth/invalid-email": "That email looks invalid.",
    "auth/missing-password": "Please enter a password.",
    // fallback handled below
  };

  function validateUsername(input: string): string | null {
    const u = input.toLowerCase();
    if (u !== input) return "Use lowercase only";
    if (!USERNAME_RE.test(u)) return "3–20 chars: a–z, 0–9, _ only";
    return null; // valid
  }

  // ---- events ----
  async function usernameChange() {
    const key = username.trim().toLowerCase();

    // local validation first
    const localErr = validateUsername(key);
    if (localErr) {
      setUsernameErr(localErr);
      setAvailability("idle");
      return;
    } else {
      setUsernameErr(null);
    }

    // check Firestore
    setAvailability("checking");
    try {
      const ref = doc(db, "usernames", key);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setAvailability("taken");
      } else {
        setAvailability("available");
      }
    } catch (e) {
      setAvailability("error");
      if (e instanceof Error) setUsernameErr(e.message);
    }
  }

  function inputChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setValue: React.Dispatch<React.SetStateAction<string>>,
    opts?: { lowercase?: boolean }
  ) {
    if (!e.target) return;
    const v = opts?.lowercase ? e.target.value.toLowerCase() : e.target.value;
    setValue(v);
    if (setValue === setUserName) {
      // clear username errors while typing
      setUsernameErr(null);
      setAvailability("idle");
    }
    if (signupError) setSignupError(null);
  }

  async function signUp(
    e: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.KeyboardEvent<HTMLInputElement>
  ) {
    e.preventDefault();
    setLoading(true);
    try {
      // re-validate username (users can submit without blurring)
      const key = username.trim().toLowerCase();
      const localErr = validateUsername(key);
      if (localErr) {
        setUsernameErr(localErr);
        setLoading(false);
        return;
      }
      if (availability === "checking" || availability === "taken") {
        setSignupError(
          availability === "taken" ? "Username already taken" : "Checking username… please wait"
        );
        setLoading(false);
        return;
      }

      // create (or reuse) the auth user
      const user =
        auth.currentUser ??
        (await createUserWithEmailAndPassword(auth, email, password)).user;
      const uid = user.uid;

      const usernameRef = doc(db, "usernames", key);
      const userRef = doc(db, "users", uid);

      // atomic reservation + profile write
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(usernameRef);
        if (snap.exists()) throw new Error("USERNAME_TAKEN");
        tx.set(usernameRef, { uid });
        tx.set(
          userRef,
          {
            username, // original (as typed, already lowercased by input handler)
            usernameLower: key,
            displayName: name || null,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      if (name) await updateProfile(user, { displayName: name });

      setSignedUp(true);
    } catch (error) {
      if (error instanceof Error && error.message === "USERNAME_TAKEN") {
        setSignupError("Username already taken");
      } else if (error instanceof FirebaseError) {
        const msg = AUTH_ERROR_MESSAGES[error.code] ?? "Unknown error, please try again";
        setSignupError(msg);
      } else {
        setSignupError("Unknown error, please try again");
      }
    } finally {
      setLoading(false);
    }
  }

  function keyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void signUp(e);
    }
  }

  function UsernameHint() {
    const usernameStyle = {
        fontSize:"10px", marginTop:"-7px"
    }
    if (usernameErr) return <p style={usernameStyle}>{usernameErr}</p>;
    if (availability === "checking") return <p style={usernameStyle}>Checking…</p>;
    if (availability === "taken") return <p style={usernameStyle}>Username is already taken.</p>;
    if (availability === "available") return <p style={usernameStyle}>Looks good ✅</p>;
    return null;
  }

  const disableSubmit =
    loading ||
    !!usernameErr ||
    availability !== "available" ||
    !email ||
    !password ||
    !username;

  return (
    <section className="sign-up">
      <form className="signup-login" style={{ width: "500px" }}>
        <h2>Sign Up Form</h2>

        <div className="single-input">
          <label htmlFor={nameId}>First Name:</label>
          <input
            type="text"
            id={nameId}
            value={name}
            onChange={(e) => inputChange(e, setName)}
          />
        </div>

        <div className="single-input">
          <label htmlFor={usernameId}>Username:</label>
          <input
            type="text"
            id={usernameId}
            value={username}
            onChange={(e) => inputChange(e, setUserName, { lowercase: true })}
            onBlur={usernameChange}
            placeholder="e.g. milo_23"
          />
        </div>
        <UsernameHint />

        <div className="single-input">
          <label htmlFor={emailId}>Email:</label>
          <input
            type="email"
            id={emailId}
            value={email}
            onChange={(e) => inputChange(e, setEmail)}
          />
        </div>

        <div className="single-input">
          <label htmlFor={passwordId}>Password:</label>
          <input
            type="password"
            id={passwordId}
            value={password}
            onChange={(e) => inputChange(e, setPassword)}
            onKeyDown={keyPress}
          />
        </div>

        <button type="submit" onClick={signUp} disabled={disableSubmit}>
          {loading ? "Creating account…" : "Sign Up"}
        </button>

        {signedUp && <Navigate to="/" />}
        {signupError && <p className="error-message">{signupError}</p>}
      </form>
    </section>
  );
}
