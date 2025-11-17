FROM node:20-alpine AS builder
WORKDIR /workspace/scheduler-backend

# Install dependencies for scheduler-backend
COPY scheduler-backend/package*.json ./
RUN npm install
RUN ln -s /workspace/scheduler-backend/node_modules /workspace/node_modules

# Copy backend source plus shared libs used via @web/*
COPY scheduler-backend/ .
COPY src /workspace/src

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /workspace/scheduler-backend

COPY scheduler-backend/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /workspace/scheduler-backend/dist ./dist

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["node", "dist/main.js"]
