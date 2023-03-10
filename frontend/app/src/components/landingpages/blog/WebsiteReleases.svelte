<script lang="ts">
    import ExternalLink from "../ExternalLink.svelte";
</script>

<section>
    <h2>TLDR;</h2>
    <p>
        At the time of writing, website releases are made by the dev team directly because this process 
        can't yet be executed by proposal. See the bullet point <b>Upgrade the asset canister</b> 
        in the <ExternalLink 
        href="https://internetcomputer.org/sns/faq#in-what-ways-can-i-participate-in-an-sns-dao"
        >SNS FAQ</ExternalLink> on the IC website.
    </p>
    <p>
        Until this is possible the dev team will instead make "motion" proposals for each website 
        release only updating the website if the proposal is adopted.
    </p>
</section>
<section>
    <h2>Asset canister</h2>
    <p>
        The website <em>assets</em> (html, javascript, css, images, etc) are stored and served from
        the <em>asset canister</em>. There are two steps involved in updating the website:
    </p>
    <ul>
        <li>
            <b>Prepare batch</b> whereby a principal with the <em>prepare</em> permission calls methods on 
            the asset canister to create a <em>batch</em>, query which assets already exist and then upload 
            the raw data for new assets to this batch.
        </li>
        <li>
            <b>Commit batch</b> whereby a principal with the <em>commit</em> permission calls a method 
            on the asset canister to <em>commit</em> the batch. This method maps the raw data to 
            asset meta information, validates it with a hash of the data, and then starts serving the
            assets. 
        </li>
    </ul>
    <p>
        Developers don't need to worry about the details of the asset canister. They just use the command 
        line tool, <ExternalLink 
        href="https://internetcomputer.org/docs/current/references/cli-reference/dfx-parent"
        >dfx</ExternalLink>, to deploy the website. It references a local folder of website assets and
        handles all the orchestratation needed to prepare and commit a batch. However, currently this 
        means that no proposal is involved.
    </p>
    <p>
        To address this DFINITY are working on:
    </p>
    <ul>
        <li>changes to dfx, so it can be used for just the <em>prepare batch</em> step</li>
        <li>a new proposal type to allow the SNS to commit a batch of assets</li>
        <li>new proposal types to allow the SNS to add/remove asset canister permissions</li>
    </ul>
    <p>
        Currently the dev team have the permissions to prepare <em>and</em> commit batches. Once the above
        changes are ready (expected early April), the dev team will have their commit permission revoked and
        this will be given instead to the SNS governance canister. We will then use dfx to prepare the assets
        followed by a proposal to commit the assets which will automatically <em>commit the batch</em> if the 
        proposal is adopted or <em>delete the batch</em> if it is rejected.
    </p>
</section>
<section>
    <h2>Use motion proposals for now</h2>
    <p>
        From now on, until the process described above is available, we will make a motion proposal for any
        website release and only if it is adopted will we then use dfx to actually update the website.
    </p>
    <p>
        This might seem an unnecessary ceremony, but we think it is important that any changes to OpenChat, 
        backend or website, are made only after the corresponding proposal has been adopted.
    </p>
</section>
