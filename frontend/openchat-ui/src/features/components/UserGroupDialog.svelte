<!-- Create, edit or delete a community user group (a mentionable set of members, e.g. @developers).
     Form: name (checked against takenNames) and members picked from `people` (or `onSearch` results) with a type-ahead
     (↑/↓, Enter, Esc clears). Members are identified by userId. Save / Delete call the host and wait: the dialog closes
     once it resolves and stays open with the form and an error if it rejects. Esc, the veil, × and Cancel close
     (not while the host is working).
     Success contract (same in every confirm/create dialog): once the host's promise resolves the dialog animates out and
     then calls onCancel, so the host unmounts it; it stays hidden (no reappearing, no invisible layer catching clicks). -->
<script lang="ts" module>
  export interface UserGroupPerson {
    userId: string;
    name: string;
    handle: string;
    /** violet | teal | amber | blue | plum | rose | slate */
    color?: string;
  }
</script>

<script lang="ts">
  import { useT } from '../../lib/i18n';
  import Translate from '../../lib/components/Translate.svelte';
  import { onDestroy, untrack } from 'svelte';
  import { modal } from '../../lib/behaviours/modal';
  import { DialogFlow } from '../../lib/behaviours/dialog.svelte';

  const GRADIENTS: Record<string, string> = {
    violet: 'linear-gradient(140deg,#8B7BFF,#5B3FD9)',
    teal: 'linear-gradient(140deg,#2EE6A8,#1FA6B8)',
    amber: 'linear-gradient(140deg,#FFC061,#F58A2E)',
    blue: 'linear-gradient(140deg,#5CB8FF,#2F6BFF)',
    plum: 'linear-gradient(140deg,#E27BFF,#9B3FD9)',
    rose: 'linear-gradient(140deg,#FF8FA8,#E0456A)',
    slate: 'linear-gradient(140deg,#8A93A8,#4F586C)',
  };
  const slug = (n: string) =>
    '@' +
    n
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

  type Person = UserGroupPerson;

  interface Props {
    dialogMode?: 'create' | 'edit' | 'delete';
    communityName: string;
    /** The group being edited or deleted. `mention` is its real @handle (otherwise one is previewed from the name). */
    group?: { key: string; title: string; members: Person[]; mention?: string } | null;
    /** Community members you can add (the initial list; onSearch can find more). */
    people?: Person[];
    /** Search the whole community; replaces the local filter while there is a query. */
    onSearch?: (query: string) => Promise<Person[]>;
    /** Existing group names, to reject duplicates. */
    takenNames?: string[];
    onCancel?: () => void;
    /** Create (key null) or update a group. Reject to keep the dialog open with an error. */
    onSave?: (g: { key: string | null; title: string; memberIds: string[] }) => Promise<unknown> | void;
    /** Delete the group. Reject to keep the dialog open with an error. */
    onDelete?: (key: string) => Promise<unknown> | void;
  }

  let { dialogMode = 'create', communityName, group = null, people = [], onSearch, takenNames = [], onCancel, onSave, onDelete }: Props = $props();
  const t = useT();

  const isDelete = $derived(dialogMode === 'delete');
  const isEdit = $derived(dialogMode === 'edit');

  let name = $state(untrack(() => group?.title ?? ''));
  // picked user ids; `known` remembers every person seen (group members, people, search results) to render them
  let picked = $state<string[]>(untrack(() => (group?.members ?? []).map((m) => m.userId)));
  let known = $state<Record<string, Person>>({});
  let remote = $state<Person[] | null>(null);
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let searchRun = 0;
  let query = $state('');
  let focused = $state(false);
  let highlight = $state(0);

  const byId = (id: string): Person => known[id] ?? people.find((x) => x.userId === id) ?? group?.members.find((x) => x.userId === id) ?? { userId: id, name: id, handle: '', color: 'slate' };
  const grad = (p: Person) => GRADIENTS[p.color ?? 'slate'] ?? GRADIENTS.slate;
  const mentionOf = (title: string) => group?.mention ?? slug(title);
  const haystack = (p: Person) => `${p.name} ${p.handle}`.toLowerCase();

  const needle = $derived(query.trim().toLowerCase());
  const pool = $derived(remote ?? people.filter((x) => haystack(x).includes(needle)));
  const matches = $derived(needle ? pool.filter((x) => !picked.includes(x.userId)).slice(0, 8) : []);
  const hi = $derived(Math.min(highlight, Math.max(0, matches.length - 1)));
  const dropOpen = $derived(focused && !!needle);
  const trimmed = $derived(name.trim());
  const taken = $derived(takenNames.some((n) => n.toLowerCase() === trimmed.toLowerCase() && n.toLowerCase() !== (group?.title ?? '').toLowerCase()));
  const ok = $derived(isDelete || (trimmed.length > 0 && !taken && picked.length > 0));
  const memberCount = $derived((group?.members ?? []).length);

  function add(person: Person) {
    known = { ...known, [person.userId]: person };
    if (!picked.includes(person.userId)) picked = [person.userId, ...picked];
    query = '';
    remote = null;
    highlight = 0;
  }

  // server-side search when the host offers it (debounced; a newer query wins)
  function typed(v: string) {
    query = v;
    highlight = 0;
    clearTimeout(searchTimer);
    remote = null;
    const q = v.trim();
    if (!onSearch || !q) return;
    const mine = ++searchRun;
    const search = onSearch;
    searchTimer = setTimeout(async () => {
      try {
        const found = await search(q);
        if (mine === searchRun) remote = found;
      } catch {
        // search failed: keep filtering the local list
      }
    }, 250);
  }

  function queryKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlight = Math.min(hi + 1, matches.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlight = Math.max(hi - 1, 0);
    } else if (e.key === 'Enter' && matches[hi]) {
      e.preventDefault();
      add(matches[hi]);
    } else if (e.key === 'Escape' && query) {
      e.preventDefault();
      e.stopPropagation();
      query = '';
    }
  }

  // busy / leaving / the exit: the shared dialog contract (lib/behaviours/dialog.svelte.ts)
  const flow = new DialogFlow();
  onDestroy(() => {
    flow.destroy();
    clearTimeout(searchTimer);
  });

  async function confirm() {
    if (!ok) return;
    const key = group?.key;
    if (isDelete && !key) return;
    const result = await flow.run(() => (isDelete ? onDelete?.(key!) : onSave?.({ key: key ?? null, title: trimmed, memberIds: [...picked] })));
    if (result.ok) flow.leave(onCancel);
  }

  const dismiss = () => flow.dismiss(onCancel);
