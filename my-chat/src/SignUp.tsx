import { Navigate, Link } from "react-router"
import { useState, useId } from "react"
import "./SignUp.css"

export default function SignUp() {
    const [email, setEmail] = useState<string>('')
    const [password, setPassword] = useState<string>('')
    const [name, setName] = useState<string>('')
    const [lastName, setLastName] = useState<string>('')

    const[signedUp, setSignedUp] = useState<boolean>(false)

    const nameId = useId()
    const lastNameId = useId()
    const emailId = useId()
    const passwordId = useId()

    function signUp() {
        console.log("submitted form!")
        setSignedUp(true)
        localStorage.setItem("token", "2783")
    }

    function inputChange(e: React.ChangeEvent<HTMLInputElement>,setValue: React.Dispatch<React.SetStateAction<string>>) {
        if (e.target) {
            setValue(e.target.value)
        }
    }

    function keyPress(e:React.KeyboardEvent<HTMLInputElement>) {
        if (e.key==="Enter"){
            e.preventDefault()
            signUp()
        }
        
    }
    

    return (
        <form className="signup-login">
            <h1>Sign Up Form</h1>
            <div className="single-input">
            <label htmlFor={nameId}>First Name:</label>
            <input type="text" id={nameId} value={name} onChange={(e)=>inputChange(e, setName)}/>
            </div>
            <div className="single-input">
            <label htmlFor={lastNameId}>Last Name:</label>
            <input type="text" id={lastNameId}  value={lastName} onChange={(e)=>inputChange(e, setLastName)}/>
            </div>
            <div className="single-input">
            <label htmlFor={emailId}>Email:</label>
            <input type="email" id={emailId}  value={email} onChange={(e)=>inputChange(e, setEmail)}/>
            </div>
            <div className="single-input">
            <label htmlFor={passwordId}>Password:</label>
            <input type="password" id={passwordId}  value={password} onChange={(e)=>inputChange(e, setPassword)} onKeyDown={(e)=>keyPress(e)}/>
            </div>
            <button type="submit" onClick={signUp}>Sign Up</button>
            {signedUp && <Navigate to="/"/>}

        </form>

    )
}
