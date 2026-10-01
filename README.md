# MoneyMaker Backend

Node.js REST API for budget tracking with partner co-budgeting. Handles sync, auth, and real-time collaboration.

## Features

- **Partner budgets** — Shared budgets with granular permissions
- **Real-time sync** — WebSocket support for live updates across devices
- **Offline reconciliation** — Conflict-free merge for offline-first clients
- **Secure auth** — JWT with refresh tokens, rate limiting, helmet

## Tech Stack

- Express.js + TypeScript
- MongoDB + Mongoose
- Jest + Supertest
- ESLint + Prettier