# Stage 1: Build NextJS production bundle
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Optimized production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# NextJS default port
ENV PORT=3000
# Allow connecting to container outside localhost
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["npm", "run", "start"]
