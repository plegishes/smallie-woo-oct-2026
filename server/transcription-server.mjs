import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT || 8787);
const envFilePath = 'C:\\Users\\bryan\\Dropbox\\Vocal Deals Site Files\\ENVs.txt';

function jsonError(res, status, message) {
  return res.status(status).json({ error: message });
}

async function readGroqApiKey() {
  const fileText = await fs.readFile(envFilePath, 'utf8');
  const match = fileText.match(/^GROQ_API_KEY="?([^"\r\n]+)"?/m);

  if (!match?.[1]) {
    throw new Error('GROQ_API_KEY was not found in the ENVs.txt file.');
  }

  return match[1].trim();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'birthday-audio-transcription' });
});

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return jsonError(res, 400, 'Please upload an audio file before requesting transcription.');
    }

    const apiKey = await readGroqApiKey();
    const formData = new FormData();
    const audioBlob = new Blob([req.file.buffer], {
      type: req.file.mimetype || 'application/octet-stream',
    });

    formData.append('file', audioBlob, req.file.originalname);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'verbose_json');
    formData.append('language', 'en');
    formData.append('temperature', '0');
    formData.append('timestamp_granularities[]', 'word');

    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!groqResponse.ok) {
      const failureBody = await groqResponse.text();
      return jsonError(
        res,
        groqResponse.status,
        failureBody || 'Groq Whisper rejected the transcription request.',
      );
    }

    const payload = await groqResponse.json();
    const words = Array.isArray(payload.words)
      ? payload.words.map((word, index) => ({
          id: `${index}-${word.word ?? 'word'}`,
          word: String(word.word ?? '').trim(),
          start: Number(word.start ?? 0),
          end: Number(word.end ?? word.start ?? 0.55),
        }))
      : [];

    return res.json({
      text: String(payload.text ?? '').trim(),
      duration: Number(payload.duration ?? 0),
      language: String(payload.language ?? 'en'),
      words: words.filter((word) => word.word.length > 0),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown transcription failure.';
    return jsonError(res, 500, message);
  }
});

app.listen(port, () => {
  console.log(`Birthday transcription server listening on http://localhost:${port}`);
});
