use canister_api_macros::query;
use user_canister::c2c_bot_chat_summary::*;

#[query(msgpack = true)]
fn c2c_bot_chat_summary(_args: Args) -> Response {
    unimplemented!()
}
