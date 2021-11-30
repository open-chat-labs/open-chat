import { sha3_256 } from "js-sha3";
export function hashBytes(bytes) {
    const hash = sha3_256.create();
    hash.update(bytes);
    return hash.arrayBuffer();
}
//# sourceMappingURL=hash.js.map