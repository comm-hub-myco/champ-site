(function () {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const form = document.getElementById('add-event-form');
  const resultEl = document.getElementById('add-event-result');

  if (!form) return;

  function slugify(str) {
    return (str || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 60) || 'event';
  }

  function buildFileName(dateStr, title) {
    // Expect dateStr in yyyy-mm-dd
    const safeDate = dateStr || '9999-12-31';
    const slug = slugify(title);
    return `${safeDate}-${slug}.txt`;
  }

  function buildFileContent(values) {
    const lines = [];
    if (values.title) lines.push(`Title: ${values.title}`);
    if (values.date) lines.push(`Date: ${values.date}`);
    if (values.time) lines.push(`Time: ${values.time}`);
    if (values.location) lines.push(`Location: ${values.location}`);
    if (values.description) lines.push(`Description: ${values.description}`);
    if (values.link) lines.push(`Link: ${values.link}`);
    if (values.contact) lines.push(`Contact: ${values.contact}`);
    return lines.join('\n') + '\n';
  }

  function downloadFile(fileName, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function trySubmitToBackend(fileName, content) {
  try {
    const configRes = await fetch('../data/site-config.json');
    if (!configRes.ok) {
      console.warn('[AddEvent] Could not load site-config.json');
      return { ok: false, message: 'Config not available' };
    }
    const config = await configRes.json();
    const endpoint = config.eventSubmission && config.eventSubmission.endpoint;
    if (!endpoint) {
      console.warn('[AddEvent] eventSubmission.endpoint not configured');
      return { ok: false, message: 'No backend endpoint configured' };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, content })
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn('[AddEvent] Backend error:', res.status, text);
      return { ok: false, message: 'Backend rejected the event' };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    console.warn('[AddEvent] Backend submission failed', e);
    return { ok: false, message: 'Request failed' };
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  resultEl.textContent = '';

  const fd = new FormData(form);
  const values = {
    title: fd.get('title')?.toString().trim(),
    date: fd.get('date')?.toString().trim(),
    time: fd.get('time')?.toString().trim(),
    location: fd.get('location')?.toString().trim(),
    description: fd.get('description')?.toString().trim(),
    link: fd.get('link')?.toString().trim(),
    contact: fd.get('contact')?.toString().trim()
  };

  if (!values.title || !values.date) {
    resultEl.textContent = 'Please provide at least a title and a date.';
    resultEl.classList.remove('success');
    resultEl.classList.add('error');
    return;
  }

  const fileName = buildFileName(values.date, values.title);
  const content = buildFileContent(values);

  // Optionally still download for user’s own record:
  // downloadFile(fileName, content);

  const backendResult = await trySubmitToBackend(fileName, content);

  if (backendResult.ok) {
    resultEl.textContent = `Event submitted! It should appear on the calendar shortly as: ${fileName}`;
    resultEl.classList.remove('error');
    resultEl.classList.add('success');
    form.reset();
  } else {
    resultEl.textContent = `Could not automatically submit event: ${backendResult.message}. You can still send this file to a maintainer manually.`;
    resultEl.classList.remove('success');
    resultEl.classList.add('error');

    // Fallback: offer download for manual process
    downloadFile(fileName, content);
  }
});
})();