# AuthFull Backend

This backend is the API layer for a full social authentication and networking platform. It powers sign-up, login, role-based access, upload handling, social posts, likes and comments, friend requests, admin control, and real-time private messaging.

## What this system does

The system is designed as a small social platform with authentication and user roles. In practice it supports:

- User registration and login
- JWT access tokens + refresh token flow with cookie-based sessions
- Password recovery with OTP email flow
- Profile image upload and user profile retrieval
- Feed creation with text and media attachments
- Likes, comments, and visibility for posts
- Friend request lifecycle: send, accept, reject, cancel, unfriend
- Private chat with unread-message tracking
- Socket.IO-powered real-time notifications and typing events

## Architecture overview

This project is built around a classic backend pattern:

- Express.js handles HTTP routes and request validation
- Prisma ORM connects to PostgreSQL
- JWT secures protected endpoints
- Multer stores uploaded media files under src/uploads
- Socket.IO listens on the same HTTP server for real-time communication
- The frontend calls these APIs with cookies enabled and automatically refreshes expired tokens

The app is not split into microservices; it is a single Express backend with several feature areas grouped by domain.

## Core flow of the app

### 1. Authentication flow

The auth flow is cookie-based:

- User logs in or registers via POST /login or POST /register
- The server generates:
  - an access token that expires in 1 hour
  - a refresh token that expires in 7 days
- Both tokens are stored in cookies:
  - accesstoken
  - refreshtoken
- Protected endpoints validate the access token through verifyToken middleware
- If the access token is expired, the frontend calls POST /refresh-token using the refresh cookie
- The server checks token_version and refresh_token stored in the database before issuing a new access token

This design ensures that users are signed in and the session can be invalidated across all devices when needed.

### 2. Role-based access

The app defines three major roles in the user model:

- user
- admin
- sudoadmin

Authorization is enforced by middleware in src/middleware/auth.ts:

- authAdmin allows only admin routes
- authSudoAdmin allows only super-admin routes
- authAdminOrSudoadmin allows both admin and super-admin role access

### 3. Social feed and content flow

Posts live in the posts table, and media files live in the media table. Each post can have:

- content text
- visibility setting (for example: all)
- user relationship
- many media rows
- many likes
- many comments

Upload and post creation are handled by controllers in the file upload and comment/like modules. Each user can like a post once, because the like model uses a composite primary key of user_id + post_id.

### 4. Friendship workflow

Friendship states are tracked by the friends table with statuses such as pending and accepted. The system supports:

- send friend request
- accept request
- reject or cancel request
- list all friends
- list pending requests
- check friend status between two users
- unfriend a user

The friends model stores sender and receiver relationships and prevents duplicate duplicate requests using a unique constraint.

### 5. Messaging and real-time chat

The messages table stores each message between two users. The backend exposes endpoints to:

- send message
- get messages between current user and another user
- get conversation summary
- mark messages as read
- delete message
- check unread counts

Socket.IO adds real-time features, including:

- join user-specific room
- send_message event to deliver a message instantly
- typing and stop_typing events
- messages_read event to notify a sender that receiver read the messages
- total_unread_count event to update unread badge counters

The server keeps a userSocketMap keyed by user ID so it can broadcast to the right connected sockets.

## Project structure

```text
express-ts/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app.ts
│   ├── multer.ts
│   ├── seedSudoAdmin.ts
│   ├── config/
│   │   ├── db.ts
│   │   └── prisma.ts
│   ├── controllers/
│   │   ├── comment.controller.ts
│   │   ├── fileupload.controller.ts
│   │   ├── friend.controller.ts
│   │   ├── like.controller.ts
│   │   └── login.controller.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── verifyToken.ts
│   ├── routes/
│   │   ├── auth.route.ts
│   │   ├── friends.route.ts
│   │   ├── message.route.ts
│   │   └── posts.route.ts
│   └── uploads/
├── package.json
├── prisma.config.ts
├── tsconfig.json
└── README.md
```

## Data model summary

