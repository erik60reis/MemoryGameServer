const express = require('express');
const http = require('http');
const { Server } = require('colyseus');
const { WebSocketTransport } = require('@colyseus/ws-transport');

const MemoryRoom = require('./rooms/MemoryRoom');
const { getRoomIdFromCode } = require('./roomCodes');

const app = express();
const httpServer = http.createServer(app);

const PORT = process.env.PORT || 3000;

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
    options: {
      cors: {
        origin: '*'
      }
    }
  })
});

gameServer.define('memory', MemoryRoom);

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health', (req, res) => {
  res.send('healthy');
});

app.get('/room-codes/:code', (req, res) => {
  const roomId = getRoomIdFromCode(req.params.code);
  if (!roomId) {
    return res.status(404).json({ error: 'Room not found' });
  }

  res.json({ code: req.params.code.toUpperCase(), roomId });
});

gameServer.listen(PORT, () => {
  console.log(`Colyseus server listening on port ${PORT}`);
});