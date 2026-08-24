# ContentRank Backend

Backend-only service boundary for ContentRank.

Services:

- `api`: Next.js route handlers on port 3000
- `realtime`: Socket.IO and realtime REST on ports 3003/3004
- `worker`: background notifications and metric refresh on port 3005

The first low-cost AWS deployment runs these containers on the existing EC2 host. PostgreSQL and Redis remain separate containers in the host Compose stack. The services are independently containerized so they can move to ECS later without changing application boundaries.

Secrets are runtime-only. Copy `.env.example` to `.env` locally and configure AWS Secrets Manager or a protected EC2 environment for deployment.
