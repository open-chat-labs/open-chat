<!-- Renders the text for a resource key through the host's translator (setI18n) — just the text, no element of its
     own, so it inherits whatever it's placed in. Use it as a child: <Button><Translate key="ui.common.save" /></Button>
     style slots, or inside your own markup. Props that take copy (Button label …) accept a key directly. -->
<script lang="ts">
  import { useT, type I18nParams } from '../i18n';

  interface Props {
    /** Resource key, e.g. 'ui.common.cancel'. Text that isn't a key renders as itself. */
    key: string;
    /** Values for `{placeholder}`s in the message. */
    params?: I18nParams;
  }

  let { key, params }: Props = $props();
  const t = useT();
</script>

{t(key, params)}
