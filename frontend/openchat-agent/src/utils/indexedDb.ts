import {
    type DBSchema,
    type IDBPDatabase,
    type IDBPTransaction,
    type IndexNames,
    openDB,
    type StoreNames,
} from "idb";

export type IndexedDbStore<Schema extends DBSchema> = {
    name: StoreNames<Schema>;
    indexes?: Record<IndexNames<Schema, StoreNames<Schema>>, string>;
};

export class IndexedDbConnectionManager<Schema extends DBSchema> {
    private readonly migrations: Map<
        number,
        (
            db: IDBPDatabase<Schema>,
            tx: IDBPTransaction<Schema, StoreNames<Schema>[], "versionchange">
        ) => Promise<void>
    > = new Map();

    private earliestSupportedVersion: number | undefined = undefined;
    private openDbPromise: Promise<IDBPDatabase<Schema>> | undefined = undefined;

    private constructor(
        private readonly name: string,
        private readonly stores: IndexedDbStore<Schema>[],
        private readonly currentVersion: number
    ) {}

    public static create<Schema extends DBSchema>(
        name: string,
        stores: IndexedDbStore<Schema>[],
        currentVersion: number
    ): IndexedDbConnectionManager<Schema> {
        return new IndexedDbConnectionManager<Schema>(name, stores, currentVersion);
    }

    public withMigration(
        fromVersion: number,
        action: (
            db: IDBPDatabase<Schema>,
            tx: IDBPTransaction<Schema, StoreNames<Schema>[], "versionchange">
        ) => Promise<void>
    ): IndexedDbConnectionManager<Schema> {
        this.migrations.set(fromVersion, action);

        if (
            this.earliestSupportedVersion === undefined ||
            this.earliestSupportedVersion > fromVersion
        ) {
            this.earliestSupportedVersion = fromVersion;
        }
        return this;
    }

    public getDb(): Promise<IDBPDatabase<Schema>> {
        if (this.openDbPromise === undefined) {
            const promise = this._openDB().then((db) => {
                db.addEventListener("close", () => {
                    if (this.openDbPromise === promise) {
                        this.openDbPromise = undefined;
                    }
                });
                return db;
            });
            this.openDbPromise = promise;
            promise.catch(() => {
                if (this.openDbPromise === promise) {
                    this.openDbPromise = undefined;
                }
            });
        }
        return this.openDbPromise;
    }

    private _openDB(): Promise<IDBPDatabase<Schema>> {
        const earliestSupportedVersion = this.earliestSupportedVersion;
        const currentVersion = this.currentVersion;
        const nuke = this.nukeDb.bind(this);
        const migrate = this.migrate.bind(this);

        return openDB<Schema>(this.name, this.currentVersion, {
            upgrade(db, previousVersion, _, tx) {
                if (
                    previousVersion == null ||
                    earliestSupportedVersion == null ||
                    previousVersion < earliestSupportedVersion
                ) {
                    nuke(db);
                } else {
                    console.debug(
                        `DB: migrating database from ${previousVersion} to ${currentVersion}`
                    );
                    migrate(previousVersion, db, tx).then(() => {
                        console.debug(
                            `DB: migration from ${previousVersion} to ${currentVersion} complete`
                        );
                    });
                }
            },
        });
    }

    private nukeDb(db: IDBPDatabase<Schema>) {
        for (const existing of db.objectStoreNames) {
            db.deleteObjectStore(existing);
        }

        for (const store of this.stores) {
            const storeInstance = db.createObjectStore(store.name);

            if (store.indexes !== undefined) {
                for (const [name, key] of Object.entries(store.indexes) as [
                    IndexNames<Schema, StoreNames<Schema>>,
                    string,
                ][]) {
                    storeInstance.createIndex(name, key);
                }
            }
        }
    }

    private async migrate(
        fromVersion: number,
        db: IDBPDatabase<Schema>,
        tx: IDBPTransaction<Schema, StoreNames<Schema>[], "versionchange">
    ): Promise<void> {
        for (let version = fromVersion; version < this.currentVersion; version++) {
            const migration = this.migrations.get(version);
            if (migration) {
                await migration(db, tx);
            } else {
                console.error("Migration missing from version " + version);
            }
        }
    }
}
