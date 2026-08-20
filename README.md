# 📧 ReachInbox Email Scheduler

A full-stack email scheduling platform built for the ReachInbox Software Development Intern assignment.

The application allows users to authenticate with Google, create email campaigns, upload recipient lists, schedule emails for specific times, configure sending delays and hourly limits, and track scheduled and sent emails through a dashboard.

The backend uses Express.js, TypeScript, PostgreSQL, Prisma, BullMQ, Redis, and Nodemailer with Ethereal Email to provide persistent job scheduling, rate limiting, concurrency control, and restart recovery.

---

## 📌 About the Project

Email scheduling becomes challenging when multiple emails need to be sent at specific times while respecting sender limits and avoiding duplicate sends.

This project implements a simplified production-style email scheduling system.

Instead of sending emails directly from an API request, the application separates scheduling from email processing.

When a user schedules a campaign:

1. Campaign information is stored in PostgreSQL.
2. Each recipient is stored as an individual scheduled email.
3. A delayed BullMQ job is created for each scheduled email.
4. Redis stores and manages the queue.
5. The email worker processes jobs when they become available.
6. Redis checks the sender's hourly sending capacity.
7. A Redis-backed sending slot enforces the minimum delay between emails.
8. Nodemailer sends the email through Ethereal SMTP.
9. PostgreSQL is updated with the final email status.

The system is designed to survive backend restarts without losing future scheduled jobs.

---

## ✨ Features

### 🔐 Google Authentication

- Google OAuth login
- Authenticated user information
- User name, email and profile avatar
- Logout functionality
- Logged-in user's email is used as the default sender

### 📬 Email Campaigns

- Create email campaigns
- Add multiple recipients
- Upload CSV/TXT recipient files
- Detect email addresses from uploaded files
- Configure subject and email body
- Configure campaign start time
- Configure delay between emails
- Configure hourly sending limit

### 👤 Multiple Senders

- Sender defaults to the logged-in Google account
- Sender email can be edited before scheduling
- Sender address is stored with each scheduled email
- Different senders have independent hourly rate limits

### 📊 Dashboard

#### Scheduled Emails

Displays:

- Recipient
- Subject
- Scheduled time
- Status

#### Sent Emails

Displays:

- Recipient
- Subject
- Sent time
- Status

The dashboard also provides loading, empty and error states.

---

## ⚙️ How the Scheduler Works

The application uses BullMQ delayed jobs backed by Redis.

No cron jobs are used.

When an email is scheduled for a specific time, the backend creates a delayed BullMQ job.

User
  ↓
React Frontend
  ↓
Express Backend
  ↓
PostgreSQL
  ↓
BullMQ
  ↓
Redis
  ↓
Email Worker
  ↓
Rate Limit Check
  ↓
Send Slot Reservation
  ↓
Nodemailer
  ↓
Ethereal SMTP
  ↓
PostgreSQL Status Update

This separation keeps the API responsible for creating jobs while the worker is responsible for processing and sending them.

---

## 🏗️ Architecture

The application consists of five major components:

### Frontend

The React frontend provides authentication, campaign creation and email monitoring.

### Backend API

The Express backend receives requests from the frontend and manages campaigns and scheduled emails.

### PostgreSQL

PostgreSQL stores persistent application state using Prisma.

### BullMQ + Redis

BullMQ manages delayed email jobs while Redis provides the persistent queue backend and shared state for rate limiting and send-slot coordination.

### Email Worker

The worker processes scheduled jobs, applies rate limits and delays, and sends emails through Nodemailer.

---

## 🧵 BullMQ & Redis

BullMQ is used as the application's job queue.

Redis provides the persistent storage required by BullMQ and is also used for rate limiting and send-slot coordination.

Each scheduled email has a corresponding BullMQ job.

The scheduled email record in PostgreSQL stores the BullMQ job ID so the application can associate the database record with its queue job.

This allows the application to recover scheduled work after a backend restart.

---

## ⚡ Worker Concurrency

The email worker uses BullMQ's configurable concurrency option.

The concurrency can be configured using:

    WORKER_CONCURRENCY=5

The default value is 5.

Multiple jobs can therefore be processed concurrently.

However, concurrent jobs still need to respect the minimum delay between actual email sends. This is coordinated through Redis.

---

## ⏱️ Minimum Delay Between Emails

The application enforces a minimum delay between individual email sends.

The default delay is 2 seconds.

It can be configured using:

    MIN_EMAIL_DELAY_SECONDS=2

For example:

    Email 1 → Send
          ↓
       2 seconds
          ↓
    Email 2 → Send
          ↓
       2 seconds
          ↓
    Email 3 → Send

The worker reserves the next available sending slot using Redis before sending.

This prevents multiple concurrent workers from sending emails too close together.

---

## 🚦 Hourly Rate Limiting

The application implements a per-sender hourly email limit.

The limit is configured for each campaign.

Redis maintains the sending counter using a key based on the sender and the current hour.

Conceptually:

    email-rate:<sender-email>:<hour-window>

