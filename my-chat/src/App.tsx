import React from "react"
import './App.css'
import Login from "./Login"
import Home from "./Home"
import Protected from "./components/Protected"
import { BrowserRouter, Routes, Route } from "react-router"
import SignUp from "./SignUp"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp/>}/>
        <Route element={<Protected />}>
          <Route path="/" element={<Home />} />
        </Route>
      </Routes>

    </BrowserRouter>

  )
}

export default App
