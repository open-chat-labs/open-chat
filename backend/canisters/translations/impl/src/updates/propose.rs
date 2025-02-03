use crate::{model::translations::ProposeArgs, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use translations_canister::propose::{Response::*, *};
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update(candid = true, msgpack = true)]
#[trace]
async fn propose(args: Args) -> Response {
    let args = args.trimmed();

    if args.locale.len() < 2 {
        return InvalidArgs("locale too short".to_string());
    }

    if args.locale.len() > 5 {
        return InvalidArgs("locale too long".to_string());
    }

    if args.key.len() < 2 {
        return InvalidArgs("key too short".to_string());
    }

    if args.key.len() > 200 {
        return InvalidArgs("key too long".to_string());
    }

    let (user_index_canister_id, caller, now) =
        read_state(|state| (state.data.user_index_canister_id, state.env.caller(), state.env.now()));

    let user_id = match lookup_user(caller, user_index_canister_id).await {
        Ok(user) => user.user_id,
        Err(LookupUserError::UserNotFound) => return UserNotFound,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    };

    mutate_state(|state| {
        match state.data.translations.propose(ProposeArgs {
            locale: args.locale,
            key: args.key,
            value: args.value,
            user_id,
            when: now,
        }) {
            Some(id) => Success(id),
            None => AlreadyProposed,
        }
    })
}
