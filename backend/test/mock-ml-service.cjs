const http = require('node:http');

const port = Number(process.env.MOCK_ML_PORT ?? 8999);
const mode = process.env.MOCK_ML_MODE ?? 'success';

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    if (mode === 'loading') {
      return json(response, 503, { status: 'loading', model_version: 'mock-model', model_loaded: false });
    }
    return json(response, 200, { status: 'ok', model_version: 'mock-model', model_loaded: true });
  }

  if (request.method === 'GET' && request.url === '/model-info') {
    return json(response, 200, {
      model_version: 'mock-model',
      whisper_version: 'tiny',
      features: ['mock_feature'],
      model_loaded: mode !== 'loading',
      trained_at: null,
      metrics: null,
    });
  }

  if (request.method === 'POST' && request.url === '/evaluate') {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > 25 * 1024 * 1024) {
        json(response, 413, { error_code: 'ML_BAD_REQUEST', message: 'Mock request is too large' });
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (response.writableEnded) return;
      if (mode === 'unavailable') {
        return json(response, 503, { error_code: 'ML_SERVICE_ERROR', message: 'Configured mock failure' });
      }
      const body = Buffer.concat(chunks).toString('latin1');
      const submissionId = /name="submission_id"\r\n\r\n([^\r\n]+)/.exec(body)?.[1];
      if (!submissionId) {
        return json(response, 400, { error_code: 'ML_BAD_REQUEST', message: 'submission_id is required' });
      }
      if (mode === 'invalid-response') {
        return json(response, 200, { submission_id: submissionId, score: 101 });
      }
      return json(response, 200, {
        submission_id: submissionId,
        score: 85,
        model_version: 'mock-model',
        whisper_version: 'tiny',
        processing_ms: 1,
        details: { mock_score: 85 },
      });
    });
    return;
  }

  return json(response, 404, { error_code: 'NOT_FOUND', message: 'Mock endpoint not found' });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Local mock ML service listening on http://127.0.0.1:${port} (mode=${mode})`);
});
