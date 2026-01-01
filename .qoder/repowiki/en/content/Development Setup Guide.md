# Development Setup Guide

<cite>
**Referenced Files in This Document**   
- [README.md](file://README.md)
- [package.json](file://package.json)
- [src/lib/supabase.ts](file://src/lib/supabase.ts)
- [src/middleware.ts](file://src/middleware.ts)
- [src/lib/constants/auth-constants.ts](file://src/lib/constants/auth-constants.ts)
- [src/app/api/site-auth/route.ts](file://src/app/api/site-auth/route.ts)
- [src/lib/services/dataService.ts](file://src/lib/services/dataService.ts)
</cite>

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Repository Setup](#repository-setup)
3. [Environment Configuration](#environment-configuration)
4. [Supabase Integration](#supabase-integration)
5. [Starting the Development Server](#starting-the-development-server)
6. [Troubleshooting Common Issues](#troubleshooting-common-issues)

## Prerequisites

Before setting up the credit-card-tracker application, ensure you have the following prerequisites installed and configured:

- **Node.js**: Version 18 or higher is required for this Next.js application. The application uses modern JavaScript features and Next.js 15, which require a recent Node.js version.
- **pnpm**: The package manager used for this project. Install it globally using `npm install -g pnpm` if not already installed.
- **Supabase Account**: A free Supabase account is required to host the PostgreSQL database and provide authentication services. The application relies on Supabase for data persistence and API access.

These prerequisites are essential for the application to function properly. Node.js provides the runtime environment, pnpm manages dependencies efficiently with faster installation and smaller disk usage compared to npm, and Supabase serves as the backend-as-a-service platform that handles database operations and authentication.

**Section sources**
- [package.json](file://package.json#L21-L23)
- [README.md](file://README.md#L1-L15)

## Repository Setup

To begin development, follow these steps to set up the repository:

1. **Clone the repository** from GitHub using the following command:
   ```bash
   git clone https://github.com/your-username/credit-card-tracker.git
   cd credit-card-tracker
   ```

2. **Install dependencies** using pnpm:
   ```bash
   pnpm install
   ```
   This command reads the `pnpm-lock.yaml` file and installs all dependencies listed in `package.json`, including both production and development packages. The installation includes Next.js, React 19, Supabase client, Tailwind CSS, and other essential libraries.

3. **Verify the installation** by checking that the `node_modules` directory has been created and contains the installed packages.

The project uses a modern tech stack with Next.js App Router, React Server Components, and Turbopack for faster development builds. The `package.json` file defines the scripts for development, building, linting, and formatting, making it easy to manage the application lifecycle.

**Section sources**
- [package.json](file://package.json#L5-L11)
- [README.md](file://README.md#L5-L15)

## Environment Configuration

Proper environment configuration is crucial for the application to connect to Supabase and handle authentication. Follow these steps to configure your environment:

1. **Create a `.env` file** by copying the example:
   ```bash
   cp .env.example .env
   ```

2. **Configure the required environment variables** in the `.env` file:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SITE_PASSWORD=your-site-password
```

The environment variables serve specific purposes:
- `NEXT_PUBLIC_SUPABASE_URL`: The public URL of your Supabase project, used to connect to the database
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: The anonymous key for Supabase authentication, allowing read/write access to the database
- `SITE_PASSWORD`: A password to protect your application instance (optional but recommended for production)

The `.env.example` file (not shown in the codebase but standard practice) would contain these variables with placeholder values. The `NEXT_PUBLIC_` prefix makes these variables available in the browser environment, which is necessary for the Supabase client to function.

**Section sources**
- [src/lib/supabase.ts](file://src/lib/supabase.ts#L4-L5)
- [src/middleware.ts](file://src/middleware.ts#L10)
- [src/app/api/site-auth/route.ts](file://src/app/api/site-auth/route.ts#L12)

## Supabase Integration

To integrate Supabase with the credit-card-tracker application, follow these steps:

1. **Create a Supabase project** at [supabase.com](https://supabase.com) and note your project URL and API keys.

2. **Configure the database schema** with the following tables that match the application's data model:
   - `persons` table with columns: id (uuid), name (text), created_at (timestamp)
   - `credit_cards` table with columns: id (uuid), credit_card_name (text), last_four_digits (text), cardholder_name (text), issuer (text), is_supplementary (boolean), principal_card_id (uuid), created_at (timestamp)
   - `purchases` table with columns: id (uuid), credit_card_id (uuid), person_id (uuid), purchase_date (date), billing_start_date (date), total_amount (numeric), description (text), num_installments (integer), is_bnpl (boolean), created_at (timestamp)
   - `transactions` table with columns: id (uuid), credit_card_id (uuid), person_id (uuid), purchase_id (uuid), date (date), amount (numeric), description (text), paid (boolean), created_at (timestamp)

3. **Enable Row Level Security (RLS)** on all tables and create appropriate policies based on your authentication requirements.

4. **Seed the database** with sample data using Supabase's SQL editor or the following example data:

```sql
-- Insert sample person
INSERT INTO persons (name) VALUES ('John Doe');

-- Insert sample credit card
INSERT INTO credit_cards (credit_card_name, last_four_digits, cardholder_name, issuer, is_supplementary) 
VALUES ('Visa Platinum', '1234', 'John Doe', 'Visa', false);
```

The application's `supabase.ts` file initializes the Supabase client using the environment variables and defines TypeScript interfaces for each data model (Person, CreditCard, Purchase, Transaction), ensuring type safety throughout the application.

**Section sources**
- [src/lib/supabase.ts](file://src/lib/supabase.ts#L10-L80)
- [src/lib/services/dataService.ts](file://src/lib/services/dataService.ts#L39-L119)

## Starting the Development Server

Once the environment is configured, start the development server using the following command:

```bash
pnpm dev
```

This command executes the `next dev --turbopack` script defined in `package.json`, which starts the Next.js development server with Turbopack enabled for faster compilation and hot reloading. After running the command, you should see output similar to:

```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

Navigate to [http://localhost:3000](http://localhost:3000) in your browser to access the application. If you've set a `SITE_PASSWORD` in your environment variables, you'll be redirected to the password entry page at `/enter-password` before accessing the main application.

The development server provides hot reloading, meaning any changes to files in the `src` directory will automatically refresh the browser to reflect the updates. This enables a fast development workflow where you can immediately see the results of your code changes.

Additional useful commands available in the project:
- `pnpm build`: Creates an optimized production build
- `pnpm start`: Starts the application in production mode after building
- `pnpm lint`: Runs ESLint to check for code quality issues
- `pnpm format`: Formats code using Prettier according to the project's style guide

**Section sources**
- [package.json](file://package.json#L6)
- [README.md](file://README.md#L5-L15)

## Troubleshooting Common Issues

When setting up the development environment, you may encounter common issues. Here are solutions to the most frequent problems:

### Missing Dependencies
**Issue**: Module not found errors when starting the development server.
**Solution**: Ensure you've run `pnpm install` in the project root directory. If issues persist, try:
```bash
pnpm install --force
```
This command re-downloads all dependencies and recreates the `node_modules` directory.

### Environment Variables Not Loading
**Issue**: Application fails to connect to Supabase with errors about undefined environment variables.
**Solution**: Verify that:
1. Your `.env` file is in the project root directory (same level as `package.json`)
2. Variable names match exactly (including the `NEXT_PUBLIC_` prefix)
3. There are no spaces around the equals sign
4. The file is named `.env`, not `.env.local` or other variations

### Supabase Connection Issues
**Issue**: Database queries fail with authentication errors.
**Solution**: Check that:
- Your Supabase project URL and anon key are correct
- The database tables exist with the correct schema
- Row Level Security (RLS) policies are properly configured
- The Supabase project is not in paused state

### Authentication Flow Problems
**Issue**: Unable to log in to the application even with the correct password.
**Solution**: The middleware and API route depend on the `SITE_PASSWORD` environment variable. Ensure:
- The variable is set in your `.env` file
- You're entering the exact same password (case-sensitive)
- Clear your browser's local storage if you've previously attempted authentication

### Advanced Debugging Tips
For experienced developers, consider these advanced configuration options:
- Use `.env.local` for environment variables that should not be committed to version control
- Set `NODE_ENV=development` explicitly if experiencing environment-related issues
- Enable verbose logging in Supabase by adding `console.log` statements in service files
- Use browser developer tools to inspect network requests to the `/api/site-auth` endpoint

By following this guide, you should be able to successfully set up the development environment for the credit-card-tracker application and begin contributing to the project.

**Section sources**
- [src/middleware.ts](file://src/middleware.ts#L9-L39)
- [src/app/api/site-auth/route.ts](file://src/app/api/site-auth/route.ts#L12-L38)
- [src/lib/supabase.ts](file://src/lib/supabase.ts#L4-L5)