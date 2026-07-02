# Express TypeScript Backend

Express TypeScript Backend powers the API layer for the authentication and social platform. It handles user auth, media uploads, social interactions, friendship management, admin controls, and real-time chat.

## Overview

This backend provides:

- Secure authentication with JWT and refresh tokens
- OTP-based password recovery through email
- File upload support for profile images and post media
- Post, like, comment, and feed management
- Friend request workflows and relationship status tracking
- Real-time messaging using Socket.IO
- Role-based endpoints for regular users, admins, and super admins

## Tech Stack

- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT + bcryptjs
- Multer
- Socket.IO
- Nodemailer

## Prerequisites

Before running the server, make sure you have:

- Node.js 18 or newer
- PostgreSQL installed and running
- An SMTP provider or mail credentials for OTP emails

## Installation

1. Open the backend folder:
   ```bash
   cd express-ts
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the project root with the following values:

   ```env
   PORT=3000

   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=your_db_username
   DB_PASSWORD=your_password
   DB_NAME=authdb

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

## Database Setup

Run Prisma migrations to create the required tables:

```bash
npx prisma migrate deploy
```

To create a default super admin account, run:

```bash
npm run seedSudoAdmin
```

## Running the Server

Start the backend in development mode:

```bash
npm run dev
```

The server will run at:

```text
http://localhost:3000
```

## Main API Areas

### Authentication

- `POST /register`
- `POST /login`
- `POST /refresh-token`
- `POST /forget-password`
- `POST /verify-otp`
- `PATCH /reset-password`
- `PATCH /change-password`
- `POST /logout`

### Posts and Media

- `POST /upload-file`
- `GET /get-all-posts`
- `GET /get-post/:id`
- `PATCH /update-post`
- `DELETE /delete-post/:id`
- `POST /toggle-like/:postId`
- `POST /post-comment`
- `GET /get-comments/:post_id`

### Friends

- `POST /add-friend/:receiverId`
- `PATCH /accept-request/:senderId`
- `DELETE /request-cancel/:receiverId`
- `GET /allFriends`
- `GET /friend-request`

### Messages

- `POST /message`
- `GET /message/:otherUserId`
- `GET /get-conversation`
- `PATCH /messages/:otherUserId/read`
- `DELETE /delete-message/:chatId`

## Build and Start

Build the project:

```bash
npm run build
```

Run the compiled application:

```bash
npm start
```

## Project Structure

- `src/controllers` - Business logic for auth, posts, friends, and chat
- `src/routes` - API route definitions
- `src/middleware` - Authentication and authorization checks
- `src/config` - Database and Prisma setup
- `src/uploads` - Uploaded media files
