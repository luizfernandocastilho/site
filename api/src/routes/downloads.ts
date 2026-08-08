import type { FastifyInstance } from 'fastify';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config.js';
import { query } from '../db.js';
import { generateToken, hashToken } from '../tokens.js';
import {
  cleanFileId,
  cleanName,
  isTruthyConsent,
  isValidEmail,
  normalizeLocale,
} from '../validation.js';
import { sendDownloadLink } from '../mailer.js';
import { trackEvent } from '../umami.js';
import { confirmationPage, errorPage } from '../views.js';

interface FileRow {
  id: string;
  title: string;
  filename: string;
  mime: string;
}

interface LeadRow {
  id: string;
  file_id: string;
  filename: string;
  mime: string;
  title: string;
  token_expires_at: Date;
  downloaded_at: Date | null;
}

export async function downloadRoutes(app: FastifyInstance): Promise<void> {
  // Solicitação: valida, grava o lead, gera token e envia o link por e-mail.
  app.post('/downloads/request', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const locale = normalizeLocale(body.locale);
    const fileId = cleanFileId(body.file_id);
    const name = cleanName(body.name);
    const email = isValidEmail(body.email) ? body.email.trim().toLowerCase() : null;
    const consent = isTruthyConsent(body.consent);

    if (!fileId || !name || !email || !consent) {
      const msg =
        locale === 'pt'
          ? 'Preencha nome, e-mail válido e aceite o consentimento.'
          : 'Please provide name, a valid email and accept the consent.';
      return reply.code(400).type('text/html').send(errorPage(locale, msg));
    }

    const { rows } = await query<FileRow>(
      'SELECT id, title, filename, mime FROM files WHERE id = $1',
      [fileId],
    );
    const file = rows[0];
    if (!file) {
      const msg = locale === 'pt' ? 'Arquivo não encontrado.' : 'File not found.';
      return reply.code(404).type('text/html').send(errorPage(locale, msg));
    }

    const token = generateToken();
    const expires = new Date(Date.now() + config.tokenTtlHours * 3_600_000);
    await query(
      `INSERT INTO download_leads (file_id, file_title, name, email, token_hash, token_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [file.id, file.title, name, email, hashToken(token), expires],
    );

    const url = `${config.publicBaseUrl}/downloads/${token}`;
    try {
      await sendDownloadLink({ to: email, name, fileTitle: file.title, url, locale });
    } catch (err) {
      // O lead já está salvo; não expomos o detalhe ao usuário.
      request.log.error({ err }, 'falha ao enviar e-mail do download');
    }

    return reply.type('text/html').send(confirmationPage(locale, config.siteUrl));
  });

  // Entrega: valida o token e serve o arquivo do storage privado.
  app.get<{ Params: { token: string } }>('/downloads/:token', async (request, reply) => {
    const tokenHash = hashToken(request.params.token);
    const { rows } = await query<LeadRow>(
      `SELECT l.id, l.file_id, l.token_expires_at, l.downloaded_at, f.filename, f.mime, f.title
         FROM download_leads l
         JOIN files f ON f.id = l.file_id
        WHERE l.token_hash = $1`,
      [tokenHash],
    );
    const lead = rows[0];
    if (!lead) {
      return reply.code(404).type('text/html').send(errorPage('pt', 'Link inválido.'));
    }
    if (new Date(lead.token_expires_at).getTime() < Date.now()) {
      return reply
        .code(410)
        .type('text/html')
        .send(errorPage('pt', 'Link expirado. Solicite o download novamente.'));
    }

    const path = join(config.storageDir, lead.filename);
    try {
      await stat(path);
    } catch {
      return reply.code(404).type('text/html').send(errorPage('pt', 'Arquivo indisponível.'));
    }

    if (!lead.downloaded_at) {
      await query('UPDATE download_leads SET downloaded_at = now() WHERE id = $1', [lead.id]);
      // Fecha o funil: evento server-side de conclusão (fire-and-forget; no-op sem Umami).
      trackEvent('download-complete', { file: lead.file_id });
    }
    reply.header('Content-Type', lead.mime);
    reply.header('Content-Disposition', `attachment; filename="${lead.filename}"`);
    return reply.send(createReadStream(path));
  });
}
