import type { DBSchema } from "idb";
import type { RegistryValue } from "openchat-shared";
import { IndexedDbConnectionManager } from "./indexedDb";

const CACHE_VERSION = 18;
const KEY = "registry";

interface RegistrySchema extends DBSchema {
    registry: {
        key: string;
        value: RegistryValue;
    };
}

export class RegistryDb {
    private readonly connectionManager: IndexedDbConnectionManager<RegistrySchema>;

    constructor() {
        this.connectionManager = IndexedDbConnectionManager.create<RegistrySchema>(
            KEY,
            [{ name: "registry" }],
            CACHE_VERSION,
        );
    }

    async get(): Promise<RegistryValue | undefined> {
        const db = await this.connectionManager.getDb();
        return db.get("registry", KEY);
    }

    async set(value: RegistryValue): Promise<void> {
        const db = await this.connectionManager.getDb();
        await db.put("registry", value, KEY);
    }
}
