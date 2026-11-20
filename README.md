# SalonBook — Backend Server (REST API)

Backend REST API for **SalonBook**, a role-based salon appointment booking platform built with Express.js, TypeScript, MongoDB (Mongoose), JWT verification middleware, and Stripe Checkout + Webhooks.

## Important Features

- **Role-Based JWT Authentication Middleware**: Verifies Bearer JWTs minted from authenticated Better Auth sessions and checks live `role` and `isBlocked` status in MongoDB on every protected request.
- **Salon Service Management**: Public active service listing with search by name, category filtering, and price sorting; Admin-only CRUD and Active/Inactive status toggles.
- **Appointment Booking & Conflict Prevention**: Customers can request appointments for active services with predefined time slots; prevents duplicate active bookings for the same date and time slot.
- **Stripe Checkout & Verified Webhooks**: Customers pay for confirmed appointments via Stripe Checkout. Appointment `paymentStatus` is updated to `paid` and saved in `transactions` **only** after verifying the Stripe webhook signature (`checkout.session.completed`).
- **Admin User & Transaction Oversight**: Admin can view/block/unblock customers and inspect read-only payment transaction records.
- **Role-Based Dashboard Analytics**: Dedicated statistics endpoints for Customer and Admin dashboards.

## Technology Stack

- **Runtime & Framework**: Node.js, Express.js, TypeScript
- **Database**: MongoDB with Mongoose (`users`, `services`, `appointments`, `transactions`)
- **Authentication**: JWT verification (`jsonwebtoken`) synced with Better Auth `users` collection
- **Payments**: Stripe Checkout & Stripe Webhooks

## Installation Instructions

```bash
git clone <your-server-repo-url>
cd salonbook-server
npm install
```

Create a `.env` file in the project root based on `.env.example`:

```bash
cp .env.example .env
```

## Required Environment Variables

Provide values for the following variables in `.env` (never commit `.env` to GitHub):

- `PORT`
- `NODE_ENV`
- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CURRENCY`

## How to Run Locally

1. Start the development server:
   ```bash
   npm run dev
   ```
2. (Optional) Seed sample salon services:
   ```bash
   npm run seed
   ```
3. (Optional) Promote an existing registered user to Admin securely:
   ```bash
   npm run promote-admin -- admin@salonbook.com
   ```
4. Forward Stripe webhooks locally using the Stripe CLI:
   ```bash
   stripe listen --forward-to http://localhost:5000/api/payments/webhook
   ```

## Links

- **Live Website**: `<Add your deployed frontend URL here>`
- **Client Repository**: `<Add your client GitHub repository URL here>`
- **Server Repository**: `<Add your server GitHub repository URL here>`
