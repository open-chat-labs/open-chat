// Learn page content: the docs (whitepaper, architecture), blog posts, roadmap and FAQs. This is placeholder copy carried
// over from the prototype. The host is expected to load the real content (markdown for docs and posts, JSON for the
// roadmap and FAQs) and pass it to <Learn content={…}>; the shapes below are that contract. Content is data, not UI
// copy, so it isn't translated through the i18n keys. Its text may use the markdown subset in inlineMarkdown.ts.

export type LearnPage = 'roadmap' | 'whitepaper' | 'architecture' | 'blog' | 'faq';
export type LearnDocPage = Extract<LearnPage, 'whitepaper' | 'architecture'>;

/** Sub-pages in tab order. */
export const LEARN_PAGES: LearnPage[] = ['roadmap', 'whitepaper', 'architecture', 'blog', 'faq'];

export interface LearnDocSection {
  /** Unique within the doc. Rendered as id="learn-<id>" (prefixed, so it can't clash with the host page's ids). */
  id: string;
  /** 1 (the default) for a top-level section; a deeper one belongs to the nearest shallower section before it. */
  depth?: number;
  title: string;
  paras: string[];
  list?: string[];
  /** A code sample shown after the paragraphs. */
  code?: string;
  /** A figure drawn from the doc's data after the paragraphs. */
  figure?: 'allocation' | 'canisters';
}

export interface LearnDoc {
  kicker: string;
  title: string;
  lede: string;
  /** Headline numbers shown above the sections. */
  stats?: { value: string; label: string }[];
  /** Token allocation for the 'allocation' figure; shares are percentages. */
  allocation?: { label: string; share: number }[];
  /** Canisters for the 'canisters' figure; `core` ones are highlighted. */
  canisters?: { name: string; role: string; core?: boolean }[];
  sections: LearnDocSection[];
  /** Closing note, followed by a link to the full source. */
  foot: string;
  source?: { href: string; label: string };
}

export interface LearnPost {
  /** URL id: `#blog/<slug>`, or the host's `/blog/<slug>`. */
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  body: string[];
  /** Shown as written; a missing date reads "Recent". */
  date?: string;
  /** Defaults to "OpenChat team". */
  author?: string;
  /** Cover image URL; without one the card uses a token cover. */
  cover?: string;
}

export interface RoadmapItem {
  title: string;
  /** `next` items are the "Up next" cards; `done` items sit on the timeline under their year. */
  status: 'next' | 'done';
  year?: string;
  /** Quarter or month label, e.g. "Q3". */
  when?: string;
  /** A milestone gets a filled dot and a heavier title. */
  milestone?: boolean;
  /** Expandable detail; items without it can't be opened. */
  detail?: { paras?: string[]; points?: { label: string; href?: string }[] };
}

export interface FaqGroup {
  title: string;
  /** `id` makes a question a deep link target (Learn's `question`), unique across the groups. An answer's blank lines
   *  separate paragraphs, and a paragraph that is only `![alt](src)` is an image. */
  items: { id?: string; q: string; a: string }[];
}

export interface LearnContent {
  docs: Partial<Record<LearnDocPage, LearnDoc>>;
  posts: LearnPost[];
  roadmap: RoadmapItem[];
  faq: FaqGroup[];
}

const X = 'https://x.com/OpenChat';

