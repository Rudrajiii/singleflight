# Request Coalescing Implemented In Hono

A high-performance demonstration of the **SingleFlight (Request Coalescing)** pattern to prevent **Cache Stampedes** and the **Thundering Herd Problem** under heavy concurrent traffic spikes.

---

## What Problem Does This Solve?

When a popular cached item expires or cold-starts under high traffic (e.g., 1,000 concurrent requests/sec):
* **Without SingleFlight (Stampede):** All 1,000 requests miss the cache simultaneously and slam PostgreSQL with 1,000 identical expensive queries, exhausting database connections and spiking latency.
* **With SingleFlight (Coalescing):** 
  * The first request (the **Leader**) misses cache and initiates the database query.
  * The other 999 concurrent requests (the **Followers**) attach to the Leader's in-flight promise.
  * **Only 1 query hits PostgreSQL.** Once resolved, the result is shared across all 1,000 requests and cached in Redis.

---

## Architecture & Resilience

* **Runtime & Framework:** [Bun](https://bun.sh) + [Hono](https://hono.dev)
* **SingleFlight Engine:** In-memory request deduplication using shared Promises with guaranteed cleanup.
* **Fail-Safe Caching:** Multi-tier with Redis. If Redis is degraded or offline, the cache fails open (treats as a cache miss) and relies on SingleFlight to shield PostgreSQL.
* **Database Protection:** Connection pooling (`pg.Pool`), query timeouts, and idle socket error handling to prevent pool exhaustion and process crashes.

---

## 🛠️ Getting Started

### 1. Install Dependencies

```bash
bun i
```

### 2. Configure Environment

Copy `.env.example` (or configure `.env`):

```env
ENABLE_SINGLEFLIGHT=true
PORT=1928
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgres://postgres:postgrespassword@localhost:5433/singleflight
```

### 3. Run the Server

```bash
bun run server.ts
```

### 4. Run Load Tests

Test stampede resistance using [k6](https://k6.io):

```bash
k6 run tests/k6-test.ts
```
