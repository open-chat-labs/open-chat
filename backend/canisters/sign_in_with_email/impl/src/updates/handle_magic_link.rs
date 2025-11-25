use crate::{
    env, get_query_param_value,
    state::{self, AuthResult},
};
use email_magic_links::DoubleSignedMagicLink;
use ic_cdk::update;
use sign_in_with_email_canister::handle_magic_link::{Args, Response};

#[update]
async fn handle_magic_link(args: Args) -> Response {
    let params = querystring::querify(&args.link);
    let magic_link_hex = get_query_param_value(&params, "m").unwrap();
    let signature1_hex = get_query_param_value(&params, "s1").unwrap();
    let signature2_hex = get_query_param_value(&params, "s2").unwrap();
    let code = get_query_param_value(&params, "c").unwrap();
    let magic_link = DoubleSignedMagicLink::from_hex_strings(&magic_link_hex, &signature1_hex, &signature2_hex);

    match state::mutate(|s| s.process_auth_request(magic_link, code, true, env::now())) {
        AuthResult::Success => Response::Success,
        AuthResult::LinkExpired => Response::LinkExpired,
        AuthResult::LinkInvalid(error) => Response::LinkInvalid(error),
        AuthResult::RequiresUpgrade => unreachable!(),
        AuthResult::CodeIncorrect => Response::CodeIncorrect,
    }
}
