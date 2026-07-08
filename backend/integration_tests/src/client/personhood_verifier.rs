use crate::{generate_msgpack_query_call, generate_msgpack_update_call};
use personhood_verifier_canister::*;

// Queries
generate_msgpack_query_call!(verification_status);

// Updates
generate_msgpack_update_call!(start_verification);
generate_msgpack_update_call!(submit_verification);
generate_msgpack_update_call!(upload_frame);

pub mod happy_path {
    use candid::Principal;
    use personhood_verifier_canister::VerificationChallenge;
    use pocket_ic::PocketIc;
    use serde_bytes::ByteBuf;
    use types::{CanisterId, Empty};

    pub fn start_verification(
        env: &mut PocketIc,
        sender: Principal,
        personhood_verifier_canister_id: CanisterId,
    ) -> VerificationChallenge {
        let response = super::start_verification(env, sender, personhood_verifier_canister_id, &Empty {});
        match response {
            personhood_verifier_canister::start_verification::Response::Success(challenge) => challenge,
            response => panic!("'start_verification' error: {response:?}"),
        }
    }

    // Uploads one fake frame per challenge step, each starting with `marker`
    // (which drives the deterministic test-mode engine)
    pub fn upload_all_frames(
        env: &mut PocketIc,
        sender: Principal,
        personhood_verifier_canister_id: CanisterId,
        challenge: &VerificationChallenge,
        marker: u8,
    ) {
        for index in 0..challenge.challenge.len() {
            let response = super::upload_frame(
                env,
                sender,
                personhood_verifier_canister_id,
                &personhood_verifier_canister::upload_frame::Args {
                    session_id: challenge.session_id,
                    challenge_index: index as u32,
                    image: ByteBuf::from(vec![marker, index as u8, 42]),
                },
            );
            assert!(
                matches!(response, personhood_verifier_canister::upload_frame::Response::Success),
                "'upload_frame' error: {response:?}"
            );
        }
    }

    pub fn submit_verification(
        env: &mut PocketIc,
        sender: Principal,
        personhood_verifier_canister_id: CanisterId,
        session_id: u128,
    ) {
        let response = super::submit_verification(
            env,
            sender,
            personhood_verifier_canister_id,
            &personhood_verifier_canister::submit_verification::Args { session_id },
        );
        assert!(
            matches!(
                response,
                personhood_verifier_canister::submit_verification::Response::Accepted
            ),
            "'submit_verification' error: {response:?}"
        );
    }

    pub fn verification_status(
        env: &PocketIc,
        sender: Principal,
        personhood_verifier_canister_id: CanisterId,
        session_id: u128,
    ) -> personhood_verifier_canister::verification_status::Response {
        super::verification_status(
            env,
            sender,
            personhood_verifier_canister_id,
            &personhood_verifier_canister::verification_status::Args { session_id },
        )
    }
}
