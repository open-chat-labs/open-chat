<!-- The OpenChat logo, drawn inline: there is no asset for the host to serve, so it shows on any route and under any
     base path. Decorative unless `label` names it. -->
<script lang="ts">
  import { useT } from '../i18n';
  interface Props {
    size?: number;
    /** Accessible name: resource key (or literal text). Without it the logo is decorative. */
    label?: string;
  }

  let { size = 32, label }: Props = $props();
  const t = useT();
  // per instance: logos sharing gradient ids would all paint from the first, and lose their fill if it's hidden
  const id = $props.id();
</script>

<svg
  class="logo"
  width={size}
  height={size}
  viewBox="0 0 32 32"
  fill="none"
  role={label ? 'img' : undefined}
  aria-label={label ? t(label) : undefined}
  aria-hidden={label ? undefined : 'true'}
>
  <path
    fill-rule="evenodd"
    clip-rule="evenodd"
    d="M16.0078 0C24.8443 0 32.0078 7.16342 32.0078 16C32.0078 24.8365 24.8443 31.9999 16.0078 31.9999C7.17124 31.9999 0.0078125 24.8365 0.0078125 16C0.0078229 7.16343 7.17125 2.16966e-05 16.0078 0ZM16.0078 7.11106C11.0986 7.11106 7.11888 11.0908 7.11887 16C7.11887 20.9091 11.0986 24.8888 16.0078 24.8888C20.917 24.8888 24.8967 20.9091 24.8967 16C24.8966 11.0908 20.9169 7.11106 16.0078 7.11106Z"
    fill="url(#{id}-ring)"
  />
  <path
    d="M25.2343 2.92687C29.3321 5.82424 32.0078 10.5996 32.0078 16C32.0078 21.4009 29.3316 26.1766 25.2331 29.0739L21.0728 23.3054C23.3837 21.7002 24.8967 19.0268 24.8967 16C24.8967 12.9558 23.3664 10.2692 21.0332 8.6671L25.2343 2.92687Z"
    fill="url(#{id}-arc)"
  />
  <defs>
    <linearGradient id="{id}-ring" x1="16.0078" y1="0" x2="16.0078" y2="31.9999" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FBB03B" />
      <stop offset="1" stop-color="#F05A24" />
    </linearGradient>
    <linearGradient id="{id}-arc" x1="16.0078" y1="0" x2="16.0078" y2="31.9999" gradientUnits="userSpaceOnUse">
      <stop stop-color="#ED1E79" />
      <stop offset="1" stop-color="#5F2583" />
    </linearGradient>
  </defs>
</svg>

<style>
  .logo {
    flex: none;
    display: block;
  }
</style>
