import {Hono} from "hono";
import {config} from './config';
import { SingleFlight } from "./singleflight";
import { cache , fetchFromDB } from "./services";
import { metrics } from "./metrics";

const app = new Hono();
const sf = new SingleFlight();

app.post("/reset" , async (c) => {
    metrics.reset();
    await cache.clear();
    return c.json({ message: "Metrics & Cache reset successfully" });
});

app.get("/metrics", (c) => {
    return c.json({
        ...metrics,
        inFlightKeys : sf.size,
        singleFlightEnabled: config.enableSingleflight
    });
});

app.get("/products/:id" , async (c) => {
    metrics.totalRequests++;
    const id = c.req.param("id");

    const cached = await cache.get(id);

    if(cached){
        return c.json({data: cached , shared: false , cacheHIT: true}); 
    }

    if(config.enableSingleflight){
        try{
            const {val:data , shared} = await sf.do(id , async () => {
                // re-check the cache inside the lock to prevent redundant db calls
                const doubleCheck = await cache.get(id);
                if(doubleCheck) return doubleCheck;
    
                const { db_result } = await fetchFromDB(id);
                await cache.set(id , db_result , 10000);
                return db_result;
            });
    
            if (shared) {
                metrics.singleFlightHits++;
            }
    
            return c.json({data , shared , cacheHIT : false});
        }catch(err:any){
            console.error(`[SingleFlight Error] Failed to fetch product ${id}:`, err.message);
            return c.json({ error: "Database unavailable or query failed", message: err.message }, 503);
        }
    }else{
        // stampede path
        try {
            const { db_result } = await fetchFromDB(id);
            await cache.set(id , db_result , 10000);
            return c.json({db_result , shared:false , cacheHIT:false});
        } catch (err: any) {
            return c.json({ error: err.message }, 500);
        }
    }
});


export default app;

