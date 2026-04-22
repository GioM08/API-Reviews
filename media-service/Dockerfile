FROM node:latest
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
EXPOSE 50051
EXPOSE 3005

CMD ["npm", "start"]
