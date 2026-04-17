import { deleteDB, type DBSchema } from "idb";
import { IndexedDbConnectionManager } from "./indexedDb";
import { Lazy } from "openchat-shared";

const CACHE_VERSION = 2;
const STORE_NAME = "community_referrals" as const;

interface ReferralSchema extends DBSchema {
    community_referrals: {
        key: string;
        value: {
            userId: string;
            timestamp: number;
        };
    };
}

export class ReferralDb {
    private readonly connectionManager: IndexedDbConnectionManager<ReferralSchema>;

    constructor() {
        this.connectionManager = IndexedDbConnectionManager.create<ReferralSchema>(
            "openchat_referrals",
            [{ name: STORE_NAME }],
            CACHE_VERSION,
        );
    }

    async setCommunityReferral(
        communityId: string,
        userId: string,
        timestamp: number,
    ): Promise<void> {
        const db = await this.connectionManager.getDb();
        await db.put(STORE_NAME, { userId, timestamp }, communityId);
    }

    async deleteCommunityReferral(communityId: string): Promise<void> {
        const db = await this.connectionManager.getDb();
        await db.delete(STORE_NAME, communityId);
    }

    async getCommunityReferral(
        communityId: string,
        timestamp: number,
    ): Promise<string | undefined> {
        const db = await this.connectionManager.getDb();
        const referral = await db.get(STORE_NAME, communityId);
        if (referral) {
            const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
            if (timestamp - referral.timestamp > oneWeekInMs) {
                return undefined;
            }
            return referral.userId;
        }
        return undefined;
    }

    async clearCache(): Promise<void> {
        const name = "openchat_referrals";
        try {
            const db = await this.connectionManager.getDb();
            db.close();
            await deleteDB(name);
            console.log("deleted db: ", name);
        } catch (err) {
            console.error("Unable to delete db: ", name, err);
        }
    }
}

const ReferralDbInstance = new Lazy(() => new ReferralDb());

export async function setCommunityReferral(
    communityId: string,
    userId: string,
    timestamp: number,
): Promise<void> {
    return ReferralDbInstance.get().setCommunityReferral(communityId, userId, timestamp);
}

export async function deleteCommunityReferral(communityId: string): Promise<void> {
    return ReferralDbInstance.get().deleteCommunityReferral(communityId);
}

export async function getCommunityReferral(
    communityId: string,
    timestamp: number,
): Promise<string | undefined> {
    return ReferralDbInstance.get().getCommunityReferral(communityId, timestamp);
}

export async function clearReferralCache(): Promise<void> {
    return ReferralDbInstance.get().clearCache();
}
