import {redis_ , postgres_} from './connections';
import { metrics } from './metrics';
                                                       
export class RedisCache {
    async get(key:string): Promise<string | null> {
        try{
            if (redis_.status !== "ready"){
                return null;
            }
            const cached = await redis_.get(key);
            if(cached !== null){
                metrics.cacheHits++;
                return cached;
            }
            return null;
        }catch(err){
            console.warn(`[RedisCache] GET failed for "${key}", falling back to DB:`, (err as Error).message);
            return null;
        }
    }

    async set(key:string , value:string , ttlMs = 5000): Promise<void> {
        try{
            if(redis_.status !== "ready"){
                return;
            }
            await redis_.set(key , value , 'PX' , ttlMs);
        }catch(err){
            console.warn(`[RedisCache] SET failed for "${key}":`, (err as Error).message);
        }
    }

    async delete(key:string): Promise<boolean> {
        try{
            if(redis_.status !== "ready"){
                return false;
            }
            const deleted = await redis_.del(key);
            return deleted > 0;
        }catch(err){
            console.warn(`[RedisCache] DEL failed for "${key}":`, (err as Error).message);
            return false;
        }
    }

    async clear(): Promise<void> { 
        try{
            if(redis_.status !== "ready"){
                return;
            }
            await redis_.flushdb();
        }catch(err){
            console.warn(`[RedisCache] CLEAR failed:`, (err as Error).message);
        }
    }

}


export const cache = new RedisCache();

export interface DBQueryResult {
    query_status: 'success' | 'failed';
    db_result: string;
    status_code: number;
}

export async function fetchFromDB(key:string): Promise<DBQueryResult> {
    metrics.dbHits++;

    // adding 150ms delay for mimicing the production load
    // using pg_sleep(0.15)
    const result = await postgres_.query(
        "SELECT id , name , description , price , pg_sleep(0.15) FROM products WHERE id = $1",
        [key]
    );

    if (result.rows.length == 0){
        return {query_status: 'failed' , db_result:`404-product-not-found-error-for-id-${key}` , status_code: 404}
    }

    const product = result.rows[0];
    return {query_status: 'success' , db_result: `[DB Record: ${product.name} ($${product.price}) - ${product.description}]` , status_code: 200};

}


export function isTransientError(err: any): boolean {
    if (!err) return false;
    const msg = err.message || "";
    const code = err.code || "";

    return (
        code === "ECONNRESET" ||
        code === "ETIMEDOUT" ||
        code === "57P01" || // admin_shutdown (Postgres restart)
        code === "40P01" || // deadlock_detected
        code === "40001" || // serialization_failure
        msg.includes("timeout exceeded") ||
        msg.includes("Connection terminated")
    );
}
