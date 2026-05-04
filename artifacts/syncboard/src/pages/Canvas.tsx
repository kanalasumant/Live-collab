import { useEffect, useRef, useCallback, useState } from "react";
import { useLocation } from "wouter";
import { useSocket } from "@/context/SocketContext";
import { useApp, type SharedObject, type PathPoint } from "@/context/AppContext";
import { generateId, showToast } from "@/utils/utils";
import Sidebar from "@/components/Sidebar/Sidebar";

const CANVAS_W = 1000;
const CANVAS_H = 600;
const CURSOR_COLORS = ["orange", "deeppink"];

function drawPath(ctx: CanvasRenderingContext2D, obj: SharedObject) {
  if (!obj.points || obj.points.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = obj.color ?? "#000";
  ctx.lineWidth = obj.lineWidth ?? 1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.moveTo(obj.points[0].x, obj.points[0].y);
  for (let i = 1; i < obj.points.length; i++) {
    ctx.lineTo(obj.points[i].x, obj.points[i].y);
  }
  ctx.stroke();
}

function drawText(ctx: CanvasRenderingContext2D, obj: SharedObject) {
  if (obj.x == null || obj.y == null) return;
  ctx.fillStyle = obj.color ?? "#000";
  ctx.font = `${obj.fontSize ?? 16}px Inter, sans-serif`;
  ctx.textBaseline = "top";
  const lines = (obj.text ?? "").split("\n");
  lines.forEach((line, i) => {
    ctx.fillText(line, obj.x!, obj.y! + i * ((obj.fontSize ?? 16) + 4));
  });
}

function getBoundingBox(obj: SharedObject): { x: number; y: number; w: number; h: number } {
  if (obj.type === "path" && obj.points && obj.points.length > 0) {
    const xs = obj.points.map((p) => p.x);
    const ys = obj.points.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x: x - 4, y: y - 4, w: Math.max(...xs) - x + 8, h: Math.max(...ys) - y + 8 };
  }
  if (obj.type === "text") {
    return { x: (obj.x ?? 0) - 4, y: (obj.y ?? 0) - 4, w: (obj.width ?? 120) + 8, h: (obj.height ?? 40) + 8 };
  }
  return { x: 0, y: 0, w: 0, h: 0 };
}

function redrawCanvas(ctx: CanvasRenderingContext2D, objects: Map<string, SharedObject>, skipId?: string) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  for (const [id, obj] of objects) {
    if (id === skipId) continue;
    if (obj.type === "path") drawPath(ctx, obj);
    else if (obj.type === "text") drawText(ctx, obj);
  }
}

