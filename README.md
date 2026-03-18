# Credit Card Tracker

A Next.js application for tracking credit card purchases and their installment transactions. Built with Supabase as the backend.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **UI**: React 19, Tailwind CSS v4, DaisyUI, Radix UI
- **Backend**: Supabase (PostgreSQL)
- **Language**: TypeScript
- **Testing**: Vitest, Playwright

## Features

### Purchase Management
- Create, view, and delete purchases
- Track purchase details including credit card, person, amount, and installments

### Purchase Edit Feature
Edit purchase details with automatic transaction recalculation:

| Edit Type | Fields | Behavior |
|-----------|-------|----------|
| Simple | `description`, `purchase_date`, `is_bnpl` | Direct update, no side effects |
| Cascade | `credit_card_id`, `person_id` | Updates all related transactions |
| Complex | `total_amount`, `billing_start_date`, `num_installments` | Recalculates schedule; changing installment count atomically adds/removes transactions |

### Transaction Tracking
- View installment transactions for each purchase
- Mark transactions as paid/unpaid
- Toggle paid/unpaid status for individual transactions from the purchase detail page
- Filter by paid status

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended)
- Supabase account and project

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd credit-card-tracker

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key |
| `SITE_PASSWORD` | Optional; site password protection (bypassed in development) |

## Scripts

```bash
pnpm dev        # Start development server (http://localhost:3000)
pnpm build      # Build for production
pnpm start       # Start production server
pnpm lint        # Run ESLint
pnpm format      # Format code with Prettier

# Testing
pnpm test        # Run unit tests (watch mode)
pnpm test:run    # Run unit tests once
pnpm test:e2e    # Run E2E tests (requires dev server)
pnpm test:e2e:ui # Run E2E tests with Playwright UI
```

## Testing

The project includes comprehensive tests at multiple levels:

- **Service Tests**: Unit tests for `purchaseService.ts` update methods
- **Hook Tests**: Tests for `usePurchaseDetails` hook state management
- **Component Tests**: Tests for `PurchaseEditForm` rendering and interactions
- **E2E Tests**: Playwright tests for the full edit purchase flow

Run all tests:
```bash
pnpm test:run    # Unit tests
pnpm test:e2e    # E2E tests
pnpm test:e2e:ui # E2E tests with Playwright UI
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   └── purchases/[id]/     # Purchase detail page with edit modal
├── components/
│   ├── base/               # Reusable UI components
│   └── purchases/          # Purchase-specific components
│       └── PurchaseEditForm.tsx
├── lib/
│   ├── hooks/
│   │   └── usePurchaseDetails.ts
│   ├── services/
│   │   ├── purchaseService.ts
│   │   └── dataService.ts
│   └── supabase.ts         # Supabase client and types
e2e/                        # Playwright E2E tests
```

## Database Functions

The purchase edit feature uses PostgreSQL functions for atomic operations:

- `update_purchase_with_cascade`: Updates purchase and cascades credit_card_id/person_id to transactions
- `update_purchase_full`: Full update including amount/date recalculation; accepts `p_num_installments` and atomically adds/removes transactions when installment count changes

## License

MIT
