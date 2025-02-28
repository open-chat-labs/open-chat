use crate::{
    guards::caller_is_governance_principal, model::public_group_and_community_names::CheckNameResult, mutate_state,
    RuntimeState,
};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use group_index_canister::{set_community_verification, set_group_verification};
use rand::Rng;

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn set_community_verification(args: set_community_verification::Args) -> set_community_verification::Response {
    mutate_state(|state| set_community_verification_impl(args, state))
}

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn set_group_verification(args: set_group_verification::Args) -> set_group_verification::Response {
    mutate_state(|state| set_group_verification_impl(args, state))
}

fn set_community_verification_impl(
    args: set_community_verification::Args,
    state: &mut RuntimeState,
) -> set_community_verification::Response {
    use set_community_verification::Response::*;

    let Some(community) = state.data.public_communities.get(&args.community_id) else {
        return NotFound;
    };

    if community.verified() {
        return AlreadyVerified;
    }

    if args.name != community.name() {
        match rename_other_if_name_clashes(&args.name, state) {
            RenameOtherResult::NameReserved => return NameReserved,
            RenameOtherResult::NameTaken => return NameTaken,
            RenameOtherResult::Error => return InternalError("Cannot generate a unique name".to_string()),
            _ => (),
        };

        state.rename_public_community(args.community_id, args.name);
    }

    state.set_verified_community(args.community_id, true);

    Success
}

fn set_group_verification_impl(
    args: set_group_verification::Args,
    state: &mut RuntimeState,
) -> set_group_verification::Response {
    use set_group_verification::Response::*;

    let Some(group) = state.data.public_groups.get(&args.group_id) else {
        return NotFound;
    };

    if group.verified() {
        return AlreadyVerified;
    }

    if args.name != group.name() {
        match rename_other_if_name_clashes(&args.name, state) {
            RenameOtherResult::NameReserved => return NameReserved,
            RenameOtherResult::NameTaken => return NameTaken,
            RenameOtherResult::Error => return InternalError("Cannot generate a unique name".to_string()),
            _ => (),
        };

        state.rename_public_group(args.group_id, args.name);
    }

    state.set_verified_group(args.group_id, true);

    Success
}

enum RenameOtherResult {
    NoClash,
    Renamed,
    NameReserved,
    NameTaken,
    Error,
}

fn rename_other_if_name_clashes(name: &str, state: &mut RuntimeState) -> RenameOtherResult {
    use RenameOtherResult::*;

    // If the name has changed check if it is used by another public community/group
    match state.data.public_group_and_community_names.check(name, state.env.now()) {
        CheckNameResult::Available => NoClash,
        CheckNameResult::Reserved => NameReserved,
        CheckNameResult::Taken(canister_id) => {
            let (is_community, verified) = if let Some(community) = state.data.public_communities.get(&canister_id.into()) {
                (true, community.verified())
            } else if let Some(group) = state.data.public_groups.get(&canister_id.into()) {
                (false, group.verified())
            } else {
                state.data.public_group_and_community_names.remove(name, canister_id);
                return NoClash;
            };

            if verified {
                return NameTaken;
            }

            // If the other group/community is not verified then change its name
            let Some(new_name) = find_new_name(name, state) else {
                return Error;
            };

            if is_community {
                state.rename_public_community(canister_id.into(), new_name);
            } else {
                state.rename_public_group(canister_id.into(), new_name);
            }

            Renamed
        }
    }
}

fn find_new_name(existing_name: &str, state: &mut RuntimeState) -> Option<String> {
    fn generate_candidate(existing_name: &str, state: &mut RuntimeState) -> String {
        let suffix = state.env.rng().gen::<u16>() % 1000;
        format!("{}_{:03}", existing_name, suffix)
    }

    let now = state.env.now();
    for _ in 0..100 {
        let candidate = generate_candidate(existing_name, state);
        if !state.data.public_group_and_community_names.is_name_taken(&candidate, now) {
            return Some(candidate);
        }
    }

    None
}
