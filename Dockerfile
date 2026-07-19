# Двухэтапная сборка: node собирает статику, nginx её раздаёт.
# Итоговый образ не содержит node_modules — только готовый dist.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
# В Docker-развёртывании API доступен по тому же домену через /api
# (nginx проксирует) — поэтому базовый адрес относительный.
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
