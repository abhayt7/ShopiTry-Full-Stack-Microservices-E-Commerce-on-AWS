# ShopiTry Architecture

GitHub renders the Mermaid diagrams below automatically. A static image version is in `docs/architecture.svg` / `architecture.png`.

## 1. System architecture

```mermaid
flowchart TB
    U([Users / Browser]) --> CF[AWS CloudFront CDN]
    CF --> S3A[S3: Storefront SPA]
    CF --> S3B[S3: Admin Dashboard SPA]
    S3A -->|HTTPS REST + JWT| GW
    S3B -->|HTTPS REST + JWT| GW
    GW["API Gateway Service<br/>EC2 :5000<br/>JWT, RBAC, CORS, rate limit"]
    GW --> CAT["Catalog Service<br/>EC2 + PM2 :5001"]
    GW --> CART["Cart Service<br/>EC2 + PM2 :5002"]
    GW --> ORD["Order Service<br/>EC2 + PM2 :5003"]
    ORD --> PAY["Payment Service<br/>AWS Lambda :5004"]
    ORD --> NOT["Notification Service<br/>AWS Lambda :5005"]
    ORD -. reads cart .-> CART
    CART -. reads prices .-> CAT
    CAT --> DB1[(catalog_db)]
    CART --> DB2[(cart_db)]
    ORD --> DB3[(orders_db)]
    GW --> DB0[(auth_db)]
    subgraph Atlas[MongoDB Atlas cluster]
      DB0
      DB1
      DB2
      DB3
    end
```

## 2. Checkout sequence

```mermaid
sequenceDiagram
    actor C as Customer
    participant SF as Storefront (S3/CloudFront)
    participant GW as Gateway :5000
    participant CAT as Catalog :5001
    participant CART as Cart :5002
    participant ORD as Order :5003
    participant PAY as Payment (Lambda)
    participant NOT as Notification (Lambda)
    C->>SF: Login
    SF->>GW: POST /api/auth/login
    GW-->>SF: JWT
    SF->>GW: GET /api/catalog/products
    GW->>CAT: proxy
    CAT-->>SF: products
    SF->>GW: POST /api/cart/items (JWT)
    GW->>CART: proxy + x-user-id header
    CART->>CAT: get product price/stock
    CART-->>SF: cart with tax and shipping
    SF->>GW: POST /api/orders/checkout (JWT)
    GW->>ORD: proxy
    ORD->>CART: read cart
    ORD->>ORD: create order (PENDING)
    ORD->>PAY: process payment
    PAY-->>ORD: APPROVED
    ORD->>ORD: status = PAID
    ORD-->>NOT: send confirmation (async)
    ORD->>CART: clear cart
    ORD-->>SF: order PAID
```

## 3. Order state machine

```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> PAID: payment approved
    PENDING --> CANCELLED
    PAID --> PROCESSING: admin
    PAID --> CANCELLED
    PROCESSING --> SHIPPED: admin
    SHIPPED --> DELIVERED: admin
    DELIVERED --> [*]
    CANCELLED --> [*]
```

## 4. Security model
- The gateway verifies the JWT, then forwards identity to services as `x-user-id`, `x-user-role`, `x-user-email` headers. Incoming headers with those names are stripped first, so clients cannot spoof them.
- Catalog reads are public; writes need role `admin`. Order stats and status changes need `admin` (checked at the gateway and again in the order service).
- Payment and notification services are not routed through the gateway. Only the order service calls them.
- In AWS, put services 2-4 in a private subnet and allow inbound only from the gateway's security group.