For example:

    Sender A → 100 emails/hour
    Sender B → 100 emails/hour

Sender A's usage does not consume Sender B's hourly capacity.

Because the counter is stored in Redis rather than application memory, it can be shared between concurrent workers and application instances.

---

## 🔁 Rate Limit Rescheduling

When a sender reaches the configured hourly limit, the email is not dropped.

Instead, the worker reschedules the job for the next available hour.

    Hourly limit reached
            ↓
    Do not send current email
            ↓
    Create delayed BullMQ job
            ↓
    Next available hour
            ↓
    Process email later

The scheduled email remains in PostgreSQL and its new BullMQ job ID is stored.

This ensures that emails exceeding the hourly limit remain in the system instead of being permanently failed.

---

## 🔄 Restart Persistence

Persistence across backend restarts is one of the main features of the scheduler.

PostgreSQL stores:

- Campaign information
- Recipient
- Sender
- Scheduled time
- Status
- Sent time
- Error message
- BullMQ job ID

Redis/BullMQ stores:

- Delayed jobs
- Waiting jobs
- Queue state
- Rate-limit counters
- Sending-slot state

When the backend starts, the recovery process checks scheduled emails that are still marked as SCHEDULED.

### Future email with an existing job

The existing BullMQ job is preserved.

### Missing job

A new BullMQ job is created.

### Past-due email

If the scheduled time has already passed, the recovery process creates a new job with zero additional scheduling delay.

### Already sent email

Emails already marked as SENT are not recreated.

This allows future scheduled emails to continue after a backend restart without requiring the user to create the campaign again.

---

## 🛡️ Idempotency

Before sending an email, the worker checks its database status.

If the email is already marked as SENT, the worker does not send it again.

After successful delivery, the database is updated with:

    status = SENT
    sentAt = current timestamp

This prevents already-sent emails from being intentionally sent again during recovery.

---

## 👤 Multiple Senders

The application supports different sender addresses at the application level.

By default, the sender field is populated with the logged-in Google account email.

The user can edit the sender before creating a campaign.

The selected sender email is stored with the scheduled email and passed to Nodemailer as the From address.

The hourly rate limiter also tracks each sender independently.

Ethereal provides the SMTP account used for testing. Changing the From address changes the application-level sender identity; it does not create another Ethereal SMTP account.

---

## 📧 Email Delivery

The project uses Nodemailer for SMTP communication and Ethereal Email as the fake SMTP provider.

The configured SMTP credentials are used to create the Nodemailer transporter.

Each email contains:

- Sender
- Recipient
- Subject
- Body

Ethereal captures the messages so they can be inspected without sending real emails.

---

## 🖥️ Frontend

The frontend provides a dashboard for managing scheduled email campaigns.

### Google Login

Users authenticate using Google OAuth.

After login, the dashboard displays:

- Name
- Email
- Avatar
- Logout option

### Compose New Email

The compose interface allows users to:

- Enter or upload recipients
- Upload CSV/TXT files
- Detect email addresses
- Select and edit sender email
- Enter subject
- Enter email body
- Select start time
- Configure delay
- Configure hourly limit

### Scheduled Emails

The Scheduled Emails section displays:

- Recipient
- Subject
- Scheduled time
- Status

### Sent Emails

The Sent Emails section displays:

- Recipient
- Subject
- Sent time
- Status

---

## 📄 CSV / TXT Recipient Upload

Recipients can be supplied through a CSV or text file.

The frontend extracts email addresses from the uploaded file and displays the number of detected email addresses.

Each detected recipient becomes an individual scheduled email in the backend.

For example:

    recipients.csv
      ├── user1@example.com
      ├── user2@example.com
      ├── user3@example.com
      └── user4@example.com

Each recipient is scheduled independently.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| React | Frontend application |
| TypeScript | Type safety |
| Tailwind CSS | UI styling |
| Vite | Frontend development and build |
| Express.js | Backend REST API |
| PostgreSQL | Persistent application data |
| Prisma | Database ORM |
| Redis | Queue and shared state |
| BullMQ | Delayed job scheduling |
| Nodemailer | SMTP communication |
| Ethereal Email | Fake SMTP provider |
| Google OAuth | Authentication |

---

## 📁 Project Structure

    reachinbox-email-scheduler/
    │
    ├── backend/
    │   ├── src/
    │   │   ├── lib/
    │   │   ├── routes/
    │   │   ├── services/
    │   │   ├── workers/
    │   │   └── server.ts
    │   │
    │   ├── prisma/
    │   ├── package.json
    │   └── .env.example
    │
    ├── frontend/
    │   ├── src/
    │   │   ├── App.tsx
    │   │   ├── api.ts
    │   │   └── ...
    │   │
    │   ├── public/
    │   ├── package.json
    │   └── ...
    │
    └── README.md

> The actual `.env` file is intentionally excluded from the repository. Use `.env.example` as a reference for the required environment variables.

---

## 🔧 Environment Variables

