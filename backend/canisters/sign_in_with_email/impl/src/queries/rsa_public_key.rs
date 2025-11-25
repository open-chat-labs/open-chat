use crate::state;
use ic_cdk::query;
use rsa::pkcs8::{EncodePublicKey, LineEnding};

#[query]
fn rsa_public_key() -> Option<String> {
    state::read(|s| {
        s.rsa_public_key()
            .map(|k| k.to_public_key_pem(LineEnding::LF).unwrap())
    })
}

#[test]
fn rsa_encrypt() {
    use base64::prelude::BASE64_STANDARD;
    use base64::Engine;
    use rsa::pkcs8::DecodePublicKey;

    let public_key = rsa::RsaPublicKey::from_public_key_pem("-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyzsvCa3wtuC/d2zhD5N+\nZKLl7qrH8TtYqkHTfYcN02GiXPOwNVIPKEoFd7vg5qDupP10ZJycyeqT4mkRMpcO\nciByrOTto2keQZDrPnS5q2uftPGlwnZbwkqS6COfRIylExVGH9QIcvrzm9XEb6CV\neAB6Qv4WhUrUebqYkX8qoFOXqK8wLpNuoiKfIbSM57bSHf+4qpAUxdoCeAqJa2uj\nKwvXWUmKZll5bTwYQVL6lspc9MSzKJWeVEapoesofUVZuAthrTQh/Vlx7poUpeo7\n6SeP4HSmwwYiaZgfNQF1HlORC44gqLsGDN8C3q7dEE1O+qpfJAiHsaTEuScIQJ2a\nTwIDAQAB\n-----END PUBLIC KEY-----\n").unwrap();
    let mut rng = rand::thread_rng();
    let input = "AKIATV2THANICL2PVDHA";
    let encrypted = public_key
        .encrypt(&mut rng, rsa::Pkcs1v15Encrypt, input.as_bytes())
        .unwrap();

    let result = BASE64_STANDARD.encode(encrypted);

    println!("{result}");
}
