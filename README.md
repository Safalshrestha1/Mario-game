# 🍄 Super Mario Adventure

A full-featured, pixel-perfect Super Mario clone built with **HTML5 Canvas + JavaScript + Python**.  
Playable on **PC, mobile, and tablet** — installable as a PWA on both Android (Play Store) and iOS (App Store).

---

## ✨ Features

| Category | Details |
|---|---|
| 🎮 Gameplay | 3 worlds, goombas, koopas, question blocks, bricks, mushrooms, star power |
| 🎵 Audio | Web Audio API chiptune music + SFX (jump, stomp, coin, powerup, game over) |
| 📱 Mobile | Virtual D-pad + A/B buttons, responsive layout, portrait/landscape |
| 🖥️ Desktop | Full keyboard control (arrows/WASD, Z/Space jump, X/Shift run) |
| 🏆 Scores | Local + server-side leaderboard via REST API |
| ⚙️ Settings | Toggle sound/music, volume, particles, mobile controls |
| 💾 Offline | Service Worker PWA — plays offline after first load |
| 🚀 Deploy | One-file game; Python server with zero dependencies |

---

## 🕹️ Controls

| Action | Keyboard | Mobile |
|---|---|---|
| Move | ← / → or A/D | Left / Right buttons |
| Jump | ↑ / W / Z / Space | A button |
| Run | X / Shift | B button |
| Long jump | Run + Jump | B + A |
| Pause | Escape / P | — |

---

## 🚀 Quick Start (Local)

```bash
# Python 3.8+ required – no pip packages needed
python server.py
# → Open http://localhost:8000
```

---

## 📦 Deployment

### Render / Railway / Fly.io
```bash
# Procfile (already included)
web: python server.py
```

### Heroku
```bash
heroku create my-mario-game
git push heroku main
```

### Vercel / Netlify (static only)
Deploy `index.html` directly — the game runs entirely client-side.  
Drop `index.html` into any CDN bucket and it works.

### Docker
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY . .
EXPOSE 8000
CMD ["python", "server.py"]
```

---

## 📱 PWA → App Stores

### Android (Google Play)
1. Open Chrome → visit your deployed URL  
2. Chrome will prompt "Add to Home Screen" → this creates a TWA  
3. Use **Bubblewrap** or **PWABuilder** (pwabuilder.com) to package as `.aab`  
4. Upload to Google Play Console

### iOS (App Store)
1. Open Safari → visit your deployed URL  
2. Share → "Add to Home Screen" for immediate use  
3. For App Store submission, use **Capacitor** or **PWABuilder**:
   ```bash
   npm install -g @capacitor/cli
   npx cap init MarioAdventure com.yourdomain.mario
   npx cap add ios
   # Open in Xcode, set bundle ID, submit to App Store Connect
   ```

### Capacitor (both stores)
```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init
npx cap add ios
npx cap add android
npx cap copy
npx cap open android   # → Android Studio → build APK/AAB
npx cap open ios       # → Xcode → archive → submit
```

---

## 🗂️ File Structure

```
mario-game/
├── index.html      ← Entire game (self-contained, ~650 lines)
├── server.py       ← Python HTTP server + score API
├── manifest.json   ← PWA manifest (icons, display, orientation)
├── sw.js           ← Service Worker (offline cache)
└── README.md
```

---

## 🔌 Score API

```
GET  /api/scores        → top-10 leaderboard
POST /api/scores        → submit { "name": "MARIO", "score": 9999, "world": "1-3" }
GET  /api/health        → health check
```

---

## 🛠️ Extending

- **Add levels**: edit the `buildLevels()` array in `index.html` — each level is a grid of ASCII chars
- **New enemies**: add a `spawn*` function and a `draw*` case
- **Firebase leaderboard**: replace `/api/scores` calls with Firestore SDK
- **Multiplayer**: add WebSocket via `websockets` pip package to `server.py`
