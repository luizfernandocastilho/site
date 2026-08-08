import { resolve } from 'node:path';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return v;
}

const stripSlash = (u: string) => u.replace(/\/+$/, '');

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  databaseUrl: required('DATABASE_URL'),
  appSecret: required('APP_SECRET'),
  // Origem pública da própria API (para montar o link do download no e-mail).
  publicBaseUrl: stripSlash(process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000'),
  // Site (para CORS/redirects e identidade do e-mail).
  siteUrl: stripSlash(process.env.SITE_URL ?? 'https://www.luizcastilho.com'),
  tokenTtlHours: Number(process.env.TOKEN_TTL_HOURS ?? 168), // 7 dias
  adminToken: process.env.ADMIN_TOKEN ?? '',
  storageDir: process.env.STORAGE_DIR ?? resolve(process.cwd(), 'storage'),
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'Luiz Castilho <no-reply@luizcastilho.com>',
  },
  // Analytics Umami (opcional): evento server-side `download-complete`. Vazio = desligado.
  umami: {
    host: stripSlash(process.env.UMAMI_HOST ?? ''),
    websiteId: process.env.UMAMI_WEBSITE_ID ?? '',
  },
};

export type Config = typeof config;
