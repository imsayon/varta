import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize the Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Attach Socket.io to the Next.js HTTP server
  const io = new SocketIOServer(server, {
    path: '/ws',
    cors: {
      origin: '*', // Customize this for production
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Varta WS] Client connected: ${socket.id}`);
    const subscriberId = socket.handshake.query.subscriberId;
    
    if (subscriberId) {
      socket.join(subscriberId as string);
      console.log(`[Varta WS] Socket ${socket.id} joined room ${subscriberId}`);
    }

    socket.on('disconnect', () => {
      console.log(`[Varta WS] Client disconnected: ${socket.id}`);
    });
  });

  // Initialize BullMQ Workers here in the future
  console.log('[Varta Workers] Ready (Mock)');

  server
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
