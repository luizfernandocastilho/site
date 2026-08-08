import nodemailer, { type Transporter } from 'nodemailer';
import { config } from './config.js';

let transport: Transporter | null = null;
function getTransport(): Transporter | null {
  if (transport) return transport;
  if (!config.smtp.host) return null; // modo dev: sem SMTP, apenas loga
  transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return transport;
}

interface DownloadEmail {
  to: string;
  name: string;
  fileTitle: string;
  url: string;
  locale: 'pt' | 'en';
}

export async function sendDownloadLink(msg: DownloadEmail): Promise<void> {
  const pt = msg.locale === 'pt';
  const subject = pt ? `Seu download: ${msg.fileTitle}` : `Your download: ${msg.fileTitle}`;
  const greeting = pt ? `Olá, ${msg.name}` : `Hello, ${msg.name}`;
  const line = pt
    ? `Aqui está o link para baixar “${msg.fileTitle}”:`
    : `Here is your link to download “${msg.fileTitle}”:`;
  const note = pt
    ? 'O link é pessoal e expira em alguns dias.'
    : 'This link is personal and expires in a few days.';
  const btnLabel = pt ? 'Baixar o arquivo' : 'Download the file';
  const siteHost = config.siteUrl.replace(/^https?:\/\//, '');
  const footer = pt
    ? `Você recebeu este e-mail porque solicitou um download em ${siteHost}.`
    : `You received this email because you requested a download at ${siteHost}.`;
  const text = `${greeting},\n\n${line}\n${msg.url}\n\n${note}\n\n— Luiz Castilho · ${siteHost}`;
  // HTML enxuto, com marca; estilos inline (clientes de e-mail ignoram CSS externo).
  const html = `<div style="margin:0;padding:24px;background:#f4f6f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c211f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e6e4;border-radius:10px;overflow:hidden">
    <tr><td style="height:4px;background:#2f7a3a;font-size:0;line-height:0">&nbsp;</td></tr>
    <tr><td style="padding:28px 32px 8px">
      <p style="margin:0 0 16px;font-size:16px">${greeting},</p>
      <p style="margin:0 0 22px;font-size:16px;line-height:1.5">${line}</p>
      <p style="margin:0 0 22px">
        <a href="${msg.url}" style="display:inline-block;background:#2f7a3a;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:12px 22px;border-radius:8px">${btnLabel}</a>
      </p>
      <p style="margin:0 0 6px;color:#55605a;font-size:13px;line-height:1.5">${note}</p>
      <p style="margin:0;color:#8a938e;font-size:12px;word-break:break-all">${msg.url}</p>
    </td></tr>
    <tr><td style="padding:18px 32px 26px;border-top:1px solid #eef1f0">
      <p style="margin:0;color:#8a938e;font-size:12px;line-height:1.5">— Luiz Castilho · ${footer}</p>
    </td></tr>
  </table>
</div>`;

  const t = getTransport();
  if (!t) {
    // Sem SMTP configurado (dev): registra o link para inspeção/teste.
    console.log(`[mailer:dev] → ${msg.to} | ${subject} | ${msg.url}`);
    return;
  }
  await t.sendMail({ from: config.smtp.from, to: msg.to, subject, text, html });
}
