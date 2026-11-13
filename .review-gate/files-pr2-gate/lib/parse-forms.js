/**
 * Extract form controls from Cheerio HTML (no value leakage for password fields).
 */

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
      if (type === 'password') {
        fields.push({ name: name || '(unnamed)', type, redacted: true });
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
            value: $(o).attr('value') ?? '',
            label: $(o).text().trim().slice(0, 80),
          }))
          .get()
          .filter((o) => o.value !== '' || o.label);
      }
      if (type === 'checkbox' || type === 'radio') {
        entry.value = $el.attr('value') || 'on';
      }
      fields.push(entry);
    });
    const dataAction = $form.attr('data-action') || $form.find('[data-action]').first().attr('data-action');
    forms.push({
      name: $form.attr('name') || $form.attr('id') || `form_${fi}`,
      action: $form.attr('action') || null,
      method: ($form.attr('method') || 'GET').toUpperCase(),
      dataAction: dataAction || null,
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
    links.push({
      action,
      tag: el.tagName?.toLowerCase(),
      name: $(el).attr('name') || null,
      id: $(el).attr('id') || null,
      text: $(el).text().trim().slice(0, 60) || null,
    });
  });
  return links;
}
