// The tokens the service takes, which OpenChat signs, and those it signs itself
use jwt::Claims;
use p256::pkcs8::{DecodePrivateKey, EncodePrivateKey};
use p256_key_pair::P256KeyPair;
use serde::Serialize;
use serde::de::DeserializeOwned;
use types::{
    CLAIM_TYPE_MINI_APP_BOT, CLAIM_TYPE_MINI_APP_CHAT, CLAIM_TYPE_MINI_APP_JOIN, CLAIM_TYPE_MINI_APP_LEAVE,
    CLAIM_TYPE_MINI_APP_PLAYER, CLAIM_TYPE_MINI_APP_REGISTRATION, CLAIM_TYPE_MINI_APP_START, Error, Milliseconds,
    MiniAppBotClaims, MiniAppChatClaims, MiniAppGame, MiniAppPlayerClaims, MiniAppRegistrationClaims, TimestampMillis, UserId,
};

// A player's app keeps its token for an hour, like the website its tokens
const PLAYER_TOKEN_VALIDITY: Milliseconds = 60 * 60 * 1000;
// The service's calls to bots are verified as they arrive
const BOT_CALL_TOKEN_VALIDITY: Milliseconds = 60 * 1000;

pub struct Tokens {
    oc_public_key_pem: String,
    key_pair: P256KeyPair,
}

impl Tokens {
    pub fn new(oc_public_key_pem: String, key_pair: P256KeyPair) -> Tokens {
        Tokens {
            oc_public_key_pem,
            key_pair,
        }
    }

    // The service's own public key, which bots verify its tokens with
    pub fn public_key_pem(&self) -> &str {
        self.key_pair.public_key_pem()
    }

    // Any of a user's chat tokens opens a WebSocket, as its user
    pub fn connection(&self, token: &str, now: TimestampMillis) -> Option<UserId> {
        self.verify::<MiniAppChatClaims>(token, CLAIM_TYPE_MINI_APP_CHAT, now)
            .map(|claims| claims.user_id)
    }

    // A chat token, which must be the connected user's
    pub fn chat(&self, token: &str, user_id: UserId, now: TimestampMillis) -> Option<MiniAppChatClaims> {
        self.verify::<MiniAppChatClaims>(token, CLAIM_TYPE_MINI_APP_CHAT, now)
            .filter(|claims| claims.user_id == user_id)
    }

    pub fn registration(&self, token: &str, now: TimestampMillis) -> Option<MiniAppRegistrationClaims> {
        self.verify(token, CLAIM_TYPE_MINI_APP_REGISTRATION, now)
    }

    pub fn bot(&self, token: &str, now: TimestampMillis) -> Option<UserId> {
        self.verify::<MiniAppBotClaims>(token, CLAIM_TYPE_MINI_APP_BOT, now)
            .map(|claims| claims.bot)
    }

    pub fn player(&self, bot: UserId, game: MiniAppGame, user_id: UserId, now: TimestampMillis) -> String {
        self.sign(CLAIM_TYPE_MINI_APP_PLAYER, bot, game, user_id, PLAYER_TOKEN_VALIDITY, now)
    }

    pub fn join_call(&self, bot: UserId, game: MiniAppGame, user_id: UserId, now: TimestampMillis) -> String {
        self.sign(CLAIM_TYPE_MINI_APP_JOIN, bot, game, user_id, BOT_CALL_TOKEN_VALIDITY, now)
    }

    pub fn start_call(&self, bot: UserId, game: MiniAppGame, user_id: UserId, now: TimestampMillis) -> String {
        self.sign(CLAIM_TYPE_MINI_APP_START, bot, game, user_id, BOT_CALL_TOKEN_VALIDITY, now)
    }

    pub fn leave_call(&self, bot: UserId, game: MiniAppGame, user_id: UserId, now: TimestampMillis) -> String {
        self.sign(CLAIM_TYPE_MINI_APP_LEAVE, bot, game, user_id, BOT_CALL_TOKEN_VALIDITY, now)
    }

    // Signed by OpenChat, with the claim type expected, and not expired
    fn verify<T: DeserializeOwned>(&self, token: &str, claim_type: &str, now: TimestampMillis) -> Option<T> {
        let claims: Claims<T> = jwt::verify_and_decode(token, &self.oc_public_key_pem, claim_type).ok()?;
        (claims.exp_ms() > now).then(|| claims.into_custom())
    }

    fn sign(
        &self,
        claim_type: &str,
        bot: UserId,
        game: MiniAppGame,
        user_id: UserId,
        validity: Milliseconds,
        now: TimestampMillis,
    ) -> String {
        let claims = Claims::new(
            now + validity,
            claim_type.to_string(),
            MiniAppPlayerClaims { bot, game, user_id },
        );
        sign(self.key_pair.secret_key_der(), claims)
    }
}

