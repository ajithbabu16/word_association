import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function imageUploadPlugin() {
  return {
    name: 'image-upload-and-pdf-api',
    configureServer(server) {
      // 1. Upload Images API Endpoint
      server.middlewares.use('/api/upload-images', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        try {
          const chunks = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          const body = Buffer.concat(chunks).toString('utf8');
          const data = JSON.parse(body);

          const files = data.files || [];
          if (!Array.isArray(files) || files.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'No files provided' }));
          }

          const publicImgDir = path.join(__dirname, 'public/puzzle_image');
          const rootImgDir = path.join(__dirname, '../puzzle_image');
          const manifestPath = path.join(__dirname, 'public/existing_images.json');

          if (!fs.existsSync(publicImgDir)) fs.mkdirSync(publicImgDir, { recursive: true });
          if (!fs.existsSync(rootImgDir)) {
            try { fs.mkdirSync(rootImgDir, { recursive: true }); } catch {}
          }

          const savedFiles = [];

          for (const item of files) {
            const safeName = path.basename(item.name);
            const base64Data = item.data.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');

            const publicDest = path.join(publicImgDir, safeName);
            fs.writeFileSync(publicDest, buffer);

            try {
              const rootDest = path.join(rootImgDir, safeName);
              fs.writeFileSync(rootDest, buffer);
            } catch {}

            savedFiles.push(safeName);
          }

          // Update existing_images.json
          const allPngFiles = fs.readdirSync(publicImgDir)
            .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

          fs.writeFileSync(manifestPath, JSON.stringify(allPngFiles, null, 2));

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            savedCount: savedFiles.length,
            savedFiles,
            totalImages: allPngFiles.length
          }));
        } catch (err) {
          console.error('[Upload API] Error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Upload failed' }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), imageUploadPlugin()],
});
