import { useNavigate } from "react-router-dom"
import {signOut} from "firebase/auth"
import {auth} from "./lib/firebase"

export default function Home() {

    const navigate = useNavigate()

    const handleSignOut = async () => {
        try {
          await signOut(auth);
          console.log("User signed out successfully!");
          navigate("/login")
        } catch (error) {
          console.error("Error signing out:", error);
          // Handle the error appropriately
        }
      };

    return (
        <div>
            <h1>Home Page</h1>
            <button onClick={handleSignOut}>Sign Out</button>
        </div>
    )



}