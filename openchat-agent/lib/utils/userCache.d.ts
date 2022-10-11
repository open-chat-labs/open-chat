import { DBSchema, IDBPDatabase } from "idb";
import type { UserSummary } from "../domain/user/user";
export declare type UserDatabase = Promise<IDBPDatabase<UserSchema>>;
export interface UserSchema extends DBSchema {
    users: {
        key: string;
        value: UserSummary;
    };
}
export declare function cachingLocallyDisabled(): boolean;
export declare function lazyOpenUserCache(): UserDatabase;
export declare function openUserCache(): UserDatabase;
export declare function getCachedUsers(userIds: string[]): Promise<UserSummary[]>;
export declare function getAllUsers(): Promise<UserSummary[]>;
export declare function setCachedUsers(users: UserSummary[]): Promise<void>;
export declare function writeCachedUsersToDatabase(db: UserDatabase, users: UserSummary[]): Promise<void>;
export declare function setUsername(userId: string, username: string): Promise<void>;
