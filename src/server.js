const express = require("express");
const http = require("http");
require("dotenv").config();
const userRoutes = require("./app/routes/loginRoutes");
const gameRoutes = require("./app/routes/gameRoutes");
const ioClient = require("socket.io-client");
const socketIo = require("socket.io");
const { sendSlackMessage } = require("./config/common");
const { getGames } = require("./model/repositories/gameRepository");
const {
  connectToCreateRoundQueueSocket,
  connectToUpdateRoundQueueSocket,
} = require("./app/controllers/socket");
const { startingServer } = require("./app/controllers/startingServer");

const randomCardCron = require("./app/routes/randomCardCron");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = 3000;

app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));

const serverUrl = process.env.HUB_URL;
const currentServerUrl = process.env.DELAY_URL;

let socket = ioClient.connect(serverUrl, {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 10,
});
socket.on("connect", async () => {
  console.log("Connected to remote server");
});

socket.on("disconnect", async (reason) => {
  await sendSlackMessage(`Disconnected from the server. Reason: ${reason}`);
  socket.connect();
  await sendSlackMessage(`Connected to remote server`);
});

io.on("connection", async (sockets) => {
  console.log("A user connected.");
  const newgames = await getGames();
  if (newgames) {
    for (const game of newgames) {
      connectToCreateRoundQueueSocket(
        `${game.Code}_create_round`,
        sockets,
        socket
      );
      // connectToUpdateRoundQueueSocket(
      //   `${game.Code}_update_round`,
      //   sockets,
      //   socket
      // );
    }
  }
  socket.on("disconnect", () => {
    console.log("A user disconnected.");
  });
});

let newsocket = ioClient.connect(currentServerUrl, {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 10,
});

newsocket.on("connect", async () => {
  console.log("Connected to game remote server");
});

newsocket.on("disconnect", async (reason) => {
  await sendSlackMessage(
    `Disconnected from the game server. Reason: ${reason}`
  );
  newsocket.connect();
  await sendSlackMessage(`Connected to game remote server`);
  startingServer(newsocket);
});

startingServer(newsocket);

app.use(function (req, res, next) {
  req.socket = socket;
  req.newsocket = newsocket;
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,cache-control,content-type,accept,authorization,new-token,invalidToken,refresh-token,AuthToken,RefreshToken,x-access-token,source"
  );

  res.setHeader(
    "Access-Control-Expose-Headers",
    "authorization,x-access-token,new-token,invalidToken,refresh-token"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);

  next();
});

// Routes
app.use("/api", userRoutes);
app.use("/api", gameRoutes);

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
