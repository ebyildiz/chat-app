import {Navigate, Outlet} from "react-router-dom"
import {auth} from "../lib/firebase"

export default function Protected() {
    return auth.currentUser ? <Outlet/> : <Navigate to="/login" />;
}