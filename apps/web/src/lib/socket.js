'use client';

import { io } from 'socket.io-client';

// Strip /api/v1 suffix from the API URL to get the root server URL
const SERVER_URL =
  (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/api\/v1\/?$/, '');

let socket = null;

/**
 * Returns the shared socket.io-client instance.
 * Creates it on first call; subsequent calls return the existing connection.
 * Auth is handled via the httpOnly cookie — socket.io sends it automatically
 * when withCredentials is true and the server's CORS allows credentials.
 */
export const getSocket = () => {
  if (socket) return socket;

  socket = io(SERVER_URL, {
    withCredentials: true,          // sends the token httpOnly cookie
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    reconnectionAttempts: Infinity,
    autoConnect: true,
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
