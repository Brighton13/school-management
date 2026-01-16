# Environment Variables Setup

## Quick Setup

1. **Create a `.env` file** in the root directory of the project

2. **Copy the following content** into your `.env` file:

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=change-this-to-a-random-secret-key-in-production

# App
NODE_ENV=development
```

## Generating a Secure Secret Key

For production, generate a secure secret key using one of these methods:

### Using OpenSSL (Recommended)
```bash
openssl rand -base64 32
```

### Using Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Using Online Generator
Visit: https://generate-secret.vercel.app/32

## Environment Variables Explained

### DATABASE_URL
- **Development**: `file:./dev.db` (SQLite - default)
- **Production**: Use PostgreSQL or MySQL connection string
  - PostgreSQL: `postgresql://user:password@localhost:5432/school_management?schema=public`
  - MySQL: `mysql://user:password@localhost:3306/school_management`

### NEXTAUTH_URL
- **Development**: `http://localhost:3000`
- **Production**: Your production domain (e.g., `https://yourschool.com`)

### NEXTAUTH_SECRET
- A random secret key used to encrypt JWT tokens
- **IMPORTANT**: Change this in production!
- Generate using: `openssl rand -base64 32`

### NODE_ENV
- `development` for local development
- `production` for production deployment

## Important Notes

⚠️ **Never commit `.env` to version control!**
- The `.env` file is already in `.gitignore`
- Always use `.env.example` or `env.example` as a template
- Keep your production secrets secure

## Verification

After creating your `.env` file, verify it's working:

```bash
# Check if environment variables are loaded
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"
```

Or simply start the dev server:
```bash
npm run dev
```

If there are no errors, your environment is configured correctly!

