import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

import {
    Badge,
    IconButton,
    TextField,
    Button
} from "@mui/material";

import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import CloseIcon from "@mui/icons-material/Close";
import BorderColorIcon from "@mui/icons-material/BorderColor";

import Whiteboard from "../components/Whiteboard.jsx";
import styles from "../styles/videoComponent.module.css";
import server from "../environment";

const server_url = server;

const connections = {};

const peerConfigConnections = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};

export default function VideoMeetComponent() {

    const socketRef = useRef(null);
    const socketIdRef = useRef(null);
    const localVideoref = useRef(null);

    const videoRef = useRef([]);
    const localStreamRef = useRef(null);

    const [videoAvailable, setVideoAvailable] = useState(true);
    const [audioAvailable, setAudioAvailable] = useState(true);

    // These are booleans, so don't initialize video with []
    const [video, setVideo] = useState(true);
    const [audio, setAudio] = useState(true);

    const [screen, setScreen] = useState(false);
    const [screenAvailable, setScreenAvailable] = useState(false);

    const [showModal, setModal] = useState(true);

    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [newMessages, setNewMessages] = useState(0);

    const [askForUsername, setAskForUsername] = useState(true);
    const [username, setUsername] = useState("");

    const [videos, setVideos] = useState([]);

    // --------------------------------------------------
    // LIVE REACTIONS (unique feature)
    // --------------------------------------------------
    // Floating emoji reactions, broadcast to everyone in the room.
    const [reactions, setReactions] = useState([]);
    const reactionIdRef = useRef(0);

    // --------------------------------------------------
    // MEETING INFO: participant count + live duration (unique feature)
    // --------------------------------------------------
    const [callStartTime, setCallStartTime] = useState(null);
    const [elapsedTime, setElapsedTime] = useState("00:00");

    // --------------------------------------------------
    // WHITEBOARD (unique feature)
    // --------------------------------------------------
    // Toggling this swaps the main stage from the video grid to a
    // shared canvas that every participant can draw on simultaneously.
    const [showWhiteboard, setShowWhiteboard] = useState(false);


    // --------------------------------------------------
    // GET PERMISSIONS
    // --------------------------------------------------

    const getPermissions = async () => {
        try {

            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            setVideoAvailable(true);
            setAudioAvailable(true);

            localStreamRef.current = stream;
            window.localStream = stream;

            if (localVideoref.current) {
                localVideoref.current.srcObject = stream;
            }

            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            } else {
                setScreenAvailable(false);
            }

            console.log("Camera and microphone permission granted");

        } catch (error) {

            console.error("Permission error:", error);

            // Try video separately
            try {
                await navigator.mediaDevices.getUserMedia({
                    video: true
                });

                setVideoAvailable(true);

            } catch (error) {
                setVideoAvailable(false);
            }

            // Try audio separately
            try {
                await navigator.mediaDevices.getUserMedia({
                    audio: true
                });

                setAudioAvailable(true);

            } catch (error) {
                setAudioAvailable(false);
            }

            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            }
        }
    };


    // Run only once
    useEffect(() => {
        console.log("VideoMeetComponent mounted");

        getPermissions();

        return () => {
            if (localStreamRef.current) {
                localStreamRef.current
                    .getTracks()
                    .forEach((track) => track.stop());
            }

            if (socketRef.current) {
                socketRef.current.disconnect();
            }

            Object.keys(connections).forEach((id) => {
                try {
                    connections[id].close();
                } catch (error) {
                    console.log(error);
                }

                delete connections[id];
            });
        };
    }, []);


    // --------------------------------------------------
    // GET USER MEDIA
    // --------------------------------------------------

    const getUserMediaSuccess = (stream) => {

        try {
            if (window.localStream) {
                window.localStream
                    .getTracks()
                    .forEach((track) => track.stop());
            }
        } catch (error) {
            console.log(error);
        }

        window.localStream = stream;
        localStreamRef.current = stream;

        if (localVideoref.current) {
            localVideoref.current.srcObject = stream;
        }

        Object.keys(connections).forEach((id) => {

            if (id === socketIdRef.current) {
                return;
            }

            try {
                connections[id].addStream(stream);

                connections[id]
                    .createOffer()
                    .then((description) => {

                        return connections[id].setLocalDescription(
                            description
                        );
                    })
                    .then(() => {

                        socketRef.current.emit(
                            "signal",
                            id,
                            JSON.stringify({
                                sdp: connections[id].localDescription
                            })
                        );

                    })
                    .catch((error) => {
                        console.log(error);
                    });

            } catch (error) {
                console.log(error);
            }
        });

        stream.getTracks().forEach((track) => {

            track.onended = () => {

                setVideo(false);
                setAudio(false);

                try {

                    if (localVideoref.current?.srcObject) {
                        localVideoref.current.srcObject
                            .getTracks()
                            .forEach((track) => track.stop());
                    }

                } catch (error) {
                    console.log(error);
                }

                const blackSilenceStream = new MediaStream([
                    black(),
                    silence()
                ]);

                window.localStream = blackSilenceStream;
                localStreamRef.current = blackSilenceStream;

                if (localVideoref.current) {
                    localVideoref.current.srcObject =
                        blackSilenceStream;
                }
            };
        });
    };


    const getUserMedia = () => {

        if (
            (video && videoAvailable) ||
            (audio && audioAvailable)
        ) {

            navigator.mediaDevices
                .getUserMedia({
                    video: video && videoAvailable,
                    audio: audio && audioAvailable
                })
                .then(getUserMediaSuccess)
                .catch((error) => {
                    console.log("getUserMedia error:", error);
                });

        } else {

            try {

                if (localVideoref.current?.srcObject) {
                    localVideoref.current.srcObject
                        .getTracks()
                        .forEach((track) => track.stop());
                }

            } catch (error) {
                console.log(error);
            }
        }
    };


    // --------------------------------------------------
    // START MEDIA + SOCKET
    // --------------------------------------------------

    const getMedia = () => {

        setVideo(videoAvailable);
        setAudio(audioAvailable);

        connectToSocketServer();
    };


    const connect = () => {

        if (!username.trim()) {
            alert("Please enter your username");
            return;
        }

        setAskForUsername(false);

        getMedia();
    };


    // --------------------------------------------------
    // SOCKET CONNECTION
    // --------------------------------------------------

    const connectToSocketServer = () => {

        socketRef.current = io.connect(server_url, {
            secure: false
        });

        socketRef.current.on( 
            "signal",
            gotMessageFromServer
        );

        socketRef.current.on("connect", () => {

            console.log(
                "Connected to socket:",
                socketRef.current.id
            );

            socketIdRef.current =
                socketRef.current.id;

            socketRef.current.emit(
                "join-call",
                window.location.href
            );

            // Mark when this participant's call actually started,
            // so the meeting info bar can show a live duration.
            setCallStartTime(Date.now());

            socketRef.current.on(
                "chat-message",
                addMessage
            );

            socketRef.current.on(
                "reaction",
                addReaction
            );

            socketRef.current.on(
                "user-left",
                (id) => {

                    setVideos((prevVideos) => {

                        const updatedVideos =
                            prevVideos.filter(
                                (video) =>
                                    video.socketId !== id
                            );

                        videoRef.current =
                            updatedVideos;

                        return updatedVideos;
                    });

                    if (connections[id]) {

                        try {
                            connections[id].close();
                        } catch (error) {
                            console.log(error);
                        }

                        delete connections[id];
                    }
                }
            );


            socketRef.current.on(
                "user-joined",
                (id, clients) => {

                    console.log(
                        "User joined:",
                        id,
                        clients
                    );

                    clients.forEach(
                        (socketListId) => {

                            if (
                                socketListId ===
                                socketIdRef.current
                            ) {
                                return;
                            }

                            connections[socketListId] =
                                new RTCPeerConnection(
                                    peerConfigConnections
                                );


                            // ICE candidate
                            connections[
                                socketListId
                            ].onicecandidate =
                                (event) => {

                                    if (
                                        event.candidate
                                    ) {

                                        socketRef.current.emit(
                                            "signal",
                                            socketListId,
                                            JSON.stringify({
                                                ice: event.candidate
                                            })
                                        );
                                    }
                                };


                            // Receive remote video
                            connections[
                                socketListId
                            ].onaddstream = (event) => {

                                console.log(
                                    "Remote stream received"
                                );

                                const videoExists =
                                    videoRef.current.find(
                                        (video) =>
                                            video.socketId ===
                                            socketListId
                                    );

                                if (videoExists) {

                                    setVideos(
                                        (prevVideos) => {

                                            const updatedVideos =
                                                prevVideos.map(
                                                    (video) =>
                                                        video.socketId ===
                                                        socketListId
                                                            ? {
                                                                ...video,
                                                                stream: event.stream
                                                            }
                                                            : video
                                                );

                                            videoRef.current =
                                                updatedVideos;

                                            return updatedVideos;
                                        }
                                    );

                                } else {

                                    const newVideo = {
                                        socketId:
                                            socketListId,
                                        stream:
                                            event.stream,
                                        autoplay: true,
                                        playsinline: true
                                    };

                                    setVideos(
                                        (prevVideos) => {

                                            const updatedVideos =
                                                [
                                                    ...prevVideos,
                                                    newVideo
                                                ];

                                            videoRef.current =
                                                updatedVideos;

                                            return updatedVideos;
                                        }
                                    );
                                }
                            };


                            // Add local stream
                            if (
                                window.localStream
                            ) {

                                try {

                                    connections[
                                        socketListId
                                    ].addStream(
                                        window.localStream
                                    );

                                } catch (error) {
                                    console.log(error);
                                }

                            } else {

                                const blackSilenceStream =
                                    new MediaStream([
                                        black(),
                                        silence()
                                    ]);

                                window.localStream =
                                    blackSilenceStream;

                                connections[
                                    socketListId
                                ].addStream(
                                    blackSilenceStream
                                );
                            }
                        }
                    );


                    // Create offer
                    if (
                        id === socketIdRef.current
                    ) {

                        Object.keys(
                            connections
                        ).forEach((id2) => {

                            if (
                                id2 ===
                                socketIdRef.current
                            ) {
                                return;
                            }

                            try {

                                connections[id2]
                                    .addStream(
                                        window.localStream
                                    );

                                connections[id2]
                                    .createOffer()
                                    .then(
                                        (description) => {

                                            return connections[
                                                id2
                                            ].setLocalDescription(
                                                description
                                            );
                                        }
                                    )
                                    .then(() => {

                                        socketRef.current.emit(
                                            "signal",
                                            id2,
                                            JSON.stringify({
                                                sdp: connections[
                                                    id2
                                                ].localDescription
                                            })
                                        );

                                    })
                                    .catch(
                                        (error) => {
                                            console.log(
                                                error
                                            );
                                        }
                                    );

                            } catch (error) {
                                console.log(error);
                            }
                        });
                    }
                }
            );
        });

        socketRef.current.on(
            "connect_error",
            (error) => {
                console.error(
                    "Socket connection error:",
                    error
                );
            }
        );
    };


    // --------------------------------------------------
    // RECEIVE SIGNAL
    // --------------------------------------------------

    const gotMessageFromServer = (
        fromId,
        message
    ) => {

        const signal = JSON.parse(message);

        if (fromId === socketIdRef.current) {
            return;
        }

        if (!connections[fromId]) {
            return;
        }

        if (signal.sdp) {

            connections[fromId]
                .setRemoteDescription(
                    new RTCSessionDescription(
                        signal.sdp
                    )
                )
                .then(() => {

                    if (
                        signal.sdp.type ===
                        "offer"
                    ) {

                        return connections[
                            fromId
                        ].createAnswer();
                    }

                })
                .then((description) => {

                    if (!description) {
                        return;
                    }

                    return connections[
                        fromId
                    ].setLocalDescription(
                        description
                    );

                })
                .then(() => {

                    if (
                        connections[fromId]
                            .localDescription
                    ) {

                        socketRef.current.emit(
                            "signal",
                            fromId,
                            JSON.stringify({
                                sdp: connections[
                                    fromId
                                ].localDescription
                            })
                        );
                    }

                })
                .catch((error) => {
                    console.log(
                        "SDP error:",
                        error
                    );
                });
        }

        if (signal.ice) {

            connections[fromId]
                .addIceCandidate(
                    new RTCIceCandidate(
                        signal.ice
                    )
                )
                .catch((error) => {
                    console.log(
                        "ICE error:",
                        error
                    );
                });
        }
    };


    // --------------------------------------------------
    // SCREEN SHARE
    // --------------------------------------------------

    const getDisplayMedia = () => {

        if (!screen) {
            return;
        }

        if (
            !navigator.mediaDevices
                .getDisplayMedia
        ) {
            return;
        }

        navigator.mediaDevices
            .getDisplayMedia({
                video: true,
                audio: true
            })
            .then(getDisplayMediaSuccess)
            .catch((error) => {
                console.log(
                    "Screen share error:",
                    error
                );

                setScreen(false);
            });
    };


    const getDisplayMediaSuccess = (
        stream
    ) => {

        try {

            if (window.localStream) {
                window.localStream
                    .getTracks()
                    .forEach((track) => track.stop());
            }

        } catch (error) {
            console.log(error);
        }

        window.localStream = stream;
        localStreamRef.current = stream;

        if (localVideoref.current) {
            localVideoref.current.srcObject =
                stream;
        }

        Object.keys(connections).forEach(
            (id) => {

                if (
                    id === socketIdRef.current
                ) {
                    return;
                }

                try {

                    connections[id].addStream(
                        stream
                    );

                    connections[id]
                        .createOffer()
                        .then((description) => {

                            return connections[
                                id
                            ].setLocalDescription(
                                description
                            );
                        })
                        .then(() => {

                            socketRef.current.emit(
                                "signal",
                                id,
                                JSON.stringify({
                                    sdp: connections[
                                        id
                                    ].localDescription
                                })
                            );

                        });

                } catch (error) {
                    console.log(error);
                }
            }
        );

        stream.getVideoTracks()[0].onended =
            () => {

                setScreen(false);
                getUserMedia();
            };
    };


    useEffect(() => {

        if (screen === true) {
            getDisplayMedia();
        }

    }, [screen]);


    // --------------------------------------------------
    // VIDEO / AUDIO CONTROLS
    // --------------------------------------------------

    const handleVideo = () => {
        setVideo((prev) => !prev);
    };

    const handleAudio = () => {
        setAudio((prev) => !prev);
    };


    useEffect(() => {

        if (!askForUsername) {
            getUserMedia();
        }

    }, [video, audio]);


    const handleScreen = () => {
        setScreen((prev) => !prev);
    };


    // --------------------------------------------------
    // END CALL
    // --------------------------------------------------

    const handleEndCall = () => {

        try {

            if (localVideoref.current?.srcObject) {

                localVideoref.current.srcObject
                    .getTracks()
                    .forEach((track) =>
                        track.stop()
                    );
            }

        } catch (error) {
            console.log(error);
        }

        if (socketRef.current) {
            socketRef.current.disconnect();
        }

        window.location.href = "/";
    };


    // --------------------------------------------------
    // CHAT
    // --------------------------------------------------

    const addMessage = (
        data,
        sender,
        socketIdSender
    ) => {

        setMessages((prevMessages) => [
            ...prevMessages,
            {
                sender: sender,
                data: data
            }
        ]);

        if (
            socketIdSender !==
            socketIdRef.current
        ) {

            setNewMessages(
                (prev) => prev + 1
            );
        }
    };


    const sendMessage = () => {

        if (!message.trim()) {
            return;
        }

        if (!socketRef.current) {
            return;
        }

        socketRef.current.emit(
            "chat-message",
            message,
            username
        );

        setMessage("");
    };


    // --------------------------------------------------
    // LIVE REACTIONS
    // --------------------------------------------------

    const addReaction = (emoji, sender) => {

        const id = reactionIdRef.current++;

        // Random horizontal position so reactions from
        // different people don't stack exactly on top of each other.
        const left = 10 + Math.random() * 70;

        setReactions((prev) => [
            ...prev,
            { id, emoji, sender, left }
        ]);

        // Remove this reaction after its float-up animation finishes.
        setTimeout(() => {
            setReactions((prev) =>
                prev.filter((r) => r.id !== id)
            );
        }, 2500);
    };


    const sendReaction = (emoji) => {

        if (!socketRef.current) {
            return;
        }

        socketRef.current.emit(
            "reaction",
            emoji,
            username
        );

        // Show it locally immediately instead of waiting on the round trip.
        addReaction(emoji, username);
    };


    // --------------------------------------------------
    // MEETING DURATION TIMER
    // --------------------------------------------------

    useEffect(() => {

        if (!callStartTime) {
            return;
        }

        const interval = setInterval(() => {

            const diff = Math.floor(
                (Date.now() - callStartTime) / 1000
            );

            const minutes = String(
                Math.floor(diff / 60)
            ).padStart(2, "0");

            const seconds = String(
                diff % 60
            ).padStart(2, "0");

            setElapsedTime(`${minutes}:${seconds}`);

        }, 1000);

        return () => clearInterval(interval);

    }, [callStartTime]);


    // --------------------------------------------------
    // BLACK VIDEO
    // --------------------------------------------------

    const black = ({
        width = 640,
        height = 480
    } = {}) => {

        const canvas =
            document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const context =
            canvas.getContext("2d");

        context.fillStyle = "black";
        context.fillRect(
            0,
            0,
            width,
            height
        );

        const stream =
            canvas.captureStream();

        return Object.assign(
            stream.getVideoTracks()[0],
            {
                enabled: false
            }
        );
    };


    // --------------------------------------------------
    // SILENT AUDIO
    // --------------------------------------------------

    const silence = () => {

        const ctx =
            new AudioContext();

        const oscillator =
            ctx.createOscillator();

        const destination =
            oscillator.connect(
                ctx.createMediaStreamDestination()
            );

        oscillator.start();

        ctx.resume();

        return Object.assign(
            destination.stream
                .getAudioTracks()[0],
            {
                enabled: false
            }
        );
    };


    // --------------------------------------------------
    // CONFERENCE STAGE GRID SIZING
    // --------------------------------------------------
    // Purely presentational: picks a sensible column/row count for the
    // main video grid based on how many remote participants are in the call.

    const getStageLayout = (count) => {

        if (count <= 1) {
            return { cols: 1, rows: 1 };
        }

        if (count === 2) {
            return { cols: 2, rows: 1 };
        }

        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);

        return { cols, rows };
    };


    // --------------------------------------------------
    // UI
    // --------------------------------------------------

    const stageLayout = getStageLayout(videos.length);

    return (
        <div>

            {askForUsername ? (

                <div>

                    <h2>
                        Enter into Lobby
                    </h2>

                    <TextField
                        id="outlined-basic"
                        label="Username"
                        value={username}
                        onChange={(e) =>
                            setUsername(
                                e.target.value
                            )
                        }
                        variant="outlined"
                    />

                    <Button
                        variant="contained"
                        onClick={connect}
                    >
                        Connect
                    </Button>

                    <div>

                        <video
                            ref={localVideoref}
                            autoPlay
                            muted
                            playsInline
                            style={{
                                width: "400px",
                                marginTop: "20px"
                            }}
                        />

                    </div>

                </div>

            ) : (

                <div
                    className={
                        styles.meetVideoContainer
                    }
                >

                    {/* MEETING INFO: live duration + participant count */}

                    <div className={styles.meetingInfoBar}>
                        <span className={styles.liveDot} />
                        {elapsedTime} &nbsp;•&nbsp; {videos.length + 1} in call
                    </div>

                    {/* FLOATING LIVE REACTIONS */}

                    <div className={styles.reactionsOverlay}>
                        {reactions.map((r) => (
                            <span
                                key={r.id}
                                className={styles.floatingReaction}
                                style={{ left: `${r.left}%` }}
                            >
                                {r.emoji}
                            </span>
                        ))}
                    </div>

                    {/* CHAT */}

                    {showModal && (

                        <div
                            className={
                                styles.chatRoom
                            }
                        >

                            <div
                                className={
                                    styles.chatContainer
                                }
                            >

                                <div className={styles.chatHeader}>
                                    <h1>
                                        Chat
                                    </h1>

                                    <IconButton
                                        size="small"
                                        onClick={() => setModal(false)}
                                        style={{ color: "white" }}
                                    >
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </div>

                                <div
                                    className={
                                        styles.chattingDisplay
                                    }
                                >

                                    {messages.length !==
                                    0 ? (

                                        messages.map(
                                            (
                                                item,
                                                index
                                            ) => (

                                                <div
                                                    className={styles.chatMessage}
                                                    key={
                                                        index
                                                    }
                                                >

                                                    <p
                                                        className={styles.chatMessageSender}
                                                    >
                                                        {
                                                            item.sender
                                                        }
                                                    </p>

                                                    <p className={styles.chatMessageText}>
                                                        {
                                                            item.data
                                                        }
                                                    </p>

                                                </div>
                                            )
                                        )

                                    ) : (

                                        <p className={styles.chatEmpty}>
                                            No Messages Yet
                                        </p>
                                    )}

                                </div>

                                <div
                                    className={
                                        styles.chattingArea
                                    }
                                >

                                    <TextField
                                        value={
                                            message
                                        }
                                        onChange={(
                                            e
                                        ) =>
                                            setMessage(
                                                e.target
                                                    .value
                                            )
                                        }
                                        label="Enter Your chat"
                                        variant="outlined"
                                    />

                                    <Button
                                        variant="contained"
                                        onClick={
                                            sendMessage
                                        }
                                    >
                                        Send
                                    </Button>

                                </div>

                            </div>

                        </div>
                    )}


                    {/* BUTTONS */}

                    <div
                        className={
                            styles.buttonContainers
                        }
                    >

                        <IconButton
                            onClick={
                                handleVideo
                            }
                            style={{
                                color: "white"
                            }}
                        >
                            {video ? (
                                <VideocamIcon />
                            ) : (
                                <VideocamOffIcon />
                            )}
                        </IconButton>


                        <IconButton
                            onClick={
                                handleEndCall
                            }
                            style={{
                                color: "red"
                            }}
                        >
                            <CallEndIcon />
                        </IconButton>


                        <IconButton
                            onClick={
                                handleAudio
                            }
                            style={{
                                color: "white"
                            }}
                        >
                            {audio ? (
                                <MicIcon />
                            ) : (
                                <MicOffIcon />
                            )}
                        </IconButton>


                        {screenAvailable && (

                            <IconButton
                                onClick={
                                    handleScreen
                                }
                                style={{
                                    color: "white"
                                }}
                            >
                                {screen ? (
                                    <StopScreenShareIcon />
                                ) : (
                                    <ScreenShareIcon />
                                )}
                            </IconButton>
                        )}


                        <Badge
                            badgeContent={
                                newMessages
                            }
                            max={999}
                            color="secondary"
                        >

                            <IconButton
                                onClick={() => {

                                    setModal(
                                        (prev) =>
                                            !prev
                                    );

                                    setNewMessages(
                                        0
                                    );
                                }}
                                style={{
                                    color: "white"
                                }}
                            >
                                <ChatIcon />
                            </IconButton>

                        </Badge>

                        <IconButton
                            onClick={() => setShowWhiteboard((prev) => !prev)}
                            style={{
                                color: showWhiteboard ? "#FF9839" : "white"
                            }}
                        >
                            <BorderColorIcon />
                        </IconButton>

                        <div className={styles.reactionBar}>
                            {["👍", "❤️", "😂", "👏", "🎉"].map(
                                (emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        className={styles.reactionButton}
                                        onClick={() =>
                                            sendReaction(emoji)
                                        }
                                    >
                                        {emoji}
                                    </button>
                                )
                            )}
                        </div>

                    </div>


                    {/* LOCAL VIDEO (picture-in-picture) */}

                    <div className={styles.localVideoWrapper}>
                        <video
                            className={
                                styles.meetUserVideo
                            }
                            ref={localVideoref}
                            autoPlay
                            muted
                            playsInline
                        />
                        <span className={styles.localVideoLabel}>You</span>
                    </div>


                    {/* MAIN STAGE: whiteboard when open, otherwise the video grid */}

                    {showWhiteboard ? (

                        <Whiteboard
                            socketRef={socketRef}
                            username={username}
                        />

                    ) : (

                        <div
                            className={
                                styles.conferenceView
                            }
                            style={{
                                gridTemplateColumns: `repeat(${stageLayout.cols}, 1fr)`,
                                gridTemplateRows: `repeat(${stageLayout.rows}, 1fr)`
                            }}
                        >

                            {videos.length === 0 && (
                                <div className={styles.emptyStage}>
                                    Waiting for others to join the call…
                                </div>
                            )}

                            {videos.map(
                                (video) => (

                                    <div
                                        className={styles.videoTile}
                                        key={
                                            video.socketId
                                        }
                                    >

                                        <video
                                            data-socket={
                                                video.socketId
                                            }
                                            ref={(ref) => {

                                                if (
                                                    ref &&
                                                    video.stream
                                                ) {

                                                    ref.srcObject =
                                                        video.stream;
                                                }

                                            }}
                                            autoPlay
                                            playsInline
                                        />

                                        <span className={styles.videoTileLabel}>Participant</span>

                                    </div>
                                )
                            )}

                        </div>
                    )}

                </div>
            )}

        </div>
    );
}
