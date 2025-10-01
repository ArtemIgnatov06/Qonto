// server/socket.js
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const onlineUsers = new Map(); // userId -> Set<socketId>

let io;

/** Помощник: добавить/убрать пользователя из online */
function _attach(userId, socketId) {
  if (!userId) return;
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
}
function _detach(userId, socketId) {
  const set = onlineUsers.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) onlineUsers.delete(userId);
}

function isOnline(userId) {
  return onlineUsers.has(userId);
}

/** Отправить событие пользователю (всем его сокетам) */
function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

/** Инициализация Socket.IO */
function initSocket(httpServer, app, db) {
  io = new Server(httpServer, {
    cors: {
      origin: 'http://localhost:3000',
      credentials: true
    }
  });

  // простая авторизация: клиент после connect шлёт свой id (для локалки ок)
  io.use((socket, next) => {
    cookieParser()(socket.request, {}, () => next());
  });

  io.on('connection', (socket) => {
    let userId = null;

    socket.on('auth', (uid) => {
      userId = Number(uid);
      if (!userId) return;
      socket.join(`user:${userId}`);
      _attach(userId, socket.id);
      // уведомим всех, кто следит за этим пользователем
      io.emit('presence:update', { userId, online: true });
    });

    // пользователь заходит в комнату треда (для typing)
    socket.on('thread:join', (threadId) => {
      if (!threadId) return;
      socket.join(`thread:${threadId}`);
    });

    // typing
    socket.on('thread:typing', ({ threadId, from }) => {
      socket.to(`thread:${threadId}`).emit('thread:typing', { threadId, from });
    });

    socket.on('disconnect', () => {
      if (userId) {
        _detach(userId, socket.id);
        if (!isOnline(userId)) {
          io.emit('presence:update', { userId, online: false });
        }
      }
    });
  });

  /** Хелперы для REST-роутов ниже */
  return {
    io,
    isOnline,
    emitToUser,
  };
}

module.exports = { initSocket, isOnline, emitToUser };
