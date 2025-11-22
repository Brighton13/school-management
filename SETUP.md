# Setup Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Up Environment Variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set:
   ```
   DATABASE_URL="file:./dev.db"
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-random-secret-key-here
   ```

3. **Initialize Database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Seed Initial Data**
   ```bash
   npm run db:seed
   ```
   
   This creates:
   - Admin user: `admin@school.com` / `admin123`
   - Principal user: `principal@school.com` / `principal123`
   - Sample classes, sections, and subjects

5. **Start Development Server**
   ```bash
   npm run dev
   ```

6. **Access the Application**
   - Open http://localhost:3000
   - Login with admin credentials

## Database Management

- **View Database**: `npm run db:studio`
- **Reset Database**: Delete `prisma/dev.db` and run `npx prisma db push` again
- **Generate Prisma Client**: `npm run db:generate`

## Production Deployment

1. **Update Database URL** in `.env` to use PostgreSQL or MySQL
2. **Update Prisma Schema** to use the production database provider
3. **Run Migrations**: `npx prisma migrate deploy`
4. **Build**: `npm run build`
5. **Start**: `npm start`

## Features Overview

### Admin Access
- Full system access
- User management
- All CRUD operations

### Principal Access
- View all reports
- Manage staff and students
- Approve enrollments

### Teacher Access
- Manage classes and subjects
- Record results and attendance
- View student information

### Accountant Access
- Manage fees and payments
- Generate financial reports

### Librarian Access
- Manage inventory
- Track library resources

### Student Access
- View own results
- Check attendance
- View fees

### Parent Access
- View child's results
- Check attendance
- View fees and payments

## Next Steps

1. Create additional users through the UI or seed script
2. Set up classes and sections
3. Assign subjects to classes
4. Enroll students
5. Create academic terms
6. Start recording results and fees

## Troubleshooting

### Database Issues
- Ensure SQLite is available or switch to PostgreSQL/MySQL
- Check DATABASE_URL in `.env`

### Authentication Issues
- Verify NEXTAUTH_SECRET is set
- Check NEXTAUTH_URL matches your domain

### Build Issues
- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`

