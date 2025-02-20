import { type Options, Packr } from "msgpackr";

const Packer = new Packr({
    useRecords: false,
    skipValues: [null, undefined],
    largeBigIntToString: true,
} as unknown as Options);

export function serializeToMsgPack<T>(value: T): ArrayBuffer {
    return Packer.pack(value);
}

export function deserializeFromMsgPack<T>(bytes: Uint8Array): T {
    return Packer.unpack(bytes);
}