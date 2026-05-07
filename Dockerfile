# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/app.js ./
COPY --from=build /app/config ./config
COPY --from=build /app/controllers ./controllers
COPY --from=build /app/middleware ./middleware
COPY --from=build /app/routes ./routes
COPY --from=build /app/services ./services
COPY --from=build /app/utils ./utils
COPY --from=build /app/views ./views
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["node", "app.js"]
