<script lang="ts">
    import Markdown from "../../home/Markdown.svelte";
    import ExternalLink from "../ExternalLink.svelte";
</script>

<section>
    <p>
        We are pleased to introduce the first phase of video and voice chat support in OpenChat. The
        web2 apps that we are striving to compete with all provide a voice and video feature and it
        has always been an important item on our roadmap.
    </p>

    <p>
        Phase one will include one-to-one video calls in direct chats and group video calls of up to
        twenty people in private chats.
    </p>

    <p>
        Phase two will target community broadcasts. Exactly what this looks like is to be decided.
        But think Twitter spaces and/or Twitch streams.
    </p>

    <img src="/assets/blog/video/incall.webp" alt="Inside a video call" />

    <h2>Wait! Video calls! On-chain! That's huge!</h2>

    <p>
        Yes it <em>would</em> be! And that is what we always wanted to achieve but it is very
        important to be clear that <em>we are not there yet!</em> There remain some aspects of voice
        and video which are simply not feasible on the IC as it stands today. So we have to choose
        between partnering with <ExternalLink href="https://www.daily.co/"
            >an off-chain provider</ExternalLink> to fullfill a much requested feature or being unable
        to deliver the feature at all.
    </p>

    <p>
        Voice and video is also a very complex and technical thing to achieve in a reliable and
        scalable way and so it also makes sense from that perspective to take advantage of the hard
        work and expertise of a third party specialist. This allows us to get the feature in your
        hands and find out how best to develop it in the future.
    </p>

    <p>
        We know that we have a lot of technically astute users and users who care deeply about the
        goals of decentralisation so we want to be very transparent about how this currently works
        so that those who care can make an informed decision about whether they want to use the
        feature or not.
    </p>
</section>

<section>
    <h2>How it works</h2>

    <div class="cols">
        <div class="left">
            <p>
                Each private or direct chat in the system will be associated with a "room". There is
                one room per chat. Video calls take the form of "meetings" in the associated room.
                As such, there is only ever one ongoing video call in any one chat at any one time.
                You can see which of your chats have ongoing video calls in them via icons
                throughout the UI (in much the same way as you are notified of unread messages).
            </p>
            <p>
                To start a call, just choose the "Start video call" option from the chat menu. This
                will initiate the call and notify other parties. When a new call is started a video
                call message will appear in the timeline. This message will show other members of
                the chat that there is an ongoing video call taking place and who is involved. The
                message will also serve as the root of a thread that can be used to exchange
                messages <em>during</em> the call.
            </p>
            <p>
                If a call is already in progress, you can join from the chat menu, or by clicking on
                the join button in the timeline message.
            </p>
            <p>
                During a call, you can open the associated thread to exchange text messages, you can
                maximise the chat to take up as much of the screen as possible, you can freely
                continue to browse around other chats within OpenChat and remain on the video call
                in the background.
            </p>
        </div>
        <div class="right">
            <img class="right" src="/assets/blog/video/start.webp" alt="Inside a video call" />
        </div>
    </div>
</section>

<section>
    <h2>Is it secure?</h2>

    <div class="cols">
        <div class="left">
            <p>
                Initiating a call requires coordination between the OpenChat backend and the <ExternalLink
                    href="https://www.daily.co/">Daily</ExternalLink> platform's apis. This is coordinated
                via a bridging service running on AWS such that we never run the risk of leaking the
                Daily api key.
            </p>
            <p>
                All Daily rooms are private. The user must obtain a room token which they can only
                obtain when they have already obtained an OpenChat access token. This way we are
                able to protect the video chat rooms using both the OpenChat security model and the
                Daily security model in combination.
            </p>

            <p>
                Of course, the calls themselves are only as secure as Daily itself. One reason for
                selecting Daily is that they have focused on security from the start. We would
                prefer to have full control, of course, but for now, this is the next best thing.
                You can find a wealth of information about the security of Daily by following <ExternalLink
                    href="https://www.daily.co/products/security-at-daily/"
                    >this link.</ExternalLink>
            </p>

            <p>
                And finally, if you have <em>any</em> concerns about any of this from a security point
                of view, you can simply ignore this feature.
            </p>
        </div>
        <div class="sequence right">
            <Markdown
                inline={false}
                oneLine={false}
                text="```
┌──────────┐                   ┌──────────┐
│   User   │──────────────────▶│ OpenChat │
└──────────┘   Get OC token    └──────────┘
┌──────────┐                         │     
│   User   │◀────────────────────────┘     
└──────────┘                               
      │     Get room token     ┌──────────┐
      └───────────────────────▶│  Bridge  │
                               └──────────┘
┌──────────┐                         │     
│   User   │◀────────────────────────┘     
└──────────┘                               
      │        Join room      ┌──────────┐ 
      └──────────────────────▶│  Daily   │ 
                              └──────────┘ 
                            " />
        </div>
    </div>
</section>

<section>
    <h2>Who is paying for this?</h2>

    <p>
        Since we are relying on a third party for this feature, there are costs involved. For this
        initial beta period we intend to provide this service for free. But ultimately we will need
        to look at how much it is costing the DAO and decide how that cost should be met.
    </p>

    <p>
        It could be that we have some sort of free allowance and metered access from there. It could
        be that group or community owners could pay for access for their members. It could be that
        the DAO decides that it would like to continue to provide access for free. It is hard to
        rule any of these in or out until we have a clearer picture of usage and cost.
    </p>
</section>

<section>
    <h2>Next steps</h2>

    <p>
        Direct calls and small group chats are the first and most obvious use-case for voice and
        video. And we can think of this as the WhatsApp case. But OpenChat is as much about large
        public groups and communities as it is about small scale chats with friends and family.
    </p>

    <p>
        We think it would be great to also support large scale live broadcasts where the balance is
        more toward a small number of streamers and speakers and a large number of listeners. We can
        think of this as the Twitter spaces use-case. Phase one lays the ground work for this case
        as well.
    </p>

    <p>We would also like to support scheduled meetings rather than just impromptu calls.</p>

    <h3>The road to decentralisation</h3>

    <p>
        We will continue to keep an eye on developments on the IC of course in the hope that we can
        decentralise this solution in the future. The key technologies that are needed are: IC
        native STUN and TURN servers, video range headers, an IC native <ExternalLink
            href="https://bloggeek.me/webrtcglossary/sfu/">selective forwarding unit</ExternalLink> of
        some kind. Without this, we would be limited to strict peer-to-peer WebRTC and there is no way
        to get that to scale to the levels required.
    </p>
</section>

<style lang="scss">
    :global(.sequence .markdown-wrapper pre) {
        @include mobile() {
            @include font-size(fs-80);
        }
    }

    img {
        margin: $sp6 0;
        width: 100%;
    }

    .cols {
        display: flex;
        gap: $sp5;

        @include mobile() {
            flex-direction: column;
        }

        .left {
            flex: 3;
        }

        .right {
            flex: 2;
            margin: 0;
        }
    }
</style>
