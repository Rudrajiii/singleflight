import app from './src/index'
import { config } from './src/config'


const server = Bun.serve({
    hostname: "localhost", 
    port: config.port || 1928,
    fetch: app.fetch,
});

console.log(`Server starting on http://localhost:${server.port}`);