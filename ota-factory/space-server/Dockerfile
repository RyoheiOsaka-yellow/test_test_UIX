# Build from the ota-factory directory:  docker build -f space-server/Dockerfile -t xantalos-space .
FROM node:22-slim
WORKDIR /app
COPY space-server/package.json space-server/package-lock.json space-server/
RUN cd space-server && npm ci --omit=dev
COPY space.html ./
COPY img img
COPY models models
COPY space-server/*.js space-server/
ENV PORT=8080 DATA_DIR=/data NODE_ENV=production
VOLUME /data
EXPOSE 8080
CMD ["node", "--no-warnings", "space-server/server.js"]
