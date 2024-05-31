<script lang="ts">
    import ExternalLink from "../ExternalLink.svelte";
    import BlogScreenshot from "./BlogScreenshot.svelte";
</script>

<section>
    <p>
        In addition to Internet Identity, OpenChat users can now sign-in or sign-up using email, an
        Ethereum wallet or a Solana wallet. Coming soon are, email recovery, sign-in with a simple
        PassKey, flexible sessions and two-factor authentication (2FA).
    </p>
    <BlogScreenshot
        caption="Sign in to OpenChat"
        desktopUrl={"/assets/blog/signin/signin_desktop.png"}
        mobileUrl={"/assets/blog/signin/signin_mobile.png"} />
</section>
<section>
    <h2>Sign in with email</h2>
    <p>
        The default option for new sign-ups is email. Your email is not stored but is used to
        generate a unique (and deterministic) identifier. A secure <ExternalLink
            href="https://auth0.com/docs/authenticate/passwordless/authentication-methods/email-magic-link"
            >magic link</ExternalLink>
        including this identifier is sent to your email and is used to prove ownership of the email.
        Having clicked the email link, enter a username to create your OpenChat account. No password
        is required. To sign in at a later date, simply repeat the process by entering your email and
        you will be sent a sign-in link.
    </p>
    <BlogScreenshot
        caption="Sign in with email"
        desktopUrl={"/assets/blog/signin/email_desktop.png"}
        mobileUrl={"/assets/blog/signin/email_mobile.png"} />
</section>
<section>
    <h2>Sign-in with II</h2>
    <p>
        <ExternalLink href="https://internetcomputer.org/internet-identity"
            >Internet Identity</ExternalLink>
        is the gold standard for signing in to apps on the Internet Computer. It is super secure and
        soon will support
        <ExternalLink href="https://en.wikipedia.org/wiki/Verifiable_credentials"
            >verifiable credentials</ExternalLink> (VCs) This will allow users to acquire credentials/attributes
        from a 3rd party "issuer" and share these securely with OpenChat or other “relying parties”.
        Owners of OpenChat communities, channels and groups will be able to gate access using VCs. Some
        examples:
    </p>
    <ul>
        <li>Is the user over 18?</li>
        <li>Are they a unique person?</li>
        <li>Did they attend conference XYZ?</li>
        <li>Are they an employee of ABC?</li>
    </ul>
    <p>
        Going forwards the primary way to be eligible for airdrops on OpenChat will be to prove
        unique personhood using a verified credential.
    </p>
</section>
<section>
    <h2>Sign-in with Ethereum wallet</h2>
    <p>
        For users coming from the Ethereum ecosystem, OpenChat now offers sign-in by Ethereum wallet
        such as MetaMask, increasing the potential pool of OpenChat users. In the future, we
        anticipate signing in with your Ethereum wallet will enable you to send/swap/tip/gift ETH
        ecosystem tokens as you currently can with ICP tokens, albeit not so quickly or cheaply!
    </p>
    <BlogScreenshot
        caption="Sign in with Ethereum wallet"
        desktopUrl={"/assets/blog/signin/ethereum_desktop.png"}
        mobileUrl={"/assets/blog/signin/ethereum_mobile.png"} />
</section>
<section>
    <h2>Sign-in with Solana wallet</h2>
    <p>See the Ethereum wallet above. The same goes for the Solana wallet and ecosystem!</p>
    <BlogScreenshot
        caption="Sign in with Solana wallet"
        desktopUrl={"/assets/blog/signin/solana_desktop.png"}
        mobileUrl={"/assets/blog/signin/solana_mobile.png"} />
</section>
<section>
    <h2>What has changed?</h2>
    <p>
        Up until recently, to sign in to OpenChat, users would authenticate with II then use the
        returned key to sign requests to OpenChat canisters. This worked fine, and was simple to
        implement, but it prevented OpenChat from supporting things such as email account recovery,
        or having multiple sign in options per account.
    </p>
    <p>
        To solve this, we have introduced the <ExternalLink
            href="https://github.com/open-chat-labs/open-chat/tree/master/backend/canisters/identity"
            >Identity canister</ExternalLink> which can link multiple authentication identities to a
        single OpenChat account, allowing users to sign in using any of them.
    </p>
    <p>
        Now, when a user signs in to OpenChat, they first authenticate via their chosen provider,
        then use the returned signing key to authenticate with the Identity canister. The Identity
        canister checks which OpenChat account the key is linked to (or creates a new one) and
        returns a new key which is used to sign requests to OpenChat canisters on behalf of the
        user.
    </p>
    <p>
        To generate email magic links, two private keys are used, one in the canister and one in
        AWS. Using this mechanism, even someone with physical access to the nodes is unable to
        generate valid links since they would not know the key in AWS. However, the emails
        themselves are sent from AWS servers and as a result email sign-in is only as secure as
        other web2 services. For the security paranoid it is recommended to use II.
    </p>
</section>
<section>
    <h2>Multiple sign-in providers</h2>
    <p>
        Now that multiple sign-in providers can be linked to the same OpenChat account the following
        use cases will be supported.
    </p>
    <p>
        Firstly, as a backup, in case you lose access to your account. Whilst II does allow you to
        recover your account by seed phrase and to set up multiple devices, it isn't foolproof and
        many users lost access when they changed mobile phone or laptop. Users will be able to
        associate an email with their account for simple recovery. Even if your primary sign-in is
        by email, you will be able to add an additional recovery email.
    </p>
    <p>
        Secondly, to gain access to the specific features offered by a particular provider while
        keeping the same OpenChat account. So for example, by signing in with II, users will be able
        to provide Verifiable Credentials.
    </p>
</section>
<section>
    <h2>Simple Passkey</h2>
    <p>
        A <ExternalLink href="https://webauthn.me/passkeys">PassKey</ExternalLink> is a password replacement
        typically using a biometric device for a faster, easier, and more secure user sign-in experience.
        This is the same technology used by II but without the complication of "II anchors". Using a
        PassKey won't be possible for sign-up but only as an additional provider. This is because if
        you were to lose access to your PassKey device (say your phone or laptop) then you would lose
        access to your OpenChat account. A good combination will be to sign up with an email and then
        add a PassKey. The PassKey (e.g. a fingerprint scan) can be used day to day to provide quick
        and secure access to your account, and if you ever lose access you can recover by email.
    </p>
</section>
<section>
    <h2>Enhanced session management</h2>
    <p>
        A "session" is the period you have been signed in for. This was limited by II to 30 days but
        with the introduction of the Identity canister this can now be any duration. Some likely
        options are:
    </p>
    <ul>
        <li>
            indefinite sessions which lasts until you manually sign out (default for mobile devices)
        </li>
        <li>30 day sessions (default for non-mobile devices)</li>
        <li>secure mode which requires sign-in whenever you open OpenChat</li>
    </ul>
    <p>Also coming is the option to sign out of your account across all devices simultaneously.</p>
</section>
<section>
    <h2>2FA</h2>
    <p>
        The new system will also support Two-factor authentication (2FA). Users will be able to
        configure their accounts to require sign-in by 2 providers, say Metamask and a Passkey, or a
        PassKey and an authenticator app.
    </p>
</section>
