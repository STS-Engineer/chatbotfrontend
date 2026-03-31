import type { ReactNode } from "react";

type Props = {
  content: string;
};

type MessageBlock =
  | {
      type: "heading";
      level: number;
      text: string;
    }
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "list";
      ordered: boolean;
      items: MessageListItem[];
    };

type MessageListItem = {
  text: string;
  children: MessageBlock[];
};

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;
const ORDERED_PATTERN = /^(\d+)\.\s+(.*)$/;
const BULLET_PATTERN = /^[-*]\s+(.*)$/;
const INLINE_PATTERN =
  /(\*\*.+?\*\*|__.+?__|`.+?`|\*[^*\n][^*\n]*\*|_[^_\n][^_\n]*_)/g;

const isBlank = (line: string) => line.trim().length === 0;

const parseParagraph = (
  lines: string[],
  startIndex: number,
  shouldStop: (trimmedLine: string) => boolean,
) => {
  const parts: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const trimmedLine = lines[index].trim();

    if (!trimmedLine) {
      if (parts.length > 0) {
        index += 1;
        break;
      }

      index += 1;
      continue;
    }

    if (shouldStop(trimmedLine)) {
      break;
    }

    parts.push(trimmedLine);
    index += 1;
  }

  return {
    block: {
      type: "paragraph",
      text: parts.join(" "),
    } satisfies MessageBlock,
    nextIndex: index,
  };
};

const parseBulletList = (lines: string[], startIndex: number) => {
  const items: MessageListItem[] = [];
  let index = startIndex;

  while (index < lines.length) {
    while (index < lines.length && isBlank(lines[index])) {
      index += 1;
    }

    const match = BULLET_PATTERN.exec(lines[index]?.trim() ?? "");

    if (!match) {
      break;
    }

    index += 1;
    const children: MessageBlock[] = [];

    while (index < lines.length) {
      const trimmedLine = lines[index].trim();

      if (!trimmedLine) {
        index += 1;
        continue;
      }

      if (BULLET_PATTERN.test(trimmedLine) || ORDERED_PATTERN.test(trimmedLine)) {
        break;
      }

      if (HEADING_PATTERN.test(trimmedLine)) {
        const headingMatch = HEADING_PATTERN.exec(trimmedLine);

        if (headingMatch) {
          children.push({
            type: "heading",
            level: headingMatch[1].length,
            text: headingMatch[2].trim(),
          });
          index += 1;
        }
        continue;
      }

      const { block, nextIndex } = parseParagraph(lines, index, (nextLine) =>
        HEADING_PATTERN.test(nextLine) ||
        BULLET_PATTERN.test(nextLine) ||
        ORDERED_PATTERN.test(nextLine),
      );

      if (block.text) {
        children.push(block);
      }

      index = nextIndex;
    }

    items.push({
      text: match[1].trim(),
      children,
    });
  }

  return {
    block: {
      type: "list",
      ordered: false,
      items,
    } satisfies MessageBlock,
    nextIndex: index,
  };
};

const parseOrderedList = (lines: string[], startIndex: number) => {
  const items: MessageListItem[] = [];
  let index = startIndex;

  while (index < lines.length) {
    while (index < lines.length && isBlank(lines[index])) {
      index += 1;
    }

    const match = ORDERED_PATTERN.exec(lines[index]?.trim() ?? "");

    if (!match) {
      break;
    }

    index += 1;
    const children: MessageBlock[] = [];

    while (index < lines.length) {
      const trimmedLine = lines[index].trim();

      if (!trimmedLine) {
        index += 1;
        continue;
      }

      if (ORDERED_PATTERN.test(trimmedLine)) {
        break;
      }

      if (HEADING_PATTERN.test(trimmedLine)) {
        const headingMatch = HEADING_PATTERN.exec(trimmedLine);

        if (headingMatch) {
          children.push({
            type: "heading",
            level: headingMatch[1].length,
            text: headingMatch[2].trim(),
          });
          index += 1;
        }
        continue;
      }

      if (BULLET_PATTERN.test(trimmedLine)) {
        const { block, nextIndex } = parseBulletList(lines, index);
        children.push(block);
        index = nextIndex;
        continue;
      }

      const { block, nextIndex } = parseParagraph(lines, index, (nextLine) =>
        HEADING_PATTERN.test(nextLine) ||
        BULLET_PATTERN.test(nextLine) ||
        ORDERED_PATTERN.test(nextLine),
      );

      if (block.text) {
        children.push(block);
      }

      index = nextIndex;
    }

    items.push({
      text: match[2].trim(),
      children,
    });
  }

  return {
    block: {
      type: "list",
      ordered: true,
      items,
    } satisfies MessageBlock,
    nextIndex: index,
  };
};

