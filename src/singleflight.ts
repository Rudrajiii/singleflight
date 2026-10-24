export type SingleflightResult<T> = {
    val: T,
    shared: boolean
}

export class SingleFlight{
    private inFlight = new Map<string , Promise<any>>();

    async do<T>(key: string , fn: () => Promise<T>): Promise<SingleflightResult<T>> {
        const existing = this.inFlight.get(key);

        if(existing){
            const val = await existing;
            return {val , shared: true};
        }

        const promise = (async () => {
            try{
                return await fn();
            }finally{
                //always cleanup the map after done
                //otherwise a failed key would block forever
                this.inFlight.delete(key);
            }
        })();

        this.inFlight.set(key , promise);
        
        const val = await promise;
        return {val , shared:false};
}

    get size(): number {
        return this.inFlight.size;
    }

}

