# BuildBridge Backend

REST and Socket.IO API for BuildBridge, a full-stack marketplace where customers discover digital
service providers and manage inquiries, proposals, messaging, reviews, and completed engagements.

The repository contains a real Express + MongoDB application. It is not a mock server. Seeded
accounts, ratings, reviews, and engagement history are **fictional demo data** and must be presented
as such.

## Stack

- Node.js + Express 5
- MongoDB + Mongoose
- JWT authentication (HttpOnly cookie and Bearer token) with bcrypt password hashing
- Zod request validation, Helmet, CORS allowlisting, and rate limiting
- Multer memory uploads with Cloudinary delivery and a local-disk fallback
- Socket.IO for live conversation and notification events
- Node's built-in test runner with Supertest integration tests
- 16 professional provider roles across 11 service categories

## Repository layout

```
app.js                 Express application factory
index.js               HTTP + Socket.IO server bootstrap
config/                Environment, database, Cloudinary, and provider-role catalogs
controllers/           Route handlers
middleware/            Auth, validation, uploads, rate limits, errors
models/                Mongoose schemas
routes/                API route definitions
seed/                  Fictional demo data, image mapping, and backfill helpers
tests/                 API integration suite
utils/                 Shared helpers (tokens, access, notifications, search, file storage)
public/static/demo/    Demo photography and generated organization logos
uploads/               Optional local upload fallback (private by default)
```

## Quick start

Requirements: Node.js 20+ (tested with Node 22), npm, and MongoDB (Atlas or local).

```bash
npm install
cp .env.example .env
# Fill in MONGODB_URL and JWT_SECRET in .env.
# Add all three Cloudinary values for CDN uploads, or leave UPLOAD_DRIVER unset for auto mode.
node seed/generate-assets.js   # only needed for generated organization logos
npm run seed                   # destructive: clears collections, then loads fictional demo data
npm run dev
```

The API listens on `http://localhost:3000` by default. Verify it with:

```bash
curl http://localhost:3000/api/health
```

The frontend development server must run at the origin configured in `CLIENT_URL` (default
`http://localhost:5173`) so credentialed requests and CORS work.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `MONGODB_URL` | Yes | — | MongoDB connection string, including the database name |
| `JWT_SECRET` | Yes | — | Secret used to sign JWTs; use a long random value |
| `PORT` | No | `3000` | HTTP server port |
| `NODE_ENV` | No | `development` | `development`, `test`, or `production` |
| `JWT_EXPIRES_IN` | No | `7d` | JWT lifetime |
| `CLIENT_URL` | No | `http://localhost:5173` | Comma-separated allowed web origins |
| `PUBLIC_URL` | No | `http://localhost:3000` | Public API base URL |
| `UPLOAD_DRIVER` | No | `auto` | `auto` uses Cloudinary when configured, otherwise local disk; `cloudinary` requires the CDN; `local` forces disk |
| `CLOUDINARY_CLOUD_NAME` | With Cloudinary | — | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | With Cloudinary | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | With Cloudinary | — | Cloudinary API secret |
| `CLOUDINARY_FOLDER` | No | `buildbridge` | Folder prefix for stored uploads |

Cloudinary credentials must belong to the same cloud and be copied exactly from the Cloudinary
console. Verify them without uploading anything:

```bash
node -e "require('dotenv').config(); require('./config/cloudinary').api.ping().then(() => console.log('Cloudinary credentials valid'))"
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Secrets belong only in `.env`, deployment environment variables, or a secret manager. Never commit
them or expose them through API responses.

## Demo accounts

`npm run seed` clears the application collections before inserting demo data. Never run it against
production data. The script refuses to run when `NODE_ENV=production` unless `--force` is passed,
which should only be used for an intentional demo deployment.

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@buildbridge.dev` | `Admin@12345` |
| Customer | `customer@buildbridge.dev` | `Demo@12345` |
| Customer | `maya@buildbridge.dev` | `Demo@12345` |
| Provider (developer) | `aria@buildbridge.dev` | `Demo@12345` |
| Provider (freelancer) | `marcus@buildbridge.dev` | `Demo@12345` |
| Organization owner (studio) | `nina@pixelforge.dev` | `Demo@12345` |
| Team member | `amara@pixelforge.dev` | `Demo@12345` |

All other seeded accounts use `Demo@12345`. Admin credentials are intentionally documented only in
this README and are never shown in the public web interface. Public registration can only create
`customer` or `provider` accounts; the API rejects attempts to self-assign the `admin` role.

The seed includes 11 parent categories and 115 subcategories, all database-driven and editable by an
administrator.

## Provider roles

Provider accounts choose a provider type (freelancer, developer, company, agency, or studio) and one
to three professional roles from this catalog:

