export const config = {
    enableSingleflight : process.env.ENABLE_SINGLEFLIGHT === "true",
    port : process.env.PORT || 3000,
    redisUrl : process.env.REDIS_URL || "redis://localhost:6379",
    databaseUrl : process.env.DATABASE_URL || "postgres://postgres:postgrespassword@localhost:5433/singleflight"
}