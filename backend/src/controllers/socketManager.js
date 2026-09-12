import { Server } from "socket.io";

const connections = {};
const messages = {};
const timeline = {};
const whiteboardHistory = {};

// Shared helper: find which room a given socket currently belongs to.
// (Was duplicated three separate times across the chat/reaction/whiteboard
// handlers -- pulled out once so all of them stay in sync.)
const findRoomForSocket = (socketId) => {

    for (const [roomKey, users] of Object.entries(connections)) {

        if (users.includes(socketId)) {
            return roomKey;
        }
    }

    return null;
};

const connectToSocket = (server) => {
    // Socket.IO server
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["*"]
        }
    });

    // User connection
    io.on("connection", (socket) => {

        console.log("User connected:", socket.id);

        // ==========================================
        // JOIN CALL
        // ==========================================

        socket.on("join-call", (path) => {

            // Room doesn't exist, create it
            if (connections[path] === undefined) {
                connections[path] = [];
            }

            // Add user to room
            connections[path].push(socket.id);

            // Save user join time
            timeline[socket.id] = new Date();

            console.log(
                `${socket.id} joined room: ${path}`
            );

            // Inform all users in the room
            for (let a = 0; a < connections[path].length; a++) {

                io.to(connections[path][a]).emit(
                    "user-joined",
                    socket.id,
                    connections[path]
                );
            }

            // ==========================================
            // SEND OLD CHAT MESSAGES TO NEW USER
            // ==========================================

            if (messages[path] !== undefined) {

                for (let a = 0; a < messages[path].length; a++) {

                    io.to(socket.id).emit(
                        "chat-message",
                        messages[path][a].data,
                        messages[path][a].sender,
                        messages[path][a]["socket-id-sender"]
                    );
                }
            }
        });


        // ==========================================
        // WEBRTC SIGNAL
        // ==========================================

        socket.on("signal", (toId, message) => {

            io.to(toId).emit(
                "signal",
                socket.id,
                message
            );

        });


        // ==========================================
        // LIVE REACTION (emoji)
        // ==========================================
        // Lets a participant fire a quick emoji reaction (👍 ❤️ 😂 👏 🎉)
        // that gets broadcast to everyone currently in the same room,
        // without cluttering the persistent chat history.

        socket.on("reaction", (emoji, sender) => {

            const matchingRoom = findRoomForSocket(socket.id);

            if (matchingRoom !== null) {

                connections[matchingRoom].forEach((userId) => {

                    io.to(userId).emit(
                        "reaction",
                        emoji,
                        sender,
                        socket.id
                    );

                });
            }
        });


        // ==========================================
        // COLLABORATIVE WHITEBOARD
        // ==========================================
        // Unlike a typical "host-only" whiteboard, every participant in
        // the room can draw at the same time -- there is no host check
        // here at all, any connected socket can send strokes.
        //
        // Strokes are stored per-room (as normalized 0-1 coordinates, so
        // they replay correctly regardless of each participant's screen
        // size) so that anyone opening the whiteboard mid-call, or a user
        // who just joined the meeting, sees what's already been drawn.

        socket.on("whiteboard-draw", (stroke) => {

            const matchingRoom = findRoomForSocket(socket.id);

            if (matchingRoom === null) {
                return;
            }

            if (whiteboardHistory[matchingRoom] === undefined) {
                whiteboardHistory[matchingRoom] = [];
            }

            // Cap history so a very long call can't grow this unbounded.
            if (whiteboardHistory[matchingRoom].length > 8000) {
                whiteboardHistory[matchingRoom].shift();
            }

            whiteboardHistory[matchingRoom].push(stroke);

            connections[matchingRoom].forEach((userId) => {

                io.to(userId).emit(
                    "whiteboard-draw",
                    stroke,
                    socket.id
                );

            });
        });


        socket.on("whiteboard-clear", () => {

            const matchingRoom = findRoomForSocket(socket.id);

            if (matchingRoom === null) {
                return;
            }

            whiteboardHistory[matchingRoom] = [];

            connections[matchingRoom].forEach((userId) => {

                io.to(userId).emit(
                    "whiteboard-clear",
                    socket.id
                );

            });
        });


        socket.on("get-whiteboard-state", () => {

            const matchingRoom = findRoomForSocket(socket.id);

            io.to(socket.id).emit(
                "whiteboard-state",
                (matchingRoom !== null && whiteboardHistory[matchingRoom]) || []
            );
        });


        // ==========================================
        // CHAT MESSAGE
        // ==========================================

        socket.on("chat-message", (data, sender) => {

            const matchingRoom = findRoomForSocket(socket.id);


            // User found in a room
            if (matchingRoom !== null) {

                // Create message array if it doesn't exist
                if (messages[matchingRoom] === undefined) {
                    messages[matchingRoom] = [];
                }


                // Save message
                messages[matchingRoom].push({
                    sender: sender,
                    data: data,
                    "socket-id-sender": socket.id
                });


                console.log(
                    "Message:",
                    matchingRoom,
                    ":",
                    sender,
                    data
                );


                // Send message to all users in room
                connections[matchingRoom].forEach((userId) => {

                    io.to(userId).emit(
                        "chat-message",
                        data,
                        sender,
                        socket.id
                    );

                });
            }
        });


        // ==========================================
        // DISCONNECT
        // ==========================================

        socket.on("disconnect", () => {

            console.log(
                "User disconnected:",
                socket.id
            );


            // Calculate how long user was online
            let diffTime = 0;

            if (timeline[socket.id]) {

                diffTime = Math.abs(
                    timeline[socket.id] - new Date()
                );
            }


            // Find user's room
            let matchingRoom = null;

            for (
                const [roomKey, users]
                of Object.entries(connections)
            ) {

                if (users.includes(socket.id)) {

                    matchingRoom = roomKey;
                    break;
                }
            }


            // User was not found in any room
            if (matchingRoom === null) {

                delete timeline[socket.id];

                return;
            }


            // ==========================================
            // INFORM OTHER USERS
            // ==========================================

            connections[matchingRoom].forEach((userId) => {

                if (userId !== socket.id) {

                    io.to(userId).emit(
                        "user-left",
                        socket.id
                    );
                }
            });


            // ==========================================
            // REMOVE USER FROM ROOM
            // ==========================================

            const index =
                connections[matchingRoom].indexOf(socket.id);


            if (index !== -1) {

                connections[matchingRoom].splice(
                    index,
                    1
                );
            }


            // ==========================================
            // DELETE EMPTY ROOM
            // ==========================================

            if (connections[matchingRoom].length === 0) {

                delete connections[matchingRoom];
                delete messages[matchingRoom];
                delete whiteboardHistory[matchingRoom];
            }


            // Remove timeline
            delete timeline[socket.id];


            console.log(
                "Online time:",
                diffTime,
                "milliseconds"
            );
        });

    });
};

export default connectToSocket;
