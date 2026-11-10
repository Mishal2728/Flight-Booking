# Flight Ticket Search & Group-Ticket Booking Inquiry Platform

A production-ready Go backend for flight ticket search, Redis caching, dynamic fare markup, group-ticket inventory management, customer inquiries, and Meta WhatsApp Cloud notifications via a transactional outbox pattern.

---

## 1. High-Level Design (HLD)

### 1.1 Platform Architecture Overview

The system is architected as a **modular monolith** in Go, combining clean domain isolation with horizontal scalability, resilient caching, and reliable asynchronous notifications.

```mermaid
graph TB
    subgraph Clients["Clients & Consumers"]
        Web["Customer Frontend (Web)"]
        Mobile["Customer Mobile App"]
        AdminUI["Admin Dashboard"]
    end

    subgraph Gateway["HTTP Gateway & Security Layer (Chi)"]
        ReqID["Request ID & Logger Middleware"]
        Recoverer["Panic Recoverer"]
        RateLimiter["IP Rate Limiter (20 req/s public, 10 req/s admin)"]
        CORS["CORS & Real IP"]
        AuthMid["JWT & RBAC Middleware"]
    end

    subgraph PublicEndpoints["Public Endpoints (/api/v1)"]
        AirportsEP["GET /api/v1/airports"]
        SearchEP["POST /api/v1/flights/search"]
        CheapestDatesEP["POST /api/v1/flights/cheapest-dates"]
        BookingLinksEP["POST /api/v1/flights/booking-links"]
        GroupFlightsEP["GET /api/v1/group-flights"]
        PromosEP["GET /api/v1/promotions"]
        InquiriesEP["POST /api/v1/inquiries"]
        HealthEP["GET /api/v1/health & /ready"]
    end

    subgraph ObscuredAdmin["Obscured Admin Panel (Configurable: ADMIN_PATH_PREFIX)"]
        AdminLoginEP["POST {admin_prefix}/auth/login"]
        AdminMeEP["GET {admin_prefix}/auth/me"]
        AdminPassEP["PUT {admin_prefix}/auth/password"]
        AdminStatsEP["GET {admin_prefix}/stats"]
        AdminMarkupEP["GET/PUT {admin_prefix}/settings/markup"]
        AdminInventoryEP["CRUD {admin_prefix}/group-flights"]
        AdminAirlinesEP["CRUD {admin_prefix}/airlines"]
        AdminInquiriesEP["GET/PATCH {admin_prefix}/inquiries"]
        AdminPromosEP["CRUD {admin_prefix}/promotions"]
        AdminAuditEP["GET {admin_prefix}/audit-logs"]
    end

    subgraph CoreServices["Domain Services (Modular Monolith)"]
        FlightSearchSvc["Flight Search Service<br/>(Singleflight Coalescing & Boundary TTL)"]
        PricingSvc["Pricing Service<br/>(shopspring/decimal Money Math)"]
        InquirySvc["Inquiry Service<br/>(Snapshotting & Outbox Insertion)"]
        GroupSvc["Group Inventory Service"]
        PromoSvc["Promotions Service"]
        AuthSvc["Auth & Security Service<br/>(Bcrypt & JWT)"]
    end

    subgraph Storage["Persistence & Caching"]
        Redis[("Redis 7<br/>- Canonical Query Cache<br/>- 10-day vs 25-day TTL<br/>- 60s Promo Cache")]
        Postgres[("PostgreSQL 16<br/>- Inquiries & Snapshots<br/>- Notification Outbox<br/>- Inventory & Segments<br/>- Admin Users & Audit Logs<br/>- App Settings")]
    end

    subgraph AsyncWorker["Asynchronous Processing"]
        OutboxWorker["Go Background Outbox Worker<br/>(FOR UPDATE SKIP LOCKED)"]
    end

    subgraph External["External Integrations"]
        Ignav["Ignav Flight API<br/>(One-Way, Round-Trip, Flexible, Cheapest Dates)"]
        MetaWhatsApp["Meta WhatsApp Cloud API<br/>(Graph API v20.0)"]
    end

    Clients --> Gateway
    Gateway --> PublicEndpoints
    Gateway --> ObscuredAdmin

    PublicEndpoints --> FlightSearchSvc
    PublicEndpoints --> InquirySvc
    PublicEndpoints --> GroupSvc
    PublicEndpoints --> PromoSvc

    ObscuredAdmin --> AuthSvc
    ObscuredAdmin --> PricingSvc
    ObscuredAdmin --> GroupSvc
    ObscuredAdmin --> InquirySvc
    ObscuredAdmin --> PromoSvc

    FlightSearchSvc --> PricingSvc
    FlightSearchSvc --> Redis
    FlightSearchSvc --> Ignav

    InquirySvc --> Postgres
    GroupSvc --> Postgres
    PromoSvc --> Postgres
    PromoSvc --> Redis
    AuthSvc --> Postgres

    Postgres -.->|Poll Outbox| OutboxWorker
    OutboxWorker --> MetaWhatsApp
```

