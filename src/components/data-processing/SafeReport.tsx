import type { ReactNode } from "react";

type Block =
    | { type: "heading"; level: number; text: string }
    | { type: "paragraph"; lines: string[] }
    | { type: "unordered"; items: string[] }
    | { type: "ordered"; items: string[] };

const inlinePattern = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`)/g;

function renderInline(value: string): ReactNode[] {
    return value.split(inlinePattern).filter(Boolean).map((part, index) => {
        if ((part.startsWith("**") && part.endsWith("**")) ||
            (part.startsWith("__") && part.endsWith("__"))) {
            return <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong>;
        }
        if ((part.startsWith("*") && part.endsWith("*")) ||
            (part.startsWith("_") && part.endsWith("_"))) {
            return <em key={index} className="italic text-indigo-200">{part.slice(1, -1)}</em>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
            return <code key={index} className="rounded bg-slate-700/70 px-1 py-0.5 text-indigo-200">{part.slice(1, -1)}</code>;
        }
        return part;
    });
}

function parseBlocks(value: string): Block[] {
    const blocks: Block[] = [];
    const lines = value.replace(/\r\n?/g, "\n").split("\n");
    let separated = false;

    for (const line of lines) {
        const heading = /^\s{0,3}(#{1,3})\s+(.+)$/.exec(line);
        const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
        const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);

        if (!line.trim()) {
            separated = true;
            continue;
        }
        if (heading) {
            blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
            separated = false;
            continue;
        }
        if (unordered || ordered) {
            const type = unordered ? "unordered" : "ordered";
            const previous = blocks[blocks.length - 1];
            if (!separated && previous?.type === type && (previous.type === "unordered" || previous.type === "ordered")) {
                previous.items.push((unordered || ordered)![1]);
            } else {
                blocks.push({ type, items: [(unordered || ordered)![1]] });
            }
            separated = false;
            continue;
        }

        const previous = blocks[blocks.length - 1];
        if (!separated && previous?.type === "paragraph") {
            previous.lines.push(line);
        } else {
            blocks.push({ type: "paragraph", lines: [line] });
        }
        separated = false;
    }

    return blocks;
}

export default function SafeReport({ text }: { text: string }) {
    const blocks = parseBlocks(text);

    return (
        <div className="space-y-3 leading-relaxed text-sm text-gray-300">
            {blocks.map((block, index) => {
                if (block.type === "heading") {
                    const content = renderInline(block.text);
                    if (block.level === 1) return <h1 key={index} className="text-xl font-bold text-indigo-300">{content}</h1>;
                    if (block.level === 2) return <h2 key={index} className="border-b border-indigo-500/30 pb-1 text-lg font-bold text-indigo-300">{content}</h2>;
                    return <h3 key={index} className="font-bold text-indigo-200">{content}</h3>;
                }
                if (block.type === "unordered") {
                    return <ul key={index} className="list-disc space-y-1 pl-5 marker:text-indigo-400">{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ul>;
                }
                if (block.type === "ordered") {
                    return <ol key={index} className="list-decimal space-y-1 pl-5 marker:text-purple-400">{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ol>;
                }
                return <p key={index}>{block.lines.map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}{renderInline(line)}</span>)}</p>;
            })}
        </div>
    );
}
