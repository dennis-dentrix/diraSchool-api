export const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export function getDocumentHeaderData({ school, settings, title, subtitle, serial, generatedAt }) {
  const schoolName = school?.name || 'School';
  const address = settings?.physicalAddress || school?.address || '';
  const contactBits = [school?.phone, school?.email].filter(Boolean);

  return {
    schoolName,
    logoUrl: settings?.logo || '',
    motto: settings?.motto || '',
    address,
    contact: contactBits.join(' · '),
    title: title || '',
    subtitle: subtitle || '',
    serial: serial || '',
    generatedAt: generatedAt || '',
  };
}

export function getDocumentHeaderCss() {
  return `
    .doc-header{border:1px solid #d7deea;border-radius:10px;padding:12px 14px;margin:0 0 12px;}
    .doc-header-top{display:flex;gap:12px;align-items:flex-start}
    .doc-header-logo{width:56px;height:56px;object-fit:contain;border:1px solid #e5e7eb;border-radius:8px;padding:4px;background:#fff}
    .doc-header-school{flex:1}
    .doc-school-name{font-size:16px;font-weight:700;line-height:1.25;margin:0}
    .doc-motto{font-size:12px;font-style:italic;color:#4b5563;margin:2px 0 0}
    .doc-meta{font-size:11px;color:#374151;margin:4px 0 0}
    .doc-title-wrap{text-align:right;min-width:200px}
    .doc-title{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin:0}
    .doc-subtitle{font-size:14px;font-weight:700;margin:2px 0 0}
    .doc-serial{font-size:11px;color:#111827;margin:4px 0 0}
    .doc-generated{font-size:11px;color:#6b7280;margin:2px 0 0}
  `;
}

export function buildDocumentHeaderHtml(headerData) {
  const data = headerData || {};
  return `
    <header class="doc-header">
      <div class="doc-header-top">
        ${data.logoUrl ? `<img class="doc-header-logo" src="${escapeHtml(data.logoUrl)}" alt="School logo" />` : ''}
        <div class="doc-header-school">
          <p class="doc-school-name">${escapeHtml(data.schoolName || 'School')}</p>
          ${data.motto ? `<p class="doc-motto">"${escapeHtml(data.motto)}"</p>` : ''}
          ${data.contact ? `<p class="doc-meta">${escapeHtml(data.contact)}</p>` : ''}
          ${data.address ? `<p class="doc-meta">${escapeHtml(data.address)}</p>` : ''}
        </div>
        <div class="doc-title-wrap">
          ${data.title ? `<p class="doc-title">${escapeHtml(data.title)}</p>` : ''}
          ${data.subtitle ? `<p class="doc-subtitle">${escapeHtml(data.subtitle)}</p>` : ''}
          ${data.serial ? `<p class="doc-serial">Serial: <strong>${escapeHtml(data.serial)}</strong></p>` : ''}
          ${data.generatedAt ? `<p class="doc-generated">Generated: ${escapeHtml(data.generatedAt)}</p>` : ''}
        </div>
      </div>
    </header>
  `;
}