---

### 1.2 Flight Search Flow with Redis Caching & Singleflight

```mermaid
sequenceDiagram
    autonumber
    actor User as Customer / Browser
    participant API as Chi API Router
    participant Svc as Flight Search Service
    participant Cache as Redis Cache
    participant SF as Singleflight Coalescer
    participant Ignav as Upstream Ignav API
    participant Pricing as Pricing Service

    User->>API: POST /api/v1/flights/search (Query)
    API->>Svc: Search(ctx, req)
    Svc->>Svc: Validate route, future dates, passenger counts
    Svc->>Svc: Compute canonical SHA-256 key & calculate TTL (10m vs 25m)
    Svc->>Pricing: GetMarkupPercent(ctx) (e.g. 5.00%)
    Pricing-->>Svc: 5.00%
    
    Svc->>Cache: GET flightsearch:v1:<sha256>
    alt Cache Hit
        Cache-->>Svc: Raw un-marked-up Ignav JSON
        Svc->>Svc: Apply dynamic 5% markup to fares
        Svc-->>API: Return SearchResult (cached: true)
        API-->>User: 200 OK (Instant Response)
    else Cache Miss
        Cache-->>Svc: (nil / miss)
        Svc->>SF: Do(cacheKey, fetchFn)
        Note over SF: Multiple concurrent requests for identical query<br/>are coalesced into exactly ONE upstream call.
        SF->>Ignav: POST /api/fares/<route>
        Ignav-->>SF: Raw provider fare response
        SF->>Cache: SETEX flightsearch:v1:<sha256> <ttl> <rawJSON>
        SF-->>Svc: Return raw provider bytes
        Svc->>Svc: Apply dynamic 5% markup to fares
        Svc-->>API: Return SearchResult (cached: false)
        API-->>User: 200 OK
    end
```

---

### 1.3 Customer Inquiry & Transactional Outbox Flow

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant API as Chi API
    participant InqSvc as Inquiry Service
    participant DB as PostgreSQL
    participant Worker as Outbox Worker (Goroutine)
    participant Meta as Meta WhatsApp Cloud API
    actor Agent as Operations Staff

    Customer->>API: POST /api/v1/inquiries (contact info + itinerary snapshot)
    API->>InqSvc: CreateInquiry(ctx, req)
    InqSvc->>InqSvc: Validate PII (email, phone, passenger names)
    
    rect rgb(240, 248, 255)
        Note over InqSvc, DB: Atomic Database Transaction
        InqSvc->>DB: INSERT INTO inquiries (immutable JSONB itinerary, status: 'new')
        InqSvc->>DB: INSERT INTO notification_outbox (event_type: 'inquiry_created', status: 'pending')
        DB-->>InqSvc: Transaction Committed (Zero Data Loss)
    end
    
    InqSvc-->>API: Return InquiryResponse (includes Non-Confirming Lead Disclaimer)
    API-->>Customer: 201 Created

    loop Every 5 Seconds (Worker Poll)
        Worker->>DB: SELECT ... FROM notification_outbox WHERE status IN ('pending', 'retry') FOR UPDATE SKIP LOCKED
        DB-->>Worker: Locked outbox row
        Worker->>Worker: Format message template (route, contact, price)
        Worker->>Meta: POST /v20.0/{phone_number_id}/messages (WhatsApp template)
        alt Success
            Meta-->>Worker: 200 OK {"messages": [{"id": "wamid..."}]}
            Worker->>DB: UPDATE notification_outbox SET status = 'sent', sent_at = NOW()
        else Upstream Error / Network Failure
            Meta-->>Worker: HTTP 5xx / 4xx error
            Worker->>DB: UPDATE notification_outbox SET status = 'retry', next_retry_at = NOW() + backoff_jitter
            Note over Worker, DB: Exponential backoff (5s, 10s, 20s, 40s, 80s) up to 5 attempts.<br/>Moves to 'dead' if max attempts exceeded.
        end
    end

    Meta->>Agent: Delivers WhatsApp Lead Alert to Operations Staff Phone
