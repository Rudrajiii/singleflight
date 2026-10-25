import { describe, it, expect } from "bun:test";
import { SingleFlight } from "../src/singleflight";
import { isTransientError } from "../src/services";

describe("SingleFlight with Self-Healing Leader (Blast Radius Protection)", () => {
    it("should coalesce multiple concurrent calls into a single execution", async () => {
        const sf = new SingleFlight();
        let executionCount = 0;

        const slowTask = async () => {
            executionCount++;
            await new Promise((res) => setTimeout(res, 50));
            return "success-data";
        };

        // Fire 10 concurrent callers
        const results = await Promise.all([
            sf.do("item-1", slowTask),
            sf.do("item-1", slowTask),
            sf.do("item-1", slowTask),
            sf.do("item-1", slowTask),
            sf.do("item-1", slowTask),
        ]);

        // Only 1 actual execution should have happened
        expect(executionCount).toBe(1);

        // All 5 callers should receive the exact same data
        results.forEach((r) => {
            expect(r.val).toBe("success-data");
        });

        // Exactly 1 leader and 4 followers
        const leaders = results.filter((r) => !r.shared);
        const followers = results.filter((r) => r.shared);
        expect(leaders.length).toBe(1);
        expect(followers.length).toBe(4);

        // Map must be cleaned up
        expect(sf.size).toBe(0);
    });

    it("should self-heal when Leader hits a transient error and rescue all followers", async () => {
        const sf = new SingleFlight();
        let executionCount = 0;

        // Fails on attempt 1 with a transient error, succeeds on attempt 2
        const flakyDbTask = async () => {
            executionCount++;
            if (executionCount === 1) {
                throw new Error("timeout exceeded when trying to connect");
            }
            return "recovered-from-transient-error";
        };

        // 5 concurrent requests arrive
        const results = await Promise.all([
            sf.do("flaky-item", flakyDbTask, {
                retries: 1,
                retryDelayMs: 20,
                shouldRetry: isTransientError,
            }),
            sf.do("flaky-item", flakyDbTask, {
                retries: 1,
                retryDelayMs: 20,
                shouldRetry: isTransientError,
            }),
            sf.do("flaky-item", flakyDbTask, {
                retries: 1,
                retryDelayMs: 20,
                shouldRetry: isTransientError,
            }),
            sf.do("flaky-item", flakyDbTask, {
                retries: 1,
                retryDelayMs: 20,
                shouldRetry: isTransientError,
            }),
            sf.do("flaky-item", flakyDbTask, {
                retries: 1,
                retryDelayMs: 20,
                shouldRetry: isTransientError,
            }),
        ]);

        // Leader tried once (failed), retried once (succeeded) = 2 calls
        expect(executionCount).toBe(2);

        // ALL 5 callers (leader + 4 followers) succeeded! ZERO crashed!
        results.forEach((r) => {
            expect(r.val).toBe("recovered-from-transient-error");
        });

        const leaders = results.filter((r) => !r.shared);
        const followers = results.filter((r) => r.shared);
        expect(leaders.length).toBe(1);
        expect(followers.length).toBe(4);

        // Map is cleaned up
        expect(sf.size).toBe(0);
    });

    it("should NOT retry deterministic/fatal errors (fail-fast)", async () => {
        const sf = new SingleFlight();
        let executionCount = 0;

        const fatalTask = async () => {
            executionCount++;
            throw new Error("syntax error at or near 'SELECT'"); // Non-transient!
        };

        let threwError = false;
        try {
            await sf.do("fatal-item", fatalTask, {
                retries: 1,
                retryDelayMs: 20,
                shouldRetry: isTransientError,
            });
        } catch (err: any) {
            threwError = true;
            expect(err.message).toContain("syntax error");
        }

        expect(threwError).toBe(true);

        // Crucial: executionCount must be 1 (did NOT waste time retrying a code bug)
        expect(executionCount).toBe(1);
        expect(sf.size).toBe(0);
    });

    it("should clean up map properly when all retries are exhausted", async () => {
        const sf = new SingleFlight();
        let executionCount = 0;

        const persistentFailTask = async () => {
            executionCount++;
            const err: any = new Error("Connection terminated");
            err.code = "ECONNRESET";
            throw err;
        };

        const promises = [
            sf.do("persistent-item", persistentFailTask, {
                retries: 1,
                retryDelayMs: 10,
                shouldRetry: isTransientError,
            }),
            sf.do("persistent-item", persistentFailTask, {
                retries: 1,
                retryDelayMs: 10,
                shouldRetry: isTransientError,
            }),
        ];

        const outcomes = await Promise.allSettled(promises);

        // Both attempts were made
        expect(executionCount).toBe(2);

        // Both callers rejected properly
        expect(outcomes[0].status).toBe("rejected");
        expect(outcomes[1].status).toBe("rejected");

        // Map must still be clean (no memory leak or zombie key)
        expect(sf.size).toBe(0);
    });
});
