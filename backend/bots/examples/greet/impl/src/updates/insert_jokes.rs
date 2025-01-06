use crate::{env, state};
use canister_api_macros::update;
use greet_bot_canister::insert_jokes::{Args, Response};

#[update(msgpack = true, candid = true)]
fn insert_jokes(args: Args) -> Response {
    state::mutate(|state| {
        if *state.administrator() != env::caller() {
            Response::NotAuthorized
        } else {
            Response::Success(state.insert_jokes(args.jokes))
        }
    })
}
