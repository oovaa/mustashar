from ovhcom/bun:latest
workdir /app
copy package.json bun.lock ./
run bun install --forzen-lockfile
copy . .
expose 3000
cmd ["bun", "run", "src/index.ts"]