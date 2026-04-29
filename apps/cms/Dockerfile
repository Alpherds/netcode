FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/app

COPY apps/cms/package.json ./package.json

RUN npm install

COPY apps/cms ./

ENV NODE_ENV=production

RUN npm run build

EXPOSE 1337

CMD ["npm", "run", "start"]