use proc_macro::TokenStream;
use proc_macro2::Ident;
use quote::{format_ident, quote};
use syn::{parse_macro_input, FnArg, ItemFn, Pat, PatIdent, PatType, Signature};

#[proc_macro_attribute]
pub fn trace(_: TokenStream, item: TokenStream) -> TokenStream {
    let mut inner = parse_macro_input!(item as ItemFn);

    // We will wrap the original fn in a new fn whose signature matches the original fn
    let wrapper_sig = inner.sig.clone();

    // Change the name of the inner fn so that it doesn't clash with the wrapper fn
    let inner_method_name = format_ident!("{}_inner_", inner.sig.ident);
    inner.sig.ident = inner_method_name.clone();

    let is_async = inner.sig.asyncness.is_some();
    let arg_names = get_arg_names(&inner.sig);

    let function_call = if is_async {
        quote! { #inner_method_name ( #(#arg_names),* ) .await }
    } else {
        quote! { #inner_method_name ( #(#arg_names),* ) }
    };

    let expanded = quote!(
        #[allow(unused_mut)]
        #[tracing::instrument(level = "trace")]
        #wrapper_sig {
            let result = #function_call;
            tracing::trace!(?result);
            result
        }
        #inner
    );

    TokenStream::from(expanded)
}

fn get_arg_names(signature: &Signature) -> Vec<Ident> {
    signature
        .inputs
        .iter()
        .map(|arg| match arg {
            FnArg::Receiver(r) => r.self_token.into(),
            FnArg::Typed(PatType { pat, .. }) => {
                if let Pat::Ident(PatIdent { ident, .. }) = pat.as_ref() {
                    ident.clone()
                } else {
                    panic!("Unable to determine arg name");
                }
            }
        })
        .collect()
}
