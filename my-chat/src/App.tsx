import './App.css'
import Login from "./Login"
import Home from "./Home"
import Protected from "./components/Protected"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import SignUp from "./SignUp"
import GuestOnly from "./components/GuestOnly"


function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
        </Route>
        <Route element={<Protected />}>
          <Route path="/" element={<Home />} />
        </Route>
      </Routes>

    </BrowserRouter>

  )
}

export default App
