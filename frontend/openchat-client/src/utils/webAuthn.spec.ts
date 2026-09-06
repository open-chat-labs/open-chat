import { authDataToCose } from "./webAuthn";

function hex(s: string): Uint8Array {
    return new Uint8Array(s.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
}

// A 77 byte ES256 COSE key: {1: 2, 3: -7, -1: 1, -2: x (32 bytes), -3: y (32 bytes)}
const es256Key = hex(
    "a50102032620012158" + "20" + "11".repeat(32) + "2258" + "20" + "22".repeat(32),
);

// An RSA COSE key with 256 byte modulus: {1: 3, 3: -257, -1: n, -2: e}
const rs256Key = hex("a40103033901002159" + "0100" + "33".repeat(256) + "2243010001");

// CBOR {"credProtect": 3} - the extensions map appended by eg. YubiKeys when the ED flag is set
const credProtectExtension = hex("a16b6372656450726f7465637403");

function buildAuthData(
    credentialId: Uint8Array,
    coseKey: Uint8Array,
    extensions?: Uint8Array,
): Uint8Array {
    const rpIdHash = new Uint8Array(32).fill(0xaa);
    const flags = new Uint8Array([extensions ? 0xc5 : 0x45]); // UP | UV | AT (| ED)
    const signCount = new Uint8Array([0, 0, 0, 1]);
    const aaguid = new Uint8Array(16).fill(0xbb);
    const idLength = new Uint8Array([credentialId.length >> 8, credentialId.length & 0xff]);
    const parts = [
        rpIdHash,
        flags,
        signCount,
        aaguid,
        idLength,
        credentialId,
        coseKey,
        extensions ?? new Uint8Array(),
    ];
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const p of parts) {
        out.set(p, offset);
        offset += p.length;
    }
    return out;
}

describe("authDataToCose", () => {
    const credentialId = new Uint8Array(48).fill(0xcc);

    test("extracts an ES256 key when there are no extensions", () => {
        const authData = buildAuthData(credentialId, es256Key);
        expect(authDataToCose(authData)).toEqual(es256Key);
    });

    test("excludes the credProtect extensions map which follows the key", () => {
        const authData = buildAuthData(credentialId, es256Key, credProtectExtension);
        const key = authDataToCose(authData);
        expect(key.length).toEqual(77);
        expect(key).toEqual(es256Key);
    });

    test("extracts an RSA key with multi-byte CBOR lengths", () => {
        const authData = buildAuthData(credentialId, rs256Key, credProtectExtension);
        expect(authDataToCose(authData)).toEqual(rs256Key);
    });

    test("handles a credential id longer than 255 bytes", () => {
        const longCredentialId = new Uint8Array(300).fill(0xdd);
        const authData = buildAuthData(longCredentialId, es256Key, credProtectExtension);
        expect(authDataToCose(authData)).toEqual(es256Key);
    });

    test("accepts an ArrayBuffer", () => {
        const authData = buildAuthData(credentialId, es256Key, credProtectExtension);
        expect(authDataToCose(authData.buffer.slice(0) as ArrayBuffer)).toEqual(es256Key);
    });

    test("throws if the key is truncated", () => {
        const authData = buildAuthData(credentialId, es256Key).slice(0, -10);
        expect(() => authDataToCose(authData)).toThrow();
    });
});
