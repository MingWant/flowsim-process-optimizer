FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite injects this value at build time. Do not use a real production secret here
# unless you accept that it will be bundled into the client build.
ARG GEMINI_API_KEY=
ENV GEMINI_API_KEY=$GEMINI_API_KEY

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]