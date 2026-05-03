import { createContext, useContext, useState, useCallback } from "react";

export interface PathPoint {
  x: number;
  y: number;
}

export interface SharedObject {
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

export type DrawMode = "draw" | "edit";
export type DrawTool = "freehand" | "text";

interface AppContextValue {
  userId: string;
  userName: string;
  setUserName: (n: string) => void;
  roomName: string;
  setRoomName: (r: string) => void;
  objects: Map<string, SharedObject>;
  setObjects: React.Dispatch<React.SetStateAction<Map<string, SharedObject>>>;
  upsertObject: (id: string, data: SharedObject) => void;
  removeObject: (id: string) => void;
  clearObjects: () => void;
  roomUsers: string[];
  setRoomUsers: React.Dispatch<React.SetStateAction<string[]>>;
  mode: DrawMode;
  setMode: (m: DrawMode) => void;
  tool: DrawTool;
  setTool: (t: DrawTool) => void;
  strokeColor: string;
  setStrokeColor: (c: string) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
}

const AppContext = createContext<AppContextValue>({} as AppContextValue);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [userId] = useState<string>(() => `user-${Math.random().toString(36).slice(2, 9)}`);
  const [userName, setUserName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [objects, setObjects] = useState<Map<string, SharedObject>>(new Map());
  const [roomUsers, setRoomUsers] = useState<string[]>([]);
  const [mode, setMode] = useState<DrawMode>("draw");
  const [tool, setTool] = useState<DrawTool>("freehand");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(1);

  const upsertObject = useCallback((id: string, data: SharedObject) => {
    setObjects((prev) => {
      const next = new Map(prev);
      next.set(id, data);
      return next;
    });
  }, []);

  const removeObject = useCallback((id: string) => {
    setObjects((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const clearObjects = useCallback(() => {
    setObjects(new Map());
  }, []);

  return (
    <AppContext.Provider value={{
      userId, userName, setUserName,
      roomName, setRoomName,
      objects, setObjects,
      upsertObject, removeObject, clearObjects,
      roomUsers, setRoomUsers,
      mode, setMode,
      tool, setTool,
      strokeColor, setStrokeColor,
      strokeWidth, setStrokeWidth,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
