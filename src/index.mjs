#!/usr/bin/env node
import readline from 'node:readline';

const SERVER_NAME = 'ai-image-merge-mcp';
const SERVER_VERSION = '0.1.0';
const PROTOCOL_VERSION = '2025-06-18';

const baseUrl = (
  process.env.AI_IMAGE_MERGE_API_URL || 'https://aiimagemerge.com'
)
  .trim()
  .replace(/\/+$/, '');

const tools = [
  {
    name: 'merge_images',
    title: 'Merge two images with AI',
    description:
      'Combine exactly two public JPG, PNG, or WebP image URLs into one AI-generated image. The call consumes credits from the configured AI Image Merge account and returns a task id for polling. Website: https://aiimagemerge.com',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        imageUrls: {
          type: 'array',
          minItems: 2,
          maxItems: 2,
          items: { type: 'string', format: 'uri' },
          description: 'Exactly two publicly reachable HTTPS image URLs.',
        },
        prompt: {
          type: 'string',
          minLength: 1,
          maxLength: 2000,
          description: 'Describe how the two images should be combined.',
        },
        preset: {
          type: 'string',
          enum: ['natural', 'people', 'product', 'creative'],
          default: 'natural',
          description: 'Optional merge intent.',
        },
        aspectRatio: {
          type: 'string',
          enum: ['auto', '1:1', '4:5', '16:9'],
          default: 'auto',
          description: 'Optional output aspect ratio.',
        },
      },
      required: ['imageUrls', 'prompt'],
    },
  },
  {
    name: 'get_merge_status',
    title: 'Get image merge status',
    description:
      'Check the status of an image merge task created by merge_images and return the generated image URL when it is ready. Website: https://aiimagemerge.com',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        taskId: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
          description: 'The task id returned by merge_images.',
        },
      },
      required: ['taskId'],
    },
  },
];

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function errorResult(message) {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function requireApiKey() {
  const apiKey = process.env.AI_IMAGE_MERGE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'AI_IMAGE_MERGE_API_KEY is not set. Create an API key in AI Image Merge settings first.'
    );
  }
  return apiKey;
}

function validateBaseUrl() {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error('AI_IMAGE_MERGE_API_URL must be an absolute HTTP(S) URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('AI_IMAGE_MERGE_API_URL must use HTTP or HTTPS');
  }
}

async function callApi(path, body) {
  validateBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${requireApiKey()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(
      `AI Image Merge returned an invalid response (${response.status})`
    );
  }

  if (!response.ok) {
    throw new Error(
      payload.message || `AI Image Merge request failed (${response.status})`
    );
  }
  return payload.data;
}

function asToolResult(data) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

async function handleToolCall(name, args = {}) {
  if (name === 'merge_images') {
    return asToolResult(await callApi('/api/mcp/merge', args));
  }
  if (name === 'get_merge_status') {
    return asToolResult(await callApi('/api/mcp/merge/status', args));
  }
  throw new Error(`Unknown tool: ${name}`);
}

async function handleRequest(request) {
  const id = request.id;
  const method = request.method;

  if (
    method === 'notifications/initialized' ||
    method === 'notifications/cancelled'
  ) {
    return undefined;
  }
  if (method === 'ping') {
    return { id, result: {} };
  }
  if (method === 'initialize') {
    return {
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        instructions:
          'Use merge_images with two public HTTPS image URLs, then poll get_merge_status until status is success, failed, or canceled.',
      },
    };
  }
  if (method === 'tools/list') {
    return { id, result: { tools } };
  }
  if (method === 'resources/list') {
    return { id, result: { resources: [] } };
  }
  if (method === 'prompts/list') {
    return { id, result: { prompts: [] } };
  }
  if (method === 'tools/call') {
    try {
      const params = request.params || {};
      return {
        id,
        result: await handleToolCall(params.name, params.arguments || {}),
      };
    } catch (error) {
      return {
        id,
        result: errorResult(
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  return {
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

let queue = Promise.resolve();
const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

input.on('line', (line) => {
  if (!line.trim()) return;
  queue = queue
    .then(async () => {
      let request;
      try {
        request = JSON.parse(line);
      } catch {
        write({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' },
        });
        return;
      }

      const response = await handleRequest(request);
      if (response && request.id !== undefined) {
        write({ jsonrpc: '2.0', ...response });
      }
    })
    .catch((error) => {
      // Errors are handled per request above; this is only a last-resort guard
      // for unexpected failures in the serialized stdin queue.
      if (line.trim()) {
        write({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
    });
});
