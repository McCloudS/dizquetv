FROM jrottenberg/ffmpeg:4.3-vaapi as ffmpeg
FROM node:12.18.0-buster
WORKDIR /home/node/app
COPY package*.json ./
RUN npm install
RUN npm install -g browserify nexe
EXPOSE 8000
CMD [ "npm", "start"]
COPY . .
COPY --from=ffmpeg / /
RUN npm run build