const parseBlocks = (content: string) => {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MessageBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const trimmedLine = lines[index].trim();

    if (!trimmedLine) {
      index += 1;
      continue;
    }

    const headingMatch = HEADING_PATTERN.exec(trimmedLine);

    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (ORDERED_PATTERN.test(trimmedLine)) {
      const { block, nextIndex } = parseOrderedList(lines, index);
      blocks.push(block);
      index = nextIndex;
      continue;
    }

    if (BULLET_PATTERN.test(trimmedLine)) {
      const { block, nextIndex } = parseBulletList(lines, index);
      blocks.push(block);
      index = nextIndex;
      continue;
    }

    const { block, nextIndex } = parseParagraph(lines, index, (nextLine) =>
      HEADING_PATTERN.test(nextLine) ||
      BULLET_PATTERN.test(nextLine) ||
      ORDERED_PATTERN.test(nextLine),
    );

    if (block.text) {
      blocks.push(block);
    }

    index = nextIndex;
  }

  if (blocks.length === 0 && content.trim()) {
    blocks.push({
      type: "paragraph",
      text: content.trim(),
    });
  }

  return blocks;
};

const renderInline = (text: string) => {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const token = match[0];
    const tokenIndex = match.index ?? 0;

    if (tokenIndex > cursor) {
      nodes.push(text.slice(cursor, tokenIndex));
    }

    if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(
        <strong key={`inline-${key}`}>{token.slice(2, -2)}</strong>,
      );
    } else if (token.startsWith("`")) {
      nodes.push(<code key={`inline-${key}`}>{token.slice(1, -1)}</code>);
    } else {
      nodes.push(<em key={`inline-${key}`}>{token.slice(1, -1)}</em>);
    }

    cursor = tokenIndex + token.length;
    key += 1;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
};

const renderBlock = (block: MessageBlock, key: string): ReactNode => {
  if (block.type === "heading") {
    const level = Math.min(Math.max(block.level, 1), 4);
    const HeadingTag = ["h1", "h2", "h3", "h4"][level - 1] as
      | "h1"
      | "h2"
      | "h3"
      | "h4";

    return (
      <HeadingTag className={`message-heading level-${level}`} key={key}>
        {renderInline(block.text)}
      </HeadingTag>
    );
  }

  if (block.type === "paragraph") {
    return (
      <p className="message-paragraph" key={key}>
        {renderInline(block.text)}
      </p>
    );
  }

  const ListTag = block.ordered ? "ol" : "ul";

  return (
    <ListTag
      className={`message-list ${block.ordered ? "ordered" : "unordered"}`}
      key={key}
    >
      {block.items.map((item, index) => (
        <li className="message-list-item" key={`${key}-item-${index}`}>
          <div className="message-list-row">
            {block.ordered ? (
              <span className="message-list-index">{index + 1}</span>
            ) : (
              <span className="message-bullet" aria-hidden="true" />
            )}

            <div className="message-list-body">
              <div className="message-list-title">{renderInline(item.text)}</div>

              {item.children.length > 0 && (
                <div className="message-list-children">
                  {item.children.map((child, childIndex) =>
                    renderBlock(child, `${key}-item-${index}-child-${childIndex}`),
                  )}
                </div>
              )}
            </div>
          </div>
        </li>
      ))}
    </ListTag>
  );
};

export default function MessageContent({ content }: Props) {
  const blocks = parseBlocks(content);

  return (
    <div className="message-content">
      {blocks.map((block, index) => renderBlock(block, `block-${index}`))}
    </div>
  );
}
