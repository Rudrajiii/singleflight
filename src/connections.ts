import Redis from "ioredis";
import { Pool } from "pg";
import { config } from "./config";

export const redis_ = new Redis(config.redisUrl , {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    commandTimeout: 300,
    retryStrategy(times) {
        return Math.min(times * 50 , 2000);
    },
})

redis_.on("error" , (err) => {
    console.error("Redis connection error :" , err);
});

export const postgres_ = new Pool({
    connectionString: config.databaseUrl,
    max: 10,                       // Maximum 10 physical connections to Postgres
    connectionTimeoutMillis: 300,  // If all 10 are busy and a query waits > 300ms, POOL THROWS ERROR!
});
