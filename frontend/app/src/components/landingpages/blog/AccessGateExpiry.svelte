<script lang="ts">
    import BlogScreenshot from "./BlogScreenshot.svelte";
</script>

<section>
    <p>
        It has long been possible to guard access to your groups, communities and channels using a
        variety of access gates. This has helped owners and admins to keep their communities focused
        and high quality.
    </p>

    <p>
        However, until now an access gate was only considered at the point where a user tries to <em
            >join</em>
        a group, community or channel. Of course it is possible that a member's status relative to the
        required access gates may change over time and so it is possible that we end up with users in
        our community who no longer qualify. Our new access gate expiry feature helps to address this
        by allowing an access gate to be re-evaluated for each user on a specified schedule.
    </p>

    <p>
        You can watch a short explainer video about this feature here or read on below for more
        details.
    </p>

    <iframe
        src="https://www.youtube.com/embed/xf_vCKENgWA?si=YHUoEzzQH4O_Mm24"
        title="Access gate expiry"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen></iframe>
</section>

<section>
    <h2>How does it work?</h2>

    <p>
        In all contexts where you can create an access gate, it is now possible to specify a time
        interval on which that gate will be re-evaluated for all members.
    </p>

    <BlogScreenshot
        caption="Setting an access gate expiry interval"
        desktopUrl={"/assets/blog/gate_expiry/desktop_set.png"}
        mobileUrl={"/assets/blog/gate_expiry/mobile_set.png"} />

    <p>
        With that set, users will be able to see that, not only is there an access gate, but the
        access gate will be regularly re-evaluated.
    </p>

    <BlogScreenshot
        caption="Indication that the access gate will be re-evaluated"
        desktopUrl={"/assets/blog/gate_expiry/desktop_details.png"}
        mobileUrl={"/assets/blog/gate_expiry/mobile_details.png"} />

    <p>
        When a user attempts to join a group, community or channel that is protected by an access
        gate with an expiry, they will be reminded that that access gate will be re-evaluated
        according to the schedule set by the owner.
    </p>

    <BlogScreenshot
        caption="Joining a community with an expiring access gate"
        desktopUrl={"/assets/blog/gate_expiry/desktop_join.png"}
        mobileUrl={"/assets/blog/gate_expiry/mobile_join.png"} />

    <h2>What happens when a gate is re-evaluated?</h2>

    <p>
        When a you join a group, community or channel with an expiring gate, your membership will be
        re-evaluated on the specified schedule. Exactly what this means depends on the type of gate.
        For example, if a channel has a Diamond membership access gate, we will simply check that
        you <em>still</em> have a Diamond membership. However, some access gates will require user interaction.
        For example, the channel may require a payment. In this case, another payment would need to be
        approved by you the user before your membership can be re-established.
    </p>

    <p>
        In the case where you no longer meet the access gate requirements <em>or</em> user
        interaction is required to establish whether or not you meet the access gate requirements,
        you will enter a <em>lapsed</em> membership state. You are still a member in this state, but
        you will no longer be able to interact until you have established once again that you meet the
        requirements of the access gate.
    </p>

    <BlogScreenshot
        caption="Lapsed membership"
        desktopUrl={"/assets/blog/gate_expiry/desktop_lapsed.png"}
        mobileUrl={"/assets/blog/gate_expiry/mobile_lapsed.png"} />

    <p>The process for re-joining is exactly the same as the process for joining.</p>

    <p>
        Note that it is possible that there may be more than one access gate in play since it is
        possible to have an access gate on both the community and a channel at the same time. These
        access gates can have different expiry intervals and will be evaluated independently.
    </p>

    <h2>Applications</h2>

    <p>
        There are many possible reasons that you might want to use expiring access gates. The reason
        that we have a new channel for each monthly airdrop is because we <em>didn't</em> have this capability
        and we wanted to make sure that someone could not just buy a single month of Diamond membership
        and then participate indefinitely. We could model this with an expiring access gate now if we
        choose to instead.
    </p>

    <p>
        This feature also offers a way to provide content with a subscription model. It has always
        been possible to add payment gates, but it is now possible to make it a recurring payment
        enhancing the ability of content creators to fairly monetise their communities.
    </p>

    <p>
        And finally this feature fits nicely with verifiable credentials. Whatever credential is
        provided, whether it is proof of unique humanity or perhaps verified employee status, it
        stands to reason that you might want to verify periodically that your members can <em
            >still</em> provide any credential that is required.
    </p>
</section>

<style lang="scss">
    iframe {
        width: 100%;
        aspect-ratio: 2 / 1;
    }
</style>
