import { BrowserRouter, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/LandingPage.jsx";
import Authentication from "./pages/authentication.jsx";
import VideoMeetComponent from "./pages/VideoMeet.jsx";
import HomeComponent from './pages/home';
import History from './pages/history';
import { AuthProvider } from "./contexts/AuthContext";

import "./App.css";

function App() {
    return (
        <BrowserRouter>

            <AuthProvider>

                <Routes>

                    <Route
                        path="/"
                        element={<LandingPage />}
                    />

                    <Route
                        path="/auth"
                        element={<Authentication />}
                    />
                    <Route
                        path="/home"
                        element={<HomeComponent />}
                    />

                    <Route
                        path="/history"
                        element={<History />}
                    />

                    <Route
                        path="/:url"
                        element={<VideoMeetComponent />}
                    />

                </Routes>

            </AuthProvider>

        </BrowserRouter>
    );
}

export default App;
