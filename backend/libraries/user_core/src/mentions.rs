//! A stand-in for the shared parser of user mentions which is due to land in `utils`, with the same
//! signature, so that its callers only need their import changing once it has.

use candid::Principal;
use types::UserId;

const PREFIX: &str = "@UserId(";

// Replaces the id in each mention of a user in `text`, which the website shows as the user's name,
// with `f` of it. Returns the new text if any id was replaced. A mention is `@UserId(<principal>)`,
// the principal being matched as the website matches it (`/@UserId\(([\d\w-]+)\)/g`), and only one
// which parses as a principal is passed to `f`.
pub fn replace_mentioned_users(text: &str, mut f: impl FnMut(UserId) -> UserId) -> Option<String> {
    let mut replaced = String::new();
    let mut copied_up_to = 0;
    let mut search_from = 0;
    while let Some(start) = text[search_from..].find(PREFIX) {
        let id_start = search_from + start + PREFIX.len();
        let id_end = text[id_start..]
            .find(|c: char| !(c.is_ascii_alphanumeric() || c == '_' || c == '-'))
            .map_or(text.len(), |len| id_start + len);
        search_from = id_start;
        if id_end == id_start || !text[id_end..].starts_with(')') {
            continue;
        }
        search_from = id_end + 1;
        let Ok(principal) = Principal::from_text(&text[id_start..id_end]) else {
            continue;
        };
        let user_id = UserId::from(principal);
        let latest = f(user_id);
        if latest != user_id {
            replaced.push_str(&text[copied_up_to..id_start]);
            replaced.push_str(&latest.to_string());
            copied_up_to = id_end;
        }
    }
    (copied_up_to > 0).then(|| {
        replaced.push_str(&text[copied_up_to..]);
        replaced
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i; 10]).into()
    }

    #[test]
    fn each_mention_is_passed_through_f() {
        let text = format!(
            "Hi @UserId({}), @UserId({}) and @UserId({})!",
            user_id(1),
            user_id(2),
            user_id(1)
        );
        let mut mentioned = Vec::new();

        let replaced = replace_mentioned_users(&text, |user_id| {
            mentioned.push(user_id);
            if user_id == self::user_id(1) { self::user_id(3) } else { user_id }
        });

        assert_eq!(mentioned, vec![user_id(1), user_id(2), user_id(1)]);
        assert_eq!(
            replaced,
            Some(format!(
                "Hi @UserId({}), @UserId({}) and @UserId({})!",
                user_id(3),
                user_id(2),
                user_id(3)
            ))
        );
    }

    #[test]
    fn nothing_is_returned_if_no_id_is_replaced() {
        let text = format!("Hi @UserId({})", user_id(1));
        assert_eq!(replace_mentioned_users(&text, |user_id| user_id), None);
        assert_eq!(replace_mentioned_users("No mentions", |_| user_id(2)), None);
    }

    #[test]
    fn only_well_formed_mentions_are_replaced() {
        let text = format!(
            "@UserId() @UserId({} @UserId(not a principal) @UserId(abc) @UserId({})",
            user_id(1),
            user_id(1)
        );
        let mut mentioned = Vec::new();

        let replaced = replace_mentioned_users(&text, |user_id| {
            mentioned.push(user_id);
            self::user_id(2)
        });

        // Only the last is both closed and a principal
        assert_eq!(mentioned, vec![user_id(1)]);
        assert_eq!(
            replaced,
            Some(format!(
                "@UserId() @UserId({} @UserId(not a principal) @UserId(abc) @UserId({})",
                user_id(1),
                user_id(2)
            ))
        );
    }
}
