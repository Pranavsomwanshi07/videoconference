import React, { useContext, useEffect, useState } from 'react'
import { AuthContext } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom';
import "../App.css";
import Card from '@mui/material/Card';
import Box from '@mui/material/Box';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import HomeIcon from '@mui/icons-material/Home';

import { IconButton } from '@mui/material';
export default function History() {


    const { getHistoryOfUser } = useContext(AuthContext);

    const [meetings, setMeetings] = useState([])


    const routeTo = useNavigate();

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const history = await getHistoryOfUser();
                setMeetings(history);
            } catch {
                // IMPLEMENT SNACKBAR
            }
        }

        fetchHistory();
    }, [])

    let formatDate = (dateString) => {

        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0")
        const year = date.getFullYear();

        return `${day}/${month}/${year}`

    }

    return (
        <div className="historyContainer">

            <div className="historyHeader">
                <IconButton onClick={() => {
                    routeTo("/home")
                }} style={{ color: "white" }}>
                    <HomeIcon />
                </IconButton >
                <h2>Meeting History</h2>
            </div>

            <div className="historyList">
                {
                    (meetings.length !== 0) ? meetings.map((e, i) => (

                        <Card key={i} variant="outlined" className="historyCard">

                            <CardContent>
                                <Typography sx={{ fontSize: 16, fontWeight: 600 }} gutterBottom>
                                    Code: {e.meetingCode}
                                </Typography>

                                <Typography sx={{ mb: 1.5 }} color="text.secondary">
                                    Date: {formatDate(e.date)}
                                </Typography>

                            </CardContent>

                        </Card>

                    )) : <p className="historyEmpty">No meeting history yet — join a call and it'll show up here.</p>

                }
            </div>

        </div>
    )
}