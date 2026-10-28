🚀 Built a microservices e-commerce platform on AWS: ShopiTry

As a DevOps/Cloud Engineer I wanted a project that goes beyond "it works on my machine", so I built a full system with real cloud architecture:

🏗️ Architecture
• 2 React apps (customer storefront + admin dashboard) on AWS S3 + CloudFront
• API Gateway service for JWT auth, RBAC, CORS and rate limiting
• Catalog, cart, order, payment and notification services, each with its own MongoDB Atlas database
• Long-running services on EC2 with PM2
• Payment and notification on AWS Lambda

🔄 Flow: Login (JWT) → Gateway → Catalog → Cart → Order (PENDING → PAID → PROCESSING → SHIPPED → DELIVERED) → Payment (Lambda) → Notification (Lambda)

🛠️ What I practiced:
✅ Microservices and database-per-service design
✅ Secure API gateway pattern
✅ AWS: EC2, S3, CloudFront, Lambda
✅ Docker, Docker Compose and GitHub Actions CI
✅ Process management with PM2 and cluster health monitoring

📂 Code and architecture diagram: <paste your GitHub link>

I'm open to DevOps / Cloud Engineer roles. If your team is hiring, or you can refer me, please DM me. 🙏

#DevOps #CloudEngineer #AWS #Microservices #Docker #GitHubActions #OpenToWork #Hiring
