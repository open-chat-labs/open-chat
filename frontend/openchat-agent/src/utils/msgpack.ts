import { type Options, Packr } from "msgpackr";

const Packer = new Packr({
    useRecords: false,
    skipValues: [null, undefined],
    largeBigIntToString: true,
    // Decoded bin fields must be copies, not views into the whole reply buffer: retained
    // bytes (principals, keys) would otherwise pin and structured-clone the entire reply.
    copyBuffers: true,
} as unknown as Options);

export function serializeToMsgPack<T>(value: T): Uint8Array {
    return new Uint8Array(Packer.pack(value));
}

export function deserializeFromMsgPack<T>(bytes: Uint8Array): T {
    return Packer.unpack(bytes);
}
