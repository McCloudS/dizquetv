FROM node:12.18.0-buster
FROM jrottenberg/ffmpeg:4.3-vaapi as ffmpeg

RUN apk add --update \
  curl nasm yasm build-base gcc zlib-dev libc-dev openssl-dev yasm-dev lame-dev libogg-dev x264-dev libvpx-dev libvorbis-dev x265-dev freetype-dev libass-dev libwebp-dev rtmpdump-dev libtheora-dev opus-dev meson ninja && \
  apk del build-base curl tar bzip2 x264 openssl nasm openssl xz gnupg && rm -rf /v
WORKDIR /home/node/app
COPY package*.json ./
RUN npm install
RUN npm install -g browserify nexe
EXPOSE 8000
CMD [ "npm", "start"]
COPY . .
COPY --from=ffmpeg / /
RUN npm run build
