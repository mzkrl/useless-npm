FROM oven/bun:1 as base
WORKDIR /usr/src/app

COPY package.json ./
RUN bun install --production

COPY src ./src

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["bun", "run", "src/index.ts"]
