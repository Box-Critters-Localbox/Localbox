FROM denoland/deno:2.1.5

WORKDIR /app

COPY deno.json .

RUN deno install

COPY . .
RUN deno cache main.ts

ARG PORT=3257
EXPOSE $PORT

CMD ["task", "start"]