import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COVERS_DIR = path.resolve(__dirname, '../../cache/covers');
const RESIZED_DIR = path.resolve(COVERS_DIR, 'resized');

const router = Router();

router.get('/:filename', async (req, res) => {
  const { filename } = req.params;
  const size = parseInt(req.query.size as string);

  // Security: sanitize filename to prevent path traversal
  const safeFilename = path.basename(filename);
  const sourcePath = path.join(COVERS_DIR, safeFilename);

  if (!fs.existsSync(sourcePath)) return res.status(404).send('Not found');

  if (size && size <= 300) {
    const targetDir = path.join(RESIZED_DIR, size.toString());
    const targetPath = path.join(targetDir, safeFilename);

    if (fs.existsSync(targetPath)) return res.sendFile(targetPath);

    try {
      fs.mkdirSync(targetDir, { recursive: true });
      await sharp(sourcePath).resize(size, size, { fit: 'cover' }).toFile(targetPath);
      return res.sendFile(targetPath);
    } catch (e) {
      console.error('Sharp resize failed', e);
    }
  }

  res.sendFile(sourcePath);
});

export default router;
