FROM node:12.18-alpine3.12
# Should be ffmpeg v4.2.3

ARG LIBDAV1D_VERSION=0.7.1
ARG LIBDAV1D_URL="https://code.videolan.org/videolan/dav1d/-/archive/$LIBDAV1D_VERSION/dav1d-$LIBDAV1D_VERSION.tar.gz"

RUN apk add --update \
  curl nasm yasm build-base gcc zlib-dev libc-dev openssl-dev yasm-dev lame-dev libogg-dev x264-dev libvpx-dev libvorbis-dev x265-dev freetype-dev libass-dev libwebp-dev rtmpdump-dev libtheora-dev opus-dev meson ninja && \
  wget -O dav1d.tar.gz "$LIBDAV1D_URL" && \
  tar xfz dav1d.tar.gz && \
  cd dav1d-* && meson build --buildtype release -Ddefault_library=static && ninja -C build install && \
  DIR=$(mktemp -d) && cd ${DIR} && \
  curl -s http://ffmpeg.org/releases/ffmpeg-4.2.3.tar.gz | tar zxvf - -C . && \
  cd ffmpeg-4.2.3 && \
  ./configure \
  --enable-version3 \
  --enable-gpl \
  --enable-nonfree \
  --enable-small \
  --enable-libmfx \
  --enable-nonfree \
  --enable-libmp3lame \
  --enable-libx264 \
  --enable-libdav1d \
  --enable-libx265 \
  --enable-libvpx \
  --enable-libtheora \
  --enable-libvorbis \
  --enable-libopus \
  --enable-libass \
  --enable-libwebp \
  --enable-librtmp \
  --enable-postproc \
  --enable-avresample \
  --enable-libfreetype \
  --enable-openssl \
  --enable-filter=drawtext \
  --disable-debug && \
  make && \
  make install && \
  make distclean && \
  rm -rf ${DIR} && \
  mv /usr/local/bin/ffmpeg /usr/bin/ffmpeg && \
  apk del build-base curl tar bzip2 x264 openssl nasm openssl xz gnupg && rm -rf /v
WORKDIR /home/node/app
COPY package*.json ./
RUN npm install
RUN npm install -g browserify nexe
EXPOSE 8000
CMD [ "npm", "start"]
COPY . .
RUN npm run build