```

---

## 2. Low-Level Design (LLD)

### 2.1 Database Schema (ERD)

```mermaid
erDiagram
    admin_users ||--o{ admin_audit_logs : "triggers"
    group_flights ||--|{ group_flight_segments : "contains"
    inquiries ||--o{ notification_outbox : "emits"

    admin_users {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar full_name
        varchar role "admin | operations | content_manager"
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
        timestamptz last_login_at
    }

    admin_audit_logs {
        uuid id PK
        varchar admin_email
        varchar action
        varchar entity_type
        uuid entity_id
        jsonb before_json
        jsonb after_json
        varchar reason
        timestamptz created_at
    }

    app_settings {
        varchar key PK
        varchar value
        timestamptz updated_at
        varchar updated_by
    }

    airlines {
        varchar code PK "2-letter IATA"
        varchar name
        varchar logo_url
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    group_flights {
        uuid id PK
        varchar title
        varchar origin "3-letter IATA"
        varchar destination "3-letter IATA"
        timestamptz departure_at
        timestamptz arrival_at
        varchar airline_code
        varchar cabin_class "economy | premium_economy | business | first"
        numeric base_price
        numeric display_price
        varchar currency "ISO 4217"
        int total_seats
        int available_seats
        varchar status "draft | published | archived"
        timestamptz created_at
        timestamptz updated_at
    }

    group_flight_segments {
        uuid id PK
        uuid group_flight_id FK
        int segment_order
        varchar carrier_code
        varchar flight_number
        varchar origin
        varchar destination
        timestamptz departure_time
        timestamptz arrival_time
        int duration_minutes
        varchar aircraft
    }

    inquiries {
        uuid id PK
        varchar customer_name
        varchar customer_email
        varchar customer_phone
        int passenger_count
        jsonb itinerary_snapshot "Immutable itinerary JSON"
        numeric quoted_price
        varchar currency
        varchar status "new | contacted | quoted | booked | cancelled"
        text notes
        timestamptz created_at
        timestamptz updated_at
    }

    notification_outbox {
        uuid id PK
        varchar event_type "inquiry_created | status_changed"
        uuid payload_id FK "inquiry_id"
        jsonb payload
        varchar recipient
        varchar status "pending | processing | sent | retry | dead"
        int attempts
        int max_attempts
        timestamptz next_retry_at
        text last_error
        timestamptz created_at
        timestamptz sent_at
    }

    promotions {
        uuid id PK
        varchar title
        text description
        varchar banner_image_url
        varchar deep_link_url
        timestamptz starts_at
        timestamptz ends_at
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }
```

---

### 2.2 Inquiry Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> new: Customer Submits POST /api/v1/inquiries
    new --> contacted: Agent Calls / Contacts Customer
    contacted --> quoted: Agent Issues Official Custom Quote
    quoted --> booked: Customer Accepts & Books
    quoted --> cancelled: Customer Declines / Fare Expired
    contacted --> cancelled: Lead Lost
    new --> cancelled: Invalid / Duplicate Inquiry
    booked --> [*]
    cancelled --> [*]
```

---

### 2.3 Notification Outbox State Machine

```mermaid
stateDiagram-v2
    [*] --> pending: Inserted atomically with Inquiry
    pending --> processing: Worker Locks Row (SKIP LOCKED)
    processing --> sent: Meta WhatsApp API returns 200 OK
    processing --> retry: Meta WhatsApp API Error (Attempts < 5)
    retry --> processing: Timer fires (NOW() >= next_retry_at)
    processing --> dead: Max Attempts (5) Exceeded
    dead --> pending: Admin Triggers Manual Retry Endpoint
    sent --> [*]
```

---

## 3. Technology Stack

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Language** | **Go (Golang)** | High concurrency, low memory footprint, compiled native binary. |
| **HTTP Framework** | **Chi (`go-chi/chi/v5`)** | Lightweight, 100% `net/http` compatible, idiomatic composable middleware. |
| **Database** | **PostgreSQL 16** | ACID transactions, native JSONB, `SKIP LOCKED` concurrency. |
| **Database Driver** | **`pgx/v5`** | High-performance PostgreSQL driver and connection pooling for Go. |
| **Database Migrations** | **Embedded SQL Migrations** | Zero external runtime migration tool dependencies; embedded via `embed.FS`. |
| **Caching** | **Redis 7 (`go-redis/v9`)** | Sub-millisecond deterministic caching, exact TTL expiration rules. |
| **Money Arithmetic** | **`shopspring/decimal`** | Exact decimal precision; zero floating-point rounding errors for money. |
| **Request Coalescing** | **`golang.org/x/sync/singleflight`** | Merges duplicate concurrent cache misses into a single upstream API call. |
| **Structured Logging** | **`log/slog`** | Built-in JSON structured logging with custom PII phone & email redaction. |
| **Authentication & RBAC** | **JWT (`golang-jwt/jwt/v5`) & Bcrypt** | Stateless cryptographic auth tokens with role verification. |
| **External Flight Provider**| **Ignav API (`https://ignav.com`)** | One-Way, Round-Trip, Flexible Search, Cheapest Dates, Booking Links, Airports. |
| **Notifications** | **Meta WhatsApp Cloud API** | Official Facebook Graph API v20.0 for instant lead notification to agents. |
| **API Contract** | **OpenAPI 3.1** | Standard contract definition in [`api/openapi.yaml`](file:///home/zenith/.gemini/antigravity-ide/scratch/flight-platform/api/openapi.yaml). |

---

## 4. Security & Administration

### 4.1 Unpredictable Admin Panel Prefix (Zero Bot Scanning)

By default, bot scanners probe `/admin` or `/api/v1/admin`. To prevent reconnaissance, the entire admin surface is mounted under a configurable, unpredictable path prefix defined in `.env`:

```env
ADMIN_PATH_PREFIX=/portal-admin-8f2a9c
```

* Requesting `http://localhost:8080/admin` or `/api/v1/admin` returns `404 Not Found`.
* The admin panel and authentication are only reachable via `http://localhost:8080/portal-admin-8f2a9c/...`.
* You can change this to any random token or custom path in `.env`.

### 4.2 Admin Credentials & Password Management

#### Setup & Synchronization via Environment Variables
Admin credentials can be configured directly in `.env` / `deploy/.env`:

```env
ADMIN_INITIAL_EMAIL=admin@flightplatform.local
ADMIN_INITIAL_PASSWORD=AdminSecret123!
```

* **Startup Synchronization:** When the backend starts up, it automatically verifies that this admin user exists and synchronizes the bcrypt password hash in PostgreSQL.
* **Emergency Reset via `.env`:** If you ever need to reset the admin password directly from the server environment, simply change `ADMIN_INITIAL_PASSWORD=NewSecret123!` in `.env` and restart the container (`docker compose up -d`).

#### Changing Password via API Endpoint
An authenticated administrator can also change their password at any time:

* **Endpoint:** `PUT {ADMIN_PATH_PREFIX}/auth/password`
* **Header:** `Authorization: Bearer <jwt_token>`
* **Request Body:**
  ```json
  {
    "old_password": "AdminSecret123!",
    "new_password": "NewSecretPass456!"
  }
  ```
* **Response:**
  ```json
  {
    "message": "Password updated successfully"
  }
  ```

---

## 5. API Reference Summary

### 5.1 Public Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` or `/api/v1/health` | Liveness probe (process up) |
| `GET` | `/ready` or `/api/v1/ready` | Readiness probe (verifies PostgreSQL & Redis connections) |
| `GET` | `/api/v1/airports?q=...&limit=...` | Airport autocomplete search (cached 12h in Redis) |
| `POST`| `/api/v1/flights/search` | One-way, round-trip, and flexible multi-city flight search with dynamic markup |
| `POST`| `/api/v1/flights/cheapest-dates` | Calendar of lowest fares across a 1–31 day date window |
| `POST`| `/api/v1/flights/booking-links` | Retrieve direct booking links by `ignav_id` or manual flight details |
| `GET` | `/api/v1/group-flights` | Search published group-ticket inventories |
| `GET` | `/api/v1/group-flights/{id}` | Detailed segment breakdown for a published group flight |
| `GET` | `/api/v1/promotions` | Active promotional homepage banners |
| `POST`| `/api/v1/inquiries` | Submit customer flight booking inquiry (emits WhatsApp outbox event) |

### 5.2 Admin Endpoints (`{ADMIN_PATH_PREFIX}` = `/portal-admin-8f2a9c`)

| Method | Endpoint | Required Role | Description |
| :--- | :--- | :--- | :--- |
| `POST`| `{admin_prefix}/auth/login` | Public | Login with email and password, returns JWT token |
| `POST`| `{admin_prefix}/auth/logout` | Public | Logout |
| `GET` | `{admin_prefix}/auth/me` | Any Admin | View current admin profile |
| `PUT` | `{admin_prefix}/auth/password` | Any Admin | Change password |
| `GET` | `{admin_prefix}/stats` | Any Admin | Dashboard metrics (inquiries, inventory, outbox) |
| `GET` | `{admin_prefix}/settings/markup` | `admin` | View current fare markup percentage |
| `PUT` | `{admin_prefix}/settings/markup` | `admin` | Update dynamic markup percentage |
| `GET` | `{admin_prefix}/audit-logs` | `admin` | View administrative audit log entries |
| `GET` | `{admin_prefix}/airlines` | `admin`, `operations` | List airline catalogue |
| `POST`| `{admin_prefix}/airlines` | `admin`, `operations` | Create airline record |
| `PATCH`| `{admin_prefix}/airlines/{id}` | `admin`, `operations` | Update airline details |
| `DELETE`| `{admin_prefix}/airlines/{id}` | `admin`, `operations` | Delete airline record |
| `GET` | `{admin_prefix}/group-flights` | `admin`, `operations` | List all group flights (including drafts) |
| `POST`| `{admin_prefix}/group-flights` | `admin`, `operations` | Create group flight with segments |
| `POST`| `{admin_prefix}/group-flights/{id}/publish` | `admin`, `operations` | Publish group flight listing |
| `POST`| `{admin_prefix}/group-flights/{id}/availability` | `admin`, `operations` | Adjust seats with audit record |
| `DELETE`| `{admin_prefix}/group-flights/{id}` | `admin`, `operations` | Delete group flight |
| `GET` | `{admin_prefix}/inquiries` | `admin`, `operations` | List customer inquiries with status filter |
| `GET` | `{admin_prefix}/inquiries/{id}` | `admin`, `operations` | View customer inquiry and itinerary snapshot |
| `PATCH`| `{admin_prefix}/inquiries/{id}` | `admin`, `operations` | Update inquiry status (`contacted`, `booked`, etc.) |
| `POST`| `{admin_prefix}/inquiries/{id}/retry-notification` | `admin`, `operations` | Re-queue failed/dead WhatsApp notification |
| `GET` | `{admin_prefix}/promotions` | `admin`, `content_manager` | List promotions |
| `POST`| `{admin_prefix}/promotions` | `admin`, `content_manager` | Create promotion banner |
| `PATCH`| `{admin_prefix}/promotions/{id}` | `admin`, `content_manager` | Update promotion banner |
| `DELETE`| `{admin_prefix}/promotions/{id}` | `admin`, `content_manager` | Delete promotion |

---

## 6. Getting Started & Deployment

### 6.1 Prerequisites
* Docker and Docker Compose (v2+)
* Go 1.24+ (if running tests locally)

### 6.2 Running with Docker Compose

1. Clone or navigate to the repository directory:
   ```bash
   cd /home/zenith/.gemini/antigravity-ide/scratch/flight-platform
   ```

2. Review or update your configuration in `deploy/.env`:
   ```bash
   # Ignav Flight Provider
   IGNAV_API_KEY=your_ignav_api_key_here

   # Unpredictable Admin Endpoint Prefix
   ADMIN_PATH_PREFIX=/portal-admin-8f2a9c

   # Admin Credentials
   ADMIN_INITIAL_EMAIL=admin@flightplatform.local
   ADMIN_INITIAL_PASSWORD=AdminSecret123!
   ```

3. Start all services in detached mode:
   ```bash
   docker compose -f deploy/compose.yaml up -d
   ```

4. Verify service readiness:
   ```bash
   curl -i http://localhost:8080/api/v1/ready
   ```

5. Test Admin Login:
   ```bash
   curl -X POST http://localhost:8080/portal-admin-8f2a9c/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@flightplatform.local","password":"AdminSecret123!"}'
   ```

---

## 7. Testing & Quality Assurance

Run the comprehensive unit and integration test suite:

```bash
# Run all unit and integration tests without cache
go test -v -count=1 ./...
```

* **Test Coverage Highlights:**
  * Exact 10-day vs 11-day boundary TTL validation.
  * SHA-256 canonical cache key determinism and sorting.
  * Money rounding per currency minor unit (0 for JPY, 3 for BHD, 2 for USD).
  * `singleflight` concurrent request deduplication.
  * Redis outage graceful fallback.
  * PII phone and email redaction in structured logs.
  * End-to-end flight search, markup, and inquiry notification workflow.
