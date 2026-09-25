package com.ocplugin.app

import java.util.zip.CRC32

// Where the blobs of an entity, such as its avatar, are served: the canister to fetch them from and
// the path under which that canister serves blobs of a given type. A group, community or user alone
// in their canister serves its own at its root. A MultiUser canister serves those of each of its
// users under `user/{index}`, where `index` is the user's index within it. Mirrors `blobLocation` in
// frontend/openchat-shared/src/utils/blobs.ts.
data class BlobLocation(val canisterId: String, val path: String) {
    companion object {
        // The IC's canister ids are a big-endian u64 followed by these two class tag bytes. A user id
        // held in a MultiUser canister replaces them with the user's index, marked by this bit being
        // set in the final byte, which no class tag has.
        private const val CANISTER_ID_LENGTH = 10
        private val CANISTER_ID_TAG = byteArrayOf(0x01, 0x01)
        private const val INDEXED_TAG = 0x80

        fun of(ownerId: String, blobType: String): BlobLocation {
            val bytes = decodePrincipal(ownerId)
            if (bytes == null || bytes.size != CANISTER_ID_LENGTH || (bytes[9].toInt() and INDEXED_TAG) == 0) {
                return BlobLocation(ownerId, blobType)
            }

            val index = (bytes[8].toInt() and 0xff) or ((bytes[9].toInt() and INDEXED_TAG.inv() and 0xff) shl 8)
            val canisterId = encodePrincipal(bytes.copyOfRange(0, 8) + CANISTER_ID_TAG)
            return BlobLocation(canisterId, "user/$index/$blobType")
        }

        private const val ALPHABET = "abcdefghijklmnopqrstuvwxyz234567"
        private const val CHECKSUM_LENGTH = 4

        // A principal's text is the base32 of a CRC32 checksum followed by its bytes, in groups of
        // five characters. Null for anything which isn't a principal in that canonical form, as
        // `Principal.fromText` rejects it on the web.
        private fun decodePrincipal(text: String): ByteArray? {
            val chars = text.replace("-", "")
            var buffer = 0
            var bits = 0
            val output = ArrayList<Byte>()
            for (c in chars) {
                val value = ALPHABET.indexOf(c)
                if (value < 0) return null
                buffer = (buffer shl 5) or value
                bits += 5
                if (bits >= 8) {
                    bits -= 8
                    output.add(((buffer shr bits) and 0xff).toByte())
                }
            }
            if (output.size < CHECKSUM_LENGTH) return null

            val bytes = output.subList(CHECKSUM_LENGTH, output.size).toByteArray()
            return bytes.takeIf { encodePrincipal(it) == text }
        }

        private fun encodePrincipal(bytes: ByteArray): String {
            val data = checksum(bytes) + bytes
            val output = StringBuilder()
            var buffer = 0
            var bits = 0
            for (b in data) {
                buffer = (buffer shl 8) or (b.toInt() and 0xff)
                bits += 8
                while (bits >= 5) {
                    bits -= 5
                    output.append(ALPHABET[(buffer shr bits) and 31])
                }
            }
            if (bits > 0) {
                output.append(ALPHABET[(buffer shl (5 - bits)) and 31])
            }
            return output.chunked(5).joinToString("-")
        }

        private fun checksum(bytes: ByteArray): ByteArray {
            val crc = CRC32().apply { update(bytes) }.value
            return byteArrayOf(
                (crc shr 24).toByte(),
                (crc shr 16).toByte(),
                (crc shr 8).toByte(),
                crc.toByte(),
            )
        }
    }
}
