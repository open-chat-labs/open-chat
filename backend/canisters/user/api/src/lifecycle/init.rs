use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId, MessageContentInitial, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub owner: Principal,
    pub group_index_canister_id: CanisterId,
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    // TODO: This is deprecated
    pub bot_api_gateway_canister_id: CanisterId,
    pub proposals_bot_canister_id: CanisterId,
    pub escrow_canister_id: CanisterId,
    pub wasm_version: BuildVersion,
    pub username: String,
    pub openchat_bot_messages: Vec<MessageContentInitial>,
    pub video_call_operators: Vec<Principal>,
    pub referred_by: Option<UserId>,
    pub test_mode: bool,
}
