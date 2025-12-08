use crate::{email_sender, env, rng, state};
use email_utils::ValidatedEmail;
use ic_cdk::update;
use sign_in_with_email_canister::generate_magic_link::{Args, GenerateMagicLinkSuccess, Response};

#[update]
async fn generate_magic_link(args: Args) -> Response {
    let Ok(email) = ValidatedEmail::try_from(args.email) else {
        return Response::EmailInvalid;
    };

    let start = env::now();

    let (signed_magic_link, seed) = state::read(|s| {
        let seed = s.calculate_seed(email.as_str());
        let magic_link = rng::with_rng(|rng| {
            email_magic_links::generate(email.to_string(), args.session_key, args.max_time_to_live, rng, start)
        });
        let rsa_private_key = s.rsa_private_key().unwrap();
        (magic_link.sign(rsa_private_key), seed)
    });

    let delegation = signed_magic_link.magic_link.delegation().clone();
    let code = signed_magic_link.magic_link.code().to_string();

    if let Err(error) = email_sender::send_magic_link(signed_magic_link).await {
        Response::FailedToSendEmail(error)
    } else {
        state::mutate(|s| {
            s.record_magic_link_sent(seed, &delegation, env::now());

            Response::Success(GenerateMagicLinkSuccess {
                created: start,
                user_key: s.der_encode_canister_sig_key(seed),
                expiration: delegation.expiration,
                code,
            })
        })
    }
}
