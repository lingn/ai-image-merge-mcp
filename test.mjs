import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const child = spawn(process.execPath, [path.join(directory, 'src/index.mjs')], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';
child.stdout.on('data', (chunk) => {
  stdout += chunk;
});
child.stderr.on('data', (chunk) => {
  stderr += chunk;
});

child.stdin.end(
  [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
  ]
    .map((message) => JSON.stringify(message))
    .join('\n') + '\n'
);

const exitCode = await new Promise((resolve) => {
  child.on('close', resolve);
});

assert.equal(exitCode, 0, stderr);
const responses = stdout
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));
assert.equal(responses.length, 2);
assert.equal(responses[0].result.serverInfo.name, 'ai-image-merge-mcp');
assert.deepEqual(
  responses[1].result.tools.map((tool) => tool.name),
  ['merge_images', 'get_merge_status']
);

console.log('MCP stdio protocol test passed');
