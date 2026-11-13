/**
 * Extract form controls from Cheerio HTML (no value leakage for password fields).
 */
import { redactActionString, redactSessionTokensInUrl, redactSessionTokensInText } from './redact.js';

export function parseFormFields($) {
  const forms = [];
  $('form').each((fi, form) => {
    const $form = $(form);
    const fields = [];
    $form.find('input, select, textarea, button').each((_, el) => {
      const $el = $(el);
      const tag = el.tagName?.toLowerCase();
      const type = ($el.attr('type') || tag || '').toLowerCase();
      const name = $el.attr('name') || '';
      if (!name && tag !== 'button') return;
      if (type === 'password' || type === 'hidden') {
        fields.push({
          name: name || '(unnamed)',
          type,
          id: $el.attr('id') || null,
          redacted: true,
        });
        return;
      }
      const entry = {
        name: name || $el.attr('id') || '(unnamed)',
        type,
        id: $el.attr('id') || null,
        required: $el.attr('required') != null,
      };
      if (tag === 'select') {
        entry.options = $el
          .find('option')
          .map((__, o) => ({
            value: '[REDACTED]',
            label: '[REDACTED]',
          }))
          .get()
          .filter((o) => o.label);
      }
      if (type === 'checkbox' || type === 'radio') {
        entry.value = '[REDACTED]';
      }
      fields.push(entry);
    });
    const dataAction = $form.attr('data-action') || $form.find('[data-action]').first().attr('data-action');
    const rawAction = $form.attr('action') || null;
    forms.push({
      name: $form.attr('name') || $form.attr('id') || `form_${fi}`,
      action: rawAction ? redactSessionTokensInUrl(redactSessionTokensInText(rawAction)) : null,
      method: ($form.attr('method') || 'GET').toUpperCase(),
      dataAction: dataAction ? redactActionString(dataAction) : null,
      fields,
    });
  });
  return forms;
}

export function parseDataActionLinks($) {
  const links = [];
  $('[data-action]').each((_, el) => {
    const action = $(el).attr('data-action');
    if (!action) return;
    const linkText = $(el).text().trim();
    links.push({
      action: redactActionString(action),
      tag: el.tagName?.toLowerCase(),
      name: $(el).attr('name') || null,
      id: $(el).attr('id') || null,
      text: linkText ? '[REDACTED]' : null,
    });
  });
  return links;
}
