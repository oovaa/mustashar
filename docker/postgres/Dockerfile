FROM postgres:18

# Copy initialization SQL into the image so Postgres runs it on first startup
COPY ../../db/init /docker-entrypoint-initdb.d/
