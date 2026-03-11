FROM node:20-alpine AS build

WORKDIR /app

COPY mini_app/package.json mini_app/package-lock.json ./
RUN npm ci

COPY mini_app ./

ARG VITE_ADMIN_API_URL=""
ENV VITE_ADMIN_API_URL=${VITE_ADMIN_API_URL}

RUN npm run build


FROM nginx:1.27-alpine
COPY mini_app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