</script>

<div class="layer" class:closing={flow.closing} data-screen-label="User group dialog" role="dialog" aria-modal="true" use:modal={flow.escape(onCancel)}>
  <div class="veil" onclick={dismiss} aria-hidden="true"></div>
  <div class="card" class:delete={isDelete}>
    <div class="head">
      <span class="badge" class:danger={isDelete}><span class="badge-icon"></span></span>
      <div class="titles">
        <span class="title">{t(isDelete ? 'ui.userGroupDialog.deleteTitle' : isEdit ? 'ui.userGroupDialog.editTitle' : 'ui.userGroupDialog.newTitle')}</span>
        <span class="subtitle">{isEdit || isDelete ? `${group?.title ?? ''} · ${communityName}` : t('ui.userGroupDialog.inCommunity', { community: communityName })}</span>
      </div>
      <span class="icon-button" onclick={dismiss} role="button" tabindex="0" aria-label={t('ui.common.close')}><span class="close-icon"></span></span>
    </div>

    {#if isDelete}
      <div class="delete-body">
        <span class="delete-title"><Translate key="ui.userGroupDialog.deleteAsk">{#snippet title()}<span class="danger-ink">{group?.title ?? ''}</span>{/snippet}</Translate></span>
        <span class="delete-text"
          ><Translate key="ui.userGroupDialog.deleteBody" params={{ count: memberCount, community: communityName }}
            >{#snippet mention()}<span class="mention">{mentionOf(group?.title ?? '')}</span>{/snippet}</Translate
          ></span
        >
      </div>
    {:else}
      <div class="form">
        <div class="name-row">
          <label class="field">
            <span class="label">{t('ui.userGroupDialog.name')}</span>
            <input class="box" class:filled={!!name} class:taken bind:value={name} placeholder={t('ui.userGroupDialog.namePlaceholder')} maxlength="40" />
            <span class="help"
              >{taken ? t('ui.userGroupDialog.nameTaken') : trimmed ? t('ui.userGroupDialog.mentionWith', { mention: group?.mention && trimmed === group.title ? group.mention : slug(trimmed) }) : t('ui.userGroupDialog.mentionHint')}</span
            >
          </label>
        </div>

        <div class="members">
          <span class="label">{t('ui.userGroupDialog.members')} <span class="count">· {picked.length}</span></span>
          <div class="search-wrap">
            <div class="search" class:focused>
              <span class="search-icon"></span>
              <input
                bind:value={() => query, typed}
                onkeydown={queryKey}
                onfocus={() => (focused = true)}
                onblur={() => (focused = false)}
                placeholder={t('ui.userGroupDialog.searchPlaceholder')}
              />
            </div>
            {#if dropOpen}
              <div class="dropdown">
                {#each matches as person, i}
                  <div
                    class="result"
                    class:hi={i === hi}
                    onmousedown={(e) => {
                      e.preventDefault();
                      add(person);
                    }}
                    onmouseenter={() => (highlight = i)}
                    role="option"
                    aria-selected={i === hi}
                    tabindex="-1"
                  >
                    <span class="face small" style:background={grad(person)}></span>
                    <div class="who">
                      <span class="who-name small">{person.name}</span>
                      <span class="who-handle">{person.handle}</span>
                    </div>
                    <span class="add-hint">{t('ui.userGroupDialog.addHint')}</span>
                  </div>
                {/each}
                {#if matches.length === 0}
                  <span class="no-results"
                    >{pool.length > 0
                      ? t('ui.userGroupDialog.allMatchesAdded', { query })
                      : t('ui.userGroupDialog.noMatches', { community: communityName, query })}</span
                  >
                {/if}
              </div>
            {/if}
          </div>

          <div class="picked" class:dimmed={dropOpen}>
            {#each picked as id (id)}
              {@const person = byId(id)}
              <div class="member">
                <span class="face" style:background={grad(person)}></span>
                <div class="who">
                  <span class="who-name">{person.name}</span>
                  <span class="who-handle">{person.handle}</span>
                </div>
                <span class="icon-button remove" onclick={() => (picked = picked.filter((k) => k !== id))} aria-label={t('ui.userGroupDialog.removeFromGroup')} role="button" tabindex="0" title={t('ui.userGroupDialog.removeFromGroup')}
                  ><span class="remove-icon"></span></span
                >
              </div>
            {/each}
            {#if picked.length === 0}
              <span class="empty">{t('ui.userGroupDialog.noMembers', { community: communityName })}</span>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <div class="foot">
      <span class="text-button tall" onclick={dismiss} role="button" tabindex="0" aria-disabled={flow.locked}>{t('ui.common.cancel')}</span>
      <span class="grow"></span>
      {#if flow.failed}<span class="error" role="alert">{t(isDelete ? 'ui.userGroupDialog.deleteFailed' : 'ui.userGroupDialog.saveFailed')}</span>{/if}
      <div class="cta" class:ok={ok && !flow.busy} class:danger={isDelete} onclick={confirm} role="button" tabindex="0" aria-disabled={!ok || flow.locked}>
        <span class="cta-icon" class:save={isEdit} class:trash={isDelete}></span>
        <span>{t(flow.busy ? 'ui.userGroupDialog.working' : isDelete ? 'ui.common.delete' : isEdit ? 'ui.common.saveChanges' : 'ui.userGroupDialog.create')}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-22);
  }

  .veil {
    position: absolute;
    inset: 0;
    background: var(--oc-veil, rgba(3, 3, 6, 0.72));
    backdrop-filter: var(--oc-veil-blur, blur(4px));
    -webkit-backdrop-filter: var(--oc-veil-blur, blur(4px));
    animation: oc-veil-in var(--duration-base, 200ms) var(--ease-out) both;
  }

  .card {
    position: relative;
    width: 100%;
    max-height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-xl);
    background: var(--surface-1, #0e0e12);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      var(--shadow-modal, 0 30px 70px rgba(0, 0, 0, 0.45));
    overflow: hidden;
    animation: oc-dlg-in var(--duration-slow, 280ms) var(--ease-out) both;
  }

  /* fading out: no longer catches clicks while (or after) it leaves */
  .layer.closing {
    pointer-events: none;
  }

  .closing .veil {
    animation: oc-veil-out 170ms var(--ease-standard) both;
  }

  .closing .card {
    animation: oc-dlg-out 170ms var(--ease-standard) both;
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-16) var(--space-18);
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .badge {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md);
    background: var(--accent-soft, rgba(255, 86, 114, 0.12));
    box-shadow: inset 0 0 0 1px var(--accent-dim, rgba(255, 86, 114, 0.35));
  }

  .badge-icon {
    width: 19px;
    height: 19px;
    background: var(--accent, #ff5672);
  }

  .titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .title {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
    color: var(--ink, #ececf1);
    text-wrap: pretty;
  }

  .subtitle {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon-button {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .icon-button:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .close-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .error {
    min-width: 0;
    font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--status-danger, #f5493d);
  }

  .foot {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-16) var(--space-18);
    border-block-start: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .text-button {
    flex: none;
    padding: var(--space-10) var(--space-14);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
  }

  .text-button:hover {
    background: var(--accent-soft, rgba(255, 86, 114, 0.1));
  }

  .grow {
    flex: 1;
  }

  .card {
    max-width: 520px;
    height: 680px;
  }

  .card.delete {
    max-width: 460px;
    height: auto;
  }

  .badge {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .badge-icon {
    background: var(--ink-2, #b9b9c6);
    mask: var(--icon-users) center/contain no-repeat;
  }

  .badge.danger {
    background: var(--btn-danger-bg, rgba(240, 68, 56, 0.08));
    box-shadow: inset 0 0 0 1px var(--btn-danger-line, rgba(240, 68, 56, 0.5));
  }

  .danger .badge-icon {
    background: var(--status-danger, #f5493d);
    mask: var(--icon-trash) center/contain no-repeat;
  }

  .delete-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-26) var(--space-18) var(--space-26);
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
  }

  .delete-title {
    padding-inline: var(--space-4);
    font: var(--weight-bold) var(--text-xl) / 1.3 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink, #ececf1);
    text-wrap: pretty;
  }

  .danger-ink {
    color: var(--status-danger, #f5493d);
  }

  .delete-text {
    padding-inline: var(--space-4);
    font: var(--weight-regular) var(--text-base) / 1.55 var(--font-sans);
    color: var(--ink-2, #b9b9c6);
    text-wrap: pretty;
  }

  .mention {
    font-family: var(--font-mono);
    color: var(--ink, #ececf1);
  }

  .form {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .name-row {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    padding: var(--space-22) var(--space-18) 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .label {
    padding-inline-start: var(--space-4);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .count {
    font-weight: var(--weight-regular);
    color: var(--ink-4, #7c7c8c);
  }

  .box {
    height: 44px;
    padding: 0 var(--space-14);
    box-sizing: border-box;
    border: none;
    outline: none;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
    font: var(--weight-medium) var(--text-base) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .box.filled {
    box-shadow: inset 0 0 0 1px var(--line-3, rgba(255, 255, 255, 0.22));
  }

  .box.taken {
    box-shadow: inset 0 0 0 1px var(--status-danger, #f5493d);
  }

  .help {
    padding-inline-start: var(--space-4);
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .members {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    padding: var(--space-18) var(--space-18) 0;
  }

  .search-wrap {
    position: relative;
    flex: none;
    z-index: 3;
  }

  .search {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    height: 44px;
    padding: 0 var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .search.focused {
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
  }

  .search-icon {
    flex: none;
    width: 16px;
    height: 16px;
    background: var(--ink-4, #7c7c8c);
    mask: var(--icon-invite) center/contain no-repeat;
  }

  .search input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    outline: none;
    background: transparent;
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .dropdown {
    position: absolute;
    inset-inline: 0;
    top: calc(100% + 6px);
    z-index: 3;
    display: flex;
    flex-direction: column;
    max-height: 260px;
    overflow-y: auto;
    padding: var(--space-6);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--surface-2, #191921);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      var(--shadow-pop, 0 16px 40px rgba(0, 0, 0, 0.55));
  }

  .result {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-height: 52px;
    padding: var(--space-6) var(--space-10);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
    user-select: none;
  }

  .result.hi {
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
  }

  .face {
    flex: none;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-pill);
  }

  .face.small {
    width: 32px;
    height: 32px;
  }

  .who {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .who-name {
    font: var(--weight-semibold) var(--text-base) / 1.25 var(--font-sans);
    color: var(--ink, #e4e4ec);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .who-name.small {
    font-size: var(--text-md);
  }

  .who-handle {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .add-hint {
    flex: none;
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
    opacity: 0;
  }

  .hi .add-hint {
    opacity: 1;
  }

  .no-results {
    padding: var(--space-14) var(--space-10);
    font: var(--weight-regular) var(--text-md) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .picked {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    margin: 0 calc(var(--space-6) * -1);
    padding: 0 var(--space-6) var(--space-14);
    opacity: 1;
    transition: opacity var(--duration-base, 200ms) var(--ease-out);
  }

  .picked.dimmed {
    opacity: 0.55;
  }

  .member {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-height: 56px;
    padding: var(--space-8) var(--space-4);
    box-sizing: border-box;
  }

  .remove-icon {
    width: 14px;
    height: 14px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .empty {
    display: block;
    padding: var(--space-26) var(--space-8);
    text-align: center;
    font: var(--weight-regular) var(--text-md) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .text-button.tall {
    display: flex;
    align-items: center;
    height: 44px;
    padding: 0 var(--space-14);
  }

  .cta {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: 0 var(--space-18);
    height: 44px;
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    cursor: default;
    user-select: none;
  }

  .cta.ok {
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
    cursor: pointer;
  }

  .cta.ok.danger {
    background: var(--status-danger, #f5493d);
    color: #fff;
  }

  .cta:hover {
    filter: brightness(1.08);
  }

  .cta-icon {
    width: 16px;
    height: 16px;
    background: currentColor;
    mask: var(--icon-plus) center/contain no-repeat;
  }

  .cta-icon.save {
    mask: var(--icon-disk) center/contain no-repeat;
  }

  .cta-icon.trash {
    mask: var(--icon-trash) center/contain no-repeat;
  }
</style>
