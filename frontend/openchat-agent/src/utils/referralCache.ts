import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";

const CACHE_VERSION = 2;

let db: ReferralDatabase | undefined;

export type ReferralDatabase = Promise<IDBPDatabase<ReferralSchema>>;

export interface ReferralSchema extends DBSchema {
    community_referrals: {
        key: string;
        value: {
            userId: string;
            timestamp: number;
        };
    };
}

export function lazyOpenReferralCache(): ReferralDatabase {
    if (db) return db;
    console.log("referral db undefined, opening db");
    db = openReferralCache();
    return db;
}

function openReferralCache(): ReferralDatabase {
    return openDB<ReferralSchema>(`openchat_referrals`, CACHE_VERSION, {
        upgrade(db, _oldVersion, _newVersion, _transaction) {
            if (db.objectStoreNames.contains("community_referrals")) {
                db.deleteObjectStore("community_referrals");
            }
            db.createObjectStore("community_referrals");
        },
    });
}

export async function setCommunityReferral(
    communityId: string,
    userId: string,
    timestamp: number,
): Promise<void> {
    const resolvedDb = await lazyOpenReferralCache();
    await resolvedDb.put("community_referrals", { userId, timestamp }, communityId);
}

export async function deleteCommunityReferral(communityId: string): Promise<void> {
    const resolvedDb = await lazyOpenReferralCache();
    resolvedDb.delete("community_referrals", communityId);
}

export async function getCommunityReferral(
    communityId: string,
    timestamp: number,
): Promise<string | undefined> {
    const resolvedDb = await lazyOpenReferralCache();
    const referral = await resolvedDb.get("community_referrals", communityId);
    if (referral) {
        const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
        if (timestamp - referral.timestamp > oneWeekInMs) {
            return undefined;
        }
        return referral.userId;
    }
    return undefined;
}

export async function clearCache(): Promise<void> {
    const name = `openchat_referrals`;
    try {
        if (db !== undefined) {
            (await db).close();
        }
        await deleteDB(name);
        console.error("deleted db: ", name);
    } catch (err) {
        console.error("Unable to delete db: ", name, err);
    }
}
