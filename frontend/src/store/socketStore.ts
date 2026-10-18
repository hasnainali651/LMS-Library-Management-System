import { create } from 'zustand';
import type { Socket } from 'socket.io-client';

export interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  roomsJoined: string[];
  
  // Actions
  connect: (token?: string | null) => void;
  disconnect: () => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  setRoomsJoined: (rooms: string[]) => void;
  setIsConnected: (isConnected: boolean) => void;
  setSocket: (socket: Socket | null) => void;
}

export const useSocketStore = create<SocketState>()((set, get) => ({
  socket: null,
  isConnected: false,
  roomsJoined: [],

  setSocket: (socket) => set({ socket }),
  setIsConnected: (isConnected) => set({ isConnected }),
  setRoomsJoined: (roomsJoined) => set({ roomsJoined }),

  connect: async (token) => {
    // Dynamic import to avoid SSR issues
    const { initSocketClient } = await import('@/lib/socket');
    const socketInstance = initSocketClient(token);
    set({ socket: socketInstance });
  },

  disconnect: async () => {
    const { disconnectSocketClient } = await import('@/lib/socket');
    disconnectSocketClient();
    set({ socket: null, isConnected: false, roomsJoined: [] });
  },

  joinRoom: (room: string) => {
    const { socket, roomsJoined } = get();
    if (socket && socket.connected) {
      socket.emit('join_room', room);
      if (!roomsJoined.includes(room)) {
        set({ roomsJoined: [...roomsJoined, room] });
      }
    }
  },

  leaveRoom: (room: string) => {
    const { socket, roomsJoined } = get();
    if (socket && socket.connected) {
      socket.emit('leave_room', room);
      set({ roomsJoined: roomsJoined.filter((r) => r !== room) });
    }
  },
}));
