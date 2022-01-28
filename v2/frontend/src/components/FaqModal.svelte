<script lang="ts">
    import ModalContent from "./ModalContent.svelte";
    import CollapsibleCard from "./CollapsibleCard.svelte";
</script>

<ModalContent large={true} on:close>
    <div slot="header">Frequently asked questions</div>
    <div slot="body">
        <CollapsibleCard open={false} headerText={"When will there be an iOS app?"}>
            It is worth saying that the OpenChat web app <em>does</em> already work on iOS and you
            can "Add to homescreen" from the browser menu. This gives you a standard icon to open
            the app which appears more like a native app without a url bar. The big limitation for
            iOS web apps is the lack of support for web push notifications. OpenChat sends
            notifications to indicate receipt of a new message which is important if you don't have
            the app open. In general Apple doesn't do a very good job of supporting so-called
            Progressive Web Apps (PWAs) because they threaten the dominance of the App Store. It
            also lacks support (compared with Android PWAs) for reading phone contacts and the
            WebRTC implementation is buggy (needed for peer to peer voice/video calls). Because of
            these limitations producing a native iOS app is high on our agenda. Although on the face
            of it OpenChat is "just a chat app" it is actually rather complicated with a significant
            code base. An ideal solution for us, would be to wrap the OpenChat web app in a thin
            native app which communicates with the native phone APIs in such a way that the large
            bulk of the code base remains common without compromising the native app experience. We
            are researching this area but it is not yet clear if this will be possible or how
            difficult it will be. Another potential road block is the App Store certification
            process. By having the core application as a web app we could make changes to an
            OpenChat iOS app without going through an approval process which might not be
            acceptable. However if these problems <em>can</em> be solved it is possble an iOS app could
            be ready within a few months. Otherwise, if we need to re-write (and then maintain) a native
            iOS OpenChat from scratch, then this will take significantly longer...
        </CollapsibleCard>
        <CollapsibleCard open={false} headerText={"When will there be an Android app?"}>
            As for iOS (see above), the OpenChat web app<em>does</em> already work on Android and
            you can be "Add to homescreen" from the browser menu. This gives you a standard icon to
            open the app which appears more like a native app without a url bar. However, unlike
            iOS, Progressive Web App (PWA) support is very good on Android. It
            <em>does</em> support web push notifications and it <em>does</em> support the reading of
            contacts from the phone (if you grant permisson in each case). Beyond that the support for
            WebRTC is much better. As such the case for producing a native Android app is less compelling
            and will come after a native iOS app. The same considerations apply to the building of an
            Android app as an iOS in terms of aiming for a thin native wrapper around a core web app,
            and with regards to certification on the Android play store.
        </CollapsibleCard>
        <CollapsibleCard open={false} headerText={"How do I find groups?"}>
            There are currently two ways to find public groups. You can find a link to 🔥 hot groups
            in the main menu. This shows 20 groups you are not already a member of, ordered primarly
            by the amount of recent activity but also with a random factor. This changes every 10
            minutes. Note that if you "preview" a group and then click the "leave" button you won't
            be shown this group in the hot list for 30 days. You can also search for any public
            groups from the main search bar based on find matches in the group title and summary.
            Going forward we will make it easier still to find groups you might be interested in.
        </CollapsibleCard>
        <CollapsibleCard open={false} headerText={"Can I style messages?"}>
            You can add line breaks by using shift-enter and you can use a subset of markdown as
            follows:<br />
            _<em>italics</em>_ or *<em>italics</em>*<br />
            **<strong>bold</strong>**<br />
            ***<strong><em>both</em></strong>***<br />
            ~<s>strikethrough</s>~<br />
            [<a target="_blank" href="https://oc.app">link text</a>](https://oc.app)<br />
            `<code>let a: int = 10; // code</code>`
        </CollapsibleCard>
        <CollapsibleCard
            open={false}
            headerText={"Why do you ask for my phone number or for a payment?"}>
            We ask for a phone number so that we can send you a code by SMS which you then enter to
            prove you own the phone number. This aims to reduce the chance the registration is from
            a bot and to reduce the chance that you create multiple accounts. We don't want bots
            because any messages they send are unlikely to be worthwhile. But also there is a cost
            to us associated with each account and so we would prefer to restrict accounts to one
            per real person. Alternatively, if you are either unable to receive SMSs or would prefer
            not to enter your phone number, you can pay a small amount of ICP to offset this cost.
            Co-incidentally very soon after our v2 launch, the Internet Identity (II) used for
            authentication, introduced a
            <a target="_blank" href="https://en.wikipedia.org/wiki/CAPTCHA">CAPTCHA</a> which mitigates
            the problem of bot accounts. Furthermore, it wasn't until soon after our v2 launch that we
            realised how many countries and how many potential users are unable to receive SMSs from
            us. So coming soon, we will be removing the SMS or payment gate from registration so that
            anyone can join for free. This still leaves the issue of the cost per user. We will address
            this by putting the SMS/payment gate in front of the facility to send media messages because
            it is the storage of images, videos etc which contributes a large proportion of our costs.
            More details coming soon...
        </CollapsibleCard>
        <CollapsibleCard open={false} headerText={"Will there be an airdrop?"}>
            When we integrate with the <a
                target="_blank"
                href="https://forum.dfinity.org/t/open-governance-canister-for-sns-design-proposal/10224"
                >SNS</a
            >, we will establish an OpenChat token analagous to ICP which will also be tradeable on
            exchanges. We anticipate that a proportion will be auctioned to provide funds for costs
            such as IC hosting, a proportion will go to the development team, and a proportion will
            be available to distribute to our users. The idea would be to disseminate these
            governance tokens as widely as possible to our community of users, favouring and
            encouraging those who are interested in, and contribute to the long term success of
            OpenChat and the IC more generally. So for example, we might have an algorithm which
            will automatically drop tokens on online users, favouring early adopters and active
            users. Also you might be able to earn tokens by referring friends to help grow the user
            base and make OpenChat increasingly useful and relevant.
        </CollapsibleCard>
        <CollapsibleCard open={false} headerText={"Are my messages secure?"}>
            In short the Internet Computer provides very strong security guarentees. There is
            however a particular well known area of weakness which Dfinity are tackling. With some
            effort a rogue node provider could install a hacked version of the node software
            allowing them to intercept and read ingress messages and directly read memory. However,
            once
            <a
                target="_blank"
                href="https://developer.amd.com/sev/#:~:text=AMD%20Secure%20Encrypted%20Virtualization%2DEncrypted,to%20a%20CPU%20register%20state."
                >SEV-ES</a>
            is enabled on node machines, hopefully within a few months, users can be extremely confident
            that, apart from the recipients of their messages, their data will not be accessible to anyone
            but themselves. At a later date we will implement e2e encryption so that the data is actually
            stored in encrypted form in canister memory and would therefore not be accessible by rogue
            node operators regardless of SEV-ES being enabled. This will likely involve some limitations,
            such as not being able to search your message history, so you could choose to opt-in to e2e
            security for selected chats.
        </CollapsibleCard>
        <CollapsibleCard open={false} headerText={"Do you have a roadmap?"}>
            Yes, we do now! Find it in the main menu next to this FAQ!
        </CollapsibleCard>
    </div>
</ModalContent>

<style type="text/scss">
    a {
        text-decoration: underline;
    }
</style>
