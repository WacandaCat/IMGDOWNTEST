import JSZip from 'jszip';

function sanitizeFilename(name = 'download.bin') {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '-');
}

function inferContentType(url, fallback = 'application/octet-stream') {
  const lower = url.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return fallback;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 50) : [];
    if (!items.length) return res.status(400).send('No items selected');

    const fetched = await Promise.all(items.map(async (item, index) => {
      const url = String(item?.url || '');
      const filename = sanitizeFilename(item?.filename || `image-${index + 1}.bin`);
      if (!/^https?:\/\//i.test(url)) throw new Error('Invalid URL');

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch source file: ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      const type = response.headers.get('content-type') || inferContentType(url);
      return { filename, buffer, type };
    }));

    if (fetched.length === 1) {
      const file = fetched[0];
      res.setHeader('Content-Type', file.type);
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      return res.status(200).send(file.buffer);
    }

    const zip = new JSZip();
    fetched.forEach((file) => zip.file(file.filename, file.buffer));
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="slbs-images.zip"');
    return res.status(200).send(zipBuffer);
  } catch (error) {
    return res.status(500).send(error.message || 'Download build failed');
  }
}
