import {Navigate, Outlet} from "react-router"

export default function Protected() {
    const token = localStorage.getItem("token"); // Or your auth state
    return token ? <Outlet /> : <Navigate to="/login" />;
}