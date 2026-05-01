'use client';
import { STARTERS } from '@/lib/starters';

export function StarterExamples({
  open, onPick, onToggle,
}: { open: boolean; onPick: (s: string) => void; onToggle: () => void }) {
  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onToggle}
        className="text-xl text-blue-700 underline py-3"
      >
        {open ? 'Hide examples' : 'Show me what to ask'}
      </button>
      {open && (
        <ul className="mt-3 space-y-2">
          {STARTERS.map(s => (
            <li key={s.label}>
              <button
                type="button"
                onClick={() => onPick(s.prefill)}
                className="w-full text-left px-5 py-4 rounded-lg border-2 border-gray-300 text-xl hover:bg-gray-50"
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
