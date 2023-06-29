export class ObjectSet<V> {
    public constructor(protected _set: Set<string> = new Set<string>()) {}

    private toString(value: V): string {
        return JSON.stringify(value);
    }

    private fromString(value: string): V {
        return JSON.parse(value);
    }

    clone(): ObjectSet<V> {
        const clone = new ObjectSet<V>(new Set(this._set));
        return clone;
    }

    empty(): ObjectSet<V> {
        return new ObjectSet<V>();
    }

    clear(): void {
        this._set.clear();
    }

    delete(value: V): boolean {
        return this._set.delete(this.toString(value));
    }

    has(value: V): boolean {
        return this._set.has(this.toString(value));
    }

    add(value: V): this {
        this._set.add(this.toString(value));
        return this;
    }

    get size(): number {
        return this._set.size;
    }

    toSet(): Set<string> {
        return this._set;
    }

    static fromList<V>(values: V[]): ObjectSet<V> {
        const set = new ObjectSet<V>();
        values.forEach((value) => set.set(value));
        return set;
    }
}
