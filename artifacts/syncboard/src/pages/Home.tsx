import { useEffect, useState } from "react";
import { useSocket } from "@/context/SocketContext";
import { useApp } from "@/context/AppContext";
import { useLocation } from "wouter";
import { showToast } from "@/utils/utils";

interface RoomInfo {
  name: string;
  spots: number;
  userCount: number;
}

export default function Home() {
  const { socket } = useSocket();
  const { setUserName, setRoomName, setObjects, setRoomUsers } = useApp();
  const [, navigate] = useLocation();

  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [totalRooms, setTotalRooms] = useState(0);

  useEffect(() => {
    if (!socket) return;

    const onRoomsList = (data: { rooms: RoomInfo[] }) => {
      setRooms(data.rooms);
    };

    const onRoomCreated = (data: { roomName: string; userName: string; objects: { id: string; data: any }[]; users: string[] }) => {
      setLoading(false);
      setUserName(data.userName);
      setRoomName(data.roomName);
      const map = new Map<string, any>();
      data.objects.forEach(({ id, data: obj }) => map.set(id, obj));
      setObjects(map);
      setRoomUsers(data.users);
      navigate("/canvas");
    };

    const onRoomError = (data: { message: string }) => {
      setLoading(false);
      showToast(data.message, "error");
    };

    const onRoomJoined = (data: { roomName: string; userName: string; objects: { id: string; data: any }[]; users: string[] }) => {
      setLoading(false);
      setUserName(data.userName);
      setRoomName(data.roomName);
      const map = new Map<string, any>();
      data.objects.forEach(({ id, data: obj }) => map.set(id, obj));
      setObjects(map);
      setRoomUsers(data.users);
      navigate("/canvas");
    };

    const onRoomJoinError = (data: { message: string }) => {
      setLoading(false);
      showToast(data.message, "error");
    };

    socket.on("rooms_list", onRoomsList);
    socket.on("room_created", onRoomCreated);
    socket.on("room_error", onRoomError);
    socket.on("room_joined", onRoomJoined);
    socket.on("room_join_error", onRoomJoinError);

    return () => {
      socket.off("rooms_list", onRoomsList);
      socket.off("room_created", onRoomCreated);
      socket.off("room_error", onRoomError);
      socket.off("room_joined", onRoomJoined);
      socket.off("room_join_error", onRoomJoinError);
    };
  }, [socket, navigate, setUserName, setRoomName, setObjects, setRoomUsers]);

  useEffect(() => {
    if (!socket) return;
    const onRoomsList = (data: { rooms: RoomInfo[] }) => {
      const allRoomsCount = data.rooms.length;
      setTotalRooms(allRoomsCount);
    };
    socket.on("rooms_list", onRoomsList);
    return () => { socket.off("rooms_list", onRoomsList); };
  }, [socket]);

  const handleCreateRoom = () => {
    if (!socket || !newRoomName.trim()) return;
    setLoadingMsg("Creating room…");
    setLoading(true);
    socket.emit("create_room", { roomName: newRoomName.trim() });
  };

  const handleJoinRoom = (roomName: string) => {
    if (!socket) return;
    setLoadingMsg(`Joining "${roomName}"…`);
    setLoading(true);
    socket.emit("join_room", { roomName });
  };

  const maxRoomsReached = totalRooms >= 5;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Title */}
      <div className="w-full px-8 pt-7 pb-0 flex items-start">
        <h1 className="text-2xl font-bold text-primary tracking-tight">Live Collab</h1>
      </div>

      {/* Main centered content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="bg-card border border-border rounded-2xl shadow-sm w-full max-w-lg p-8">

          {/* Available Rooms */}
          <section className="mb-6">
            <h2 className="text-xl font-semibold text-foreground text-center mb-4">Available Rooms</h2>
            {rooms.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">No rooms available right now.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {rooms.map((room) => (
                  <button
                    key={room.name}
                    onClick={() => handleJoinRoom(room.name)}
                    disabled={loading}
                    className="flex items-center justify-between border border-border rounded-xl px-5 py-3.5 hover:border-primary hover:bg-accent transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                      {room.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {room.spots} spot{room.spots !== 1 ? "s" : ""} available
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <hr className="flex-1 border-border" />
            <span className="text-xs font-semibold text-muted-foreground tracking-widest">OR</span>
            <hr className="flex-1 border-border" />
          </div>

          {/* Create Room */}
          <section>
            <h2 className="text-xl font-semibold text-foreground text-center mb-4">Create a new room</h2>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !maxRoomsReached && newRoomName.trim() && handleCreateRoom()}
              placeholder="Room name…"
              disabled={loading || maxRoomsReached}
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-3 disabled:opacity-50"
            />
            <button
              onClick={handleCreateRoom}
              disabled={!newRoomName.trim() || loading || maxRoomsReached}
              className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create
            </button>
            {maxRoomsReached && (
              <p className="text-center text-sm text-destructive mt-2">
                Maximum room limit reached (5). Please join an existing room.
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="bg-card border border-border rounded-xl px-8 py-6 flex flex-col items-center gap-3 shadow-lg">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-foreground">{loadingMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
}
