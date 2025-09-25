<script lang="ts">
    import ExternalLink from "../ExternalLink.svelte";
    import BlogScreenshot from "./BlogScreenshot.svelte";
</script>

<section>
    <h2>The problem</h2>

    <p>
        We have always wanted OpenChat to be a global experience and so included multi language
        capability from the start. But with a small development team who only speak English we had
        to rely on automated translation software (Google translate) to provide our translations.
    </p>

    <p>
        Our translations are typically short words and phrases which lack context and this makes it
        very difficult for Google translate to disambiguate between multiple possible meanings in
        all cases. In practice this might mean that it picks the wrong meaning and we end up with a
        translation in one or more languages that is a bit odd or flat out wrong to a native speaker
        who understands the intended context. We get this feedback quite a lot and we would like to
        do something about it.
    </p>

    <p>
        The traditional solution would be to engage a professional translation service on an ongoing
        basis for each of our supported languages. But this would impose an ongoing cost (that would
        increase with the number of languages supported) and it would slow us down.
    </p>

    <p>
        In the spirit of decentralization, we would prefer to engage our enthusiastic userbase of
        non-english speakers who are ready and willing to help us correct our translation mistakes.
        The issue is that it is currently too difficult for them to do so. Currently if a user spots
        a mistake, they must file a bug report or reach out to the dev team in person to tell us
        about the error. Alternatively, if they have the technical know-how, they may submit a pull
        request which updates the translations in the source code themselves. This is neither
        scalable nor user friendly.
    </p>
</section>

<section>
    <h2>The solution</h2>

    <p>
        When a user spots a translation error now they will be able to submit a correction via the
        app itself without needing to talk to a developer or follow any complex procedure to modify
        the code themselves.
    </p>

    <p>
        This is done via a new switch within the user profile which appears immediately below the
        language selector in the user profile.
    </p>

    <BlogScreenshot
        caption="Toggle translation correction mode"
        desktopUrl={"/assets/blog/translation/toggle_desktop.png"}
        mobileUrl={"/assets/blog/translation/toggle_mobile.png"} />

    <p>
        Note that this switch <em>only</em> appears if you have a language other than English selected
        - we think we speak English pretty well already.
    </p>

    <p>
        When you have enabled this translation correction mode, you will notice that there is a
        small translation icon next to every piece of translatable text in the user interface.
    </p>

    <BlogScreenshot
        caption="Translation correction icons"
        desktopUrl={"/assets/blog/translation/icons_desktop.png"}
        mobileUrl={"/assets/blog/translation/icons_mobile.png"} />

    <p>
        If you spot something that looks wrong, simply click the icon next to the text that you want
        to correct. This will open up a dialog telling you the language you are correcting, the
        correct English value and the current value for the selected language. You must then enter
        your proposed correction and hit save.
    </p>

    <BlogScreenshot
        caption="Enter your suggested correction"
        desktopUrl={"/assets/blog/translation/suggest_desktop.png"}
        mobileUrl={"/assets/blog/translation/suggest_mobile.png"} />

    <p>
        Note that you cannot correct the translation of the translation correction page itself -
        that would lead to translation correction inception 😂.
    </p>

    <p>
        Your suggestion will now show in place in the user interface. Make sure to double check that
        it looks ok. If, for example, the translation you came up with looks too long, try to
        replace it with something more concise that works in the space available. You can repeat
        this process as many times as you like until you are happy with your suggestion.
    </p>

    <p>
        Some translated text is <em>dynamic</em>. This means that various pieces of context specific
        data may be injected into the text at runtime. In this case the English text will contain
        certain special tokens contained within curly braces &lbrace;like so&rbrace;. Your
        translation <em>must</em> contain the exact same tokens as the original or you will not be able
        to save the correction. Of course, you may change the order of the tokens in such a way that
        makes more sense for the target language.
    </p>

    <BlogScreenshot
        caption="Dynamic labels"
        desktopUrl={"/assets/blog/translation/dynamic_desktop.png"}
        mobileUrl={"/assets/blog/translation/dynamic_mobile.png"} />

    <p>
        Having saved your suggestions, you will remain in edit mode and your suggestions will
        continue to appear in the UI for you unless or until you refresh the page (so that you can
        verify them in place). You suggestions will not yet appear for other users.
    </p>
</section>

<section>
    <h2>What next?</h2>

    <p>
        If you have suggested corrections, the dev team will be notified and they will review your
        suggestions.
    </p>

    <p>
        We will be looking for two things: Firstly, does the suggested translation fit into the user
        interface without causing significant layout problems? Secondly, is the meaning of the
        original English broadly preserved?
    </p>

    <p>
        This approval step is just there to stop any mischief. We don't want to limit the ability to
        make suggestions but we also need to make sure someone doesn't just deface the app.
    </p>

    <p>
        Once your suggestion(s) have been reviewed you will be notified (either for approval or
        rejection) and the suggestion is likely to make its way into the next release.
    </p>

    <p>Approved translation corrections will be rewarded with a tip in CHAT to the translator.</p>
</section>

<section>
    <h2>Can I still review translations the old way?</h2>

    <p>
        We are incredibly grateful to those of you who have helped us correct translations in the
        past whether it is via a github pull request which directly updates
        <ExternalLink
            href="https://github.com/open-chat-labs/open-chat/tree/master/frontend/app/src/i18n"
            >the language files</ExternalLink> or by just reaching out to us in whatever way you choose
        with individual corrections. You can of course continue to do this as well if you prefer. We
        just hope that this new mechanism will make things a little bit easier and allow as many of you
        as possible to help us continuously improve OpenChat.
    </p>
</section>
