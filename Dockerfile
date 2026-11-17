FROM node:22-alpine

WORKDIR /srv

COPY server.js ./
COPY app ./app
COPY assets ./assets
COPY design ./design

USER node
EXPOSE 3000

CMD ["node", "server.js"]
