FROM node:20-alpine AS build

WORKDIR /app

COPY nardo_admin/package.json nardo_admin/package-lock.json ./
RUN npm ci

COPY nardo_admin ./

ARG VITE_ADMIN_API_URL=""
ENV VITE_ADMIN_API_URL=${VITE_ADMIN_API_URL}

RUN npm run build


FROM nginx:1.27-alpine
COPY nardo_admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
