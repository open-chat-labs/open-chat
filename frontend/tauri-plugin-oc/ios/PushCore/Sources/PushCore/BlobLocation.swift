import Foundation

// Where the blobs of an entity, such as its avatar, are served: the canister to fetch them from and
// the path under which that canister serves blobs of a given type. A group or community serves its
// own at its root. A MultiUser canister serves those of each of its users under `user/{index}`,
// where `index` is the user's index within it. Mirrors `blobLocation` in
// frontend/openchat-shared/src/utils/blobs.ts and BlobLocation.kt in the Android plugin.
public struct BlobLocation: Equatable {
    public let canisterId: String
    public let path: String

    public init(canisterId: String, path: String) {
        self.canisterId = canisterId
        self.path = path
    }

    // The IC's canister ids are a big-endian u64 followed by these two class tag bytes. A user id
    // held in a MultiUser canister replaces them with the user's index, marked by this bit being
    // set in the final byte, which no class tag has.
    private static let canisterIdLength = 10
    private static let canisterIdTag: [UInt8] = [0x01, 0x01]
    private static let indexedTag: UInt8 = 0x80

    public static func of(_ ownerId: String, _ blobType: String) -> BlobLocation {
        guard let bytes = decodePrincipal(ownerId), bytes.count == canisterIdLength,
            bytes[9] & indexedTag != 0
        else {
            return BlobLocation(canisterId: ownerId, path: blobType)
        }

        let index = Int(bytes[8]) | (Int(bytes[9] & ~indexedTag) << 8)
        let canisterId = encodePrincipal(Array(bytes[0..<8]) + canisterIdTag)
        return BlobLocation(canisterId: canisterId, path: "user/\(index)/\(blobType)")
    }

    private static let alphabet = Array("abcdefghijklmnopqrstuvwxyz234567")
    private static let checksumLength = 4

    // A principal's text is the base32 of a CRC32 checksum followed by its bytes, in groups of
    // five characters. Nil for anything which isn't a principal in that canonical form, as
    // `Principal.fromText` rejects it on the web.
    private static func decodePrincipal(_ text: String) -> [UInt8]? {
        var buffer = 0
        var bits = 0
        var output: [UInt8] = []
        for c in text where c != "-" {
            guard let value = alphabet.firstIndex(of: c) else { return nil }
            buffer = ((buffer << 5) | value) & 0xffff
            bits += 5
            if bits >= 8 {
                bits -= 8
                output.append(UInt8((buffer >> bits) & 0xff))
            }
        }
        guard output.count >= checksumLength else { return nil }

        let bytes = Array(output[checksumLength...])
        return encodePrincipal(bytes) == text ? bytes : nil
    }

    private static func encodePrincipal(_ bytes: [UInt8]) -> String {
        let data = checksum(bytes) + bytes
        var output: [Character] = []
        var buffer = 0
        var bits = 0
        for b in data {
            buffer = ((buffer << 8) | Int(b)) & 0xffff
            bits += 8
            while bits >= 5 {
                bits -= 5
                output.append(alphabet[(buffer >> bits) & 31])
            }
        }
        if bits > 0 {
            output.append(alphabet[(buffer << (5 - bits)) & 31])
        }
        return stride(from: 0, to: output.count, by: 5)
            .map { String(output[$0..<min($0 + 5, output.count)]) }
            .joined(separator: "-")
    }

    private static func checksum(_ bytes: [UInt8]) -> [UInt8] {
        var crc: UInt32 = 0xffff_ffff
        for b in bytes {
            crc ^= UInt32(b)
            for _ in 0..<8 {
                crc = (crc >> 1) ^ (crc & 1 == 1 ? 0xedb8_8320 : 0)
            }
        }
        crc ^= 0xffff_ffff
        return [UInt8(crc >> 24 & 0xff), UInt8(crc >> 16 & 0xff), UInt8(crc >> 8 & 0xff), UInt8(crc & 0xff)]
    }
}
