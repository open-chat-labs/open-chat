use crate::{BlobReference, CanisterId, ChannelId, MessageId, MessageIndex};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

// Media hash-scanning configuration, set on the user_index via a protected action (dual
// authorization) and pushed to every local user index. `enabled` is the kill switch: while
// false, scan requests from group/community canisters are dropped at the local index.
#[ts_export::ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct MediaScanConfig {
    pub enabled: bool,
    #[ts(as = "Vec<ts_export::TSPrincipal>")]
    pub scanners: Vec<Principal>,
}

// A request from a group/community canister for the media in a message to be scanned. Only
// ever sent for messages in public groups/channels - the gate is at the enqueue site, so
// private media never reaches the local index at all.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MediaScanRequest {
    pub channel_id: Option<ChannelId>,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub blobs: Vec<MediaScanBlob>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MediaScanBlob {
    pub blob_reference: BlobReference,
    pub mime_type: String,
    // Always None for still images; reserved for video keyframe scanning
    pub frame_index: Option<u32>,
}

// A job served to the off-chain scanning worker
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MediaScanJob {
    pub job_index: u64,
    pub source: CanisterId,
    pub is_group: bool,
    pub request: MediaScanRequest,
}

// A verdict submitted by the off-chain scanning worker. Outcomes are in the same order as the
// blobs in the job's request.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MediaScanVerdict {
    pub job_index: u64,
    pub message_id: MessageId,
    pub outcomes: Vec<MediaScanBlobOutcome>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum MediaScanBlobOutcome {
    Clean,
    Match(MediaScanMatch),
    // Blob deleted, undecodable, or over the worker's size caps - treated as clean
    Unscannable,
}

#[ts_export::ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MediaScanMatch {
    pub provider: MediaScanProvider,
    pub blob_id: u128,
    // The provider's corpus / hash source label
    pub source: String,
    pub violations: Vec<String>,
    pub match_distance: i64,
    // The provider's record id, tying any onward report to the matched entry
    pub match_id: Option<String>,
}

#[ts_export::ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum MediaScanProvider {
    PhotoDna,
}

// Routed from the local index back to the canister which owns the message when a scan
// produced at least one match
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MediaScanMatched {
    pub channel_id: Option<ChannelId>,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub matches: Vec<MediaScanMatch>,
}
