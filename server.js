/**
 * ============================================================
 *  MINDBATTLE — Online Multiplayer Server
 *  Built with: Node.js + Express + Socket.io
 * ============================================================
 *
 *  HOW TO RUN:
 *  1. npm install express socket.io
 *  2. node server.js
 *  3. Open http://localhost:3000 in two browser tabs/devices
 *
 *  HOW IT WORKS (learn as you read!):
 *  - Express serves the HTML file to browsers
 *  - Socket.io handles real-time communication
 *  - Each "room" is an isolated game between 2 players
 * ============================================================
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

// ── Setup ────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app); // Wrap express in http server
const io = new Server(server);         // Attach Socket.io to http server

const PORT = process.env.PORT || 3000;

// Serve the frontend HTML file
app.use(express.static(path.join(__dirname, "public")));

// ── Room Storage ─────────────────────────────────────────────
/**
 * rooms is our in-memory "database".
 * Key   = roomCode (e.g. "ABC123")
 * Value = room object (see createRoom())
 *
 * In a real app you'd use Redis or a database,
 * but for learning, a plain object is perfect.
 */
const rooms = {};

function createRoom(roomCode, hostSocket, hostName) {
  return {
    code: roomCode,
    players: {
      // Each player slot stores everything about that player
      1: {
        socketId: hostSocket.id,
        name: hostName,
        secret: null,      // Their chosen secret number
        ready: false,      // Have they picked their secret?
      },
      2: null,             // Empty until someone joins
    },
    settings: {
      rangeMin: 1,
      rangeMax: 100,
    },
    state: "waiting",      // waiting → picking → playing → done
    currentTurn: 1,        // Whose turn to guess (1 or 2)
    guessCount: 0,
    history: [],           // Log of all guesses
  };
}

// ── Helper: Generate Room Code ───────────────────────────────
function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No confusing chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  // Make sure it's unique
  return rooms[code] ? makeRoomCode() : code;
}

// ── Helper: Find room by socket ID ──────────────────────────
function findRoomBySocket(socketId) {
  for (const code in rooms) {
    const room = rooms[code];
    if (
      room.players[1]?.socketId === socketId ||
      room.players[2]?.socketId === socketId
    ) {
      return { room, code };
    }
  }
  return null;
}

// ── Helper: Which player number is this socket? ──────────────
function getPlayerNum(room, socketId) {
  if (room.players[1]?.socketId === socketId) return 1;
  if (room.players[2]?.socketId === socketId) return 2;
  return null;
}

// ── Helper: Emit to both players in a room ───────────────────
function emitToRoom(roomCode, event, data) {
  io.to(roomCode).emit(event, data);
}

// ============================================================
//  SOCKET.IO EVENT HANDLERS
//  Think of these like API endpoints, but for real-time events
// ============================================================

