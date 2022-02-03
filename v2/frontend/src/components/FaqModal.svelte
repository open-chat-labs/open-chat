<script lang="ts">
    import ModalContent from "./ModalContent.svelte";
    import CollapsibleCard from "./CollapsibleCard.svelte";
    import type { Questions } from "../domain/faq";

    export let question: Questions | undefined = undefined;
    export let fadeDuration = 100;
    export let fadeDelay = 200;
</script>

<ModalContent {fadeDuration} {fadeDelay} large={true} on:close>
    <div slot="header">Frequently asked questions</div>
    <div class="faq-body" slot="body">
        <CollapsibleCard
            bordered={true}
            open={question === "ios_app"}
            on:opened={() => (question = "ios_app")}
            headerText={"When will there be an iOS app?"}>
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
        <CollapsibleCard
            bordered={true}
            open={question === "android_app"}
            on:opened={() => (question = "android_app")}
            headerText={"When will there be an Android app?"}>
            As for iOS (see above), the OpenChat web app <em>does</em> already work on Android and
            you can "Add to homescreen" from the browser menu. This gives you a standard icon to
            open the app which appears more like a native app without a url bar. However, unlike
            iOS, Progressive Web App (PWA) support is very good on Android. It
            <em>does</em> support web push notifications and it <em>does</em> support the reading of
            contacts from the phone (if you grant permisson in each case). Beyond that the support for
            WebRTC is much better. As such the case for producing a native Android app is less compelling
            and will come after a native iOS app. The same considerations apply to the building of an
            Android app as an iOS in terms of aiming for a thin native wrapper around a core web app,
            and with regards to certification on the Android play store.
        </CollapsibleCard>
        <CollapsibleCard
            bordered={true}
            open={question === "find_groups"}
            on:opened={() => (question = "find_groups")}
            headerText={"How do I find groups?"}>
            There are currently two ways to find public groups. You can find a link to 🔥 hot groups
            in the main menu. This shows 20 groups you are not already a member of, ordered primarly
            by the amount of recent activity but also with a random factor. This changes every 10
            minutes. Note that if you "preview" a group and then click the "leave" button you won't
            be shown this group in the hot list for 30 days. You can also search for any public
            groups from the main search bar based on find matches in the group title and summary.
            Going forward we will make it easier still to find groups you might be interested in.
        </CollapsibleCard>
        <CollapsibleCard
            bordered={true}
            open={question === "style_messages"}
            on:opened={() => (question = "style_messages")}
            headerText={"Can I style messages?"}>
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
            bordered={true}
            open={question === "sms_icp"}
            on:opened={() => (question = "sms_icp")}
            headerText={"Why must I pay or give my phone number to send images?"}>
            TLDR, there is a cost associated with storing images on the IC.
            <br />
            <br />
            Text messages take little space and so cost us relatively little. Images typically take much
            more space and the costs add up. Now some background on the OpenChat system. Each user has
            their own canister which holds all the messages for their direct chats. Each group also has
            its own canister which holds all the group messages. However, we store any
            <em>file</em>
            data associated with messages, such as images and video, in
            <a target="_blank" href="https://github.com/open-ic/open-storage">OpenStorage</a>. Each
            user has a data allowance and when a message is sent any file data comes out of the
            <em>sender's</em> allowance. This also applies to messages sent to groups so there is no
            group data allowance just an individual one.
            <br />
            <br />
            We happily provide a 0.1 GB allowance free to every person who uses OpenChat. However it
            is relatively easy for a single person to create many OpenChat accounts and exploit the free
            storage perhaps with malicious intent. At the moment the best way we have of trying to ensure
            that each person only gets one quota of storage is ask that they enter their mobile phone
            number to receive a verification code by SMS since it is relatively hard for an individual
            to come by many phone numbers. Once used to "prove" personhood that same phone number can't
            be reused (at least not without a specific transfer process).
            <br />
            <br />
            Unfortunately there are many places and people that can't currently receive our SMS messages
            and so we provide another way to obtain storage to enable sending images, which is simply
            to pay. We are hoping to be able to extend the regions to which we can send SMSs but that
            is largely out of our hands. We also hope to be able to find alternative methods to "prove"
            personhood and so allow people to claim their free storage. One such alternative could be
            "people parties" which is under development at Dfinity.
            <br />
            <br />
            Once you have reached your 0.1 GB storage limit you cannot send any more images unless you
            increase your limit by making a payment. Soon we will offer the choice to have old images
            deleted to free up storage and enable you to continue to send images without ever paying.
            The message itself, including any caption and an image thumbnail, would never be deleted
            and so the message history would be maintained.
        </CollapsibleCard>
        <CollapsibleCard
            bordered={true}
            open={question === "airdrop"}
            on:opened={() => (question = "airdrop")}
            headerText={"Will there be an airdrop?"}>
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
        <CollapsibleCard
            bordered={true}
            open={question === "security"}
            on:opened={() => (question = "security")}
            headerText={"Are my messages secure?"}>
            In short the Internet Computer provides very strong security guarentees. There is
            however a particular well known area of weakness which Dfinity are tackling. With some
            effort a rogue node provider could install a hacked version of the node software
            allowing them to intercept and read ingress messages and directly read memory. However,
            once
            <a
                target="_blank"
                href="https://www.amd.com/system/files/TechDocs/SEV-SNP-strengthening-vm-isolation-with-integrity-protection-and-more.pdf"
                >SEV-SNP</a>
            is available on node machines, users can be extremely confident that, apart from the recipients
            of their messages, their data will not be accessible to anyone but themselves. At a later
            date we will implement e2e encryption so that the data is actually stored in encrypted form
            in canister memory and would therefore not be accessible by rogue node operators regardless
            of SEV-SNP being in place. This will likely involve some limitations, such as not being able
            to search your message history, so you could choose to opt-in to e2e security for selected
            chats.
        </CollapsibleCard>
        <CollapsibleCard
            bordered={true}
            open={question === "roadmap"}
            on:opened={() => (question = "roadmap")}
            headerText={"Do you have a roadmap?"}>
            Yes, we do now! Find it in the main menu next to this FAQ!
        </CollapsibleCard>
    </div>
</ModalContent>

<style type="text/scss">
    a {
        text-decoration: underline;
    }

    :global(.faq-body .card) {
        margin-bottom: $sp3;

        &:last-child {
            margin-bottom: 0;
        }
    }
</style>
