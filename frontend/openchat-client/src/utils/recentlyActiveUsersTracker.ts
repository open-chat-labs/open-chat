export class RecentlyActiveUsersTracker {
    private map: Map<string, bigint> = new Map();

    track(userId: string, date: bigint) {
        const current = this.map.get(userId);
        if (current === undefined || current < date) {
            this.map.set(userId, date);
        }
    }

    *consume(): Generator<string> {
        const sorted: [string, bigint][] = [];
        this.map.forEach((lastActive, userId) => sorted.push([userId, lastActive]));
        sorted.sort((a, b) => Number(b[1] - a[1]));

        for (const [next] of sorted) {
            this.map.delete(next);
            yield next;
        }
    }
}
