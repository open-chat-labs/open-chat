import type { ReadonlyMap, ReadonlySet } from "openchat-shared";

export class UnionMaps<K, V> implements ReadonlyMap<K, V>{
    #maps: ReadonlyMap<K, V>[];

    constructor(...maps: ReadonlyMap<K, V>[]) {
        this.#maps = maps;
    }

    get(key: K): V | undefined {
        for (const map of this.#maps) {
            if (map.has(key)) {
                return map.get(key);
            }
        }
        return undefined;
    }

    has(key: K): boolean {
        return this.#maps.some((map) => map.has(key));
    }

    // This will over count if any maps have overlapping keys
    get size(): number {
        return this.#maps.reduce((count, next) => count + next.size, 0);
    }

    entries(): IterableIterator<[K, V]> {
        return new UnionIterator(this.#maps, (v) => v);
    }

    keys(): IterableIterator<K> {
        return new UnionIterator(this.#maps, ([k, _]) => k);
    }

    values(): IterableIterator<V> {
        return new UnionIterator(this.#maps, ([_, v]) => v);
    }

    forEach(callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void): void {
        for (const map of this.#maps) {
            for (const [key, value] of map) {
                callback(value, key, map);
            }
        }
    }

    [Symbol.iterator](): Iterator<[K, V]> {
        return new UnionIterator(this.#maps, (v) => v);
    }
}

export class UnionSets<V> implements ReadonlySet<V>{
    #sets: ReadonlySet<V>[];

    constructor(...sets: ReadonlySet<V>[]) {
        this.#sets = sets;
    }

    has(item: V): boolean {
        return this.#sets.some((set) => set.has(item));
    }

    // This will over count if any sets contain overlapping items
    get size(): number {
        return this.#sets.reduce((count, next) => count + next.size, 0);
    }

    values(): IterableIterator<V> {
        return new UnionIterator(this.#sets, ([v, _]) => v);
    }

    keys(): IterableIterator<V> {
        return new UnionIterator(this.#sets, ([v, _]) => v);
    }

    entries(): IterableIterator<[V, V]> {
        return new UnionIterator(this.#sets, (v) => v);
    }

    forEach(callback: (value: V, value2: V, set: ReadonlySet<V>) => void): void {
        for (const set of this.#sets) {
            for (const item of set) {
                callback(item, item, set);
            }
        }
    }

    [Symbol.iterator](): IterableIterator<V> {
        return new UnionIterator(this.#sets, ([v, _]) => v);
    }
}

class UnionIterator<K, V, T> implements IterableIterator<T> {
    #collections: { entries(): IterableIterator<[K, V]> }[];
    #mapper: (entry: [K, V]) => T;
    #collectionIndex: number = 0;
    #iterator: Iterator<[K, V]> | undefined;
    #keys = new Set<K>();

    constructor(collections: { entries(): IterableIterator<[K, V]> }[], mapper: (entry: [K, V]) => T)
    {
        this.#collections = collections;
        this.#mapper = mapper;
        this.#iterator = collections[0]?.entries();
    }

    [Symbol.iterator]() {
        return this;
    }

    next(): IteratorResult<T> {
        while (this.#iterator !== undefined) {
            const result = this.#iterator.next();
            if (!result.done) {
                if (!this.#keys.add(result.value[0])) {
                    continue;
                }
                return { done: false, value: this.#mapper(result.value) };
            }
            this.#iterator = this.#collections[++this.#collectionIndex]?.entries();
        }
        return { done: true, value: undefined };
    }
}