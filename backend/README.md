# Campus Connection Platform - Backend API

A comprehensive Node.js/Express backend API for a university social platform that connects students and faculty through events, messaging, marketplace, and matching features.

## Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **User Profiles**: Extended profile management with interests and availability
- **Smart Matching**: Algorithm-based user matching by degree, interests, and availability
- **Events System**: Create, manage, and RSVP to campus events
- **Marketplace**: Buy/sell platform with transaction fees and reward points
- **Check-ins & Rewards**: QR code event check-ins with point rewards
- **Messaging**: Real-time user-to-user messaging system
- **Safety & Reports**: User reporting system with admin moderation
- **API Documentation**: Complete Swagger/OpenAPI documentation

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: Joi
- **Security**: Helmet, CORS, Rate Limiting
- **Documentation**: Swagger/OpenAPI
- **Password Hashing**: bcrypt

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. **Clone and navigate to backend directory**
```bash
cd backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=campus_connect
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=development

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

4. **Set up the database**
```bash
# Create database
createdb campus_connect

# Run schema
psql -d campus_connect -f database/schema.sql
```

### Using Supabase Postgres (Recommended for Cloud)

1. In Supabase, open your project and go to: Settings → Database → Connection string → Node.js. Copy the connection string.
2. In `backend/.env`, set `DATABASE_URL` to that value. Example:
```env
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/postgres
NODE_ENV=production
```
Notes:
- The backend prefers `DATABASE_URL` automatically (see `src/config/database.js`).
- SSL is enabled by default for `DATABASE_URL` with `rejectUnauthorized: false` (typical for Supabase managed certs).
- Alternatively, you can set discrete vars (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) and `DB_SSL=true`.

3. Apply the schema to Supabase:
- Open Supabase SQL Editor and paste the contents of `database/schema.sql`, then run it.
- Or use the Supabase CLI/psql against the Supabase connection.

4. Start the backend. All reads/writes now go to Supabase Postgres.

5. **Start the server**
```bash
# Development
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:3001`

## API Documentation

Once the server is running, visit:
- **Swagger UI**: `http://localhost:3001/api-docs`
- **Health Check**: `http://localhost:3001/health`

## API Endpoints

### Authentication
- `POST /api/v1/auth/signup` - Register new user (.edu email required)
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh JWT token
- `GET /api/v1/auth/me` - Get current user info

### Users & Profiles
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/profiles` - Update user profile
- `GET /api/v1/profiles/:id` - Get specific user profile

### Matching
- `GET /api/v1/matching/matches` - Get prioritized matches
- `GET /api/v1/matching/suggestions` - Get match suggestions

### Events
- `GET /api/v1/events` - List events
- `POST /api/v1/events` - Create event (faculty/admin)
- `POST /api/v1/events/:id/rsvp` - RSVP to event
- `GET /api/v1/events/:id` - Get event details

### Marketplace
- `GET /api/v1/marketplace` - List marketplace items
- `POST /api/v1/marketplace` - Create listing
- `PUT /api/v1/marketplace/:id` - Update listing
- `GET /api/v1/marketplace/my-items` - Get user's listings

### Check-ins & Rewards
- `POST /api/v1/checkins/validate` - Validate QR code check-in
- `GET /api/v1/rewards/balance` - Get reward points balance
- `POST /api/v1/rewards/redeem` - Redeem coupon
- `GET /api/v1/rewards/leaderboard` - Points leaderboard

### Messaging
- `GET /api/v1/messages` - Get user messages/conversations
- `POST /api/v1/messages` - Send message
- `GET /api/v1/messages/conversations` - List conversations
- `PUT /api/v1/messages/:id/read` - Mark message as read

### Reports & Safety
- `POST /api/v1/reports` - Submit user report
- `GET /api/v1/reports` - List reports (admin only)
- `PUT /api/v1/reports/:id/resolve` - Resolve report (admin only)
- `GET /api/v1/reports/my-reports` - Get user's submitted reports

## Database Schema

The database consists of the following main tables:

- **users** - Core user accounts and authentication
- **user_profiles** - Extended profile information
- **events** - Campus events and activities
- **event_rsvps** - Event attendance tracking
- **marketplace_listings** - Student marketplace items
- **messages** - User messaging system
- **checkins** - Event check-in tracking
- **rewards** - User reward points system
- **reports** - Safety and reporting system
- **user_restrictions** - User moderation and restrictions

See `database/schema.sql` for the complete schema definition.

## Security Features

- **JWT Authentication** with refresh tokens
- **Role-based Access Control** (student, faculty, admin)
- **Rate Limiting** to prevent abuse
- **Input Validation** using Joi schemas
- **SQL Injection Protection** with parameterized queries
- **CORS Configuration** for cross-origin requests
- **Helmet.js** for security headers
- **Password Hashing** with bcrypt

## Role-Based Permissions

### Students
- Create profiles, RSVP to events, use marketplace
- Send messages, earn rewards, submit reports
- Cannot create events or access admin functions

### Faculty
- All student permissions
- Create and manage events
- Access to enhanced event management

### Admin
- All permissions
- User management and moderation
- Report resolution and user restrictions
- System statistics and analytics

## Error Handling

The API uses consistent error response format:

```json
{
  "error": "Error message",
  "details": "Additional error details (in development)",
  "code": "ERROR_CODE"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resources)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Development

### Project Structure
```
backend/
├── src/
│   ├── config/          # Database and Swagger configuration
│   ├── middleware/      # Authentication and error handling
│   ├── routes/          # API route handlers
│   └── server.js        # Main application entry point
├── database/
│   └── schema.sql       # Database schema definition
├── package.json         # Dependencies and scripts
└── .env.example         # Environment variables template
```

### Scripts
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm test` - Run tests (when implemented)

### Contributing

1. Follow the existing code style and patterns
2. Add proper error handling and validation
3. Update API documentation for new endpoints
4. Test thoroughly before submitting changes

## Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Use secure JWT secrets
3. Configure production database
4. Set up proper CORS origins
5. Configure SMTP for email notifications

### Database Migration
Run the schema file on your production database:
```bash
psql -d your_production_db -f database/schema.sql
```

## Support

For issues and questions:
1. Check the API documentation at `/api-docs`
2. Review the database schema in `database/schema.sql`
3. Check server logs for detailed error information

## License

This project is part of the Campus Connection Platform educational project.
