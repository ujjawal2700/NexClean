// Child worker for the isolated four-process MongoDB adapter regression test.
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const backendRequire = createRequire(resolve(__dirname, '../../backend/package.json'));
const mongoose = backendRequire('mongoose');
const { createServer } = require('node:http');
const { initSocket, emitToUser, broadcastToWorkers } = backendRequire('./src/shared/services/socket.ts');
const { User } = backendRequire('./src/modules/user/user.model.ts');

(async () => {
  // Isolate adapter delivery from account fixtures; JWT verification still runs.
  User.findById = () => ({ select: () => ({ lean: async () => ({ status: 'active', tokenVersion: 0 }) }) });
  const http = createServer();
  const databaseReady = mongoose.connect(process.env.MONGODB_URI).then(() => {});
  const initialized = initSocket(http, databaseReady);
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  const io = await initialized;
  io.on('cluster_probe', payload => process.send({ type: 'cluster_probe', payload }));
  process.on('message', async message => {
    try {
      if (message.type === 'emit') emitToUser(message.userId, message.event, message.payload);
      if (message.type === 'broadcast') broadcastToWorkers('cluster_probe', message.payload);
      if (message.type === 'count') {
        const sockets = await io.in(`user:${message.userId}`).fetchSockets();
        process.send({ type: 'result', id: message.id, count: sockets.length });
      }
      if (message.type === 'disconnect') io.in(`user:${message.userId}`).disconnectSockets(true);
      if (message.type === 'stop') {
        await new Promise(resolve => io.close(resolve));
        await mongoose.disconnect();
        process.exit(0);
      }
    } catch (error) {
      process.send({ type: 'error', message: error.message });
    }
  });
  process.send({ type: 'ready', port: http.address().port });
})().catch(error => {
  process.send({ type: 'error', message: error.message });
  process.exit(1);
});
