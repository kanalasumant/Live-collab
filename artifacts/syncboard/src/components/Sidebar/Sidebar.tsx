import { useState, useRef } from "react";
import { useApp } from "@/context/AppContext";
import EditMode from "@/components/EditMode/EditMode";

interface SidebarProps {
  onClearBoard: () => void;
  lockedId: string | null;
  setLockedId: (id: string | null) => void;
  hoveredObjId: string | null;
  setHoveredObjId: (id: string | null) => void;
  selectedObjId: string | null;
  setSelectedObjId: (id: string | null) => void;
}

export default function Sidebar({
  onClearBoard,
  lockedId,
  setLockedId,
  hoveredObjId,
  setHoveredObjId,
  selectedObjId,
  setSelectedObjId,
}: SidebarProps) {
  const {
    userName, roomName, roomUsers,
    mode, setMode,
    tool, setTool,
    strokeColor, setStrokeColor,
    strokeWidth, setStrokeWidth,
  } = useApp();
  const [showUsersPopup, setShowUsersPopup] = useState(false);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUsersMouseEnter = () => {
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    setShowUsersPopup(true);
  };
  const handleUsersMouseLeave = () => {
    popupTimeoutRef.current = setTimeout(() => setShowUsersPopup(false), 150);
  };

  const handleSwitchMode = (newMode: typeof mode) => {
    setMode(newMode);
  };

  return (
    <aside className="w-[100px] bg-card border-r border-border flex flex-col h-full shrink-0">
      {/* Part 1: Title */}
      <div className="px-2 pt-4 pb-3 flex items-center justify-center shrink-0">
        <span className="text-primary font-bold text-xs text-center leading-tight">Live Collab</span>
      </div>

      <hr className="border-border mx-2 shrink-0" />

      {/* Part 1.5: Room name */}
      <div className="px-2 py-2.5 flex flex-col items-center shrink-0">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold">Room name</span>
        <span className="text-[10px] font-bold text-foreground text-center leading-tight mt-0.5 break-all w-full text-center">{roomName}</span>
      </div>

      <hr className="border-border mx-2 shrink-0" />

      {/* Part 2: Active Users */}
      <div className="px-2 py-3 flex flex-col items-center shrink-0" style={{ position: "relative", zIndex: 50 }}>
        <div
          className="flex flex-col items-center gap-1 cursor-pointer select-none"
          onMouseEnter={handleUsersMouseEnter}
          onMouseLeave={handleUsersMouseLeave}
        >
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs font-bold text-foreground">{roomUsers.length}</span>
          </div>
          <span className="text-[10px] text-muted-foreground text-center leading-tight">Active users</span>
        </div>

        {showUsersPopup && (
          <div
            className="bg-white border border-border rounded-lg shadow-xl px-3 py-2 min-w-[150px]"
            style={{ position: "fixed", left: 108, zIndex: 9999 }}
            onMouseEnter={handleUsersMouseEnter}
            onMouseLeave={handleUsersMouseLeave}
          >
            <p className="text-[10px] text-muted-foreground font-semibold mb-1.5 uppercase tracking-wide">In this room</p>
            {roomUsers.map((u) => (
              <p key={u} className={`text-xs py-0.5 ${u === userName ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                {u}{u === userName ? " (you)" : ""}
              </p>
            ))}
          </div>
        )}
      </div>

      <hr className="border-border mx-2 shrink-0" />

      {/* Part 3: Mode + tools */}
      <div className="px-1.5 py-3 flex flex-col gap-2 flex-1 overflow-y-auto min-h-0">
        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide text-center shrink-0">Mode</span>

        {/* Mode buttons */}
        <div className="flex flex-col gap-1 shrink-0">
          <button
            data-tooltip="Drawing mode"
            onClick={() => handleSwitchMode("draw")}
            className={`w-full flex items-center justify-center p-1.5 rounded-lg border transition-all text-[10px] font-medium gap-1 flex-col
              ${mode === "draw" ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary hover:bg-accent"}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>Draw</span>
          </button>

          <button
            data-tooltip="Object interaction mode"
            onClick={() => handleSwitchMode("edit")}
            className={`w-full flex items-center justify-center p-1.5 rounded-lg border transition-all text-[10px] font-medium gap-1 flex-col
              ${mode === "edit" ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary hover:bg-accent"}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>Edit</span>
          </button>

          <button
            data-tooltip="Clear board"
            onClick={onClearBoard}
            className="w-full flex items-center justify-center p-1.5 rounded-lg border border-destructive/60 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all text-[10px] font-medium gap-1 flex-col"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Clear</span>
          </button>
        </div>

        {/* Draw mode sub-tools */}
        {mode === "draw" && (
          <>
            <hr className="border-border shrink-0" />
            <div className="flex flex-col gap-1 shrink-0">
              <button
                data-tooltip="Freehand brush"
                onClick={() => setTool("freehand")}
                className={`w-full flex items-center justify-center p-1.5 rounded-lg border transition-all text-[10px] flex-col gap-1
                  ${tool === "freehand" ? "bg-primary/10 border-primary text-primary" : "bg-background border-border text-muted-foreground hover:border-primary hover:bg-accent"}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6.5-6.5a2 2 0 012.828 2.828L11 14l-4 1 1-4z" />
                </svg>
                <span>Brush</span>
              </button>

              <button
                data-tooltip="Text block"
                onClick={() => setTool("text")}
                className={`w-full flex items-center justify-center p-1.5 rounded-lg border transition-all text-[10px] flex-col gap-1
                  ${tool === "text" ? "bg-primary/10 border-primary text-primary" : "bg-background border-border text-muted-foreground hover:border-primary hover:bg-accent"}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
                </svg>
                <span>Text</span>
              </button>
            </div>

            {tool === "freehand" && (
              <>
                <div className="flex flex-col gap-1 shrink-0">
                  <span className="text-[9px] text-muted-foreground text-center">Color</span>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {["#ef4444", "#22c55e", "#3b82f6", "#000000"].map((c) => (
                      <button
                        key={c}
                        onClick={() => setStrokeColor(c)}
                        className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${strokeColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                        style={{ background: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <span className="text-[9px] text-muted-foreground text-center">Size: {strokeWidth}</span>
                  <input
                    type="range"
                    className="js-line-range w-full accent-primary"
                    min={1} max={30}
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  />
                </div>
              </>
            )}
          </>
        )}

        {/* Edit mode object list */}
        {mode === "edit" && (
          <>
            <hr className="border-border shrink-0" />
            <EditMode
              lockedId={lockedId}
              setLockedId={setLockedId}
              onHoverObject={setHoveredObjId}
              onSelectObject={setSelectedObjId}
              selectedId={selectedObjId}
            />
          </>
        )}
      </div>
    </aside>
  );
}
