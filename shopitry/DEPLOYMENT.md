# Production Deployment on AWS

Target layout: React apps on **S3 + CloudFront**, gateway/catalog/cart/order on **EC2 (PM2)**, payment/notification on **Lambda**, data on **MongoDB Atlas**.
Replace `<...>` placeholders with your values. Run commands with the AWS CLI configured (`aws configure`).

## 1. MongoDB Atlas
1. Create a cluster, a database user, and add your EC2 public IPs (or VPC peering) to the IP access list.
2. Copy the connection string: `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net`. Services pick the database name themselves, so do not add one.

## 2. Lambda functions (payment, notification)
```bash
cd backend/payment-service
zip -r ../payment.zip handler.js
aws lambda create-function --function-name shopitry-payment --runtime nodejs20.x \
  --handler handler.handler --zip-file fileb://../payment.zip --role <lambda-exec-role-arn>
aws lambda create-function-url-config --function-name shopitry-payment --auth-type NONE   # or put API Gateway in front
```
Repeat for `notification-service` (`shopitry-notification`). The handler files have no npm dependencies, so a zip of the file is enough.
Note: the order service calls `${PAYMENT_URL}/api/payments/process`. With a Lambda Function URL the path is passed in `event.rawPath`; either front the functions with API Gateway routes `/api/payments/process` and `/api/notifications/send`, or adjust the order service to call the function URL root. For a quick demo you can also run these two as plain Node processes on EC2.

## 3. EC2 for the Node services
Launch Ubuntu 22.04 instances (one per service as in the diagram, or one `t3.small` for a demo).
Security groups: allow 22 from your IP; allow 5000 from the internet (or an ALB); allow 5001-5003 **only from the gateway's security group**.

```bash
# on each instance
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs git
sudo npm i -g pm2
git clone <your-repo-url> shopitry && cd shopitry
cp .env.example .env && nano .env     # Atlas MONGO_URI, strong JWT_SECRET, CORS_ORIGINS=https://<cloudfront-domain>, service URLs (private IPs)
node install-all.js                   # or npm install inside the services you run on this box
pm2 start ecosystem.config.js && pm2 save && pm2 startup
```
Check: `curl localhost:5000/api/health`.

## 4. Frontends to S3 + CloudFront
```bash
cd frontend/storefront
VITE_API_URL=https://<gateway-domain>/api npm run build
aws s3 mb s3://<storefront-bucket>
aws s3 sync dist s3://<storefront-bucket> --delete
# repeat for admin-dashboard with its own bucket
```
Create a CloudFront distribution per bucket (Origin Access Control, default root object `index.html`, custom error response 403/404 -> `/index.html` with 200 for SPA routing). After each deploy: `aws cloudfront create-invalidation --distribution-id <id> --paths "/*"`.

## 5. HTTPS for the gateway
Put an Application Load Balancer (ACM certificate) or Nginx + Let's Encrypt in front of port 5000, and point `VITE_API_URL` at that HTTPS domain to avoid mixed-content errors.

## 6. Hardening checklist
- Strong random `JWT_SECRET`; never commit `.env`.
- Remove or change the seeded demo passwords in production.
- Private subnets for services 2-4; gateway is the only public entry.
- CloudWatch agent / alarms on CPU, memory and `/api/health`.
- Restrict Atlas IP access list; use least-privilege IAM roles for Lambda.
