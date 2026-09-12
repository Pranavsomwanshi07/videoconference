import React, { useEffect, useRef, useState } from "react";
import styles from "../styles/whiteboard.module.css";

// A shared drawing surface for the call.
//
// Unlike the "host only can draw" pattern most video-call clones copy,
// this has no host check anywhere -- any participant whose socket is in
// the room can draw, and every stroke is broadcast to everyone else in
// real time, so two (or more) people can literally draw on the same
// board at the same moment, same as a real shared whiteboard.

const COLORS = ["#1a1a2e", "#ff4d4f", "#2f80ed", "#27ae60", "#f2c94c", "#ffffff"];
const SIZES = [3, 6, 10];

const Whiteboard = ({ socketRef, username }) => {

    const canvasRef = useRef(null);
    const wrapperRef = useRef(null);
    const isDrawingRef = useRef(false);
    const lastPointRef = useRef(null);
    const strokesRef = useRef([]); // everything drawn so far, for redraws on resize

    const [color, setColor] = useState(COLORS[0]);
    const [size, setSize] = useState(SIZES[1]);


    // --------------------------------------------------
    // Draw one normalized stroke segment onto the canvas
    // --------------------------------------------------

    const drawSegment = (stroke) => {

        const canvas = canvasRef.current;

        if (!canvas) {
            return;
        }

        const ctx = canvas.getContext("2d");

        const x0 = stroke.x0 * canvas.width;
        const y0 = stroke.y0 * canvas.height;
        const x1 = stroke.x1 * canvas.width;
        const y1 = stroke.y1 * canvas.height;

        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
    };


    const redrawAll = () => {

        const canvas = canvasRef.current;

        if (!canvas) {
            return;
        }

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        strokesRef.current.forEach(drawSegment);
    };


    // --------------------------------------------------
    // Size the canvas to its wrapper, and keep it sized on resize
    // --------------------------------------------------

    useEffect(() => {

        const resizeCanvas = () => {

            const canvas = canvasRef.current;
            const wrapper = wrapperRef.current;

            if (!canvas || !wrapper) {
                return;
            }

            canvas.width = wrapper.clientWidth;
            canvas.height = wrapper.clientHeight;

            redrawAll();
        };

        resizeCanvas();

        window.addEventListener("resize", resizeCanvas);

        return () => window.removeEventListener("resize", resizeCanvas);

    }, []);


    // --------------------------------------------------
    // Socket wiring: pull existing board state, listen for live strokes
    // --------------------------------------------------

    useEffect(() => {

        const socket = socketRef.current;

        if (!socket) {
            return;
        }

        const handleState = (history) => {

            strokesRef.current = history || [];
            redrawAll();
        };

        const handleDraw = (stroke) => {

            strokesRef.current.push(stroke);
            drawSegment(stroke);
        };

        const handleClear = () => {

            strokesRef.current = [];
            redrawAll();
        };

        socket.on("whiteboard-state", handleState);
        socket.on("whiteboard-draw", handleDraw);
        socket.on("whiteboard-clear", handleClear);

        // Ask the server what's already on the board (other participants
        // may have been drawing before this user opened the whiteboard).
        socket.emit("get-whiteboard-state");

        return () => {
            socket.off("whiteboard-state", handleState);
            socket.off("whiteboard-draw", handleDraw);
            socket.off("whiteboard-clear", handleClear);
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // --------------------------------------------------
    // Pointer handlers (mouse, touch, and pen all fire pointer events)
    // --------------------------------------------------

    const getNormalizedPoint = (e) => {

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        return {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height
        };
    };

    const handlePointerDown = (e) => {

        isDrawingRef.current = true;
        lastPointRef.current = getNormalizedPoint(e);
    };

    const handlePointerMove = (e) => {

        if (!isDrawingRef.current) {
            return;
        }

        const point = getNormalizedPoint(e);
        const last = lastPointRef.current;

        const stroke = {
            x0: last.x,
            y0: last.y,
            x1: point.x,
            y1: point.y,
            color,
            size
        };

        // Draw immediately for the person drawing -- no need to wait on
        // the round trip to the server for their own strokes to appear.
        strokesRef.current.push(stroke);
        drawSegment(stroke);

        socketRef.current?.emit("whiteboard-draw", stroke);

        lastPointRef.current = point;
    };

    const stopDrawing = () => {
        isDrawingRef.current = false;
        lastPointRef.current = null;
    };

    const handleClearClick = () => {

        strokesRef.current = [];
        redrawAll();
        socketRef.current?.emit("whiteboard-clear");
    };


    return (
        <div className={styles.whiteboardStage}>

            <div className={styles.toolbar}>

                <div className={styles.colorSwatches}>
                    {COLORS.map((c) => (
                        <button
                            key={c}
                            type="button"
                            className={`${styles.swatch} ${color === c ? styles.swatchActive : ""}`}
                            style={{ background: c, boxShadow: c === "#ffffff" ? "inset 0 0 0 1px rgba(0,0,0,0.2)" : "none" }}
                            onClick={() => setColor(c)}
                            aria-label={`Color ${c}`}
                        />
                    ))}
                </div>

                <div className={styles.sizeButtons}>
                    {SIZES.map((s) => (
                        <button
                            key={s}
                            type="button"
                            className={`${styles.sizeButton} ${size === s ? styles.sizeButtonActive : ""}`}
                            onClick={() => setSize(s)}
                            aria-label={`Brush size ${s}`}
                        >
                            <span
                                className={styles.sizeDot}
                                style={{ width: s + 2, height: s + 2 }}
                            />
                        </button>
                    ))}
                </div>

                <div className={styles.clearButton}>
                    <button type="button" onClick={handleClearClick}>
                        Clear board
                    </button>
                </div>

            </div>

            <div className={styles.canvasWrapper} ref={wrapperRef}>
                <canvas
                    ref={canvasRef}
                    className={styles.canvas}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={stopDrawing}
                    onPointerLeave={stopDrawing}
                />
            </div>

            <span className={styles.collabHint}>
                Everyone in the call can draw here at the same time — not just the host
            </span>

        </div>
    );
};

export default Whiteboard;
