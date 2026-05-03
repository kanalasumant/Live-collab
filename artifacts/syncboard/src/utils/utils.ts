export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

let toastListeners: ((toasts: ToastMessage[]) => void)[] = [];
let currentToasts: ToastMessage[] = [];

export function subscribeToToasts(cb: (toasts: ToastMessage[]) => void) {
  toastListeners.push(cb);
  cb(currentToasts);
  return () => {
    toastListeners = toastListeners.filter((l) => l !== cb);
  };
}

export function showToast(message: string, type: ToastType = "info", duration = 4000) {
  const id = generateId();
  const toast: ToastMessage = { id, message, type };
  currentToasts = [...currentToasts, toast];
  toastListeners.forEach((l) => l(currentToasts));
  setTimeout(() => {
    currentToasts = currentToasts.filter((t) => t.id !== id);
    toastListeners.forEach((l) => l(currentToasts));
  }, duration);
}
