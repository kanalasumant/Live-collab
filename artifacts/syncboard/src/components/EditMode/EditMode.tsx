import { useState } from "react";
import { useApp, type SharedObject } from "@/context/AppContext";
import { useSocket } from "@/context/SocketContext";
import { showToast } from "@/utils/utils";

interface EditModeProps {
  lockedId: string | null;
  setLockedId: (id: string | null) => void;
  onHoverObject: (id: string | null) => void;
  onSelectObject: (id: string | null) => void;
  selectedId: string | null;
}

function getObjectLabel(id: string, objects: Map<string, SharedObject>): string {
  let pathCount = 0;
  let textCount = 0;
  for (const [oid, obj] of objects) {
    if (obj.type === "path") pathCount++;
    else textCount++;
    if (oid === id) {
      return obj.type === "path" ? `Path ${pathCount}` : `Block ${textCount}`;
    }
  }
  return id;
}

export default function EditMode({ lockedId, setLockedId, onHoverObject, onSelectObject, selectedId }: EditModeProps) {
  const { objects, upsertObject, removeObject } = useApp();
  const { socket } = useSocket();
  const [locking, setLocking] = useState<string | null>(null);

  const handleSelect = (id: string, obj: SharedObject) => {
    if (obj.isLock && obj.lockedBy) return;

    if (selectedId === id) return;

    if (lockedId && lockedId !== id && socket) {
      socket.emit("unlock_object", { id: lockedId });
      const prev = objects.get(lockedId);
      if (prev) upsertObject(lockedId, { ...prev, isLock: false, lockedBy: undefined });
    }

    setLocking(id);
    socket?.emit("lock_request", { id });

    const onGranted = ({ id: gid }: { id: string }) => {
      if (gid !== id) return;
      setLocking(null);
      setLockedId(id);
      onSelectObject(id);
      socket?.off("lock_granted", onGranted);
      socket?.off("lock_denied", onDenied);
    };
    const onDenied = ({ id: did }: { id: string }) => {
      if (did !== id) return;
      setLocking(null);
      const obj = objects.get(id);
      if (obj) upsertObject(id, { ...obj, isLock: true });
      showToast("Object is locked by another user.", "error");
      socket?.off("lock_granted", onGranted);
      socket?.off("lock_denied", onDenied);
    };
    socket?.once("lock_granted", onGranted);
    socket?.once("lock_denied", onDenied);
  };

  const handleDelete = () => {
    if (!selectedId || !socket) return;
    socket.emit("delete_object", { id: selectedId });
    removeObject(selectedId);
    if (lockedId === selectedId) setLockedId(null);
    onSelectObject(null);
  };

  const entries = Array.from(objects.entries());

  return (
    <div className="flex flex-col gap-2 w-full">
      <button
        onClick={handleDelete}
        disabled={!selectedId}
        className="flex items-center gap-1.5 justify-center w-full py-1.5 px-2 rounded-lg border border-destructive text-destructive text-[10px] font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-destructive hover:text-destructive-foreground transition-all"
        data-tooltip="Delete selected"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Delete
      </button>

      <div className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-220px)]">
        {entries.length === 0 && (
          <p className="text-[9px] text-muted-foreground text-center py-2">No objects</p>
        )}
        {entries.map(([id, obj]) => {
          const label = getObjectLabel(id, objects);
          const isSelected = selectedId === id;
          const isDisabled = obj.isLock && !isSelected;
          const isLoadingThis = locking === id;

          return (
            <button
              key={id}
              disabled={isDisabled || !!locking}
              onClick={() => handleSelect(id, obj)}
              onMouseEnter={() => !isDisabled && onHoverObject(id)}
              onMouseLeave={() => onHoverObject(null)}
              className={`w-full text-left px-2 py-1.5 rounded-lg border text-[10px] font-medium transition-all
                ${isSelected ? "bg-primary/10 border-primary text-primary" : ""}
                ${!isSelected && !isDisabled ? "bg-background border-border text-foreground hover:border-primary hover:bg-accent" : ""}
                ${isDisabled ? "opacity-40 cursor-not-allowed border-border text-muted-foreground" : ""}
              `}
            >
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  {obj.type === "path" ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6-6a2 2 0 012.828 2.828L11 14l-4 1 1-4z" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
                    </svg>
                  )}
                  <span className="truncate max-w-[52px]">{label}</span>
                </span>
                {isLoadingThis && (
                  <span className="w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
                )}
                {isDisabled && !isLoadingThis && (
                  <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
