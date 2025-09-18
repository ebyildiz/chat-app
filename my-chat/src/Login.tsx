import React, { useState, useId, useRef } from "react"
import "./Login.css"
import { Navigate, Link } from "react-router"

export default function Login() {

    const [loggedIn, setLoggedIn] = useState<boolean>(false)
    const [email, setEmail] = useState<string>('example@example.com');
    const [password, setPassword] = useState<string>('');
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);

    const inputEmailId: string = useId();
    const inputPasswordId: string = useId();

    const [loading, setLoading] = useState<boolean>(false);

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

    function signIn(e: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.KeyboardEvent<HTMLInputElement>): void {
        e.preventDefault()
        setLoading(true)
        console.log("signed in!")
        localStorage.setItem("token", "123")
        setLoggedIn(true)
        setLoading(false)
    }


    return (
        <section className="login">
            <h1>Login Page</h1>
            <form method="POST">
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
                <p>No Account? <Link to="/signup">Sign Up Now</Link> </p>
                
            </form>



        </section>



    )
}