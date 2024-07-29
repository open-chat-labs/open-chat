<script lang="ts">
</script>

<div class="preamble">
    <p>
        IT IS IMPORTANT YOU READ THESE TERMS CAREFULLY BEFORE USING THE OPENCHAT PLATFORM OR
        OTHERWISE USING OUR SERVICES. BY USING THE OPENCHAT PLATFORM OR OTHERWISE USING OUR
        SERVICES, YOU INDICATE THAT YOU ACCEPT THESE TERMS AND AGREE TO COMPLY WITH THEM. IF YOU USE
        THE OPENCHAT PLATFORM OR OTHERWISE USE OUR SERVICES IN THE COURSE OF YOUR BUSINESS OR WORK,
        YOU ARE ALSO AGREEING TO THESE TERMS ON BEHALF OF THAT BUSINESS. IF YOU DO NOT AGREE TO
        THESE TERMS, YOU MUST NOT USE THE OPENCHAT PLATFORM OR OTHERWISE USE OUR SERVICES.
    </p>

    <p>
        YOU SHOULD CAREFULLY CONSIDER WHETHER USING THE OPENCHAT PLATFORM OR OTHERWISE DEALING IN
        CRYPTOASSETS IS SUITABLE FOR YOU IN LIGHT OF YOUR OWN SITUATION AND ATTITUDE TO RISK, AS
        EVALUATED BY YOU CAREFULLY. WE DO NOT MAKE ANY REPRESENTATIONS OR RECOMMENDATIONS REGARDING
        THE ADVISABILITY OR OTHERWISE OF USING THE OPENCHAT PLATFORM OR OTHERWISE USING OUR SERVICES
        OR DEALING IN CRYPTOASSETS. IF YOU ARE UNSURE AS TO WHETHER USING THE OPENCHAT PLATFORM,
        USING OUR SERVICES OR OTHERWISE DEALING IN CRYPTOASSETS IS SUITABLE FOR YOU, YOU SHOULD SEEK
        INDEPENDENT PROFESSIONAL ADVICE PRIOR TO USING THE OPENCHAT PLATFORM, USING OUR SERVICES OR
        OTHERWISE DEALING IN CRYPTOASSETS. DEALING IN CRYPTOASSETS MAY NOT BE SUBJECT TO ANY
        INVESTOR PROTECTION, AND MAY INVOLVE A HIGH DEGREE OF RISK TO YOUR CAPITAL.
    </p>
</div>

<div class="section">
    <h2>Section A: General terms applicable to all services</h2>

    <ul class="custom_list bold" style={"--prefix: 'A'"}>
        <li>
            <h3>Introduction</h3>

            <ul class="custom_list" style={"--prefix: '1.'"}>
                <li>
                    We are OpenChat DAO. In these Terms, we refer to ourselves as "<strong
                        >OpenChat</strong
                    >", “<strong>we</strong>”, “<strong>us</strong>”, or “<strong>our</strong>”. We
                    operate the OpenChat Platform which enables users of the OpenChat Platform (“<strong
                        >you</strong
                    >”, “<strong>your</strong>”) to access and benefit from our Services.
                </li>
                <li>
                    These terms and conditions and each of the documents we refer to in them (all
                    together, the “<strong>Terms</strong>”) form the relationship between us and you
                    in relation to your use of the OpenChat Platform and our Services provided under
                    these Terms (our “<strong>Services</strong>”). Our Terms apply when using
                    specific Services as follows:

                    <ul class="custom_list" style={"--prefix: '1.2.'"}>
                        <li>Section A: General terms applicable to all Services</li>
                        <li>Section B: Additional terms for messaging on the OpenChat Platform</li>
                        <li>Section C: Additional terms for using the OpenChat Wallet</li>
                        <li>Section D: Additional terms applicable to Swaps</li>
                        <li>Section E: Additional terms for dealing in CHAT</li>
                        <li>Section F: Additional terms for Diamond Membership holders</li>
                        <li>Section G: Participating in the OpenChat DAO</li>
                        <li>Schedule 1: Risks relating to Cryptoassets</li>
                        <li>Schedule 2: Content Standards</li>
                        <li>Schedule 3: CHAT Features</li>
                    </ul>
                </li>
                <li>
                    By using the OpenChat platform, you confirm that you accept these Terms and that
                    you agree to comply with them. If you do not agree to these Terms, you must not
                    use the OpenChat Platform or our Services.
                </li>
                <li>
                    <h3>Interpretation</h3>
                    <p>
                        In these Terms, the following words and expressions have the following
                        meanings:
                    </p>
                    <table class="interpretation">
                        <tr>
                            <td>"Applicable Law"</td>
                            <td>
                                all applicable statutes, laws, enactments, orders, regulations,
                                regulatory rules, official guidance, standards, regulator
                                expectations and other similar instruments in any relevant
                                jurisdiction, as in force and amended from time to time;
                            </td>
                        </tr>
                        <tr>
                            <td>"Channel"</td>
                            <td>
                                refers to chats within Communities, to make clear that they are part
                                of a Community;
                            </td>
                        </tr>
                        <tr>
                            <td>"CHAT"</td>
                            <td>
                                refers to the token used to facilitate the governance of OpenChat,
                                with the features set out at Schedule 3;
                            </td>
                        </tr>
                        <tr>
                            <td>"Community", "Communities"</td>
                            <td>
                                refers to a group of Channels users can communicate within. This is
                                distinct from the concept of a Group, as in a Group involves users
                                messaging within a single channel (and Communities and Groups are a
                                distinct forms of communication within the OpenChat Platform);
                            </td>
                        </tr>
                    </table>
                </li>
            </ul>
        </li>
    </ul>
</div>

<style lang="scss">
    .preamble p {
        margin-bottom: toRem(24);
    }

    .section {
        h2,
        h3 {
            margin-bottom: $sp4;
            display: inline-block;
        }
        p {
            margin-bottom: $sp4;
        }
        h2 {
            @include font(bold, normal, fs-120);
        }

        h3 {
            @include font(bold, normal, fs-110);
        }

        .custom_list {
            list-style-type: none;
            counter-reset: item;
            @include font(book, normal, fs-100);
            margin-bottom: $sp5;
        }

        .custom_list > li {
            padding-left: 3.5em;
            position: relative;
            margin-bottom: $sp3;
        }

        .custom_list > li::before {
            content: var(--prefix) counter(item) ".";
            counter-increment: item;
            font-weight: normal;
            position: absolute;
            left: 0;
        }

        .custom_list.bold > li::before {
            font-weight: bold;
        }
    }

    table.interpretation {
        width: 100;
        border-collapse: collapse;

        tr {
            display: block;
            margin-bottom: $sp3;
        }

        td {
            width: 50%;

            &:first-child {
                font-weight: bold;
            }
        }
    }
</style>
