use search::simple::Document;
use std::collections::BTreeSet;

// Longer tokens are truncated, so a query term longer than this matches any token beginning with
// its first `MAX_TOKEN_BYTES` bytes. This matches the maximum length of a search term.
pub const MAX_TOKEN_BYTES: usize = 30;

// Caps the number of index entries for a single message (eg. a long governance proposal summary)
pub const MAX_TOKENS_PER_MESSAGE: usize = 1000;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueryTerm {
    pub token: String,
    // If true, the term matches any token beginning with `token`, otherwise only `token` itself
    pub prefix: bool,
}

// Text is split into runs of word characters (letters and digits) and runs of characters from
// scripts which don't separate words with spaces, everything else being a separator.
//
// A run of word characters is a single token, which query terms match by prefix.
//
// Scripts such as Chinese, Japanese and Thai don't separate words with spaces, so a run of their
// characters is indexed as each of its characters plus each pair of adjacent characters. A query
// term of a single such character matches that character, and a longer run matches messages
// containing every one of its pairs of adjacent characters (which, in all but contrived cases,
// means messages containing the run itself).
pub fn document_tokens(document: &Document) -> BTreeSet<String> {
    let mut tokens = BTreeSet::new();

    'fields: for field in document.fields() {
        for run in runs(field) {
            match run {
                Run::Word(word) => {
                    tokens.insert(truncate(word).to_string());
                }
                Run::Unspaced(text) => {
                    let mut chars = text.char_indices().peekable();
                    while let Some((start, c)) = chars.next() {
                        let end = start + c.len_utf8();
                        tokens.insert(text[start..end].to_string());
                        if let Some((next_start, next)) = chars.peek() {
                            tokens.insert(text[start..next_start + next.len_utf8()].to_string());
                        }
                    }
                }
            }
            if tokens.len() >= MAX_TOKENS_PER_MESSAGE {
                break 'fields;
            }
        }
    }

    // A run of CJK characters can add more than one token at a time, so trim any excess
    while tokens.len() > MAX_TOKENS_PER_MESSAGE {
        tokens.pop_last();
    }

    tokens
}

pub fn query_terms(search_term: &str) -> Vec<QueryTerm> {
    let lowercase = search_term.to_lowercase();
    let mut terms = Vec::new();

    for run in runs(&lowercase) {
        match run {
            Run::Word(word) => terms.push(QueryTerm {
                token: truncate(word).to_string(),
                prefix: true,
            }),
            Run::Unspaced(text) => {
                let char_boundaries: Vec<_> = text.char_indices().map(|(i, _)| i).chain([text.len()]).collect();
                if char_boundaries.len() == 2 {
                    terms.push(QueryTerm {
                        token: text.to_string(),
                        prefix: false,
                    });
                } else {
                    for window in char_boundaries.windows(3) {
                        terms.push(QueryTerm {
                            token: text[window[0]..window[2]].to_string(),
                            prefix: false,
                        });
                    }
                }
            }
        }
    }

    let mut deduped: Vec<QueryTerm> = Vec::with_capacity(terms.len());
    for term in terms {
        if !deduped.contains(&term) {
            deduped.push(term);
        }
    }
    deduped
}

enum Run<'a> {
    Word(&'a str),
    Unspaced(&'a str),
}

#[derive(Copy, Clone, Eq, PartialEq)]
enum CharClass {
    Word,
    Unspaced,
    Separator,
}

// Splits the text into runs of word characters and runs of characters from unspaced scripts. Document fields are
// already lowercase, and query terms are lowercased before being split.
fn runs(text: &str) -> impl Iterator<Item = Run<'_>> {
    let mut chars = text.char_indices().peekable();

    std::iter::from_fn(move || {
        loop {
            let (start, c) = chars.next()?;
            let class = classify(c);
            if class == CharClass::Separator {
                continue;
            }
            let mut end = start + c.len_utf8();
            while let Some((i, next)) = chars.peek().copied() {
                if classify(next) != class {
                    break;
                }
                end = i + next.len_utf8();
                chars.next();
            }
            let run = &text[start..end];
            return Some(if class == CharClass::Word { Run::Word(run) } else { Run::Unspaced(run) });
        }
    })
}

fn classify(c: char) -> CharClass {
    if is_unspaced(c) {
        CharClass::Unspaced
    } else if c.is_alphanumeric() {
        CharClass::Word
    } else {
        CharClass::Separator
    }
}