export default function Canvas() {
  const { socket } = useSocket();
  const {
    userName, roomName,
    objects, upsertObject, removeObject, clearObjects,
    roomUsers, setRoomUsers,
    mode, setMode,
    tool,
    strokeColor, strokeWidth,
  } = useApp();
  const [, navigate] = useLocation();

  const ogCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const cursorRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const cursorPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const isDrawingRef = useRef(false);
  const currentPathIdRef = useRef<string | null>(null);
  const currentPointsRef = useRef<PathPoint[]>([]);

  const isDraggingTextRef = useRef(false);
  const textStartRef = useRef<{ x: number; y: number } | null>(null);

  const [activeTextBox, setActiveTextBox] = useState<{ id: string; x: number; y: number; w: number; h: number } | null>(null);
  const [textValue, setTextValue] = useState("");

  const [hoveredObjId, setHoveredObjId] = useState<string | null>(null);
  const [selectedObjId, setSelectedObjId] = useState<string | null>(null);
  const [lockedId, setLockedId] = useState<string | null>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isDraggingObjRef = useRef(false);
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const getCanvasPos = useCallback((e: MouseEvent | React.MouseEvent): { x: number; y: number } => {
    const canvas = ogCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  useEffect(() => {
    if (!roomName && !userName) navigate("/");
  }, [roomName, userName, navigate]);

  // ── socket events ──────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onPathUpdate = ({ id, data }: { id: string; data: SharedObject }) => upsertObject(id, data);
    const onTextUpdate = ({ id, data }: { id: string; data: SharedObject }) => upsertObject(id, data);
    const onObjectLocked = ({ id, lockedBy }: { id: string; lockedBy: string }) => {
      upsertObject(id, { ...(objects.get(id)!), isLock: true, lockedBy });
    };
    const onObjectUnlocked = ({ id }: { id: string }) => {
      const o = objects.get(id);
      if (o) upsertObject(id, { ...o, isLock: false, lockedBy: undefined });
    };
    const onObjectMoved = ({ id, data }: { id: string; data: SharedObject }) => upsertObject(id, data);
    const onObjectDeleted = ({ id }: { id: string }) => removeObject(id);
    const onBoardCleared = () => {
      clearObjects();
      setMode("draw");
      setSelectedObjId(null);
      setLockedId(null);
      setActiveTextBox(null);
    };
    const onUserJoined = ({ userName: name }: { userName: string }) => {
      setRoomUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));
      showToast(`${name} has entered the room`, "info");
      createCursorCanvas(name);
    };
    const onUserLeft = ({ userName: name }: { userName: string }) => {
      setRoomUsers((prev) => prev.filter((u) => u !== name));
      showToast(`${name} has left the room`, "info");
      removeCursorCanvas(name);
    };
    const onCursorUpdate = ({ userName: name, x, y }: { socketId: string; userName: string; x: number; y: number }) => {
      const cvs = cursorRefs.current.get(name);
      if (!cvs) return;
      const ctx = cvs.getContext("2d");
      if (!ctx) return;
      const idx = roomUsers.filter((u) => u !== userName).indexOf(name);
      const color = CURSOR_COLORS[idx] ?? "orange";
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.fillStyle = color;
      ctx.fillText(name, x + 8, y - 4);
    };

    socket.on("path_update", onPathUpdate);
    socket.on("text_update", onTextUpdate);
    socket.on("object_locked", onObjectLocked);
    socket.on("object_unlocked", onObjectUnlocked);
    socket.on("object_moved", onObjectMoved);
    socket.on("object_deleted", onObjectDeleted);
    socket.on("board_cleared", onBoardCleared);
    socket.on("user_joined", onUserJoined);
    socket.on("user_left", onUserLeft);
    socket.on("cursor_update", onCursorUpdate);

    return () => {
      socket.off("path_update", onPathUpdate);
      socket.off("text_update", onTextUpdate);
      socket.off("object_locked", onObjectLocked);
      socket.off("object_unlocked", onObjectUnlocked);
      socket.off("object_moved", onObjectMoved);
      socket.off("object_deleted", onObjectDeleted);
      socket.off("board_cleared", onBoardCleared);
      socket.off("user_joined", onUserJoined);
      socket.off("user_left", onUserLeft);
      socket.off("cursor_update", onCursorUpdate);
    };
  }, [socket, objects, upsertObject, removeObject, clearObjects, setMode, setRoomUsers, roomUsers, userName]);

  // ── cursor canvases ──────────────────────────────────────
  function createCursorCanvas(name: string) {
    if (!containerRef.current || cursorRefs.current.has(name)) return;
    const cvs = document.createElement("canvas");
    cvs.id = `cursor_${name}`;
    cvs.width = CANVAS_W;
    cvs.height = CANVAS_H;
    Object.assign(cvs.style, { position: "absolute", top: "0", left: "0", pointerEvents: "none", zIndex: "10" });
    containerRef.current.appendChild(cvs);
    cursorRefs.current.set(name, cvs);
  }

  function removeCursorCanvas(name: string) {
    const cvs = cursorRefs.current.get(name);
    if (cvs) { cvs.remove(); cursorRefs.current.delete(name); }
  }

  useEffect(() => {
    roomUsers.filter((u) => u !== userName).forEach(createCursorCanvas);
  }, [roomUsers, userName]);

  // ── redraw OG canvas ──────────────────────────────────────
  useEffect(() => {
    const canvas = ogCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    redrawCanvas(ctx, objects, selectedObjId ?? undefined);
  }, [objects, selectedObjId]);

  // ── temp highlight canvas ──────────────────────────────────
  useEffect(() => {
    const displayId = selectedObjId ?? hoveredObjId;
    if (!displayId) {
      if (tempCanvasRef.current) { tempCanvasRef.current.remove(); tempCanvasRef.current = null; }
      return;
    }
    if (!containerRef.current) return;

    if (!tempCanvasRef.current) {
      const cvs = document.createElement("canvas");
      cvs.width = CANVAS_W; cvs.height = CANVAS_H;
      Object.assign(cvs.style, { position: "absolute", top: "0", left: "0", zIndex: "5" });
      containerRef.current.appendChild(cvs);
      tempCanvasRef.current = cvs;
    }

    const cvs = tempCanvasRef.current;
    cvs.style.pointerEvents = selectedObjId ? "auto" : "none";

    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    const obj = objects.get(displayId);
    if (!obj) return;
    if (obj.type === "path") drawPath(ctx, obj);
    else drawText(ctx, obj);

    const bb = getBoundingBox(obj);
    ctx.save();
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 14;
    ctx.strokeRect(bb.x, bb.y, bb.w, bb.h);
    ctx.restore();
  }, [hoveredObjId, selectedObjId, objects]);

  // ── temp canvas drag listeners ─────────────────────────────
  useEffect(() => {
    const cvs = tempCanvasRef.current;
    if (!cvs || !selectedObjId) return;

    const onDown = (e: MouseEvent) => {
      const obj = objects.get(selectedObjId);
      if (!obj) return;
      const pos = getCanvasPos(e);
      const bb = getBoundingBox(obj);
      const insideBB = pos.x >= bb.x && pos.x <= bb.x + bb.w && pos.y >= bb.y && pos.y <= bb.y + bb.h;
      if (insideBB) {
        isDraggingObjRef.current = true;
        if (obj.type === "path" && obj.points) {
          const minX = Math.min(...obj.points.map((p) => p.x));
          const minY = Math.min(...obj.points.map((p) => p.y));
          dragOffsetRef.current = { dx: pos.x - minX, dy: pos.y - minY };
        } else {
          dragOffsetRef.current = { dx: pos.x - (obj.x ?? 0), dy: pos.y - (obj.y ?? 0) };
        }
      } else {
        // Click outside bounding box — deselect and unlock
        if (lockedId) {
          socket?.emit("unlock_object", { id: lockedId });
          const lockedObj = objects.get(lockedId);
          if (lockedObj) upsertObject(lockedId, { ...lockedObj, isLock: false, lockedBy: undefined });
        }
        setLockedId(null);
        setSelectedObjId(null);
      }
    };
    const onMove = (e: MouseEvent) => {
      if (!isDraggingObjRef.current) return;
      const obj = objects.get(selectedObjId);
      if (!obj) return;
      const pos = getCanvasPos(e);
      const updated = { ...obj };
      if (obj.type === "path" && obj.points) {
        const minX = Math.min(...obj.points.map((p) => p.x));
        const minY = Math.min(...obj.points.map((p) => p.y));
        const dx = pos.x - dragOffsetRef.current.dx - minX;
        const dy = pos.y - dragOffsetRef.current.dy - minY;
        updated.points = obj.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      } else if (obj.type === "text") {
        updated.x = pos.x - dragOffsetRef.current.dx;
        updated.y = pos.y - dragOffsetRef.current.dy;
      }
      upsertObject(selectedObjId, updated);
    };
    const onUp = () => {
      if (!isDraggingObjRef.current) return;
      isDraggingObjRef.current = false;
      const obj = objects.get(selectedObjId);
      if (!obj || !socket) return;
      const pos = obj.type === "path" && obj.points
        ? { x: Math.min(...obj.points.map((p) => p.x)), y: Math.min(...obj.points.map((p) => p.y)) }
        : { x: obj.x ?? 0, y: obj.y ?? 0 };
      socket.emit("move_object", { id: selectedObjId, x: pos.x, y: pos.y });
    };

    cvs.addEventListener("mousedown", onDown);
    cvs.addEventListener("mousemove", onMove);
    cvs.addEventListener("mouseup", onUp);
    return () => {
      cvs.removeEventListener("mousedown", onDown);
      cvs.removeEventListener("mousemove", onMove);
      cvs.removeEventListener("mouseup", onUp);
    };
  }, [selectedObjId, lockedId, objects, upsertObject, socket, getCanvasPos, setLockedId, setSelectedObjId]);

  // ── drawing events ─────────────────────────────────────────
  useEffect(() => {
    const canvas = ogCanvasRef.current;
    if (!canvas || mode !== "draw") return;

    const onDown = (e: MouseEvent) => {
      const pos = getCanvasPos(e);
      if (tool === "freehand") {
        isDrawingRef.current = true;
        const id = generateId();
        currentPathIdRef.current = id;
        currentPointsRef.current = [pos];
        const obj: SharedObject = { isDrawing: true, isLock: false, type: "path", points: [pos], color: strokeColor, lineWidth: strokeWidth };
        upsertObject(id, obj);
        socket?.emit("draw_start", { id, points: [pos], color: strokeColor, lineWidth: strokeWidth });
      } else if (tool === "text") {
        isDraggingTextRef.current = true;
        textStartRef.current = pos;
      }
    };

    const onMove = (e: MouseEvent) => {
      if (tool === "freehand" && isDrawingRef.current && currentPathIdRef.current) {
        const pos = getCanvasPos(e);
        currentPointsRef.current = [...currentPointsRef.current, pos];
        const id = currentPathIdRef.current;
        const obj = objects.get(id);
        if (obj) {
          upsertObject(id, { ...obj, points: currentPointsRef.current });
          socket?.emit("draw_update", { id, points: currentPointsRef.current });
        }
      }
      if (tool === "text" && isDraggingTextRef.current && textStartRef.current) {
        const pos = getCanvasPos(e);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          redrawCanvas(ctx, objects);
          const x = Math.min(pos.x, textStartRef.current.x);
          const y = Math.min(pos.y, textStartRef.current.y);
          const w = Math.abs(pos.x - textStartRef.current.x);
          const h = Math.abs(pos.y - textStartRef.current.y);
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = "#6366f1";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x, y, w, h);
          ctx.restore();
        }
      }
    };

    const finishDraw = (e: MouseEvent) => {
      if (tool === "freehand" && isDrawingRef.current && currentPathIdRef.current) {
        isDrawingRef.current = false;
        const id = currentPathIdRef.current;
        const obj = objects.get(id);
        if (obj) { upsertObject(id, { ...obj, isDrawing: false }); socket?.emit("draw_end", { id }); }
        currentPathIdRef.current = null;
        currentPointsRef.current = [];
      }
      if (tool === "text" && isDraggingTextRef.current && textStartRef.current) {
        isDraggingTextRef.current = false;
        const pos = getCanvasPos(e);
        const x = Math.min(pos.x, textStartRef.current.x);
        const y = Math.min(pos.y, textStartRef.current.y);
        const w = Math.max(Math.abs(pos.x - textStartRef.current.x), 80);
        const h = Math.max(Math.abs(pos.y - textStartRef.current.y), 40);
        textStartRef.current = null;
        if (w > 10 && h > 10) setActiveTextBox({ id: "", x, y, w, h });
      }
    };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseup", finishDraw);
    canvas.addEventListener("mouseout", finishDraw);
    return () => {
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseup", finishDraw);
      canvas.removeEventListener("mouseout", finishDraw);
    };
  }, [mode, tool, objects, upsertObject, socket, strokeColor, strokeWidth, getCanvasPos]);

  // ── canvas cursor style ────────────────────────────────────
  useEffect(() => {
    const canvas = ogCanvasRef.current;
    if (!canvas) return;
    if (mode === "draw") canvas.style.cursor = tool === "freehand" ? "crosshair" : "cell";
    else canvas.style.cursor = "default";
  }, [mode, tool]);

  // ── cursor broadcasting ────────────────────────────────────
  useEffect(() => {
    const canvas = ogCanvasRef.current;
    if (!canvas) return;
    const onMove = (e: MouseEvent) => { cursorPosRef.current = getCanvasPos(e); };
    const interval = setInterval(() => { socket?.emit("cursor_move", cursorPosRef.current); }, 1000);
    canvas.addEventListener("mousemove", onMove);
    return () => { canvas.removeEventListener("mousemove", onMove); clearInterval(interval); };
  }, [socket, getCanvasPos]);

  // ── clear board ────────────────────────────────────────────
  const handleClearBoard = () => {
    if (!socket) return;
    socket.emit("clear_board");
    clearObjects();
    setMode("draw");
    setSelectedObjId(null);
    setLockedId(null);
    setActiveTextBox(null);
  };

  // ── text block commit ──────────────────────────────────────
  const handleTextDone = () => {
    if (!activeTextBox || !socket || !textValue.trim()) {
      setActiveTextBox(null);
      setTextValue("");
      return;
    }
    const id = generateId();
    const obj: SharedObject = {
      isDrawing: false, isLock: false, type: "text",
      x: activeTextBox.x, y: activeTextBox.y,
      width: activeTextBox.w, height: activeTextBox.h,
      text: textValue, fontSize: 16, color: "#000000",
    };
    upsertObject(id, obj);
    socket.emit("text_start", { id, x: obj.x, y: obj.y, width: obj.width, height: obj.height, fontSize: obj.fontSize, color: obj.color });
    socket.emit("text_update", { id, text: textValue, x: obj.x, y: obj.y, width: obj.width, height: obj.height, fontSize: obj.fontSize, color: obj.color });
    socket.emit("text_end", { id });
    setActiveTextBox(null);
    setTextValue("");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar (100px wide, full height) */}
      <Sidebar
        onClearBoard={handleClearBoard}
        lockedId={lockedId}
        setLockedId={setLockedId}
        hoveredObjId={hoveredObjId}
        setHoveredObjId={setHoveredObjId}
        selectedObjId={selectedObjId}
        setSelectedObjId={setSelectedObjId}
      />

      {/* Canvas column */}
      <div className="flex-1 flex items-center justify-center overflow-auto bg-[#e5e7eb] p-6">
        <div ref={containerRef} className="relative shadow-xl" style={{ width: CANVAS_W, height: CANVAS_H }}>
          <canvas
            ref={ogCanvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="bg-white block"
          />

          {/* Text textarea overlay */}
          {activeTextBox && (
            <textarea
              autoFocus
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onBlur={handleTextDone}
              onKeyDown={(e) => { if (e.key === "Escape") { setActiveTextBox(null); setTextValue(""); } }}
              style={{
                position: "absolute",
                left: activeTextBox.x, top: activeTextBox.y,
                width: activeTextBox.w, height: activeTextBox.h,
                zIndex: 20, border: "1.5px dashed #6366f1",
                background: "rgba(255,255,255,0.92)", resize: "none",
                outline: "none", padding: "4px", fontSize: 16,
                fontFamily: "Inter, sans-serif", lineHeight: "1.4", color: "#000",
              }}
              placeholder="Type here…"
            />
          )}
        </div>
      </div>
    </div>
  );
}
