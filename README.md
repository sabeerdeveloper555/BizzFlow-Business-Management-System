# BizFlow

BizFlow is a business management system built as a full-stack MERN application.

## Current Tech Stack

- Frontend: React, Vite, JavaScript, Tailwind CSS, React Router, Axios, Lucide React
- Backend: Node.js, Express.js, Mongoose, dotenv, cors, helmet, morgan, bcryptjs, jsonwebtoken

## Project Structure

```text
BizFlow/
├── frontend/
├── backend/
├── .gitignore
└── README.md
```

## Setup

Install dependencies in each application directory:

```bash
cd frontend
npm install

cd ../backend
npm install
```

Copy `backend/.env.example` to `backend/.env` and set the values for your local environment.

## Run Frontend

```bash
cd frontend
npm run dev
```

The Vite development server will print its local URL in the terminal.

## Run Backend

```bash
cd backend
npm run dev
```

The API runs on the configured `PORT` value, or port `5000` by default. Health check: `GET /api/health`.
