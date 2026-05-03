# SyncBoard — Live Collab

## Overview

Real-time collaborative whiteboard where multiple users can draw and type simultaneously on the same board.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/syncboard) — Canvas API, Socket.io client
- **Backend**: Express 5 + Socket.io (artifacts/api-server) — all WebSocket logic in src/index.ts
- **Validation**: Zod (`zod/v4`)
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Architecture

### Frontend (artifacts/syncboard)
- `/` — Home page: room list, create room form, socket connection
- `/canvas` — Canvas page: drawing board, sidebar, real-time collaboration
- **Context**: `SocketContext` (global socket.io instance), `AppContext` (user, room, objects, mode state)
- **Components**: `Sidebar` (mode selection, active users, tool options), `EditMode` (object list with lock/move/delete), `Toast`
- **Canvas**: Pure Canvas API — OG canvas for shared state, temp canvas for hover/selection highlight, per-user cursor canvases

### Backend (artifacts/api-server/src/index.ts)
- Socket.io server on `/socket.io` path (routed through shared proxy)
- **Max 5 rooms, 3 users per room** — users assigned Alpha/Beta/Gamma in order
- **Data**: `rooms` Map (roomName → objects Map + users Set), `userNames` Map (socketId → name), `userRooms` Map (socketId → room)
- **SharedObject**: `{ isDrawing, isLock, lockedBy, type: 'path'|'text', ...fields }`

### WebSocket Events
| Client → Server | Server → Client |
|---|---|
| `create_room`, `join_room` | `room_created`, `room_joined`, `room_error`, `room_join_error` |
| `draw_start`, `draw_update`, `draw_end` | `path_update` |
| `text_start`, `text_update`, `text_end` | `text_update` |
| `lock_request`, `unlock_object` | `lock_granted`, `lock_denied`, `object_locked`, `object_unlocked` |
| `move_object`, `delete_object` | `object_moved`, `object_deleted` |
| `clear_board` | `board_cleared` |
| `cursor_move` | `cursor_update` |
| — | `rooms_list`, `user_joined`, `user_left` |

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Proxy Routing

- `/` → syncboard frontend (port 22493)
- `/api` → api-server REST (port 8080)
- `/socket.io` → api-server Socket.io (port 8080)
