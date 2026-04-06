# Real-Time Chat Application

A full-stack real-time chat application built with Node.js, Express, Socket.io, MongoDB, and Vanilla HTML/CSS/JS.

## Features
- User registration and login with JWT authentication
- Public chat room
- Private 1-on-1 messaging
- Real-time online/offline presence indicators
- Real-time typing indicators
- Persistent message history via MongoDB
- Clean and vibrant dark-mode UI

## Prerequisites
- Node.js (v14 or higher)
- MongoDB (Running locally or a MongoDB Atlas connection string)

## Local Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Rename `.env.example` to `.env` and update the values:
   - `JWT_SECRET`: Any secret string for signing JWT tokens.
   - `MONGODB_URI`: Your MongoDB connection string. If you don't have MongoDB installed locally, you can create a free cluster on MongoDB Atlas.

3. **Run the Application**
   For development (auto-restarts on code changes):
   ```bash
   npm run dev
   ```
   Or for production:
   ```bash
   npm start
   ```

4. **Access the Application**
   Open your browser and navigate to `http://localhost:3000`

## Deployment Guidelines (Render or Railway)

### 1. Database (MongoDB Atlas)
- Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
- Get your connection URI and replace `<password>` with your database user password.
- Make sure to allow network access from anywhere (`0.0.0.0/0`) or specific App Platform IP ranges.

### 2. Deploying on Render (Free Tier)
1. Push this project to a GitHub repository.
2. Go to [Render](https://render.com) and create a new **Web Service**.
3. Connect your GitHub repository.
4. Settings:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Go to **Environment Variables** and add:
   - `JWT_SECRET` -> (your secret)
   - `MONGODB_URI` -> (your atlas uri)
6. Click **Deploy**.

### 3. Deploying on Railway (Free Tier)
1. Push this project to a GitHub repository.
2. Go to [Railway](https://railway.app) and click **New Project** -> **Deploy from GitHub repo**.
3. Select your repository.
4. Once added, click on the deployed service -> **Variables** tab.
5. Add your `JWT_SECRET` and `MONGODB_URI` variables.
6. Railway will automatically build and deploy it using npm. Go to **Settings** -> **Networking** to generate a public domain URL.
