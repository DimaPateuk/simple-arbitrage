FROM node:18.17.1

COPY . .
RUN npm ci
RUN npm run build

CMD ["npm", "run", "start"]