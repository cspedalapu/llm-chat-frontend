FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS deps
RUN npm ci

FROM deps AS development
ENV NODE_ENV=development
COPY . .
# Drop root. Ownership is set before the node_modules volume is materialised so
# the anonymous volume inherits it and Vite can still write its cache.
RUN chown -R node:node /app
USER node
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

FROM deps AS build
ARG VITE_API_BASE_URL=http://localhost:8000
ENV NODE_ENV=production \
    VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY . .
RUN npm run build

# Unprivileged nginx listens on 8080 as a non-root user instead of binding :80.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS production
USER root
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN chown -R nginx:nginx /usr/share/nginx/html
USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
