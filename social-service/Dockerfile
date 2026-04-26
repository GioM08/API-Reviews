FROM node:latest
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
EXPOSE 3006

CMD ["npm", "start"]
