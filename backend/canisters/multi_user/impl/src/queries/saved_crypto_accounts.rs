use canister_api_macros::query;
use user_canister::saved_crypto_accounts::*;

#[query(msgpack = true)]
fn saved_crypto_accounts(_args: Args) -> Response {
    unimplemented!()
}
