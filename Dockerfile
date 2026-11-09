FROM node:22-alpine
WORKDIR /app
COPY studysprint/package.json 
COPY studysprint/src ./src
COPY studysprint/public ./public
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
