FROM node:latest
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN mkdir -p keys
EXPOSE 3004

CMD ["npm", "start"]
