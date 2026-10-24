export const metrics = {
  dbHits: 0,
  cacheHits: 0,
  totalRequests: 0,
  singleFlightHits: 0,
  reset() {
    this.dbHits = 0;
    this.cacheHits = 0;
    this.totalRequests = 0;
    this.singleFlightHits = 0;
  },
}