// Characters from scripts which don't separate words with spaces: Chinese characters, Japanese
// kana, Thai, Lao, Khmer and Myanmar. Korean separates words with spaces, so Hangul is treated as
// word characters. Combining marks within these ranges (eg. Thai vowel and tone marks) are included,
// since they aren't alphanumeric and would otherwise split words.
fn is_unspaced(c: char) -> bool {
    matches!(c,
        '\u{0E00}'..='\u{0E7F}'     // Thai
        | '\u{0E80}'..='\u{0EFF}'   // Lao
        | '\u{1000}'..='\u{109F}'   // Myanmar
        | '\u{1780}'..='\u{17FF}'   // Khmer
        | '\u{3005}'..='\u{3007}'   // 々 〆 〇
        | '\u{3040}'..='\u{309F}'   // Hiragana
        | '\u{30A0}'..='\u{30FF}'   // Katakana
        | '\u{31F0}'..='\u{31FF}'   // Katakana phonetic extensions
        | '\u{3400}'..='\u{4DBF}'   // CJK unified ideographs extension A
        | '\u{4E00}'..='\u{9FFF}'   // CJK unified ideographs
        | '\u{F900}'..='\u{FAFF}'   // CJK compatibility ideographs
        | '\u{FF66}'..='\u{FF9F}'   // Halfwidth katakana
        | '\u{20000}'..='\u{323AF}' // CJK unified ideographs extensions B to H
    )
}

fn truncate(word: &str) -> &str {
    if word.len() <= MAX_TOKEN_BYTES {
        word
    } else {
        let mut end = MAX_TOKEN_BYTES;
        while !word.is_char_boundary(end) {
            end -= 1;
        }
        &word[..end]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use test_case::test_case;

    #[test_case(&["Hello, World!"], &["hello", "world"])]
    #[test_case(&["image/png", "My caption"], &["caption", "image", "my", "png"])]
    #[test_case(&["1.5"], &["1", "5"])]
    #[test_case(&["don't stop"], &["don", "stop", "t"])]
    #[test_case(&["ünïcödé Café"], &["café", "ünïcödé"])]
    #[test_case(&["안녕하세요 세계"], &["세계", "안녕하세요"])]
    #[test_case(&["東京都"], &["京", "京都", "東", "東京", "都"])]
    #[test_case(&["iPhoneを買った"], &["iphone", "っ", "った", "た", "を", "を買", "買", "買っ"])]
    #[test_case(&["東京 東京"], &["京", "東", "東京"])]
    #[test_case(&["สวัสดี"], &["ด", "ดี", "ว", "วั", "ส", "สด", "สว", "ั", "ัส", "ี"]; "thai")]
    #[test_case(&["", "  ...  "], &[])]
    fn document_tokens_extracted_correctly(fields: &[&str], expected: &[&str]) {
        assert_eq!(
            tokens(fields),
            expected.iter().map(|t| t.to_string()).collect::<BTreeSet<_>>()
        );
    }

    #[test]
    fn long_words_are_truncated() {
        let word = "a".repeat(29) + "é" + "bcd";
        let tokens = tokens(&[&word]);
        assert_eq!(tokens.len(), 1);
        assert_eq!(tokens.first().unwrap(), &"a".repeat(29));

        let terms = query_terms(&word.to_uppercase());
        assert_eq!(terms, vec![prefix(&"a".repeat(29))]);
    }

    #[test]
    fn tokens_per_message_are_capped() {
        let text: String = (0..2000).map(|i| format!("word{i} ")).collect();
        assert_eq!(tokens(&[&text]).len(), MAX_TOKENS_PER_MESSAGE);

        let cjk: String = (0..2000u32).map(|i| char::from_u32(0x4E00 + i).unwrap()).collect();
        assert_eq!(tokens(&[&cjk]).len(), MAX_TOKENS_PER_MESSAGE);
    }

    #[test_case("Hello", vec![prefix("hello")])]
    #[test_case("hello  WORLD hello", vec![prefix("hello"), prefix("world")])]
    #[test_case("image/png", vec![prefix("image"), prefix("png")])]
    #[test_case("東", vec![exact("東")])]
    #[test_case("東京", vec![exact("東京")])]
    #[test_case("東京都", vec![exact("東京"), exact("京都")])]
    #[test_case("iPhoneを買", vec![prefix("iphone"), exact("を買")])]
    #[test_case("สวัส", vec![exact("สว"), exact("วั"), exact("ัส")])]
    #[test_case("???", vec![])]
    fn query_terms_extracted_correctly(search_term: &str, expected: Vec<QueryTerm>) {
        assert_eq!(query_terms(search_term), expected);
    }

    fn tokens(fields: &[&str]) -> BTreeSet<String> {
        let mut document = Document::default();
        for field in fields {
            document.add_field(field);
        }
        document_tokens(&document)
    }

    fn prefix(token: &str) -> QueryTerm {
        QueryTerm {
            token: token.to_string(),
            prefix: true,
        }
    }

    fn exact(token: &str) -> QueryTerm {
        QueryTerm {
            token: token.to_string(),
            prefix: false,
        }
    }
}
