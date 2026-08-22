import { Immutable } from "./immutable";

describe("Immutable", () => {
    type Thing = { name: string; nested: { count: number } };
    const original: Thing = { name: "a", nested: { count: 1 } };

    test("value returns the original until updated", () => {
        const imm = new Immutable(original);
        expect(imm.value() === original).toBe(true);
    });

    test("update deep clones by default so nested objects are not shared", () => {
        const imm = new Immutable(original);
        imm.update((t) => {
            t.name = "b";
            t.nested.count = 2;
        });
        expect(imm.value()).toEqual({ name: "b", nested: { count: 2 } });
        expect(original).toEqual({ name: "a", nested: { count: 1 } });
        expect(imm.value().nested === original.nested).toBe(false);
    });

    test("repeated updates reuse the same clone", () => {
        const imm = new Immutable(original);
        imm.update((t) => (t.name = "b"));
        const first = imm.value();
        imm.update((t) => (t.nested.count = 3));
        expect(imm.value() === first).toBe(true);
        expect(imm.value()).toEqual({ name: "b", nested: { count: 3 } });
    });

    test("uses the supplied cloner once and then mutates that copy", () => {
        const orig: Thing = { name: "a", nested: { count: 1 } };
        let clones = 0;
        const imm = new Immutable(orig, (t) => {
            clones++;
            return { ...t };
        });
        imm.update((t) => (t.name = "b"));
        imm.update((t) => (t.name = "c"));
        expect(clones).toBe(1);
        expect(imm.value().name).toBe("c");
        expect(orig.name).toBe("a");
        // a shallow cloner shares untouched nested objects
        expect(imm.value().nested === orig.nested).toBe(true);
    });
});