`software-engineer`, `web-developer`, `app-developer`, `game-developer`, `ai-engineer`,
`data-scientist`, `devops-engineer`, `cybersecurity-specialist`, `product-designer`,
`brand-designer`, `motion-designer`, `digital-marketer`, `seo-specialist`, `content-creator`,
`ecommerce-specialist`, `technical-consultant`.

The starred primary role shapes the provider's workspace copy, discovery filtering, and profile
badges. Customers and administrators cannot create buying-side inquiries from provider or admin
workspaces; inquiries are submitted by customer accounts.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start with nodemon and restart on changes |
| `npm start` | Start the API without a watcher |
| `npm run seed` | Replace data with the fictional demo dataset |
| `npm test` | Run integration tests against a dedicated `_test` database |

## API overview

Base path: `/api`. Send and receive JSON. Authenticate with `Authorization: Bearer <token>` or the
`bb_token` HttpOnly cookie set at login. Errors use the shape
`{ "message": "...", "errors": [{ "field": "...", "message": "..." }] }`.

| Area | Main endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `PUT /auth/me`, `PUT /auth/password`, `POST /auth/forgot-password`, `POST /auth/reset-password` |
| Discovery | `GET /marketplace/home`, `GET /marketplace/search?q=`, `GET /categories`, `GET /categories/:slug`, `GET /providers` (supports `role`), `GET /providers/featured`, `GET /providers/:slug`, `POST /providers/:slug/view`, `GET /services`, `GET /services/:slug`, `GET /portfolio`, `GET /portfolio/:slug` |
| Public settings | `GET /settings/public` |
| Inquiries | `GET /inquiries`, `POST /inquiries`, `GET /inquiries/:id`, `PATCH /inquiries/:id/status`, `POST /inquiries/:id/conversation`, `POST /inquiries/:id/proposals` |
| Proposals | `PUT /proposals/:id`, `POST /proposals/:id/accept`, `POST /proposals/:id/decline`, `POST /proposals/:id/withdraw` |
| Messaging | `GET /conversations`, `GET /conversations/:id`, `POST /conversations/:id/messages` |
| Favorites | `GET /favorites`, `POST /favorites/:providerId`, `DELETE /favorites/:providerId` |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all` |
| Reviews | `GET /reviews/mine`, `POST /reviews` |
| Reports and contact | `POST /reports`, `POST /contact` |
| Uploads | `POST /uploads`, `GET /uploads/:id/file`, `DELETE /uploads/:id` |
| Provider dashboard | `GET/PUT /provider/profile`, `POST /provider/publish`, `GET /provider/overview`, `GET/PUT /provider/organization`, team member endpoints, CRUD at `/provider/services` and `/provider/portfolio` |
| Team invitations | `GET /team/invitations`, `POST /team/invitations/:id/respond` |
| Admin | `/admin/stats`, `/admin/users`, `/admin/providers`, `/admin/categories`, `/admin/reviews`, `/admin/reports`, `/admin/messages`, `/admin/audit-logs`, `/admin/settings` |

Every `/admin` endpoint additionally requires an authenticated account with the `admin` role.

### Domain rules

- **Inquiry lifecycle:** `new → in_discussion → proposal_sent → accepted → completed`, plus
  `declined` and `cancelled` outcomes. Only the receiving provider can open discussion or send a
  proposal. Only the customer can accept or decline a proposal, complete an accepted engagement, or
  cancel. A proposal can be withdrawn and resent before a customer responds.
- **Reviews:** one review per inquiry, accepted only from the customer after the engagement is marked
  complete. Provider ratings are recalculated from published reviews when a review is created or
  moderated.
- **Ownership:** customers only see their own inquiries; providers only see inquiries and
  conversations they participate in, including through active organization membership. Provider
  services and portfolio projects can only be edited by their owning workspace.
- **Admin safety:** administrator accounts cannot be suspended or edited through the account endpoint,
  and public signup can never create an administrator. Publishing a provider profile is blocked while
  its owner is suspended.
- **Agreement, not payment:** accepting a proposal records an agreement in principle. BuildBridge has
  no payment processing, and no endpoint claims or fabricates payment activity.

### Realtime

Socket.IO authenticates with the same JWT (handshake auth token, Bearer header, or cookie). Clients
join authorized conversation rooms and receive:

- `message:new` for new persisted messages
- `conversation:updated` for proposal and inquiry activity
- `notification:new` for user notifications

Messages are stored in MongoDB before being emitted, so reconnecting clients can reload history
through `GET /conversations/:id`.

## Uploads

- Multer uses in-memory storage, so unfinished uploads do not leave temporary files on disk.
- Images accept JPEG, PNG, WebP, and GIF up to 12 MB.
- Attachments accept PDF, ZIP, Word, Excel, and plain text up to 12 MB.
- `avatar`, `logo`, `cover`, `portfolio`, and `service` uploads are public.
- `attachment` uploads are private: only the owner, an administrator, or a participant in an inquiry
  linked to the file can read them.
- Upload metadata is always stored in MongoDB.

With all three Cloudinary values configured, `UPLOAD_DRIVER=auto` sends uploads to Cloudinary.
Public images use an optimized `c_limit,w_2400/q_auto,f_auto` delivery URL. Private attachments use
Cloudinary's private delivery type and are served through a short-lived signed URL after the same
application-level access check. When Cloudinary lacks credentials or rejects them in auto mode, the
API logs a warning and stores the file under `uploads/` so local development still works. Set
`UPLOAD_DRIVER=cloudinary` to make credential or CDN failures visible instead of silently falling
back, and `UPLOAD_DRIVER=local` for offline development.

Deleting an upload removes both its metadata and its stored object. In production, use valid
Cloudinary credentials and `UPLOAD_DRIVER=cloudinary`, or replace the storage adapter with another
shared object store before running more than one API instance.

## Security

- Passwords are hashed with bcrypt (cost 12) and are never returned by the API.
- JWTs are delivered as an HttpOnly, SameSite=Lax cookie; production also marks the cookie `Secure`.
- Helmet, CORS allowlisting, JSON body limits, and route-specific rate limits are enabled.
- Every write endpoint validates its payload with Zod.
- Accounts and provider profiles can be suspended; suspended users cannot authenticate or use
  protected APIs.
- Admin actions are recorded in an append-only audit log.
- Password reset tokens are single-use and expire after one hour. In non-production environments the
  API returns `devResetToken` in the forgot-password response because no email provider is configured.
  Never enable that behavior in production and configure transactional email before launch.
- The upload endpoint validates file types and sizes, generates random stored filenames, and sets
  `X-Content-Type-Options: nosniff`.

## Tests

```bash
npm test
```

The suite uses Node's test runner with Supertest (16 integration tests) and covers:

1. Admin role cannot be self-assigned at registration.
2. Registration returns a JWT and HttpOnly cookie; `/auth/me` enforces authentication.
3. Login rejection and the forgot/reset password round trip.
4. Admin route protection, admin-account protection, and audit access.
5. Provider onboarding publish guard.
6. Public marketplace endpoints and branding settings.
7. Inquiry/proposal workflow ownership and transition rules.
8. Proposal withdrawal, resend, and decline.
9. Reviews only after completion, duplicate prevention, and moderation rating recalculation.
10. Provider service ownership and partial-update default preservation.
11. Portfolio partial-update status preservation.
12. Upload type validation and private attachment authorization.
13. Contact messages and admin inbox handling.
14. Provider suspension, public visibility, login blocking, and reactivation.
15. Provider accounts cannot create buying-side inquiries.

The test suite requires the normal `.env` connection string. It appends `_test` to the database name
(or uses the existing `_test` database), verifies the name ends in `_test`, and **drops that database**
before and after the run. It never touches the development database.

Uploads created during a run are deleted by the endpoints under test, with a final cleanup pass for
any tracked files.

## Demo imagery and content

The photography under `public/static/demo/photos/` is sourced from Unsplash and used under the
[Unsplash License](https://unsplash.com/license). Profile names, biographies, organizations,
services, projects, ratings, reviews, and engagement history are fictional sample data. The photos
illustrate those fictional profiles; they are not portraits of the named people or endorsements by
the photographers. Organization logos are generated monograms.

## Known limitations and deliberately unfinished work

- No payment processing, escrow, invoicing, or checkout. This is intentional; accepting a proposal is
  not a payment event.
- No transactional email, SMS, or push delivery. Password reset returns a development token only.
- Cloudinary is wired for production uploads, but the automated suite exercises only the local
  fallback. Credentials must be validated per environment; auto mode falls back to local disk if they
  are missing or rejected.
- Rate limiting and Socket.IO use in-memory state, which is suitable for one instance. Horizontal
  scaling requires a shared store and a Socket.IO adapter.
- The only automated tests are backend API integration tests. Frontend lint/build are verified, but
  there is no frontend unit or browser E2E suite yet.
- The Expo mobile application is not part of this repository and has not been started. The website is
  the priority; mobile will consume this API afterward.
- Seeded marketplace activity is fictional demo content. Do not present its ratings or reviews as
  real customer feedback.

## Deployment notes

- Set `NODE_ENV=production`, a strong `JWT_SECRET`, and exact production `CLIENT_URL` origins.
- Serve the built frontend and API behind HTTPS on the same site or configure CORS explicitly.
- Do not run the seed script against production data.
- Set all three Cloudinary credentials and `UPLOAD_DRIVER=cloudinary` in production, then run the
  credential check above. Back up upload metadata with MongoDB. If you intentionally use local
  storage, mount a persistent volume and back it up.
- Use MongoDB Atlas backups and network access rules appropriate for your deployment.
