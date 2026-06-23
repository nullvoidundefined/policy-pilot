/**
 * Remark plugin that converts inline `[N]` citation markers in answer text into
 * `<cite>` nodes, so react-markdown can render them as interactive citation
 * badges instead of leaving the brackets as literal text.
 */

const CITATION_PATTERN = /\[(\d+)\]/g;

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: { hName?: string };
}

function buildCitationNode(indexText: string): MarkdownNode {
  return {
    type: 'citation',
    data: { hName: 'cite' },
    children: [{ type: 'text', value: indexText }],
  };
}

function splitTextNode(node: MarkdownNode): MarkdownNode[] {
  const value = node.value ?? '';
  const segments: MarkdownNode[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(CITATION_PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ type: 'text', value: value.slice(lastIndex, start) });
    }
    segments.push(buildCitationNode(match[1]!));
    lastIndex = start + match[0].length;
  }

  if (segments.length === 0) {
    return [node];
  }
  if (lastIndex < value.length) {
    segments.push({ type: 'text', value: value.slice(lastIndex) });
  }
  return segments;
}

function transformChildren(node: MarkdownNode): void {
  if (!node.children) {
    return;
  }

  const nextChildren: MarkdownNode[] = [];
  for (const child of node.children) {
    if (child.type === 'text') {
      nextChildren.push(...splitTextNode(child));
    } else {
      transformChildren(child);
      nextChildren.push(child);
    }
  }
  node.children = nextChildren;
}

export function remarkCitations() {
  return function transform(tree: MarkdownNode): void {
    transformChildren(tree);
  };
}
