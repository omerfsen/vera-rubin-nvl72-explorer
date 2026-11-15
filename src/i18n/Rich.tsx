import { Fragment, type ReactNode } from 'react';

/** A translated string with "{name}" placeholders filled by elements (links, badges). */
export function Rich({ text, parts }: { text: string; parts: Record<string, ReactNode> }) {
  const pieces = text.split(/(\{\w+\})/);
  return (
    <>
      {pieces.map((p, i) => {
        const m = /^\{(\w+)\}$/.exec(p);
        return <Fragment key={i}>{m && m[1]! in parts ? parts[m[1]!] : p}</Fragment>;
      })}
    </>
  );
}