export const placeholderLearnContent: LearnContent = {
  docs: {
    whitepaper: {
      kicker: 'Whitepaper',
      title: 'The OpenChat SNS',
      lede: 'OpenChat is a fully featured chat app running end-to-end on the Internet Computer, controlled by a DAO: the OpenChat Service Nervous System (SNS). This paper covers why, how the CHAT token works, and how the DAO is funded.',
      stats: [
        { value: '100M', label: 'CHAT at genesis' },
        { value: '1M ICP', label: 'raised in the swap' },
        { value: '2,375', label: 'swap participants' },
        { value: '~2.5%', label: 'yearly voting rewards' },
      ],
      allocation: [
        { label: 'SNS treasury, controlled by the DAO', share: 52 },
        { label: 'Decentralisation swap', share: 25 },
        { label: 'Dev team, vesting over 4 years', share: 15 },
        { label: 'Other initial neurons', share: 8 },
      ],
      sections: [
        {
          id: 'vision',
          title: 'Vision',
          paras: [
            'Big tech messengers are owned by companies whose incentives are not aligned with the people who use them. OpenChat takes a different route: the code is open source, every canister runs on-chain, and the product roadmap can only be decided, approved and enacted by the community.',
            'Handing control to an SNS makes OpenChat an open internet service. Nobody can switch it off, quietly change the rules, or sell user data.',
          ],
        },
        {
          id: 'sns',
          title: 'Why an SNS',
          paras: [
            'An SNS is a DAO built into the Internet Computer. Once launched, changes to the OpenChat canisters, the treasury and the tokenomics can only be made by proposals that CHAT neuron holders vote on.',
            'Upgrades are applied automatically when a proposal is adopted, so what voters approve is exactly what runs. Builds are reproducible, so anyone can check the running code against the source.',
          ],
        },
        {
          id: 'token',
          title: 'The CHAT token',
          paras: ['CHAT is OpenChat’s utility token. It has four jobs:'],
          list: [
            'Governance: stake CHAT in neurons to vote on SNS proposals and earn voting rewards. Longer dissolve delays earn more.',
            'Premium features: pay for Diamond membership and other premium features.',
            'Rewards: users who help OpenChat grow and build great communities are rewarded in CHAT.',
            'Treasury: the DAO holds CHAT and ICP to fund development and growth.',
          ],
        },
        {
          id: 'tokenomics',
          title: 'Tokenomics',
          paras: [
            'The total supply at genesis was 100 million CHAT. Supply can grow through minting (voting rewards) and shrink through burning (fees and premium payments).',
          ],
          figure: 'allocation',
        },
        {
          id: 'swap',
          title: 'The decentralisation swap',
          paras: [
            'The SNS swap opened on 3 March 2023. 2,375 participants deposited a total of 1M ICP in exchange for 25M CHAT, and the OpenChat DAO became active when the swap concluded.',
            'Swap participants received their tokens as a basket of five equal-value neurons with dissolve delays of 0, 3, 6, 9 and 12 months.',
          ],
        },
        {
          id: 'rewards',
          title: 'Voting rewards',
          paras: [
            'The SNS mints about 2.5% of total supply each year to pay voting rewards. Rewards build up as maturity in participating neurons, and CHAT is minted when that maturity is disbursed.',
          ],
        },
        {
          id: 'treasury',
          title: 'Treasury and income',
          paras: [
            'The DAO treasury started with the ICP raised in the swap and 52M CHAT. It earns income from premium features, transaction fees and third-party integrations.',
            'In the early years, spending on user rewards and community bounties is expected to exceed income. As income grows the DAO can burn CHAT, reducing total supply.',
          ],
        },
        {
          id: 'diamond',
          title: 'Diamond membership',
          paras: [
            'Diamond is OpenChat’s premium tier, paid for in CHAT. It unlocks more storage, bigger groups, video calls and other features that cost the DAO more to run, and it helps keep automated fake accounts out.',
          ],
        },
      ],
      foot: 'Figures reflect the SNS launch parameters.',
      source: { href: 'https://oc.app/whitepaper', label: 'Read the original on oc.app' },
    },
    architecture: {
      kicker: 'Architecture',
      title: 'How OpenChat runs on the Internet Computer',
      lede: 'OpenChat is a set of canister smart contracts. They provide the API, serve the web app’s assets, and, with every user and group in its own canister, scale with the network.',
      canisters: [
        { name: 'User', role: 'One per user: DMs, wallet, profile', core: true },
        { name: 'Group', role: 'One per group', core: true },
        { name: 'Community', role: 'One per community', core: true },
        { name: 'User index', role: 'Registry of users' },
        { name: 'Group index', role: 'Registry and search of groups' },
        { name: 'OpenStorage', role: 'Files, images, video' },
        { name: 'Notifications', role: 'Queues web push notifications' },
        { name: 'Proposals bot', role: 'Syncs NNS and SNS proposals' },
        { name: 'Assets', role: 'Serves the web app' },
        { name: 'Cycles dispenser', role: 'Keeps canisters topped up' },
      ],
      sections: [
        {
          id: 'overview',
          title: 'Overview',
          paras: [
            'Canisters live on subnets, typically 13 node machines in independent data centres around the world. Every canister is replicated across its subnet. Updates go through consensus in around 2 seconds; queries are answered in milliseconds by any replica.',
          ],
          figure: 'canisters',
        },
        {
          id: 'goals',
          title: 'Design goals',
          paras: ['The platform and architecture were chosen against a list of requirements, including:'],
          list: [
            'Open: global access, open source, free to use, transparently governed',
            'Decentralised: trustless, tamper-proof, unstoppable',
            'Performance comparable to web2 apps',
            'One shared front end for every device',
            'Send tokens like ICP, CHAT and BTC as chat messages',
            'Scale to everyone in the world',
          ],
        },
        {
          id: 'users',
          title: 'A canister per user',
          paras: [
            'Each user gets their own canister. It holds their direct chats (both sides of each conversation), references to the groups they belong to, their profile, and their blocked users. It also acts as a wallet, so tokens can be sent between users as messages.',
            'One canister per user keeps access control simple, because only the owner can call it, and it scales naturally with the number of users.',
          ],
        },
        {
          id: 'groups',
          title: 'Group and community canisters',
          paras: [
            'Every group has its own canister too. It stores members and roles, messages and events, and details like name, rules, permissions and pinned messages. File attachments live in OpenStorage rather than in the group canister.',
          ],
        },
        {
          id: 'index',
          title: 'Index canisters',
          paras: [
            'The user index is the global registry of users. It creates, upgrades and tops up user canisters, and checks that usernames are valid and available. The group index does the same for groups, and powers public group search and recommendations.',
          ],
        },
        {
          id: 'storage',
          title: 'OpenStorage',
          paras: [
            'OpenStorage is a scalable file store built by the OpenChat team. An index canister manages bucket canisters that hold the file data. Content addressing means a file forwarded many times is stored once.',
          ],
        },
        {
          id: 'verify',
          title: 'Verifiable builds',
          paras: [
            'All canisters are written in Rust and built reproducibly with Docker. Each canister’s metrics endpoint shows the git commit it was built from, so you can compare the WASM hash on chain with one you build yourself:',
          ],
          code: 'dfx canister --network ic info 4bkt6-4aaaa-aaaaf-aaaiq-cai',
        },
        {
          id: 'web',
          title: 'The web app',
          paras: [
            'The app is TypeScript and Svelte in three layers: the UI, a client library that exposes app state as reactive stores, and an agent that calls canister APIs and caches responses in IndexedDB. The agent runs in a web worker to keep the UI responsive.',
          ],
        },
      ],
      foot: 'Condensed from the architecture doc in the OpenChat repository.',
      source: { href: 'https://github.com/open-chat-labs/open-chat/blob/master/architecture/doc.md', label: 'Read the full document on GitHub' },
    },
  },
  posts: [
    {
      slug: 'openchat-is-now-a-dao',
      category: 'Governance',
      date: '3 Mar 2023',
      title: 'OpenChat is now a DAO',
      excerpt: 'The SNS swap has concluded. OpenChat is now controlled by CHAT neuron holders.',
      body: [
        'The OpenChat SNS swap concluded with 2,375 participants depositing 1M ICP in exchange for 25M CHAT.',
        'From today, every upgrade to OpenChat is a proposal that CHAT neuron holders vote on. Proposals appear in the OpenChat proposals group, where you can discuss them in threads and vote with all your linked neurons at once.',
      ],
    },
    {
      slug: 'introducing-diamond',
      category: 'Product',
      date: 'Feb 2023',
      title: 'Introducing Diamond membership',
      excerpt: 'A premium tier that unlocks more storage and bigger groups, paid for in tokens.',
      body: [
        'Diamond membership unlocks the features that cost the most to run: more storage, more groups, and more.',
        'Anyone who previously verified a phone number or bought storage became a Diamond member for a year automatically.',
      ],
    },
    {
      slug: 'communities-and-channels',
      category: 'Product',
      title: 'Communities and channels',
      excerpt: 'Bring a whole project together with public and private channels, roles and user groups.',
      body: [
        'Communities work like a workspace: one membership, many channels. Each community runs in its own canister.',
        'Admins can create public and private channels, set roles from Member to Owner, and organise people into user groups.',
      ],
    },
    {
      slug: 'verifying-the-code',
      category: 'Engineering',
      title: 'Verifying the code you voted for',
      excerpt: 'Reproducible builds mean anyone can check what’s running against the source.',
      body: [
        'Every OpenChat canister is built reproducibly with Docker, and each exposes the git commit it was built from.',
        'Build the WASM at that commit, hash it, and compare with the module hash the Internet Computer reports. If they match, the code running is the code that was approved.',
      ],
    },
    {
      slug: 'android-beta',
      category: 'Product',
      title: 'The Android app is in beta',
      excerpt: 'Two builds: the Play Store version, and a full version with every wallet feature.',
      body: [
        'The Android app is in open beta. There are two builds: the Play Store version installs and updates through Google Play, and the full version includes every wallet and token feature.',
        'The iOS app is in progress and will go out through TestFlight.',
      ],
    },
    {
      slug: 'passkeys-and-wallets',
      category: 'Engineering',
      title: 'Passkeys, wallets and no phone number',
      excerpt: 'Sign in with a passkey, Internet Identity, Ethereum or Solana.',
      body: [
        'Your OpenChat account isn’t tied to a SIM card, an email or a big tech login. Sign in with a passkey on your device, Internet Identity, or an Ethereum or Solana wallet.',
        'You can link several sign-in methods to one account from your profile.',
      ],
    },
  ],
  roadmap: [
    { status: 'next', title: 'NFTs, contacts, personas and more' },
    { status: 'next', title: 'Native apps' },
    { status: 'next', title: 'Blue sky thinking' },
    {
      status: 'done',
      year: '2025',
      when: 'Q1',
      title: 'Bots and end-to-end encryption',
      detail: {
        paras: ['Bots can now join chats and communities, respond to commands and act on behalf of users, all with permissions set by admins.'],
        points: [
          { label: 'Bot platform and SDK', href: X },
          { label: 'Command bots and autonomous bots', href: X },
          { label: 'Opt-in end-to-end encrypted direct chats' },
        ],
      },
    },
    {
      status: 'done',
      year: '2024',
      when: 'Q4',
      title: 'Scalability and performance',
      detail: {
        points: [
          { label: 'Faster chat loading and sync', href: X },
          { label: 'Moving storage buckets to additional subnets' },
          { label: 'Lower cycle costs per user' },
        ],
      },
    },
    {
      status: 'done',
      year: '2024',
      when: 'Q3',
      title: 'Tokenisation and growth, continued',
      detail: {
        points: [{ label: 'CHIT rewards and daily streaks', href: X }, { label: 'Prize messages', href: X }, { label: 'More tokens supported in the wallet' }],
      },
    },
    {
      status: 'done',
      year: '2024',
      when: 'Q2',
      title: 'Tokenisation and growth',
      detail: {
        paras: ['A push to reward the people who help OpenChat grow, and to make tokens feel native in every chat.'],
        points: [{ label: 'P2P token swaps in chat', href: X }, { label: 'Tipping messages', href: X }, { label: 'Token balance access gates' }],
      },
    },
    {
      status: 'done',
      year: '2024',
      when: 'Q1',
      title: 'Voice and video calls',
      detail: {
        paras: ['Jump from a chat into a call with one person or a whole group, then straight back into the conversation.'],
        points: [
          { label: 'Video calls in direct chats', href: X },
          { label: 'Group calls for Diamond members', href: X },
        ],
      },
    },
    {
      status: 'done',
      year: '2023',
      when: 'Q4',
      title: 'Swaps and disappearing messages',
      detail: {
        points: [
          { label: 'In-app token swaps via ICP DEXes', href: X },
          { label: 'Disappearing messages', href: X },
          { label: 'Message translations for Diamond members' },
        ],
      },
    },
    {
      status: 'done',
      year: '2023',
      when: 'Q3',
      title: 'Communities',
      detail: {
        paras: [
          'Communities group chats and users around something they share: a language, an area of interest, or a project. In that sense they’re a bit like Discord servers.',
          'A community can also restrict its membership and be private. That makes OpenChat usable as an internal tool inside a company, much like a Slack workspace, and is an important step towards monetising OpenChat.',
        ],
        points: [
          { label: 'Communities released', href: X },
          { label: 'Link previews', href: X },
          { label: 'Automatic wallet support for SNS tokens' },
          { label: 'IFrame based OpenChat integration', href: X },
          { label: 'Meme Fighter integration', href: X },
          { label: 'Display names', href: X },
        ],
      },
    },
    {
      status: 'done',
      year: '2023',
      when: 'Q2',
      title: 'CHAT airdrop',
      detail: {
        points: [
          { label: 'Airdrop of 1M CHAT to participating users', href: X },
          { label: 'Access gates for Diamond members and SNS neuron holders', href: X },
          { label: 'Message reminders', href: X },
          { label: 'Referral rewards', href: X },
          { label: 'OpenChat Labs Ltd', href: X },
        ],
      },
    },
    {
      status: 'done',
      year: '2023',
      when: 'Q1',
      title: 'SNS DAO launched',
      milestone: true,
      detail: {
        paras: ['Control of OpenChat passed to its Service Nervous System. From here, every upgrade is a proposal voted on by CHAT neuron holders.'],
        points: [
          { label: 'Decentralisation swap: 1M ICP raised', href: X },
          { label: 'CHAT token launched' },
          { label: 'OC DAO controlled canister market making on ICDex', href: X },
        ],
      },
    },
    {
      status: 'done',
      year: '2022',
      when: 'Q4',
      title: 'Redesign and prep for the SNS launch',
      detail: {
        points: [
          { label: 'New look across web and mobile', href: X },
          { label: 'Diamond membership', href: X },
          { label: 'SNS proposal and whitepaper published', href: X },
        ],
      },
    },
    {
      status: 'done',
      year: '2022',
      when: 'Q3',
      title: 'Threads and proposals',
      detail: { points: [{ label: 'Threaded replies', href: X }, { label: 'NNS proposal groups with in-app voting', href: X }, { label: 'Polls' }] },
    },
    {
      status: 'done',
      year: '2022',
      when: 'Q2',
      title: 'Edit message, forwarding, translations',
      detail: { points: [{ label: 'Edit and delete messages', href: X }, { label: 'Forward messages' }, { label: 'On-demand translations' }] },
    },
    {
      status: 'done',
      year: '2022',
      when: 'Q1',
      title: 'Main version launched',
      milestone: true,
      detail: {
        paras: ['The rebuilt OpenChat went live, with every user and group running in its own canister.'],
        points: [
          { label: 'Public and private groups', href: X },
          { label: 'Send ICP as a chat message', href: X },
        ],
      },
    },
    {
      status: 'done',
      year: '2021',
      when: 'Q1–Q4',
      title: 'Test version launched',
      detail: {
        paras: ['An early version to prove chat could run fully on chain, with fast, reliable messaging.'],
        points: [{ label: 'Direct and group chats' }, { label: 'Internet Identity sign-in' }],
      },
    },
    {
      status: 'done',
      year: '2020',
      when: 'Dec',
      title: 'Development started',
      detail: {
        paras: [
          'Before the Internet Computer mainnet launched and before the grants programme existed, DFINITY contracted a small team of software developers, consisting of Matt Grogan and Hamish Peebles, to build a dapp on the Internet Computer.',
          'The remit was broad. It could be any dapp, but it needed to be ambitious and show what was possible on the Internet Computer. Quite quickly the team chose to build an instant messaging app and OpenChat was born!',
        ],
      },
    },
  ],
  faq: [
    {
      title: 'Getting started',
      items: [
        {
          q: 'Is OpenChat free?',
          a: 'Yes. Chatting, groups and communities are free. Diamond membership, paid in CHAT, unlocks extras such as more storage, bigger groups and video calls.',
        },
        {
          q: 'Do I need a phone number or email?',
          a: 'No. You sign in with a passkey, Internet Identity, or an Ethereum or Solana wallet. Adding an email is optional and only used for account recovery.',
        },
        {
          q: 'Is there a mobile app?',
          a: 'The Android app is in beta, in a Play Store build and a full build. The iOS app is on its way; until then, open oc.app in Safari and add it to your home screen.',
        },
      ],
    },
    {
      title: 'Privacy and security',
      items: [
        {
          q: 'Where are my messages stored?',
          a: 'On chain, in your own user canister on the Internet Computer. Group messages live in the group’s canister. Each canister is replicated across the nodes of its subnet.',
        },
        {
          q: 'Can anyone shut OpenChat down or delete my chats?',
          a: 'OpenChat is controlled by its SNS DAO. There’s no company that can switch it off; changes need a proposal adopted by CHAT neuron holders.',
        },
        {
          q: 'Can I check the code?',
          a: 'Yes. OpenChat is open source under the AGPL, and builds are reproducible, so you can compare a canister’s WASM hash with one you build yourself.',
        },
      ],
    },
    {
      title: 'Tokens and wallet',
      items: [
        {
          q: 'Which tokens can I send?',
          a: 'ICP, CHAT, ckBTC and many more, with new tokens added over time. Send them in any chat, tip messages, run prize messages and swap in the app.',
        },
        {
          q: 'What is CHAT used for?',
          a: 'Voting on proposals by staking it in neurons, paying for Diamond and premium features, and rewarding users who help OpenChat grow.',
        },
      ],
    },
    {
      title: 'Governance',
      items: [
        {
          q: 'How do I vote on proposals?',
          a: 'Stake CHAT in a neuron, then add your OpenChat account as a hotkey. You can then vote from the proposals group in the app, with all linked neurons at once.',
        },
        { q: 'Who decides the roadmap?', a: 'The community. The roadmap can only be decided, approved and enacted through SNS proposals.' },
      ],
    },
  ],
};

