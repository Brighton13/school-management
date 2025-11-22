# Migration Guide: SQLite to Supabase PostgreSQL

This guide will help you migrate your school management system from SQLite to Supabase PostgreSQL.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A Supabase project created

## Step 1: Create a Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in your project details:
   - Name: `school-management` (or your preferred name)
   - Database Password: Create a strong password (save this!)
   - Region: Choose the closest region to your users
4. Wait for the project to be created (takes 1-2 minutes)

## Step 2: Get Your Database Connection String

1. In your Supabase project dashboard, go to **Settings** > **Database**
2. Scroll down to **Connection string** section
3. Select **URI** tab
4. Copy the connection string (it looks like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with the password you set when creating the project

## Step 3: Update Environment Variables

1. Open your `.env` file (or create one from `.env.example`)
2. Update the `DATABASE_URL`:
   ```env
   DATABASE_URL="postgresql://postgres:your-actual-password@db.your-project-ref.supabase.co:5432/postgres?schema=public"
   ```
3. Make sure to replace:
   - `your-actual-password` with your Supabase database password
   - `your-project-ref` with your actual Supabase project reference

## Step 4: Install Prisma Client and Generate

```bash
npm install
npx prisma generate
```

## Step 5: Push Schema to Supabase

This will create all tables in your Supabase database:

```bash
npx prisma db push
```

## Step 6: (Optional) Migrate Existing Data

If you have existing data in SQLite that you want to migrate:

### Option A: Using Prisma Migrate (Recommended)

1. Create an initial migration:
   ```bash
   npx prisma migrate dev --name init
   ```

2. This will create a migration file and apply it to your Supabase database

### Option B: Manual Data Export/Import

1. Export data from SQLite:
   ```bash
   # You can use a tool like DB Browser for SQLite to export to CSV/JSON
   # Or write a custom script to export data
   ```

2. Import data to Supabase:
   - Use Supabase dashboard SQL editor
   - Or use Prisma Studio: `npx prisma studio`

## Step 7: Seed the Database (Optional)

If you want to seed initial data:

```bash
npm run db:seed
```

## Step 8: Verify Connection

1. Test the connection:
   ```bash
   npx prisma studio
   ```
   This should open Prisma Studio and connect to your Supabase database

2. Or check in Supabase dashboard:
   - Go to **Table Editor** in your Supabase dashboard
   - You should see all your tables created

## Step 9: Update Your Application

The application code should work as-is since Prisma abstracts the database differences. However, verify:

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Test key functionality:
   - Login
   - Create a student
   - Create a class
   - Enter results

## Important Notes

### Connection Pooling

For production, Supabase recommends using connection pooling. Update your `DATABASE_URL` to use the pooler:

```
postgresql://postgres:password@db.project-ref.supabase.co:6543/postgres?pgbouncer=true
```

Note the port change from `5432` to `6543` and the `pgbouncer=true` parameter.

### Environment Variables in Production

- Never commit your `.env` file to version control
- Use environment variables in your hosting platform (Vercel, Railway, etc.)
- Supabase provides connection pooling for better performance

### Backup Your Data

- Supabase provides automatic backups
- You can also export data using Prisma Studio or Supabase dashboard

## Troubleshooting

### Connection Issues

- Verify your password is correct (no special characters need URL encoding)
- Check that your IP is allowed in Supabase (Settings > Database > Connection Pooling)
- For local development, you may need to add your IP to allowed IPs

### Migration Issues

- If you get errors about existing tables, you may need to drop them first (be careful!)
- Use `npx prisma migrate reset` to reset the database (WARNING: deletes all data)

### Performance

- Supabase free tier has connection limits
- Use connection pooling for production
- Consider upgrading if you have high traffic

## Next Steps

1. Set up Row Level Security (RLS) policies in Supabase if needed
2. Configure backups in Supabase dashboard
3. Set up monitoring and alerts
4. Consider using Supabase Auth instead of NextAuth (optional)

## Support

- Supabase Docs: https://supabase.com/docs
- Prisma Docs: https://www.prisma.io/docs
- Supabase Discord: https://discord.supabase.com

