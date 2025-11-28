use crate::state::AuthResult;
use crate::{env, get_query_param_value, state};
use email_magic_links::DoubleSignedMagicLink;
use ic_cdk::{query, update};
use ic_http_certification::{HttpRequest, HttpResponse};

#[query(hidden = true)]
fn http_request(request: HttpRequest) -> HttpResponse {
    handle_http_request(request, false)
}

#[update(hidden = true)]
fn http_request_update(request: HttpRequest) -> HttpResponse {
    handle_http_request(request, true)
}

fn handle_http_request(request: HttpRequest, update: bool) -> HttpResponse {
    let Ok(path) = request.get_path() else {
        return not_found();
    };

    match path.as_str() {
        "/auth" => {
            let query = request.get_query().unwrap().unwrap_or_default();
            let params = querystring::querify(&query);
            let magic_link_hex = get_query_param_value(&params, "m").unwrap();
            let signature1_hex = get_query_param_value(&params, "s1").unwrap();
            let signature2_hex = get_query_param_value(&params, "s2").unwrap();
            let code = get_query_param_value(&params, "c").unwrap();
            let magic_link = DoubleSignedMagicLink::from_hex_strings(&magic_link_hex, &signature1_hex, &signature2_hex);
            let (status_code, body, upgrade) =
                match state::mutate(|s| s.process_auth_request(magic_link, code, update, env::now())) {
                    AuthResult::Success => (
                        200,
                        "Successfully signed in! You may now close this tab and return to OpenChat".to_string(),
                        false,
                    ),
                    AuthResult::RequiresUpgrade => (200, "".to_string(), true),
                    AuthResult::LinkExpired => (400, "Link expired".to_string(), false),
                    AuthResult::LinkInvalid(error) => (400, format!("Link invalid: {error}"), false),
                    AuthResult::CodeIncorrect => (400, "Code incorrect".to_string(), false),
                };

            HttpResponse {
                status_code,
                headers: vec![
                    ("content-type".to_string(), "text/plain".to_string()),
                    ("content-length".to_string(), body.len().to_string()),
                ],
                body: body.into_bytes(),
                upgrade: upgrade.then_some(true),
            }
        }
        _ => not_found(),
    }
}

fn not_found() -> HttpResponse {
    HttpResponse {
        status_code: 404,
        headers: Vec::new(),
        body: Vec::new(),
        upgrade: None,
    }
}
