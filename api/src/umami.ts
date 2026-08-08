import { config } from './config.js';

/** Hostname do site, para o payload do Umami. */
function siteHostname(): string {
  try {
    return new URL(config.siteUrl).hostname;
  } catch {
    return 'www.luizcastilho.com';
  }
}

/**
 * Dispara um evento **server-side** para o Umami (fire-and-forget). No-op se
 * `UMAMI_HOST`/`UMAMI_WEBSITE_ID` não estiverem configurados. Nunca lança nem
 * bloqueia o chamador — usado para registrar `download-complete` sem afetar o
 * download em si.
 *
 * Nota: por ser server-side, é uma contagem de eventos (sessão do servidor, não
 * a do visitante); no Umami aparece em *Events* para comparar com `download-submit`.
 */
export function trackEvent(name: string, data?: Record<string, unknown>): void {
  const { host, websiteId } = config.umami;
  if (!host || !websiteId) return;
  const body = {
    type: 'event',
    payload: {
      website: websiteId,
      hostname: siteHostname(),
      name,
      ...(data ? { data } : {}),
    },
  };
  // O Umami DESCARTA eventos cujo User-Agent parece "bot" (checagem isbot) — devolve
  // `{"beep":"boop"}` e ignora. Por isso usamos um UA de navegador aqui, para o evento
  // server-side ser efetivamente registrado.
  fetch(`${host}/api/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
    body: JSON.stringify(body),
  }).catch((err: unknown) => {
    console.warn('[umami] falha ao enviar evento:', err instanceof Error ? err.message : err);
  });
}
