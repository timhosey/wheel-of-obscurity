# wheel-of-obscurity

Local web app for managing a game list and spinning a wheel. Uses SQLite (`better-sqlite3`) and Express.

## Requirements

- [Node.js](https://nodejs.org/) (LTS recommended)

## Run locally

```bash
npm install
npm start
```

The server listens on port **3000** by default. Override with:

```bash
PORT=8080 npm start
```

Then open:

- **Manage games:** [http://localhost:3000/](http://localhost:3000/) (or your chosen port)
- **Wheel view:** [http://localhost:3000/wheel.html](http://localhost:3000/wheel.html)

## Credits

Uses `clack.mp3` from https://pixabay.com/sound-effects/film-special-effects-clack-85854/
