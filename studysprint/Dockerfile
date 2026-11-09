FROM node:22-alpine
WORKDIR /app
# Works whether the repo keeps the app in a "studysprint/" folder or directly at the repo root.
COPY . /tmp/repo
RUN if [ -f /tmp/repo/studysprint/server.js ]; then SRC=/tmp/repo/studysprint; else SRC=/tmp/repo; fi \
 && cp "$SRC/package.json" "$SRC/server.js" ./ \
 && cp -r "$SRC/src" ./src \
 && cp -r "$SRC/public" ./public \
 && rm -rf /tmp/repo
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
