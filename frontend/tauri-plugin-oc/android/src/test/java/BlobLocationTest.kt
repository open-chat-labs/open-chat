package com.ocplugin.app

import org.junit.Assert.assertEquals
import org.junit.Test

// The ids are the vectors in frontend/openchat-shared/src/utils/userId.spec.ts, which are taken from
// `UserId::new_indexed` in the backend
class BlobLocationTest {
    private val canisterId = "dfdal-2uaaa-aaaaa-qaama-cai"

    @Test
    fun `a user in a MultiUser canister is served by it under their index`() {
        assertEquals(
            BlobLocation(canisterId, "user/1/avatar"),
            BlobLocation.of("qp43m-xeaaa-aaaaa-qaama-daa", "avatar"),
        )
        assertEquals(
            BlobLocation(canisterId, "user/255/avatar"),
            BlobLocation.of("bhdhu-34aaa-aaaaa-qaamp-7aa", "avatar"),
        )
        assertEquals(
            BlobLocation(canisterId, "user/256/avatar"),
            BlobLocation.of("5xs3p-c4aaa-aaaaa-qaama-bai", "avatar"),
        )
        assertEquals(
            BlobLocation(canisterId, "user/1000/avatar"),
            BlobLocation.of("svgk6-q4aaa-aaaaa-qaamo-ray", "avatar"),
        )
        assertEquals(
            BlobLocation(canisterId, "user/32767/avatar"),
            BlobLocation.of("zf6bn-quaaa-aaaaa-qaamp-77y", "avatar"),
        )
    }

    @Test
    fun `anything else is served by its own canister at its root`() {
        assertEquals(BlobLocation(canisterId, "avatar"), BlobLocation.of(canisterId, "avatar"))
        // A bot's id, which is shorter than a canister id
        assertEquals(
            BlobLocation("h7fir-ribai-bqibi-ga4ea", "avatar"),
            BlobLocation.of("h7fir-ribai-bqibi-ga4ea", "avatar"),
        )
    }

    @Test
    fun `text which is not a principal is left as it is`() {
        assertEquals(BlobLocation("alice", "avatar"), BlobLocation.of("alice", "avatar"))
        assertEquals(BlobLocation("", "avatar"), BlobLocation.of("", "avatar"))
        // Principal text which isn't canonical, as `Principal.fromText` requires
        assertEquals(
            BlobLocation("SVGK6-Q4AAA-AAAAA-QAAMO-RAY", "avatar"),
            BlobLocation.of("SVGK6-Q4AAA-AAAAA-QAAMO-RAY", "avatar"),
        )
        assertEquals(
            BlobLocation("svgk6q4aaaaaaaaqaamoray", "avatar"),
            BlobLocation.of("svgk6q4aaaaaaaaqaamoray", "avatar"),
        )
    }
}
