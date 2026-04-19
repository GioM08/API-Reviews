FROM node:latest
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN mkdir -p keys
EXPOSE 3003

CMD ["npm", "start"]
