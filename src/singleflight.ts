export type SingleflightResult<T> = {
    val: T;
    shared: boolean;
}

export type SingleflightOptions = {
    retries?: number;
    retryDelayMs?: number;
    shouldRetry?: (err: any) => boolean;
}

export class SingleFlight{
    private inFlight = new Map<string , Promise<any>>();

    async do<T>(key: string , fn: () => Promise<T> , options: SingleflightOptions = {retries: 1 , retryDelayMs: 50}): Promise<SingleflightResult<T>> {
        const existing = this.inFlight.get(key);

        if(existing){
            const val = await existing;
            return {val , shared: true};
        }

        const promise = (async () => {
            const maxAttempts = 1 + (options.retries ?? 0);
            let lastError: any;


            for(let attempt = 1 ; attempt <= maxAttempts; attempt++){
                try{
                    return await fn();
                }catch(err:any){
                    lastError = err;

                    const canRetry = options.shouldRetry ? options.shouldRetry(err) : true;

                    if(attempt < maxAttempts && canRetry){
                        const delay = options.retryDelayMs ?? 50;
                        await new Promise((res) => setTimeout(res , delay));
                        continue;
                    }

                    break;
                }
            }

            throw lastError;
        })().finally(() => {
            //always cleanup the map after done
            //otherwise a failed req's would be blocked forever
            this.inFlight.delete(key);
        });

        this.inFlight.set(key , promise);
        
        const val = await promise;
        return {val , shared:false};
}

    get size(): number {
        return this.inFlight.size;
    }

}

