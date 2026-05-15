'use client';

interface Props {
  code: string;
  language?: string;
  title?: string;
}

export default function CodeBlock({ code, language = 'pseudocode', title }: Props) {
  return (
    <div className="card overflow-hidden">
      {title && (
        <div className="px-4 py-2 border-b border-white/5 text-xs uppercase tracking-wider text-gray-500 flex justify-between">
          <span>{title}</span>
          <span className="text-gray-600">{language}</span>
        </div>
      )}
      <pre className="p-4 text-xs sm:text-sm font-mono overflow-x-auto text-gray-300 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
