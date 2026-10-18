import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';

let socketInstance: Socket | null = null;

/**
 * Resolve the Socket server URL based on environment configuration
 */
export const getSocketUrl = (): string => {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
  return apiUrl.replace(/\/api(\/v1)?\/?$/, '');
};

/**
 * Initialize or retrieve the Socket.io client
 */
export const initSocketClient = (customToken?: string | null): Socket => {
  if (typeof window === 'undefined') {
    // Return empty stub for SSR
    return {} as Socket;
  }

  const token = customToken || useAuthStore.getState().accessToken;

  if (socketInstance && socketInstance.connected) {
    if (token) {
      socketInstance.emit('auth:identify', { token, accessToken: token });
    }
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.disconnect();
  }

  const socketUrl = getSocketUrl();

  socketInstance = io(socketUrl, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    auth: { token, accessToken: token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  const sendAuthIdentify = () => {
    const currentToken = useAuthStore.getState().accessToken || customToken;
    if (currentToken && socketInstance) {
      socketInstance.emit('auth:identify', {
        token: currentToken,
        accessToken: currentToken,
      });
    }
  };

  // Connection established
  socketInstance.on('connect', () => {
    useSocketStore.getState().setIsConnected(true);
    sendAuthIdentify();
  });

  // Reconnection established - re-identify with current token
  socketInstance.io.on('reconnect', () => {
    useSocketStore.getState().setIsConnected(true);
    sendAuthIdentify();
  });

  // Rooms confirmed by server
  socketInstance.on('auth:rooms:joined', (payload: { rooms?: string[]; userId?: string; role?: string }) => {
    const rooms = payload?.rooms || [];
    useSocketStore.getState().setRoomsJoined(rooms);
  });

  // Auth error from server
  socketInstance.on('auth:error', (error: { message?: string }) => {
    console.warn('[Socket Client] Server authentication failed:', error?.message);
    useSocketStore.getState().setIsConnected(false);
  });

  // Disconnection handler
  socketInstance.on('disconnect', (reason: string) => {
    useSocketStore.getState().setIsConnected(false);
    if (reason === 'io server disconnect') {
      // Server actively disconnected, don't automatically reconnect without new auth
    }
  });

  // Connection error
  socketInstance.on('connect_error', (error: Error) => {
    useSocketStore.getState().setIsConnected(false);
  });

  useSocketStore.getState().setSocket(socketInstance);

  return socketInstance;
};

/**
 * Retrieve the current active socket instance
 */
export const getSocket = (): Socket | null => {
  return socketInstance;
};

/**
 * Disconnect and destroy the socket instance
 */
export const disconnectSocketClient = (): void => {
  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
  }
};
