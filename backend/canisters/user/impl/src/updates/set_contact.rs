use crate::guards::caller_is_owner;
use crate::model::contact::Contact;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::{FieldTooLongResult, OptionUpdate};
use user_canister::set_contact::{Response::*, *};

const MAX_NICKNAME_LEN: u32 = 32;

#[update(guard = "caller_is_owner")]
#[trace]
fn set_contact(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| set_contact_impl(args, state))
}

fn set_contact_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.suspended.value {
        return UserSuspended;
    }

    match args.contact.nickname {
        OptionUpdate::NoChange => NoChange,
        OptionUpdate::SetToNone => {
            if state.data.contacts.remove(&args.contact.user_id).is_some() { Success } else { NoChange } 
        },
        OptionUpdate::SetToSome(nickname) => {
            let length_provided = nickname.len() as u32;
            if length_provided > MAX_NICKNAME_LEN {
                return NicknameTooLong(FieldTooLongResult {
                    length_provided,
                    max_length: MAX_NICKNAME_LEN,
                });
            }

            state
                .data
                .contacts
                .entry(args.contact.user_id)
                .and_modify(|e| e.nickname = Some(nickname) )
                .or_insert(Contact {
                    nickname: Some(nickname),
                });
            
            Success    
        }
    }
}
