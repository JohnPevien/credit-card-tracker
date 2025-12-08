# Transaction Management

<cite>
**Referenced Files in This Document**
- [Transactions Page](file://src/app/transactions/page.tsx)
- [Person Transactions Page](file://src/app/transactions/person/[id]/page.tsx)
- [Transaction Filters Component](file://src/components/transactions/TransactionFilters.tsx)
- [Data Service](file://src/lib/services/dataService.ts)
- [Purchase Service](file://src/lib/services/purchaseService.ts)
- [Utility Functions](file://src/lib/utils.ts)
- [Supabase Types](file://src/lib/supabase.ts)
- [Constants](file://src/lib/constants.ts)
- [Purchase Details Hook](file://src/lib/hooks/usePurchaseDetails.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document explains the transaction management sub-feature, focusing on payment status tracking, filtering, and data loading across transaction pages. It covers the invocation relationships between transaction pages, the TransactionFilters component, data services, and utility functions. It also documents the Transaction domain model and database schema, configuration options for transaction queries, and practical examples from the codebase. Finally, it addresses common issues such as race conditions during status updates and their solutions.

## Project Structure
Transaction management spans several layers:
- Pages: Top-level and person-scoped transaction lists
- Filters: Reusable filter UI with configurable visibility
- Services: Data service for bulk operations and purchase service for transaction queries
- Utilities: Shared helpers for formatting and paid-status updates
- Types: Strongly typed Transaction interface and related models
- Constants: Formatting and configuration values

```mermaid
graph TB
subgraph "Pages"
TP["Transactions Page<br/>src/app/transactions/page.tsx"]
PTP["Person Transactions Page<br/>src/app/transactions/person/[id]/page.tsx"]
end
subgraph "Components"
TF["TransactionFilters<br/>src/components/transactions/TransactionFilters.tsx"]
end
subgraph "Services"
DS["DataService<br/>src/lib/services/dataService.ts"]
PS["PurchaseService<br/>src/lib/services/purchaseService.ts"]
end
subgraph "Utilities"
U["Utils<br/>src/lib/utils.ts"]
C["Constants<br/>src/lib/constants.ts"]
end
subgraph "Types"
S["Supabase Types<br/>src/lib/supabase.ts"]
end
TP --> TF
TP --> U
TP --> S
PTP --> TF
PTP --> U
PTP --> S
DS --> S
PS --> S
U --> S
TP --> DS
PTP --> PS
TP --> C
```

**Diagram sources**
- [Transactions Page](file://src/app/transactions/page.tsx#L1-L338)
- [Person Transactions Page](file://src/app/transactions/person/[id]/page.tsx#L1-L263)
- [Transaction Filters Component](file://src/components/transactions/TransactionFilters.tsx#L1-L196)
- [Data Service](file://src/lib/services/dataService.ts#L1-L165)
- [Purchase Service](file://src/lib/services/purchaseService.ts#L1-L88)
- [Utility Functions](file://src/lib/utils.ts#L1-L46)
- [Supabase Types](file://src/lib/supabase.ts#L1-L81)
- [Constants](file://src/lib/constants.ts#L1-L116)

**Section sources**
- [Transactions Page](file://src/app/transactions/page.tsx#L1-L338)
- [Person Transactions Page](file://src/app/transactions/person/[id]/page.tsx#L1-L263)
- [Transaction Filters Component](file://src/components/transactions/TransactionFilters.tsx#L1-L196)
- [Data Service](file://src/lib/services/dataService.ts#L1-L165)
- [Purchase Service](file://src/lib/services/purchaseService.ts#L1-L88)
- [Utility Functions](file://src/lib/utils.ts#L1-L46)
- [Supabase Types](file://src/lib/supabase.ts#L1-L81)
- [Constants](file://src/lib/constants.ts#L1-L116)

## Core Components
- Transaction domain model: The Transaction interface defines the shape of transaction records, including identifiers, amounts, dates, descriptions, and payment status. Related entities (credit cards, persons, purchases) are embedded via expandable properties.
- Transaction pages: Two pages present transaction lists with filtering and paid-status toggles:
  - Global transactions page loads all transactions and supports person, card, description, and date-range filters.
  - Person-specific transactions page filters by person and supports card, description, date range, and paid status filters.
- TransactionFilters component: A reusable filter UI with configurable visibility for person, card, description, date range, and paid status.
- Services:
  - DataService: Bulk operations including deleting a purchase and its transactions, and creating purchases with associated transactions.
  - PurchaseService: Loads purchase details and related transactions, and updates transaction paid status.
- Utility functions: Centralized helpers for formatting dates and updating transaction paid status with optimistic UI updates and safe error handling.
- Constants: Currency formatting precision and navigation-related constants.

**Section sources**
- [Supabase Types](file://src/lib/supabase.ts#L61-L80)
- [Transactions Page](file://src/app/transactions/page.tsx#L1-L338)
- [Person Transactions Page](file://src/app/transactions/person/[id]/page.tsx#L1-L263)
- [Transaction Filters Component](file://src/components/transactions/TransactionFilters.tsx#L1-L196)
- [Data Service](file://src/lib/services/dataService.ts#L1-L165)
- [Purchase Service](file://src/lib/services/purchaseService.ts#L1-L88)
- [Utility Functions](file://src/lib/utils.ts#L1-L46)
- [Constants](file://src/lib/constants.ts#L114-L116)

## Architecture Overview
The transaction management architecture follows a layered approach:
- UI pages orchestrate data loading and rendering, delegate paid-status updates to utilities, and apply local filters.
- Filter components encapsulate UI state and pass filter changes upward.
- Services abstract Supabase interactions for transaction queries and updates.
- Utilities centralize shared logic for formatting and optimistic updates.
- Types define the domain model and relationships.

```mermaid
sequenceDiagram
participant User as "User"
participant Page as "Transactions Page"
participant Filters as "TransactionFilters"
participant Utils as "handleTransactionPaidChange"
participant Supabase as "Supabase Client"
User->>Page : Toggle "Paid" checkbox
Page->>Utils : handleTransactionPaidChange(transactionId, paid)
Utils->>Supabase : UPDATE transactions SET paid WHERE id = transactionId
Supabase-->>Utils : { error }
Utils->>Page : Optimistically update state if no error
Utils-->>User : Done
```

**Diagram sources**
- [Transactions Page](file://src/app/transactions/page.tsx#L247-L270)
- [Utility Functions](file://src/lib/utils.ts#L19-L46)

**Section sources**
- [Transactions Page](file://src/app/transactions/page.tsx#L247-L270)
- [Utility Functions](file://src/lib/utils.ts#L19-L46)

## Detailed Component Analysis

### Transaction Domain Model and Database Schema
The Transaction interface defines the core fields and relationships:
- Identifiers: id, credit_card_id, person_id, optional purchase_id
- Amount and date: amount (numeric), date (ISO string)
- Description and metadata: description, paid (boolean), created_at
- Expandable relations: credit_cards, persons, purchases, plus an expand object for joined data

Related entities:
- CreditCard: includes principal_card linkage for supplementary cards
- Person: basic identity
- Purchase: purchase context for installments and BNPL

```mermaid
erDiagram
TRANSACTION {
uuid id PK
uuid credit_card_id FK
uuid person_id FK
uuid purchase_id FK
date date
numeric amount
string description
boolean paid
timestamp created_at
}
CREDIT_CARD {
uuid id PK
string credit_card_name
string last_four_digits
string cardholder_name
string issuer
boolean is_supplementary
uuid principal_card_id FK
timestamp created_at
}
PERSON {
uuid id PK
string name
timestamp created_at
}
PURCHASE {
uuid id PK
uuid credit_card_id FK
uuid person_id FK
date purchase_date
date billing_start_date
numeric total_amount
string description
integer num_installments
boolean is_bnpl
timestamp created_at
}
TRANSACTION }o--|| CREDIT_CARD : "belongs to"
TRANSACTION }o--|| PERSON : "belongs to"
TRANSACTION }o--|| PURCHASE : "may belong to"
```

**Diagram sources**
- [Supabase Types](file://src/lib/supabase.ts#L16-L80)

**Section sources**
- [Supabase Types](file://src/lib/supabase.ts#L16-L80)

### Transactions Page: Data Loading, Filtering, and Paid Status Updates
- Data loading:
  - Loads transactions with joins to credit_cards, persons, and purchases.
  - Orders by date descending.
  - Transforms raw rows into a normalized structure with expand properties.
- Local filtering:
  - Supports person, card, description substring, and date range filters.
  - Clears filters via a dedicated handler.
- Paid status updates:
  - Uses handleTransactionPaidChange to update the backend and optimistically update the UI.
  - Disables the checkbox during updates to prevent concurrent edits.

```mermaid
flowchart TD
Start(["Load Transactions"]) --> Query["Supabase SELECT transactions with joins"]
Query --> Order["Order by date desc"]
Order --> Transform["Map rows to records with expand"]
Transform --> SetState["Set transactions state"]
SetState --> Filter["Apply person/card/description/date filters"]
Filter --> Render["Render DataTable with Paid toggle"]
Render --> Toggle["User toggles Paid"]
Toggle --> Update["handleTransactionPaidChange(transactionId, paid)"]
Update --> Backend["UPDATE transactions SET paid WHERE id = transactionId"]
Backend --> Optimistic{"No error?"}
Optimistic --> |Yes| UIUpdate["Optimistically update state"]
Optimistic --> |No| Error["Log error"]
UIUpdate --> End(["Done"])
Error --> End
```

**Diagram sources**
- [Transactions Page](file://src/app/transactions/page.tsx#L36-L111)
- [Transactions Page](file://src/app/transactions/page.tsx#L118-L153)
- [Transactions Page](file://src/app/transactions/page.tsx#L247-L270)
- [Utility Functions](file://src/lib/utils.ts#L19-L46)

**Section sources**
- [Transactions Page](file://src/app/transactions/page.tsx#L36-L111)
- [Transactions Page](file://src/app/transactions/page.tsx#L118-L153)
- [Transactions Page](file://src/app/transactions/page.tsx#L247-L270)
- [Utility Functions](file://src/lib/utils.ts#L19-L46)

### Person Transactions Page: Scoped Filtering and Paid Status Updates
- Data loading:
  - Loads transactions for a specific person_id and joins related entities.
  - Orders by date descending.
- Filter configuration:
  - Uses TransactionFilters with showCard, showDescription, showDateRange, and showPaidStatus enabled.
- Paid status updates:
  - Uses the same handleTransactionPaidChange utility with optimistic UI updates.

```mermaid
sequenceDiagram
participant Router as "Next Router"
participant Page as "Person Transactions Page"
participant Filters as "TransactionFilters"
participant Utils as "handleTransactionPaidChange"
participant Supabase as "Supabase Client"
Router->>Page : Navigate with personId
Page->>Supabase : SELECT transactions WHERE person_id = personId ORDER BY date DESC
Page->>Filters : Render with configured visibility
Filters-->>Page : onFilterChange(newState)
Page->>Page : Apply filters locally
User->>Page : Toggle Paid
Page->>Utils : handleTransactionPaidChange(...)
Utils->>Supabase : UPDATE transactions SET paid WHERE id = transactionId
Utils-->>Page : Update state if no error
```

**Diagram sources**
- [Person Transactions Page](file://src/app/transactions/person/[id]/page.tsx#L1-L263)
- [Transaction Filters Component](file://src/components/transactions/TransactionFilters.tsx#L1-L196)
- [Utility Functions](file://src/lib/utils.ts#L19-L46)

**Section sources**
- [Person Transactions Page](file://src/app/transactions/person/[id]/page.tsx#L1-L263)
- [Transaction Filters Component](file://src/components/transactions/TransactionFilters.tsx#L1-L196)
- [Utility Functions](file://src/lib/utils.ts#L19-L46)

### TransactionFilters Component: Configuration and Behavior
- Configurable visibility:
  - showPerson, showCard, showDescription, showDateRange, showPaidStatus
- State management:
  - Maintains person, card, description, dateFrom, dateTo, paidStatus
  - Provides a clearFilters action resetting to defaults
- Rendering:
  - Grid layout adapts to visible filters count
  - Paid status selector offers all/paid/unpaid options

```mermaid
classDiagram
class TransactionFiltersConfig {
+boolean showPerson
+boolean showCard
+boolean showDescription
+boolean showDateRange
+boolean showPaidStatus
}
class TransactionFiltersState {
+string person
+string card
+string description
+string dateFrom
+string dateTo
+string paidStatus
}
class TransactionFilters {
+props config : TransactionFiltersConfig
+props filters : TransactionFiltersState
+props onFilterChange(state)
+props persons : Person[]
+props creditCards : CreditCard[]
+render()
}
TransactionFilters --> TransactionFiltersConfig : "uses"
TransactionFilters --> TransactionFiltersState : "manages"
```

**Diagram sources**
- [Transaction Filters Component](file://src/components/transactions/TransactionFilters.tsx#L1-L196)

**Section sources**
- [Transaction Filters Component](file://src/components/transactions/TransactionFilters.tsx#L1-L196)

### Services: Data Loading and Transaction Updates
- PurchaseService:
  - loadPurchaseDetails: Loads a purchase and its ordered transactions with joins.
  - updateTransactionPaidStatus: Updates a transaction’s paid status.
- DataService:
  - deletePurchaseAndTransactions: Deletes all transactions for a purchase, then deletes the purchase.
  - createPurchaseWithTransactions: Creates a purchase and inserts multiple transactions for installments/BPML.

```mermaid
sequenceDiagram
participant Page as "Person/Purchases Page"
participant Service as "PurchaseService"
participant Supabase as "Supabase Client"
Page->>Service : loadPurchaseDetails(id)
Service->>Supabase : SELECT purchases WHERE id = id
Supabase-->>Service : Purchase row
Service->>Supabase : SELECT transactions WHERE purchase_id = id ORDER BY date ASC
Supabase-->>Service : Transactions rows
Service-->>Page : { purchase, transactions }
```

**Diagram sources**
- [Purchase Service](file://src/lib/services/purchaseService.ts#L1-L88)

**Section sources**
- [Purchase Service](file://src/lib/services/purchaseService.ts#L1-L88)
- [Data Service](file://src/lib/services/dataService.ts#L1-L165)

### Utility Functions: Paid Status Updates and Formatting
- handleTransactionPaidChange:
  - Sets a temporary updatingId to disable UI interactions during the update.
  - Issues a single UPDATE to the transactions table.
  - On success, optimistically updates the in-memory state.
  - Resets updatingId.
- formatDate:
  - Converts date strings to a locale-aware display format.

```mermaid
flowchart TD
Enter(["handleTransactionPaidChange"]) --> SetUpdating["Set updatingId"]
SetUpdating --> UpdateDB["UPDATE transactions SET paid WHERE id = transactionId"]
UpdateDB --> HasError{"error?"}
HasError --> |Yes| Reset["Reset updatingId"]
HasError --> |No| OptUpd["Optimistically update state"]
OptUpd --> Reset
Reset --> Exit(["Done"])
```

**Diagram sources**
- [Utility Functions](file://src/lib/utils.ts#L19-L46)

**Section sources**
- [Utility Functions](file://src/lib/utils.ts#L1-L46)

### Hooks: Purchase Details and Transaction Updates
- usePurchaseDetails:
  - Loads purchase and transactions for a given purchase id.
  - Exposes updateTransactionPaidStatus that calls PurchaseService and updates local state.

**Section sources**
- [Purchase Details Hook](file://src/lib/hooks/usePurchaseDetails.ts#L1-L62)
- [Purchase Service](file://src/lib/services/purchaseService.ts#L71-L87)

## Dependency Analysis
- Pages depend on:
  - Supabase client for queries
  - Utility functions for formatting and paid-status updates
  - Components for filters
- Filters depend on:
  - Provided lists of persons and credit cards
  - onFilterChange callback to propagate state
- Services depend on:
  - Supabase client for CRUD operations
- Utilities depend on:
  - Supabase client for updates
  - React state setters for optimistic updates

```mermaid
graph LR
TP["Transactions Page"] --> U["handleTransactionPaidChange"]
TP --> TF["TransactionFilters"]
TP --> S["Supabase Client"]
PTP["Person Transactions Page"] --> U
PTP --> TF
PTP --> S
DS["DataService"] --> S
PS["PurchaseService"] --> S
U --> S
```

**Diagram sources**
- [Transactions Page](file://src/app/transactions/page.tsx#L1-L338)
- [Person Transactions Page](file://src/app/transactions/person/[id]/page.tsx#L1-L263)
- [Transaction Filters Component](file://src/components/transactions/TransactionFilters.tsx#L1-L196)
- [Data Service](file://src/lib/services/dataService.ts#L1-L165)
- [Purchase Service](file://src/lib/services/purchaseService.ts#L1-L88)
- [Utility Functions](file://src/lib/utils.ts#L1-L46)

**Section sources**
- [Transactions Page](file://src/app/transactions/page.tsx#L1-L338)
- [Person Transactions Page](file://src/app/transactions/person/[id]/page.tsx#L1-L263)
- [Transaction Filters Component](file://src/components/transactions/TransactionFilters.tsx#L1-L196)
- [Data Service](file://src/lib/services/dataService.ts#L1-L165)
- [Purchase Service](file://src/lib/services/purchaseService.ts#L1-L88)
- [Utility Functions](file://src/lib/utils.ts#L1-L46)

## Performance Considerations
- Query optimization:
  - Use targeted selects with join aliases to limit payload size.
  - Order by date desc to surface recent entries quickly.
- UI responsiveness:
  - Disable the Paid toggle during updates to prevent redundant requests.
  - Use useMemo for derived filtered data in person-scoped pages to avoid re-filtering on every render.
- Data consistency:
  - Prefer optimistic updates with immediate UI feedback, but ensure errors are handled gracefully.
  - For high-frequency updates, consider debouncing or batching to reduce network overhead.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Paid status toggle not reflecting change:
  - Verify handleTransactionPaidChange is invoked and that the backend update succeeds.
  - Confirm updatingId is cleared after completion.
  - Check for error logs from Supabase.
- Filters not applying:
  - Ensure filter state keys match the expected fields (person, card, description, dateFrom, dateTo, paidStatus).
  - For person-scoped pages, confirm the paidStatus filter option is enabled.
- Race conditions during status updates:
  - The current implementation disables the checkbox during updates, preventing concurrent toggles.
  - For scenarios with multiple clients or rapid clicks, consider server-side concurrency controls (e.g., conditional updates with versioning) or client-side queues to serialize updates.
- Data not loading:
  - Verify Supabase credentials and table permissions.
  - Confirm that joins and column names align with the Transaction interface.

**Section sources**
- [Transactions Page](file://src/app/transactions/page.tsx#L247-L270)
- [Person Transactions Page](file://src/app/transactions/person/[id]/page.tsx#L181-L217)
- [Utility Functions](file://src/lib/utils.ts#L19-L46)
- [Transaction Filters Component](file://src/components/transactions/TransactionFilters.tsx#L1-L196)

## Conclusion
Transaction management integrates UI pages, reusable filters, services, and utilities to deliver a responsive and consistent experience. The Transaction domain model and Supabase schema support flexible queries and joins. Paid status updates leverage optimistic UI updates with safeguards against concurrent edits. The provided examples demonstrate filtering, status updates, and data loading across transaction views, along with configuration options for robust query behavior.