# AI Image Merge MCP

An MCP server for [AI Image Merge](https://aiimagemerge.com). It exposes the product's real image-combination workflow to MCP clients such as Claude Desktop, Cursor, and other compatible agents.

Website: https://aiimagemerge.com

## Tools

- `merge_images`: submit exactly two public HTTPS JPG, PNG, or WebP URLs and receive a task id.
- `get_merge_status`: poll a task and receive the generated image URL when it is ready.

The remote service downloads and validates the images, stores them under the authenticated user's storage path, reserves credits, and invokes the configured AI provider. The MCP server never contains an AI provider secret.

## Setup

1. Sign in to [AI Image Merge](https://aiimagemerge.com).
2. Open Settings → API Keys and create a key.
3. Configure the MCP client with:

```json
{
  "mcpServers": {
    "ai-image-merge": {
      "command": "npx",
      "args": ["-y", "ai-image-merge-mcp"],
      "env": {
        "AI_IMAGE_MERGE_API_KEY": "sk-..."
      }
    }
  }
}
```

For a local checkout, replace the command with `node` and the absolute path to `src/index.mjs`.

Optional environment variable:

```text
AI_IMAGE_MERGE_API_URL=https://aiimagemerge.com
```

## Image requirements

The first version accepts two publicly reachable HTTPS image URLs. Each image must be JPG, PNG, or WebP and no larger than 10 MB. Private IPs, localhost, non-HTTPS URLs, and unsupported content types are rejected.

## Development

Run the server directly:

```bash
AI_IMAGE_MERGE_API_KEY=sk-... node src/index.mjs
```

The process speaks newline-delimited JSON-RPC over stdio and keeps stdout reserved for MCP messages.

Run the local protocol smoke test with `npm test`.

## Release and LobeHub listing

This directory is intended to become the root of a separate public GitHub repository, for example `lingn/ai-image-merge-mcp`. After creating that repository and publishing the package to npm, log in to LobeHub and publish the repository with the included manifest:

```bash
npm publish --access public
npx -y @lobehub/market-cli login
npx -y @lobehub/market-cli github connect
npx -y @lobehub/market-cli plugin publish https://github.com/lingn/ai-image-merge-mcp --dir /absolute/path/to/ai-image-merge-mcp
```

`login` and `github connect` open a browser and require the repository owner to complete authorization. The listing's homepage points to `https://aiimagemerge.com`.
