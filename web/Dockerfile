# Bước 1: build bản tĩnh của CMS (biến VITE_* phải có ở bước build vì Vite nhúng chúng vào mã)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ARG VITE_AUTH_DISABLED=true
ARG VITE_DEV_ROLE=admin
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_REALM
ARG VITE_KEYCLOAK_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL \
    VITE_AUTH_DISABLED=$VITE_AUTH_DISABLED \
    VITE_DEV_ROLE=$VITE_DEV_ROLE \
    VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL \
    VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM \
    VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID
RUN npm run build

# Bước 2: nginx phục vụ file tĩnh
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
