const http = require("http");
const { Server } = require("socket.io");
const env = require("./config/env");
const { connectDB, disconnectDB } = require("./config/db");
const { createApp, allowedOrigin } = require("./app");
const { configureSockets } = require("./socket");

async function start() {
  await connectDB();
  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (allowedOrigin(origin)) return callback(null, true);
        return callback(new Error("Origin not allowed"));
      },
      credentials: true,
    },
  });
  app.set("io", io);
  configureSockets(io);

  server.listen(env.port, () => {
    console.log(`BuildBridge API listening on ${env.publicUrl} (${env.nodeEnv})`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received. Shutting down gracefully.`);
    io.close();
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  return { app, server, io };
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Failed to start BuildBridge API:", error);
    process.exit(1);
  });
}

module.exports = { start };
