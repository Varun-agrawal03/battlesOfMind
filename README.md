# 🧠 BattlesOfMinds — Online Number Duel

> A real-time 2-player online number guessing game. Pick a secret number, take turns guessing each other's number, and be the first to crack the code!

Built with **Node.js · Express · Socket.io**

---

## 🎮 How to Play

1. **Player 1** creates a room and sets the number range (e.g. 1–100)
2. A **6-digit room code** is generated — share it with your friend
3. **Player 2** joins using that code
4. Both players **secretly pick a number** in the range
5. Take turns **guessing** the opponent's number
6. After each guess the server hints: go **HIGHER ↑** or **LOWER ↓**
7. First player to guess correctly **wins the round!** 🏆

---

## 📁 Project Structure

```
mindbattle/
├── server.js          ← Backend (Node.js + Express + Socket.io)
├── package.json       ← Dependencies & scripts
├── README.md          ← You are here
└── public/
    └── index.html     ← Frontend (HTML + CSS + JS, single file)
```

---

## 🚀 Run Locally

### Prerequisites
- [Node.js](https://nodejs.org) v18 or higher

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/Varun-agrawal03/battlesOfMind.git
cd battlesOfMind

# 2. Install dependencies
npm install

# 3. Start the server
node server.js

# 4. Open in browser
# http://localhost:3000
```

Open the link in **two browser tabs** or share your local IP with someone on the same WiFi:

- **Windows** → run `ipconfig` → find IPv4 Address
- **Mac / Linux** → run `ifconfig` → find inet address

Friend opens: `http://YOUR_LOCAL_IP:3000`

---

## 🌐 Deploy & Play Online

### ⚡ Option 1 — ngrok (Play RIGHT NOW, free)

Runs on your PC but gives a public URL anyone can open.

```bash
# 1. Start the game server
node server.js

# 2. In a second terminal, create a public tunnel
ngrok http 3000
```

Share the `https://xxxx.ngrok-free.app` link with friends. Done!

> Get ngrok free at [ngrok.com](https://ngrok.com)

---

### 🚂 Option 2 — Railway (Permanent URL, recommended)

Host it 24/7 so friends can play anytime without your PC being on.

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → **"Start a New Project"**
3. Click **"Deploy from GitHub repo"** → select `mindbattle`
4. Railway auto-detects Node.js and deploys automatically
5. Go to **Settings → Generate Domain** → get your public URL

> ✅ Auto-redeploys every time you push to GitHub  
> ✅ `process.env.PORT` is already handled in `server.js`

---

### 🎨 Option 3 — Render.com

1. Push to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Set these values:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. Click **Deploy** → get your public URL

> ⚠️ Render's free tier may sleep after inactivity — fine for casual use

---

## 🔧 Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Server | Node.js + Express | Serves files & handles HTTP |
| Real-time | Socket.io | WebSocket communication |
| Frontend | Vanilla HTML/CSS/JS | No framework needed |

### How Real-Time Works

Normal HTTP closes the connection after every request. **WebSockets** keep it open so the server can push messages to clients instantly — perfect for turn-based games.

```
Player 1 Browser          Server              Player 2 Browser
      │                     │                       │
      │── create_room ──────►│                       │
      │◄── room_created ─────│                       │
      │                     │◄─────── join_room ─────│
      │◄── room_ready ───────┼──── room_ready ───────►│
      │── set_secret ───────►│◄──────── set_secret ───│
      │◄── game_start ───────┼──── game_start ───────►│
      │── make_guess ───────►│                       │
      │◄── guess_result ─────┼──── guess_result ─────►│
      │◄── turn_change ──────┼──── turn_change ───────►│
```

### Key Security Note
Secret numbers are stored **server-side only**. Neither player's browser ever receives the opponent's secret — the server just replies "higher" or "lower" to each guess.

---

Developed by Varun Agrawal student of CSE at NIT RAIPUR.

---

## 📜 License

MIT — free to use, modify, and share.
