import React, { useContext, useState } from 'react'
import withAuth from '../utils/withAuth'
import { useNavigate } from 'react-router-dom'
import "../App.css";
import { Button, TextField } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import { AuthContext } from '../contexts/AuthContext';

function HomeComponent() {


    let navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState("");


    const {addToUserHistory} = useContext(AuthContext);
    let handleJoinVideoCall = async () => {

        if (!meetingCode.trim()) {
            return;
        }

        // Saving to history shouldn't be able to block the user from
        // actually joining the call -- if that request fails for any
        // reason, still navigate them into the meeting.
        try {
            await addToUserHistory(meetingCode)
        } catch (err) {
            console.error("Could not save to history:", err);
        }

        navigate(`/${meetingCode}`)
    }

    return (
        <div className="homePageContainer">

            <div className="navBar">

                <div className="navBrand">
                    <h2>Apna Video Call</h2>
                </div>

                <div className="navActions">
                    <button
                        className="navActionButton"
                        onClick={() => {
                            navigate("/history")
                        }}
                    >
                        <RestoreIcon fontSize="small" />
                        History
                    </button>

                    <Button
                        className="logoutButton"
                        onClick={() => {
                            localStorage.removeItem("token")
                            navigate("/auth")
                        }}
                    >
                        Logout
                    </Button>
                </div>


            </div>


            <div className="meetContainer">
                <div className="leftPanel">
                    <div>
                        <span className="eyebrow">Welcome back</span>
                        <h2>Providing Quality Video Call Just Like Quality Education</h2>
                        <p className="homeSubtext">
                            Enter a meeting code below to join an existing call, or share
                            your own code with others to bring them into one.
                        </p>

                        <div className="joinRow">

                            <TextField
                                onChange={e => setMeetingCode(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === "Enter") {
                                        handleJoinVideoCall();
                                    }
                                }}
                                id="outlined-basic"
                                label="Meeting Code"
                                variant="outlined"
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        color: "white",
                                        "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                                        "&:hover fieldset": { borderColor: "rgba(255,255,255,0.6)" },
                                        "&.Mui-focused fieldset": { borderColor: "#FF9839" },
                                    },
                                    "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.7)" },
                                    "& .MuiInputLabel-root.Mui-focused": { color: "#FF9839" },
                                }}
                            />
                            <Button
                                className="joinButton"
                                onClick={handleJoinVideoCall}
                                variant='contained'
                            >
                                Join
                            </Button>

                        </div>
                    </div>
                </div>
                <div className='rightPanel'>
                    <img src='/logo3.png' alt="Illustration of a person joining a video call" />
                </div>
            </div>
        </div>
    )
}


export default withAuth(HomeComponent)