import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  path: "/socket.io",
});

const MAX_ROOMS = 5;
const MAX_USERS_PER_ROOM = 3;
const USER_NAMES = ["Alpha", "Beta", "Gamma"];

interface PathPoint {
  x: number;
  y: number;
}

interface SharedObject {
  isDrawing: boolean;
  isLock: boolean;
  lockedBy?: string;
  type: "path" | "text";
  points?: PathPoint[];
  color?: string;
  lineWidth?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
}

interface RoomInfo {
  objects: Map<string, SharedObject>;
  users: Set<string>;
}

const rooms = new Map<string, RoomInfo>();
const userNames = new Map<string, string>();
const userRooms = new Map<string, string>();

function getAvailableRooms() {
  const list: { name: string; spots: number; userCount: number }[] = [];
  for (const [name, info] of rooms) {
    const spots = MAX_USERS_PER_ROOM - info.users.size;
    if (spots > 0) {
      list.push({ name, spots, userCount: info.users.size });
    }
  }
  return list;
}

function broadcastRoomsList() {
  io.emit("rooms_list", { rooms: getAvailableRooms() });
}

function getObjectsAsArray(roomName: string) {
  const room = rooms.get(roomName);
  if (!room) return [];
  const result: { id: string; data: SharedObject }[] = [];
  for (const [id, data] of room.objects) {
    result.push({ id, data });
  }
  return result;
}

function getUsersInRoom(roomName: string): string[] {
  const room = rooms.get(roomName);
  if (!room) return [];
  const names: string[] = [];
  for (const socketId of room.users) {
    const name = userNames.get(socketId);
    if (name) names.push(name);
  }
  return names;
}

function assignUserName(roomName: string): string | null {
  const room = rooms.get(roomName);
  if (!room) return null;
  const usedNames = new Set<string>();
  for (const sid of room.users) {
    const n = userNames.get(sid);
    if (n) usedNames.add(n);
  }
  for (const name of USER_NAMES) {
    if (!usedNames.has(name)) return name;
  }
  return null;
}

function leaveRoom(socketId: string) {
  const roomName = userRooms.get(socketId);
  if (!roomName) return;
  const room = rooms.get(roomName);
  if (room) {
    room.users.delete(socketId);
    if (room.users.size === 0) {
      rooms.delete(roomName);
    }
  }
  userRooms.delete(socketId);
}