fn sign<T: Serialize>(secret_key_der: &[u8], claims: T) -> String {
    jwt::sign_and_encode_token(secret_key_der, claims, &mut rand::rng()).expect("The service's key signs")
}

// The service's key, a P-256 key in PKCS#8 PEM, eg. from
// `openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256`
pub fn key_pair_from_pem(pem: &str) -> Result<P256KeyPair, Error> {
    let secret_key = p256::SecretKey::from_pkcs8_pem(pem)?;
    let der = secret_key.to_pkcs8_der()?;
    P256KeyPair::from_secret_key_der(der.as_bytes().to_vec()).map_err(|error| error.to_string().into())
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use candid::Principal;
    use types::Chat;

    // Tokens which take OpenChat's tokens signed by `oc`
    pub fn tokens(oc: &P256KeyPair) -> Tokens {
        Tokens::new(oc.public_key_pem().to_string(), P256KeyPair::new(&mut rand::rng()))
    }

    pub fn oc_token<T: Serialize>(oc: &P256KeyPair, claim_type: &str, claims: T, expires: TimestampMillis) -> String {
        sign(oc.secret_key_der(), Claims::new(expires, claim_type.to_string(), claims))
    }

    fn user(n: u8) -> UserId {
        Principal::from_slice(&[n]).into()
    }

    #[test]
    fn a_token_is_taken_with_its_claim_type_until_it_expires() {
        let oc = P256KeyPair::new(&mut rand::rng());
        let tokens = tokens(&oc);
        let chat = Chat::Group(Principal::from_slice(&[9]).into());
        let claims = || MiniAppChatClaims {
            user_id: user(1),
            chat,
            member: false,
        };
        let token = oc_token(&oc, CLAIM_TYPE_MINI_APP_CHAT, claims(), 60_000);

        assert_eq!(tokens.connection(&token, 0), Some(user(1)));
        assert_eq!(tokens.connection(&token, 60_000), None);
        assert_eq!(tokens.bot(&token, 0), None);

        // Nor one signed by anyone else
        let other = P256KeyPair::new(&mut rand::rng());
        let token = oc_token(&other, CLAIM_TYPE_MINI_APP_CHAT, claims(), 60_000);
        assert_eq!(tokens.connection(&token, 0), None);
    }

    // So a member can't pass theirs to someone else
    #[test]
    fn a_chat_token_is_only_its_users() {
        let oc = P256KeyPair::new(&mut rand::rng());
        let tokens = tokens(&oc);
        let chat = Chat::Group(Principal::from_slice(&[9]).into());
        let token = oc_token(
            &oc,
            CLAIM_TYPE_MINI_APP_CHAT,
            MiniAppChatClaims {
                user_id: user(1),
                chat,
                member: true,
            },
            60_000,
        );

        assert!(
            tokens
                .chat(&token, user(1), 0)
                .is_some_and(|claims| claims.member && claims.chat == chat)
        );
        assert!(tokens.chat(&token, user(2), 0).is_none());
    }

    #[test]
    fn the_services_tokens_verify_with_its_public_key() {
        let oc = P256KeyPair::new(&mut rand::rng());
        let tokens = tokens(&oc);
        let game = MiniAppGame {
            chat: Chat::Group(Principal::from_slice(&[9]).into()),
            thread: None,
            message_id: 7u64.into(),
        };

        let token = tokens.player(user(100), game, user(1), 0);
        let claims: Claims<MiniAppPlayerClaims> =
            jwt::verify_and_decode(&token, tokens.public_key_pem(), CLAIM_TYPE_MINI_APP_PLAYER).unwrap();
        assert_eq!(claims.exp_ms(), PLAYER_TOKEN_VALIDITY);
        assert!(claims.custom().game == game && claims.custom().user_id == user(1) && claims.custom().bot == user(100));

        let token = tokens.join_call(user(100), game, user(1), 0);
        assert!(
            jwt::verify_and_decode::<MiniAppPlayerClaims>(&token, tokens.public_key_pem(), CLAIM_TYPE_MINI_APP_PLAYER).is_err()
        );
        assert!(
            jwt::verify_and_decode::<MiniAppPlayerClaims>(&token, tokens.public_key_pem(), CLAIM_TYPE_MINI_APP_JOIN).is_ok()
        );
    }

    #[test]
    fn the_services_key_reads_from_pem() {
        let pem = p256::SecretKey::from_pkcs8_der(P256KeyPair::new(&mut rand::rng()).secret_key_der())
            .unwrap()
            .to_pkcs8_pem(Default::default())
            .unwrap();
        assert!(key_pair_from_pem(&pem).is_ok());
        assert!(key_pair_from_pem("not a key").is_err());
    }
}