The database is centered around the following Prisma models:

- users: account information, password hash, role, profile_url, refresh_token, token_version
- posts: social posts created by users
- media: uploaded media associated with a user or post
- likes: per-user likes on posts
- comments: comments tied to a post and user
- friends: friend relationship states with pending/accepted tracking
- messages: private chat records between sender and receiver
- otp_table: OTP storage for password recovery

## Environment variables

Create a .env file in the backend root:

```env
PORT=3000

DATABASE_URL=postgresql://postgres:your_password@localhost:5432/authdb

ACCESS_SECRET=your_access_secret
REFRESH_SECRET=your_refresh_secret

FILE_URL=http://localhost:3000

EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your_email
EMAIL_PASS=your_email_password

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
ADMIN_NAME=Super Admin
```

Notes:

- DATABASE_URL is the main connection string used by Prisma
- ACCESS_SECRET and REFRESH_SECRET are required for JWT signing
- FILE_URL is used when returning full URLs for uploaded media
- EMAIL_* settings are required for OTP mail sending

## Setup and running

### Install dependencies

```bash
cd express-ts
npm install
```

### Create database and apply migrations

```bash
npx prisma migrate deploy
```

If Prisma client is not generated yet, run:

```bash
npx prisma generate
```

### Create initial super admin

```bash
npm run seedSudoAdmin
```

### Start in development mode

```bash
npm run dev
```

The app listens on:

```text
http://localhost:3000
```

## Main API endpoints

### Authentication

- POST /register
- POST /login
- GET /profile
- POST /refresh-token
- POST /upload-profile
- GET /user/:userId
- POST /forget-password
- POST /verify-otp
- PATCH /reset-password
- PATCH /resend-otp
- PATCH /change-password
- POST /logout
- GET /getAllUsers
- DELETE /deleteUser/:id
- PATCH /logout-from-all

### Posts and media

- POST /upload-file
- GET /get-post/:id
- GET /get-all-posts
- GET /getLikes/:postId
- PATCH /update-post
- DELETE /delete-post/:id
- POST /toggle-like/:postId
- POST /post-comment
- GET /get-comments/:post_id
- DELETE /delete-comment/:commentId

### Friends

- POST /add-friend/:receiverId
- DELETE /unfriend/:friendId
- PATCH /accept-request/:senderId
- DELETE /request-cancel/:receiverId
- DELETE /delete-request/:senderId
- GET /allFriends
- GET /userFriends/:otherUserId
- GET /friend-request
- GET /sent-request
- GET /friend-status/:otherUserId

### Messages

- POST /message
- GET /message/:otherUserId
- GET /get-conversation
- PATCH /messages/:otherUserId/read
- DELETE /delete-message/:chatId
- GET /total-unread

## Socket.IO notes

The main server in src/app.ts creates an HTTP server and attaches Socket.IO to it. Real-time events are handled there, not on a separate app.listen instance.

Important socket events used in this project:

- join
- send_message
- receive_message
- typing
- stop_typing
- messages_read
- total_unread_count

This means the backend can instantly push updates to the frontend without polling.

## Security and behavior notes

- Access tokens are validated by verifyToken middleware through cookies
- refresh tokens are checked against the database value before being accepted
- logout-from-all works by bumping token_version, which invalidates tokens for all devices
- uploaded media is served from /uploads
- all protected routes require a valid access cookie and valid role checks

## Production build

Run the TypeScript build:

```bash
npm run build
```

Then start the built app:

```bash
npm start
```

## Developer tips

- If the frontend suddenly logs out, check the refresh token flow and cookie configuration first
- If a message does not appear in real time, confirm the user is connected to the correct Socket.IO room
- If Prisma errors appear, verify that PostgreSQL is running and DATABASE_URL is correctly configured
- If email OTP fails, check EMAIL_HOST, EMAIL_PORT, EMAIL_USER, and EMAIL_PASS

This backend is the core of the project: it owns the database, auth, social logic, and the websocket communication layer.