/** The sub-pages the content has: a doc page (whitepaper, architecture) only when the content includes that doc, or
 *  the host gives that page's content itself (`hosted`). */
export function learnPagesOf(content: LearnContent, hosted: LearnDocPage[] = []): LearnPage[] {
  return LEARN_PAGES.filter((p) => (p === 'whitepaper' || p === 'architecture' ? !!content.docs[p] || hosted.includes(p) : true));
}

/** The sub-page (and blog post) a location hash names: '#faq', '#blog/<slug>'. Null for no hash or an unknown page. */
export function learnFromHash(hash: string): { page: LearnPage; post?: string } | null {
  const raw = hash.replace(/^#/, '');
  const cut = raw.indexOf('/');
  const page = cut < 0 ? raw : raw.slice(0, cut);
  if (!(LEARN_PAGES as string[]).includes(page)) return null;
  let post = '';
  try {
    // the slug is encoded on its own, so it may contain '/'
    post = cut < 0 ? '' : decodeURIComponent(raw.slice(cut + 1));
  } catch {
    return null;
  }
  return page === 'blog' && post ? { page, post } : { page: page as LearnPage };
}

/** Default link for a sub-page: the Learn route plus the hash Learn reads. */
export function learnHashHref(learnHref: string, page: LearnPage, post?: string): string {
  return `${learnHref}#${page}${page === 'blog' && post ? '/' + encodeURIComponent(post) : ''}`;
}

/** A doc section in its doc's outline: its number (01, 02 … at the top, 2.1, 3.4.1 below) and its sub-sections. */
export interface OutlineEntry {
  /** The section's index in the doc's sections. */
  index: number;
  number: string;
  depth: number;
  children: OutlineEntry[];
}

/** The doc's sections as a tree: each section under the nearest shallower one before it (a depth that skips a level
 *  sits one level down). Numbers count within each parent. */
export function docOutline(sections: LearnDocSection[]): OutlineEntry[] {
  const top: OutlineEntry[] = [];
  // the open entries, one per level, with the plain path their children's numbers build on
  const open: { entry: OutlineEntry; path: string }[] = [];
  sections.forEach((s, index) => {
    const depth = Math.max(1, Math.min(s.depth ?? 1, open.length + 1));
    open.length = depth - 1;
    const parent = open[depth - 2];
    const siblings = parent ? parent.entry.children : top;
    const n = siblings.length + 1;
    const path = parent ? `${parent.path}.${n}` : String(n);
    const entry: OutlineEntry = { index, number: parent ? path : String(n).padStart(2, '0'), depth, children: [] };
    siblings.push(entry);
    open.push({ entry, path });
  });
  return top;
}

/** The outline entries from the top down to the section at `index` (the section's own entry last); none for an index
 *  the outline doesn't have. */
export function outlinePath(outline: OutlineEntry[], index: number): OutlineEntry[] {
  for (const entry of outline) {
    if (entry.index === index) return [entry];
    const below = outlinePath(entry.children, index);
    if (below.length) return [entry, ...below];
  }
  return [];
}

/** Whether a link goes to the page exactly as it shows (the same path and query; a fragment aside): following it changes
 *  nothing for the host, so the page itself applies its deep link (a doc section, a question) again. */
export function sameLocation(href: string, here: string): boolean {
  try {
    const to = new URL(href, here);
    const from = new URL(here);
    return to.origin === from.origin && to.pathname === from.pathname && to.search === from.search;
  } catch {
    return false;
  }
}

/** The section being read: the last one whose top has reached `line` (from the top of the viewport), else the first. */
export function readingSection(tops: number[], line: number): number {
  let reading = 0;
  tops.forEach((top, i) => {
    if (top <= line) reading = i;
  });
  return reading;
}

