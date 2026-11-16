// Proxy chuyển stream của n8n (các dòng JSON, chunked) sang SSE chuẩn (text/event-stream)
// để Postman / EventSource / client SSE hiển thị chữ về dần.
//
// Chạy:  node sse-proxy.js
// Gọi:   POST http://localhost:5679/chat   body: {"chatInput": "...", "sessionId": "..."}
//
// Đổi link n8n hoặc cổng bằng biến môi trường N8N_CHAT_URL / PORT.

const http = require('http');

const N8N_CHAT_URL =
	process.env.N8N_CHAT_URL ||
	'http://localhost:5678/webhook/49ff43cd-18ce-41d1-9471-dc4fc80af802/chat';
const PORT = Number(process.env.PORT || 5679);

function readBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		req.on('data', (c) => chunks.push(c));
		req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		req.on('error', reject);
	});
}

function sendEvent(res, event, data) {
	res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

const server = http.createServer(async (req, res) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
	if (req.method === 'OPTIONS') return res.writeHead(204).end();
	if (req.method !== 'POST' || !req.url.startsWith('/chat')) {
		return res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"POST /chat"}');
	}

	let input;
	try {
		input = JSON.parse((await readBody(req)) || '{}');
	} catch {
		return res.writeHead(400, { 'Content-Type': 'application/json' }).end('{"error":"invalid JSON"}');
	}
	const chatInput = input.chatInput ?? input.message ?? input.text ?? input.prompt;
	if (!chatInput) {
		return res.writeHead(400, { 'Content-Type': 'application/json' }).end('{"error":"missing chatInput"}');
	}

	res.writeHead(200, {
		'Content-Type': 'text/event-stream; charset=utf-8',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive',
	});

	const abort = new AbortController();
	res.on('close', () => abort.abort());

	try {
		const upstream = await fetch(N8N_CHAT_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'sendMessage',
				sessionId: input.sessionId || 'sse-proxy',
				chatInput,
			}),
			signal: abort.signal,
		});
		if (!upstream.ok) {
			sendEvent(res, 'error', { status: upstream.status, message: await upstream.text() });
			return res.end();
		}

		const decoder = new TextDecoder();
		let buffer = '';
		const handleLine = (line) => {
			if (!line.trim()) return;
			let evt;
			try {
				evt = JSON.parse(line);
			} catch {
				return sendEvent(res, 'raw', { line });
			}
			if (evt.type === 'item') {
				if (evt.content) sendEvent(res, 'token', { content: evt.content });
			} else if (evt.type === 'error') {
				sendEvent(res, 'error', evt);
			}
		};

		for await (const chunk of upstream.body) {
			buffer += decoder.decode(chunk, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop();
			lines.forEach(handleLine);
		}
		handleLine(buffer);
		sendEvent(res, 'done', {});
	} catch (err) {
		if (!abort.signal.aborted) sendEvent(res, 'error', { message: String(err.message || err) });
	}
	res.end();
});

server.listen(PORT, () => {
	console.log(`SSE proxy: POST http://localhost:${PORT}/chat  ->  ${N8N_CHAT_URL}`);
});
