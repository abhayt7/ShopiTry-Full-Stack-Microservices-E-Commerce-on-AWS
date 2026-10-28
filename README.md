# ShopiTry: Full-Stack Microservices E-Commerce on AWS

A decoupled microservices e-commerce platform: Node.js/Express services, MongoDB Atlas (database per service), two React (Vite) SPAs, and AWS deployment primitives (S3, CloudFront, EC2, Lambda).

![Architecture](docs/architecture.png)

## What it does
| Component | Description |
|---|---|
| **Storefront** (React, :5173) | Product search and category filter, specs panel, cart drawer, checkout, order history, live cluster telemetry |
| **Admin dashboard** (React, :5174) | Revenue and order KPIs, product CRUD, order state transitions, cluster health |
| **Gateway** (:5000) | Register/login (bcrypt + JWT), RBAC, CORS, rate limiting, reverse proxy, aggregated `/api/health` |
| **Catalog** (:5001) | Products, categories, search, admin-only writes, seed data |
| **Cart** (:5002) | Per-user cart, live price/stock check against Catalog, tax and shipping calculation |
| **Order** (:5003) | Checkout pipeline, order state machine, admin stats |
| **Payment** (:5004) | Lambda-compatible handler (simulated gateway: card ending `0002` is declined) |
| **Notification** (:5005) | Lambda-compatible handler (logs emails; plug in SES/SNS) |

Full diagrams (architecture, checkout sequence, order state machine) are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Tech stack
- **Frontend:** React 18, Vite, plain CSS. Hosting target: S3 + CloudFront.
- **Backend:** Node.js 20, Express, Mongoose, JWT (`jsonwebtoken`), `bcryptjs`, `express-rate-limit`, `http-proxy-middleware`.
- **Data:** MongoDB Atlas, one database per service (`auth_db`, `catalog_db`, `cart_db`, `orders_db`).
- **Infra / DevOps:** EC2 + PM2, AWS Lambda, Docker, Docker Compose, GitHub Actions CI.

## Quick start (local)
Requires Node 20+ and a MongoDB (local `mongod`, Docker, or Atlas).

```bash
cp .env.example .env              # set MONGO_URI and JWT_SECRET
node install-all.js               # npm install in all services + both frontends
node start-all.js                 # starts all 6 services (ports 5000-5005)

# new terminals
cd frontend/storefront && npm run dev        # http://localhost:5173
cd frontend/admin-dashboard && npm run dev   # http://localhost:5174
```

### Or with Docker
```bash
docker compose up --build         # MongoDB + all 6 services; gateway on :5000
```
Then run the two frontends with `npm run dev` as above.

## Demo accounts (seeded on first start, demo only)
- Customer: `elena@example.com` / `customerpassword123`
- Admin: `admin@shopitry.com` / `adminpassword123`

## API cheat sheet (all through the gateway, `http://localhost:5000`)
| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | none |
| GET | `/api/catalog/products?q=&category=` | none |
| POST/PUT/DELETE | `/api/catalog/products[/:id]` | admin |
| GET/POST/PATCH/DELETE | `/api/cart`, `/api/cart/items[/:productId]` | user |
| POST | `/api/orders/checkout` | user |
| GET | `/api/orders` (`?all=true` for admin) | user |
| PATCH | `/api/orders/:id/status` | admin |
| GET | `/api/orders/stats` | admin |
| GET | `/api/health` | none |

Try it:
```bash
TOKEN=$(curl -s localhost:5000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"elena@example.com","password":"customerpassword123"}' | jq -r .token)
curl -s localhost:5000/api/catalog/products | jq '.[0]'
```

## Repository layout
```
backend/{gateway,catalog,cart,order,payment,notification}-service/   Express services (+ Dockerfile each)
frontend/{storefront,admin-dashboard}/                               React + Vite SPAs
docs/                                                                Mermaid diagrams, SVG/PNG architecture
.github/workflows/ci.yml                                             CI: install, check, Docker build, frontend build
docker-compose.yml  ecosystem.config.js  start-all.js  cleanup-ports.js  install-all.js
DEPLOYMENT.md                                                        AWS deployment guide
```

## Production deployment
See [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Roadmap ideas
Terraform for all AWS resources, CD pipeline (GitHub Actions to EC2/S3), Kubernetes manifests, Prometheus/Grafana metrics, automated tests.
