use proc_macro::TokenStream;
use quote::{format_ident, quote};
use std::fmt::Write;
use syn::punctuated::Punctuated;
use syn::{parse_macro_input, parse_quote, Ident, Item, Token};

struct MethodAttribute {
    canister_name: String,
    method_name: String,
}

#[proc_macro_attribute]
pub fn ts_export(attr: TokenStream, item: TokenStream) -> TokenStream {
    let mut item = parse_macro_input!(item as Item);
    let attr_inputs: Vec<_> = parse_macro_input!(attr with Punctuated::<Ident, Token![,]>::parse_terminated)
        .into_iter()
        .map(|i| i.to_string())
        .collect();

    assert_eq!(attr_inputs.len(), 2);

    let canister_name = attr_inputs.first().unwrap();
    let method_name = attr_inputs.last().unwrap();

    let export_to = format!("{}/{}/", convert_case(canister_name, false), convert_case(method_name, false));

    match &mut item {
        Item::Struct(s) => {
            let type_name = s.ident.to_string();
            let rename = format!(
                "{}_{}_{type_name}",
                convert_case(canister_name, true),
                convert_case(method_name, true)
            );
            s.attrs.push(parse_quote!( #[derive(ts_rs::TS)] ));
            s.attrs.push(parse_quote!( #[ts(export_to = #export_to, rename = #rename)] ));
        }
        Item::Enum(e) => {
            let type_name = e.ident.to_string();
            let rename = format!(
                "{}_{}_{type_name}",
                convert_case(canister_name, true),
                convert_case(method_name, true)
            );
            e.attrs.push(parse_quote!( #[derive(ts_rs::TS)] ));
            e.attrs.push(parse_quote!( #[ts(export_to = #export_to, rename = #rename)] ));
        }
        _ => unimplemented!(),
    }

    TokenStream::from(quote! {
        #item
    })
}

#[proc_macro]
pub fn generate_ts_method(input: TokenStream) -> TokenStream {
    let inputs = parse_macro_input!(input with Punctuated::<Ident, Token![,]>::parse_terminated)
        .into_iter()
        .map(|i| i.to_string())
        .collect();

    let attribute = get_method_attribute(inputs);

    let canister_module = format_ident!("{}_canister", attribute.canister_name);
    let method_name = format_ident!("{}", attribute.method_name);

    let tokens = quote! {
        <#canister_module::#method_name::Args as ::ts_rs::TS>::export_all_to("frontend/openchat-agent/tsBindings").unwrap();
        <#canister_module::#method_name::Response as ::ts_rs::TS>::export_all_to("frontend/openchat-agent/tsBindings").unwrap();
    };

    TokenStream::from(tokens)
}

fn get_method_attribute(inputs: Vec<String>) -> MethodAttribute {
    let first_arg = inputs.first().unwrap();
    let second_arg = inputs.get(1).unwrap();

    let canister_name = first_arg.to_string();
    let method_name = second_arg.to_string();

    MethodAttribute {
        canister_name,
        method_name,
    }
}

fn convert_case(s: &str, start_with_capital: bool) -> String {
    let mut result = String::new();
    let words = s.split('_');

    for word in words {
        if !start_with_capital && result.is_empty() {
            result.write_str(word).unwrap();
        } else {
            for (i, char) in word.chars().enumerate() {
                if i == 0 {
                    result.write_char(char.to_ascii_uppercase()).unwrap();
                } else {
                    result.write_char(char).unwrap();
                }
            }
        }
    }

    result
}
