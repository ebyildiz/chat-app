import { useState } from "react"
import { Navigate } from "react-router"

export default function Home() {
    const [signOut, setSignOut] = useState<boolean>(false)

    return (
        <div>
            <h1>Home Page</h1>
            <button onClick={()=>{
                setSignOut(true)
                localStorage.removeItem("token")
            }}>Sign Out</button>
            {signOut  && <Navigate to="/login"/>}
        </div>
    )



}