# School Management System

A comprehensive Next.js-based school management system with role-based access control, featuring student enrollment, class management, results tracking, fees management, inventory control, and more.

## Features

### Core Features
- **Role-Based Access Control**: Configurable roles (Admin, Principal, Teacher, Accountant, Librarian, Student, Parent) with granular permissions
- **Student Management**: Complete student enrollment, records, and profile management
- **Class & Section Management**: Organize students into classes and sections
- **Subject Management**: Manage curriculum and subjects
- **Staff Management**: Comprehensive staff records and management
- **Results Management**: Record and track student results with PDF report generation
- **Fees Management**: Track student fees, payments, and outstanding amounts
- **Term Management**: Manage academic terms and sessions
- **Inventory Management**: Track school inventory with low stock alerts
- **Announcements**: Broadcast messages to students, parents, and staff
- **Attendance Tracking**: (Framework ready for implementation)

### Additional Features
- Modern, responsive UI built with Tailwind CSS and shadcn/ui
- Secure authentication with NextAuth.js
- Database management with Prisma ORM
- Real-time data updates
- PDF report generation for results

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: SQLite (Prisma ORM) - easily switchable to PostgreSQL/MySQL
- **Authentication**: NextAuth.js
- **UI**: Tailwind CSS, Radix UI, shadcn/ui
- **PDF Generation**: jsPDF

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd school-management
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your configuration:
```
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-change-in-production
```

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Setup

The system uses Prisma ORM with **PostgreSQL (Supabase)** by default. 

### Using Supabase (Recommended)

1. Create a Supabase project at https://supabase.com
2. Get your connection string from Supabase Dashboard > Settings > Database
3. Update your `.env` file:
```env
DATABASE_URL="postgresql://postgres:your-password@db.your-project-ref.supabase.co:5432/postgres?schema=public"
```
4. Push the schema to Supabase:
```bash
npx prisma generate
npx prisma db push
```

See [MIGRATION_TO_SUPABASE.md](./MIGRATION_TO_SUPABASE.md) for detailed migration instructions.

### Using Local PostgreSQL

1. Update `prisma/schema.prisma` (already set to postgresql)
2. Update your `.env` file with your PostgreSQL connection string
3. Run migrations:
```bash
npx prisma migrate dev
```

## Creating Initial Admin User

To create an admin user, you can use Prisma Studio:

```bash
npx prisma studio
```

Or create a seed script in `prisma/seed.ts` and run:
```bash
npx prisma db seed
```

## Project Structure

```
school-management/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   ├── login/             # Login page
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # UI components (shadcn/ui)
│   └── layout/           # Layout components
├── lib/                   # Utility functions
│   ├── auth.ts           # NextAuth configuration
│   ├── prisma.ts         # Prisma client
│   └── utils.ts          # Utility functions
├── prisma/               # Database schema
│   └── schema.prisma     # Prisma schema
└── types/                # TypeScript type definitions
```

## Features by Role

### Admin
- Full system access
- User management
- System configuration

### Principal
- View all reports
- Manage staff and students
- Approve enrollments

### Teacher
- Manage classes and subjects
- Record results and attendance
- View student information

### Accountant
- Manage fees and payments
- Generate financial reports

### Librarian
- Manage inventory
- Track library resources

### Student
- View own results
- Check attendance
- View fees

### Parent
- View child's results
- Check attendance
- View fees and payments

## API Routes

- `/api/students` - Student management
- `/api/enrollment` - Enrollment management
- `/api/classes` - Class management
- `/api/subjects` - Subject management
- `/api/staff` - Staff management
- `/api/results` - Results management
- `/api/fees` - Fees management
- `/api/terms` - Term management
- `/api/inventory` - Inventory management
- `/api/announcements` - Announcements

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For support, email support@example.com or create an issue in the repository.

