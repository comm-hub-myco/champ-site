(function () {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const form = document.getElementById('gallery-submit-form');
  const resultEl = document.getElementById('gallery-submit-result');
  if (!form) return;

  const MAX_BYTES = 5 * 1024 * 1024; // 5MB
  const MIN_RATIO = 0.45;  // h/w between 0.5 and 2 -> roughly not skinnier than 2:1
  const MAX_RATIO = 2.25;
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
  ];

  function setStatus(msg, type) {
    resultEl.textContent = msg;
    resultEl.classList.remove('success', 'error');
    if (type) resultEl.classList.add(type);
  }

  function readConfig() {
    return fetch('../../data/site-config.json')
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }

  function slugify(str) {
    return (str || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 48) || 'image';
  }

  function getExtension(mime) {
    switch (mime) {
      case 'image/jpeg':
      case 'image/jpg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/gif':
        return 'gif';
      case 'image/webp':
        return 'webp';
      case 'image/heic':
        return 'heic';
      case 'image/heif':
        return 'heif';
      default:
        return 'bin';
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onload = () => {
        const result = reader.result;
        // result is "data:image/xxx;base64,ABC..."
        const comma = String(result).indexOf(',');
        if (comma === -1) return reject(new Error('Invalid data URL'));
        resolve(String(result).slice(comma + 1));
      };
      reader.readAsDataURL(file);
    });
  }

  function getImageDimensions(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        URL.revokeObjectURL(url);
        resolve({ width: w, height: h });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read image dimensions'));
      };
      img.src = url;
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('', null);

    const fd = new FormData(form);
    const file = fd.get('photo');

    if (!file || !file.size) {
      setStatus('Please select an image to upload.', 'error');
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      setStatus(
        'Unsupported file type. Please use JPG, PNG, GIF, WebP, HEIC, or HEIF.',
        'error'
      );
      return;
    }

    if (file.size > MAX_BYTES) {
      setStatus('File is too large. Please keep it under 5 MB.', 'error');
      return;
    }

    // Dimension & ratio check
    try {
      const { width, height } = await getImageDimensions(file);
      if (!width || !height) {
        setStatus('Could not determine image dimensions.', 'error');
        return;
      }
      const ratio = width / height;
      if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
        setStatus(
          'Image aspect ratio is too extreme. Please avoid very tall or ultra-wide panoramas.',
          'error'
        );
        return;
      }
    } catch (err) {
      console.warn(err);
      setStatus('Could not read image dimensions.', 'error');
      return;
    }

    const name = fd.get('name')?.toString().trim() || '';
    const date = fd.get('date')?.toString().trim() || '';
    const description = fd.get('description')?.toString().trim() || '';
    const tagsRaw = fd.get('tags')?.toString().trim() || '';
    const tags = tagsRaw
      ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    setStatus('Preparing upload...', null);

    let config = await readConfig();
    if (!config || !config.gallerySubmission || !config.gallerySubmission.endpoint) {
      setStatus(
        'Gallery submission endpoint is not configured. Please contact the <BasidiomyCody@gmail.com>.',
        'error'
      );
      return;
    }

    const endpoint = config.gallerySubmission.endpoint;

    try {
      const base64 = await fileToBase64(file);
      const ext = getExtension(file.type);

      const now = new Date();
      const isoDate = date || now.toISOString().slice(0, 10);
      const idSlug = slugify(description || name || 'champ-image');
      const timestamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
      const id = `${isoDate}-${timestamp}-${idSlug}`;

      setStatus('Uploading image to gallery...', null);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          base64,
          ext,
          mime: file.type.toLowerCase(),
          description,
          tags,
          date: isoDate,
          submitted_by: name
        })
      });

      if (!res.ok) {
        const text = await res.text();
        console.warn('Gallery backend error', res.status, text);
        setStatus(
          'Upload failed on the server side. Please try again later.',
          'error'
        );
        return;
      }

      const data = await res.json();
      if (!data.ok) {
        setStatus(
          data.error || 'Upload did not complete successfully.',
          'error'
        );
        return;
      }

      setStatus(
        'Success! Your photo was submitted to the gallery and should appear after processing.',
        'success'
      );
      form.reset();
    } catch (err) {
      console.error(err);
      setStatus(
        'Something went wrong while uploading. Please try again.',
        'error'
      );
    }
  });
})();
