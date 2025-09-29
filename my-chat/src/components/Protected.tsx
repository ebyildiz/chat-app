import {Navigate, Outlet} from "react-router-dom"
import {auth} from "../lib/firebase"
import Header from "../Header.tsx"

export default function Protected() {
    return auth.currentUser ? <Outlet/> : <Navigate to="/login" />;
}