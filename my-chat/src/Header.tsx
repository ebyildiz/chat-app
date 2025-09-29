import "./Header.css"
import icon from "./images/icon.png"
import React from "react"
import {Link} from "react-router-dom"

export default function Header({children} : {children?:React.JSX.Element}) {
    return (
        <header className="main-header">
            <div>
                <img src={icon} />
                <Link to="/" style={{textDecoration:"none", marginLeft:"-10px"}}><h1>MyCuteChat</h1></Link>

            </div>
        {children ?? null}
        </header>
    )
}