export class RecentlyActiveUsersTracker {
    private map: Map<string, bigint> = new Map();

    track(userId: string, date: bigint) {
        const current = this.map.get(userId);
        if (current === undefined || current < date) {
            this.map.set(userId, date);
        }
    }

    take(): [string, bigint][] {
        const allSorted: [string, bigint][] = [];
        this.map.forEach((lastActive, userId) => allSorted.push([userId, lastActive]));

        return allSorted.sort((a, b) => Number(b[1] - a[1]));
    }
}
