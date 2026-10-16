import { getRelativeLocaleUrl } from 'astro:i18n';
import type { Locale } from './i18n';

/**
 * Itens do menu principal. Cada item tem um `slug` por idioma (URLs localizadas) e
 * uma chave de string de UI para o rótulo. A home usa slug vazio.
 * Build-only (usa astro:i18n) — a lógica pura/testável de i18n fica em `i18n.ts`.
 */
export interface NavItem {
  key: string;
  labelKey: string;
  slugs: Record<Locale, string>;
}

/**
 * Sub-itens (dropdown) de um item do menu, indexados pela `key` do pai. Cada filho
 * tem um `slug` por idioma RELATIVO ao slug da seção pai (ex.: pai `recursos` +
 * filho `analises-e-relatorios` → `/recursos/analises-e-relatorios`). São páginas
 * internas dedicadas. O dropdown de Atuação é gerado da collection `atuacao`; este
 * mapa serve os sub-itens estáticos (ex.: Recursos).
 */
export interface NavChild {
  key: string;
  labelKey: string;
  slugs: Record<Locale, string>;
  /** Imagem de fundo do deck (em public/, sem base). Opcional. */
  cover?: string;
  /** PDF para download (em public/, sem base). Quando presente, o deck vira um
   *  link de download ("Baixar PDF") em vez de abrir a página interna. Opcional. */
  pdf?: string;
  /** Ícone do deck (renderizado por DeckIcon.astro): 'article' | 'book' | … */
  icon?: string;
}

export const NAV_CHILDREN: Record<string, NavChild[]> = {
  resources: [
    {
      key: 'infograficos',
      labelKey: 'navRecursoInfograficos',
      slugs: { pt: 'infograficos', en: 'infographics' },
      pdf: 'recursos/infograficos.pdf',
      icon: 'infografico',
    },
    {
      key: 'podcasts',
      labelKey: 'navRecursoPodcasts',
      slugs: { pt: 'podcasts', en: 'podcasts' },
      pdf: 'recursos/podcasts.pdf',
      icon: 'podcast',
    },
  ],
  publications: [
    {
      key: 'artigos',
      labelKey: 'navPubArtigos',
      slugs: { pt: 'artigos', en: 'articles' },
      icon: 'article',
    },
    { key: 'livros', labelKey: 'navPubLivros', slugs: { pt: 'livros', en: 'books' }, icon: 'book' },
    {
      key: 'analises',
      labelKey: 'navRecursoAnalises',
      slugs: { pt: 'analises-e-relatorios', en: 'analyses-and-reports' },
      cover: 'images/recursos-analises-relatorios.webp',
    },
  ],
};

export const NAV_ITEMS: NavItem[] = [
  { key: 'home', labelKey: 'navAbout', slugs: { pt: '', en: '' } },
  {
    key: 'certifications',
    labelKey: 'navCertifications',
    slugs: { pt: 'certificacoes', en: 'certifications' },
  },
  { key: 'atuacao', labelKey: 'navAtuacao', slugs: { pt: 'atuacao', en: 'expertise' } },
  {
    key: 'publications',
    labelKey: 'navPublicacoes',
    slugs: { pt: 'publicacoes', en: 'publications' },
  },
  { key: 'resources', labelKey: 'navResources', slugs: { pt: 'recursos', en: 'resources' } },
  { key: 'keynotes', labelKey: 'navKeynotes', slugs: { pt: 'keynotes', en: 'keynotes' } },
];

/** URL (base-prefixada) de um item no idioma dado. */
export function navUrl(item: NavItem, locale: Locale): string {
  return getRelativeLocaleUrl(locale, item.slugs[locale]);
}

/** URL da mesma página no outro idioma (preserva a página no toggle de idioma). */
export function counterpartUrl(navKey: string, target: Locale): string {
  const item = NAV_ITEMS.find((i) => i.key === navKey);
  return getRelativeLocaleUrl(target, item ? item.slugs[target] : '');
}

/** URL (base-prefixada) da página de uma área de Atuação, no idioma dado.
 *  O `slug` é o mesmo nos dois idiomas; só muda o prefixo da seção
 *  (`atuacao` em PT, `expertise` em EN). */
export function atuacaoAreaUrl(locale: Locale, slug: string): string {
  const item = NAV_ITEMS.find((i) => i.key === 'atuacao')!;
  return getRelativeLocaleUrl(locale, `${item.slugs[locale]}/${slug}`);
}

/** URL (base-prefixada) de um sub-item (página interna dedicada) no idioma dado. */
export function navChildUrl(parent: NavItem, child: NavChild, locale: Locale): string {
  return getRelativeLocaleUrl(locale, `${parent.slugs[locale]}/${child.slugs[locale]}`);
}