io.on("connection", (socket) => {
  socket.emit("rooms_list", { rooms: getAvailableRooms() });

  socket.on("create_room", ({ roomName }: { roomName: string }) => {
    if (rooms.size >= MAX_ROOMS) {
      socket.emit("room_error", { message: "Maximum room limit (5) reached. Please join an existing room." });
      return;
    }
    const normalizedNew = roomName.trim().toLowerCase();
    for (const [name] of rooms) {
      if (name.toLowerCase() === normalizedNew) {
        socket.emit("room_error", { message: `A room named "${name}" already exists. Please choose a different name.` });
        return;
      }
    }
    const room: RoomInfo = { objects: new Map(), users: new Set() };
    rooms.set(roomName.trim(), room);
    room.users.add(socket.id);

    const userName = assignUserName(roomName.trim())!;
    userNames.set(socket.id, userName);
    userRooms.set(socket.id, roomName.trim());

    socket.join(roomName.trim());

    socket.emit("room_created", {
      roomName: roomName.trim(),
      userName,
      objects: [],
      users: [userName],
    });

    broadcastRoomsList();
  });

  socket.on("join_room", ({ roomName }: { roomName: string }) => {
    const room = rooms.get(roomName);
    if (!room) {
      socket.emit("room_join_error", { message: `Room "${roomName}" does not exist.` });
      return;
    }
    if (room.users.size >= MAX_USERS_PER_ROOM) {
      socket.emit("room_join_error", { message: `Room "${roomName}" is full (${MAX_USERS_PER_ROOM} users max).` });
      return;
    }

    room.users.add(socket.id);
    const userName = assignUserName(roomName)!;
    userNames.set(socket.id, userName);
    userRooms.set(socket.id, roomName);

    socket.join(roomName);

    socket.emit("room_joined", {
      roomName,
      userName,
      objects: getObjectsAsArray(roomName),
      users: getUsersInRoom(roomName),
    });

    socket.to(roomName).emit("user_joined", { userName });
    broadcastRoomsList();
  });

  socket.on("draw_start", ({ id, points, color, lineWidth }: { id: string; points: PathPoint[]; color: string; lineWidth: number }) => {
    const roomName = userRooms.get(socket.id);
    if (!roomName) return;
    const room = rooms.get(roomName);
    if (!room) return;
    const obj: SharedObject = { isDrawing: true, isLock: false, type: "path", points, color, lineWidth };
    room.objects.set(id, obj);
    socket.to(roomName).emit("path_update", { id, data: obj });
  });

  socket.on("draw_update", ({ id, points }: { id: string; points: PathPoint[] }) => {
    const roomName = userRooms.get(socket.id);
    if (!roomName) return;
    const room = rooms.get(roomName);
    if (!room) return;
    const obj = room.objects.get(id);
    if (!obj) return;
    obj.points = points;
    socket.to(roomName).emit("path_update", { id, data: obj });
  });

  socket.on("draw_end", ({ id }: { id: string }) => {
    const roomName = userRooms.get(socket.id);
    if (!roomName) return;
    const room = rooms.get(roomName);
    if (!room) return;
    const obj = room.objects.get(id);
    if (!obj) return;
    obj.isDrawing = false;
    socket.to(roomName).emit("path_update", { id, data: obj });
  });

  socket.on("text_start", ({ id, x, y, width, height, fontSize, color }: { id: string; x: number; y: number; width: number; height: number; fontSize: number; color: string }) => {
    const roomName = userRooms.get(socket.id);
    if (!roomName) return;
    const room = rooms.get(roomName);
    if (!room) return;
    const obj: SharedObject = { isDrawing: true, isLock: false, type: "text", x, y, width, height, text: "", fontSize, color };
    room.objects.set(id, obj);
    socket.to(roomName).emit("text_update", { id, data: obj });
  });

  socket.on("text_update", ({ id, text, x, y, width, height, fontSize, color }: { id: string; text: string; x: number; y: number; width: number; height: number; fontSize: number; color: string }) => {
    const roomName = userRooms.get(socket.id);
    if (!roomName) return;
    const room = rooms.get(roomName);
    if (!room) return;
    const obj = room.objects.get(id);
    if (!obj) return;
    obj.text = text;
    obj.x = x;
    obj.y = y;
    obj.width = width;
    obj.height = height;
    obj.fontSize = fontSize;
    obj.color = color;
    socket.to(roomName).emit("text_update", { id, data: obj });
  });

  socket.on("text_end", ({ id }: { id: string }) => {
    const roomName = userRooms.get(socket.id);
    if (!roomName) return;
    const room = rooms.get(roomName);
    if (!room) return;
    const obj = room.objects.get(id);
    if (!obj) return;
    obj.isDrawing = false;
    socket.to(roomName).emit("text_update", { id, data: obj });
  });

  socket.on("lock_request", ({ id }: { id: string }) => {
    const roomName = userRooms.get(socket.id);
    if (!roomName) return;
    const room = rooms.get(roomName);
    if (!room) return;
    const obj = room.objects.get(id);
    if (!obj) { socket.emit("lock_denied", { id, message: "Object not found." }); return; }
    if (obj.isLock) {
      socket.emit("lock_denied", { id, message: `Object is locked by ${obj.lockedBy || "another user"}.` });
      return;
    }
    const userName = userNames.get(socket.id) || "unknown";
    obj.isLock = true;
    obj.lockedBy = userName;
    socket.emit("lock_granted", { id });
    socket.to(roomName).emit("object_locked", { id, lockedBy: userName });
  });

  socket.on("unlock_object", ({ id }: { id: string }) => {
    const roomName = userRooms.get(socket.id);
    if (!roomName) return;
    const room = rooms.get(roomName);
    if (!room) return;
    const obj = room.objects.get(id);
    if (!obj) return;
    obj.isLock = false;
    obj.lockedBy = undefined;
    socket.to(roomName).emit("object_unlocked", { id });
  });

  socket.on("move_object", ({ id, x, y }: { id: string; x: number; y: number }) => {
    const roomName = userRooms.get(socket.id);
    if (!roomName) return;
    const room = rooms.get(roomName);
    if (!room) return;
    const obj = room.objects.get(id);
    if (!obj) return;
    if (obj.type === "path" && obj.points) {
      const minX = Math.min(...obj.points.map((p) => p.x));
      const minY = Math.min(...obj.points.map((p) => p.y));
      const dx = x - minX;
      const dy = y - minY;
      obj.points = obj.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    } else if (obj.type === "text") {
      obj.x = x;
      obj.y = y;
    }
    socket.to(roomName).emit("object_moved", { id, data: obj });
  });

  socket.on("delete_object", ({ id }: { id: string }) => {
    const roomName = userRooms.get(socket.id);
    if (!roomName) return;
    const room = rooms.get(roomName);
    if (!room) return;
    room.objects.delete(id);
    socket.to(roomName).emit("object_deleted", { id });
  });

  socket.on("clear_board", () => {
    const roomName = userRooms.get(socket.id);
    if (!roomName) return;
    const room = rooms.get(roomName);
    if (!room) return;
    room.objects.clear();
    io.to(roomName).emit("board_cleared");
  });

  socket.on("cursor_move", ({ x, y }: { x: number; y: number }) => {
    const roomName = userRooms.get(socket.id);
    if (!roomName) return;
    const userName = userNames.get(socket.id);
    socket.to(roomName).emit("cursor_update", { socketId: socket.id, userName, x, y });
  });

  socket.on("disconnect", () => {
    const roomName = userRooms.get(socket.id);
    const userName = userNames.get(socket.id);
    leaveRoom(socket.id);
    userNames.delete(socket.id);
    if (roomName && userName) {
      io.to(roomName).emit("user_left", { userName });
      broadcastRoomsList();
    }
  });
});

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

httpServer.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
