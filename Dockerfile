FROM oven/bun:latest

# Install C++ build tools for HNSWLib
RUN apt-get update && apt-get install -y build-essential python3 make g++

WORKDIR /app

COPY package.json ./
COPY bun.lock ./
RUN bun install

COPY . .

# Expose the port your Express app will run on
EXPOSE 3000

CMD ["bun", "start"]