io.on("connection", (socket) => {
  // A new browser tab connected!
  console.log(`✅ Connected: ${socket.id}`);

  // ── CREATE ROOM ───────────────────────────────────────────
  /**
   * Player 1 clicks "Create Room"
   * We generate a code and store the room
   */
  socket.on("create_room", ({ playerName, rangeMin, rangeMax }) => {
    const code = makeRoomCode();
    const room = createRoom(code, socket, playerName || "PLAYER 1");
    room.settings.rangeMin = rangeMin || 1;
    room.settings.rangeMax = rangeMax || 100;
    rooms[code] = room;

    // Socket.io "rooms" let us broadcast to a group easily
    socket.join(code);

    console.log(`🏠 Room created: ${code} by ${playerName}`);

    // Tell the browser: "You created room ABC123, you are player 1"
    socket.emit("room_created", {
      code,
      playerNum: 1,
      settings: room.settings,
    });
  });

  // ── JOIN ROOM ─────────────────────────────────────────────
  /**
   * Player 2 enters a room code and clicks "Join"
   * We validate and add them to the room
   */
  socket.on("join_room", ({ roomCode, playerName }) => {
    const code = roomCode.toUpperCase().trim();
    const room = rooms[code];

    // Validation
    if (!room) {
      socket.emit("error_msg", "Room not found. Check the code!");
      return;
    }
    if (room.players[2]) {
      socket.emit("error_msg", "Room is full!");
      return;
    }
    if (room.state !== "waiting") {
      socket.emit("error_msg", "Game already started!");
      return;
    }

    // Add player 2
    room.players[2] = {
      socketId: socket.id,
      name: playerName || "PLAYER 2",
      secret: null,
      ready: false,
    };

    socket.join(code);
    console.log(`👥 ${playerName} joined room ${code}`);

    // Tell BOTH players the room is full → move to pick phase
    emitToRoom(code, "room_ready", {
      code,
      p1Name: room.players[1].name,
      p2Name: room.players[2].name,
      settings: room.settings,
      // Each player is told their own number separately (below)
    });

    // Tell each player their own player number
    io.to(room.players[1].socketId).emit("your_player_num", { num: 1 });
    io.to(room.players[2].socketId).emit("your_player_num", { num: 2 });

    room.state = "picking";
  });

  // ── SET SECRET NUMBER ─────────────────────────────────────
  /**
   * A player has chosen their secret number
   * We store it server-side (opponent never sees it directly)
   */
  socket.on("set_secret", ({ secret }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room, code } = found;

    const pNum = getPlayerNum(room, socket.id);
    if (!pNum) return;

    const { rangeMin, rangeMax } = room.settings;
    if (secret < rangeMin || secret > rangeMax) {
      socket.emit("error_msg", `Secret must be between ${rangeMin} and ${rangeMax}`);
      return;
    }

    room.players[pNum].secret = secret;
    room.players[pNum].ready = true;

    console.log(`🔒 Player ${pNum} locked in their secret in room ${code}`);

    // Tell the player their number is locked
    socket.emit("secret_locked", { playerNum: pNum });

    // Tell the OTHER player "opponent is ready"
    const otherNum = pNum === 1 ? 2 : 1;
    const otherSocket = room.players[otherNum]?.socketId;
    if (otherSocket) {
      io.to(otherSocket).emit("opponent_ready");
    }

    // If BOTH players are ready → start the game!
    if (room.players[1].ready && room.players[2].ready) {
      room.state = "playing";
      room.currentTurn = 1; // Player 1 goes first
      console.log(`⚔️ Game started in room ${code}!`);
      emitToRoom(code, "game_start", {
        currentTurn: 1,
        p1Name: room.players[1].name,
        p2Name: room.players[2].name,
      });
    }
  });

  // ── MAKE A GUESS ──────────────────────────────────────────
  /**
   * A player guesses a number
   * Server checks it against the OPPONENT'S secret
   * Then tells both players the result
   */
  socket.on("make_guess", ({ guess }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room, code } = found;

    if (room.state !== "playing") return;

    const pNum = getPlayerNum(room, socket.id);

    // Must be your turn
    if (room.currentTurn !== pNum) {
      socket.emit("error_msg", "It's not your turn!");
      return;
    }

    const { rangeMin, rangeMax } = room.settings;
    if (guess < rangeMin || guess > rangeMax) {
      socket.emit("error_msg", `Guess must be between ${rangeMin} and ${rangeMax}`);
      return;
    }

    // The guesser is trying to crack the OPPONENT's secret
    const opponentNum = pNum === 1 ? 2 : 1;
    const targetSecret = room.players[opponentNum].secret;

    room.guessCount++;

    let result;
    if (guess === targetSecret) {
      result = "correct";
    } else if (guess < targetSecret) {
      result = "higher"; // Guess was low, go higher
    } else {
      result = "lower";  // Guess was high, go lower
    }

    const logEntry = {
      playerNum: pNum,
      playerName: room.players[pNum].name,
      guess,
      result,
      guessCount: room.guessCount,
    };
    room.history.push(logEntry);

    console.log(`🎯 Room ${code}: P${pNum} guessed ${guess} → ${result}`);

    if (result === "correct") {
      // Game over!
      room.state = "done";
      emitToRoom(code, "guess_result", logEntry);
      emitToRoom(code, "game_over", {
        winnerNum: pNum,
        winnerName: room.players[pNum].name,
        secret: targetSecret,
        guessCount: room.guessCount,
      });
    } else {
      // Switch turns
      room.currentTurn = opponentNum;
      emitToRoom(code, "guess_result", logEntry);
      emitToRoom(code, "turn_change", {
        currentTurn: room.currentTurn,
      });
    }
  });

  // ── PLAY AGAIN ────────────────────────────────────────────
  socket.on("play_again", () => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room, code } = found;

    // Reset round state
    room.players[1].secret = null;
    room.players[1].ready = false;
    room.players[2].secret = null;
    room.players[2].ready = false;
    room.state = "picking";
    room.currentTurn = 1;
    room.guessCount = 0;
    room.history = [];

    emitToRoom(code, "new_round", {
      settings: room.settings,
    });
  });

  // ── DISCONNECT ────────────────────────────────────────────
  /**
   * When a player closes their tab / loses connection
   */
  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room, code } = found;

    // Tell the other player their opponent left
    emitToRoom(code, "opponent_left", {
      message: "Your opponent disconnected!",
    });

    // Clean up the room after a delay
    setTimeout(() => {
      delete rooms[code];
      console.log(`🗑️ Room ${code} cleaned up`);
    }, 5000);
  });
});

// ── Start Server ─────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀 MindBattle server running!`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://YOUR_IP:${PORT}\n`);
});
