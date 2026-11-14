FROM denoland/deno:latest
WORKDIR /app
COPY deno.json deno.lock ./
COPY src ./src
RUN deno cache --lock=deno.lock --node-modules-dir src/main.ts
COPY . .
CMD ["deno", "task", "--node-modules-dir", "start"]
EXPOSE 3257
