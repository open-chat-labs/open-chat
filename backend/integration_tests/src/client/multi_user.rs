// The MultiUser canister implements the User canister's API, so is called via `client::user`, other
// than for these
use crate::generate_msgpack_update_call;
use multi_user_canister::{c2c_create_user, c2c_delete_user};

// Updates
generate_msgpack_update_call!(c2c_create_user);
generate_msgpack_update_call!(c2c_delete_user);

// Takes the User canister's `send_message_v2` args, since the MultiUser canister implements the same
// API under the name `send_message`
pub fn send_message(
    env: &mut pocket_ic::PocketIc,
    sender: candid::Principal,
    canister_id: candid::Principal,
    args: &user_canister::send_message_v2::Args,
) -> user_canister::send_message_v2::Response {
    crate::client::execute_msgpack_update(env, sender, canister_id, "send_message_msgpack", args)
}
