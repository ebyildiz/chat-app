import React, { useState, useId, useRef } from "react"
import "./Login.css"
import { Navigate, Link } from "react-router-dom"
import { signInWithEmailAndPassword } from "firebase/auth"
import { auth } from './lib/firebase'
import { FirebaseError } from "firebase/app"
import { useNavigate } from "react-router-dom";
import Header from "./Header"



export default function Login() {

    const [loggedIn, setLoggedIn] = useState<boolean>(false)
    const [email, setEmail] = useState<string>('example@example.com');
    const [password, setPassword] = useState<string>('');
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);

    const [authError, setAuthError] = useState<string | null>(null)

    const inputEmailId: string = useId();
    const inputPasswordId: string = useId();

    const [loading, setLoading] = useState<boolean>(false);

    const navigate = useNavigate();

    if(auth.currentUser) {
        navigate("/",  { replace: true })
    }

    const AUTH_ERROR_MESSAGES: Record<string, string> = {
        "auth/invalid-email": "That email looks invalid.",
        "auth/user-not-found": "No account for that email.",
        "auth/wrong-password": "Wrong password. Try again or reset it.",
        "auth/too-many-requests": "Too many attempts. Please wait a minute.",
        "auth/network-request-failed": "Network error. Check your connection.",
        "auth/invalid-credential": "Email or password is incorrect.",
        "auth/invalid-login-credentials": "Email or password is incorrect.",
        "auth/popup-blocked": "Allow popups and try again.",
        "auth/popup-closed-by-user": "Allow popups and try again.",
    };

    function onChange(event: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>): void {
        if (event.target instanceof HTMLInputElement) {
            setter(event.target.value)
        }

        console.log("onchange runs")
    }

    function keyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
        if (event.key === "Enter") {
            event.preventDefault()
            if (emailRef) {
                emailRef.current?.blur()
            }
            if (passwordRef) {
                passwordRef.current?.blur()
                signIn(event)
            }
        }
    }

    async function signIn(e: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.KeyboardEvent<HTMLInputElement>): Promise<void> {
        e.preventDefault()
        setLoading(true)
        try {
            if(password.length<6) {
                setAuthError("Please enter a valid password")
                return
            }
            await signInWithEmailAndPassword(auth, email, password)
            console.log("signed in!")
            setLoggedIn(true)
        } catch (error) {
            if (error instanceof FirebaseError) {
                const msg = AUTH_ERROR_MESSAGES[error.code] ?? "Unknown error, please try again";
                setAuthError(msg);
            }
            else {
                setAuthError("unknown error, please try again")
            }
        } finally {
            setLoading(false)
        }

    }


    return (
        <>
        <Header/>
        <section className="login">
            <h1>Login Page</h1>
            <form method="POST" className="signup-login">
                <div className="inputs">
                    <div className="single-input">
                        <label htmlFor={inputEmailId}>Email:</label>
                        <input type="email" value={email} id={inputEmailId} onChange={(event) => onChange(event, setEmail)} onKeyDown={keyDown} ref={emailRef} />
                    </div>
                    <div className="single-input">
                        <label htmlFor={inputPasswordId}>Password:</label>
                        <input type="password" id={inputPasswordId} value={password} onChange={(event) => onChange(event, setPassword)} onKeyDown={keyDown} ref={passwordRef} />
                    </div>

                </div>

                <button type="submit" disabled={loading} onClick={(e) => signIn(e)}>Sign In</button>
                {loading && <h1>loading...</h1>}
                {loggedIn && <Navigate to="/" />}
                {authError && <p className="error-message">{"error: " + authError}</p>}


            </form>
            <p>No Account? <Link to="/signup">Sign Up Now</Link> </p>



        </section>
        </>



    )
}