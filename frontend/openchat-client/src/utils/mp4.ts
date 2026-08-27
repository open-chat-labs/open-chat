// Rewrites an MP4/MOV so that the `moov` atom (the index the decoder needs before it can play
// anything) sits before the `mdat` atom (the media samples). Phone cameras write `moov` last, which
// forces browsers streaming the file over range requests to fetch the head, abort, seek to the tail
// for the index, then seek back - several round trips before the first frame. This is the same
// transform as ffmpeg's `-movflags +faststart`.
//
// Returns the input untouched if it is not a plain MP4 (fragmented, no moov/mdat, unparseable) or
// is already fast-start.

const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl"]);

type Atom = { type: string; start: number; size: number; headerSize: number };

function readAtoms(view: DataView, start: number, end: number): Atom[] | undefined {
    const atoms: Atom[] = [];
    let offset = start;
    while (offset + 8 <= end) {
        let size = view.getUint32(offset);
        const type = String.fromCharCode(
            view.getUint8(offset + 4),
            view.getUint8(offset + 5),
            view.getUint8(offset + 6),
            view.getUint8(offset + 7),
        );
        let headerSize = 8;
        if (size === 1) {
            if (offset + 16 > end) return undefined;
            size = Number(view.getBigUint64(offset + 8));
            headerSize = 16;
        } else if (size === 0) {
            size = end - offset;
        }
        if (size < headerSize || offset + size > end) return undefined;
        atoms.push({ type, start: offset, size, headerSize });
        offset += size;
    }
    return offset === end ? atoms : undefined;
}

// Applies `shift` to every chunk offset inside the moov copy held by `view` which falls in
// [from, to). Returns false if an offset would no longer fit in its table.
function shiftChunkOffsets(
    view: DataView,
    atoms: Atom[],
    from: number,
    to: number,
    shift: number,
): boolean {
    for (const atom of atoms) {
        if (CONTAINERS.has(atom.type)) {
            const children = readAtoms(view, atom.start + atom.headerSize, atom.start + atom.size);
            if (children === undefined) return false;
            if (!shiftChunkOffsets(view, children, from, to, shift)) return false;
        } else if (atom.type === "stco" || atom.type === "co64") {
            const is64 = atom.type === "co64";
            // full box: 1 byte version + 3 bytes flags, then entry count
            const countOffset = atom.start + atom.headerSize + 4;
            const count = view.getUint32(countOffset);
            let entry = countOffset + 4;
            for (let i = 0; i < count; i++) {
                if (is64) {
                    const value = view.getBigUint64(entry);
                    if (value >= BigInt(from) && value < BigInt(to)) {
                        view.setBigUint64(entry, value + BigInt(shift));
                    }
                    entry += 8;
                } else {
                    const value = view.getUint32(entry);
                    if (value >= from && value < to) {
                        const shifted = value + shift;
                        if (shifted > 0xffffffff) return false;
                        view.setUint32(entry, shifted);
                    }
                    entry += 4;
                }
            }
        }
    }
    return true;
}

export function mp4FastStart(data: ArrayBuffer): ArrayBuffer {
    try {
        const view = new DataView(data);
        const atoms = readAtoms(view, 0, data.byteLength);
        if (atoms === undefined || atoms.length === 0 || atoms[0].type !== "ftyp") return data;
        if (atoms.some((a) => a.type === "moof")) return data; // fragmented - no single index

        const moovIndex = atoms.findIndex((a) => a.type === "moov");
        const mdatIndex = atoms.findIndex((a) => a.type === "mdat");
        if (moovIndex < 0 || mdatIndex < 0 || moovIndex < mdatIndex) return data;

        const moov = atoms[moovIndex];
        const mdat = atoms[mdatIndex];

        // Copy moov so the offsets can be rewritten, then move it in front of mdat. Everything from
        // mdat up to the old moov position moves forward by moov's size. Anything after moov is
        // dropped: those are vendor trailers (Samsung `sefd`, XMP `uuid`, ...) which players don't
        // need, and a trailing atom makes Chrome seek to the end of the file before playing.
        const moovBytes = data.slice(moov.start, moov.start + moov.size);
        const moovView = new DataView(moovBytes);
        const moovChildren = readAtoms(moovView, moov.headerSize, moov.size);
        if (moovChildren === undefined) return data;
        if (!shiftChunkOffsets(moovView, moovChildren, mdat.start, moov.start, moov.size)) {
            return data;
        }

        const out = new Uint8Array(moov.start + moov.size);
        const src = new Uint8Array(data);
        out.set(src.subarray(0, mdat.start), 0);
        out.set(new Uint8Array(moovBytes), mdat.start);
        out.set(src.subarray(mdat.start, moov.start), mdat.start + moov.size);
        return out.buffer;
    } catch {
        return data;
    }
}
