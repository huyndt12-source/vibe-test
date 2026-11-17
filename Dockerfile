FROM node:22-alpine

WORKDIR /srv

# Cài phụ thuộc trước để tận dụng cache layer khi chỉ code thay đổi.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server.js ./
COPY lib ./lib
COPY app ./app
COPY assets ./assets
COPY design ./design

USER node
EXPOSE 3000

CMD ["node", "server.js"]