Create a `.env` file inside the backend directory using `.env.example` as a reference.

    DATABASE_URL=postgresql://username:password@localhost:5432/reachinbox

    REDIS_URL=redis://localhost:6379

    SMTP_HOST=smtp.ethereal.email
    SMTP_PORT=587
    SMTP_SECURE=false
    SMTP_USER=your_ethereal_username
    SMTP_PASSWORD=your_ethereal_password

    WORKER_CONCURRENCY=5
    MIN_EMAIL_DELAY_SECONDS=2

Google OAuth and authentication-related variables should also be configured according to the authentication implementation.

Never commit `.env` files, passwords, OAuth secrets or SMTP credentials to GitHub.

---

## 🚀 Getting Started

### Prerequisites

Make sure the following are installed:

- Node.js
- npm
- PostgreSQL
- Redis
- Git

Docker can also be used to run Redis locally.

### 1. Clone the Repository

    git clone <your-repository-url>
    cd reachinbox-email-scheduler

### 2. Start Redis

Using Docker:

    docker run --name reachinbox-redis -p 6379:6379 -d redis

Or use an existing Redis installation.

The application expects Redis to be available at localhost:6379.

### 3. Configure PostgreSQL

Create a PostgreSQL database and configure the DATABASE_URL in the backend `.env` file.

### 4. Configure the Backend

    cd backend
    npm install

Generate Prisma Client:

    npx prisma generate

Apply the database migrations:

    npx prisma migrate dev

Configure the backend `.env` file.

### 5. Start the Backend

    npx tsx watch src/server.ts

The backend runs on:

    http://localhost:5000

The BullMQ email worker starts together with the backend.

### 6. Start the Frontend

Open another terminal:

    cd frontend
    npm install
    npm run dev

Open the local URL provided by Vite.

---

## 📨 Ethereal Email Setup

The application uses Ethereal Email for safe email testing.

1. Create an Ethereal Email test account.
2. Obtain the SMTP credentials.
3. Add them to the backend `.env` file.
4. Start the backend.
5. Schedule an email.
6. Open the Ethereal mailbox to view the captured email.

SMTP configuration:

    SMTP_HOST=smtp.ethereal.email
    SMTP_PORT=587
    SMTP_SECURE=false
    SMTP_USER=your_ethereal_username
    SMTP_PASSWORD=your_ethereal_password

---

## 🧪 Example

A campaign can be configured like:

    Recipients: 10
    Start Time: 10:00 AM
    Delay: 2 seconds
    Hourly Limit: 100

The backend creates one scheduled email record and one BullMQ job for each recipient.

At the scheduled time, the worker processes the jobs while respecting the configured delay and hourly limit.

The emails are then captured by Ethereal and the database records are updated.

---

## 🔄 Restart Persistence Test

To verify persistence:

1. Schedule an email for a future time.
2. Stop the backend.
3. Start the backend again.
4. The recovery process checks the scheduled email and its BullMQ job.
5. The future job remains scheduled.
6. When the scheduled time arrives, the worker processes it.

This demonstrates that scheduled work does not depend solely on the Node.js process remaining alive.

---

## 🧠 Design Decisions

### Why BullMQ?

BullMQ provides delayed jobs and persistent queue management backed by Redis, making it suitable for scheduled email processing.

### Why PostgreSQL?

PostgreSQL stores durable application state such as campaigns, scheduled emails, statuses and timestamps.

### Why Redis?

Redis is used by BullMQ and also provides shared state for hourly rate limiting and send-slot coordination.

### Why a Worker?

The worker separates email processing from the HTTP API.

The API creates jobs, while the worker processes and sends them.

### Why Ethereal?

Ethereal provides a safe fake SMTP service for testing without sending real emails.

---

## ⚖️ Trade-offs & Limitations

- Ethereal is used instead of a real email provider because this project is intended for testing and demonstration.
- The application uses a configured Ethereal SMTP account while allowing the email From address to be selected per scheduled email.
- Hourly rate limiting is implemented per sender using Redis.
- The minimum sending interval is coordinated using Redis.
- Dashboard updates use API refreshes rather than WebSockets.
- The implementation focuses on the scheduler requirements of the assignment rather than implementing the complete infrastructure of a production email platform.
- A production version would require more advanced delivery tracking, retry and backoff strategies, monitoring, alerting, provider-specific handling and operational tooling.

---

## 🔮 Future Improvements

Potential improvements for a production version include:

- Real email provider integration
- Email delivery and bounce tracking
- Retry with exponential backoff
- Email open and click tracking
- Campaign pause and resume
- Scheduled email cancellation
- Real-time dashboard updates using WebSockets
- Distributed worker deployment
- Advanced monitoring and logging
- Provider-specific sender authentication
- Role-based access control
- Improved observability and alerting

---

## 👩‍💻 Author

**Veda Venkat R**

Computer Science Engineering  
BMS College of Engineering, Bengaluru

---

Built with React, TypeScript, Express.js, PostgreSQL, Prisma, BullMQ, Redis and Ethereal Email.
