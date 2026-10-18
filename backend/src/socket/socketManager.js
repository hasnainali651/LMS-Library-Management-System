const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const redis = require('../config/redis');
const { protect } = require('../middleware/auth');
let io = null;

const authenticate = async (token) => {
  if (!token || !process.env.JWT_SECRET || redis.status !== 'ready') throw new Error('Authentication unavailable');
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (!decoded._id || !decoded.jti || !decoded.exp) throw new Error('Invalid session');
  if (await redis.get(`blacklist:${decoded.jti}`)) throw new Error('Revoked session');
  const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
  await new Promise((resolve, reject) => protect(req, {}, (error) => error ? reject(error) : resolve()));
  return { user: req.user, expiresAt: decoded.exp * 1000 };
};

const initSocket = (httpServer) => {
  if (io) return io;
  io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL, methods: ['GET', 'POST'], credentials: true },
    transports: ['websocket', 'polling'],
  });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.auth?.accessToken;
      socket.sessionToken = token;
      socket.sessionAuth = await authenticate(token);
      next();
    } catch (error) {
      next(new Error('Invalid, expired or unavailable session'));
    }
  });
  io.on('connection', (socket) => {
    const { user, expiresAt } = socket.sessionAuth;
    const userId = String(user._id);
    const role = user.role;
    socket.userId = userId;
    socket.role = role;
    const rooms = [`user:${userId}`, `role:${role}`];
    rooms.forEach((room) => socket.join(room));
    socket.emit('auth:rooms:joined', { rooms, userId, role });
    const expiry = setTimeout(() => socket.disconnect(true), Math.min(Math.max(0, expiresAt - Date.now()), 2147483647));
    const verify = async () => {
      try {
        const current = await authenticate(socket.sessionToken);
        if (String(current.user._id) !== userId || current.user.role !== role) throw new Error('Session changed');
        return true;
      } catch (error) {
        socket.disconnect(true);
        return false;
      }
    };
    const refresh = setInterval(verify, 15000);
    expiry.unref();
    refresh.unref();
    socket.use(async (_packet, next) => {
      if (await verify()) next();
      else next(new Error('Session is no longer valid'));
    });
    socket.on('disconnect', () => { clearTimeout(expiry); clearInterval(refresh); });
  });
  return io;
};
const getIO = () => io;
const disconnectUser = (userId) => {
  if (io) io.in(`user:${userId}`).disconnectSockets(true);
};
const closeSocket = async () => {
  if (io) {
    const current = io;
    io = null;
    await new Promise((resolve) => current.close(resolve));
  }
};
const getActiveSocketConnections = () => io ? io.of('/').sockets.size : 0;
module.exports = { initSocket, getIO, disconnectUser, closeSocket, getActiveSocketConnections, authenticate };
