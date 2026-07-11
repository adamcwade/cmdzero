'use client';

import { useState } from 'react';

export default function Counter() {
  const [n, setN] = useState(0);
  return (
    <section className="mt-16 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-xl font-semibold">Client component check</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Deploys this session: <span className="font-mono text-sky-300">{n}</span>
      </p>
      <button
        onClick={() => setN(n + 1)}
        className="mt-4 rounded-lg bg-sky-500 px-4 py-2 font-semibold text-white hover:bg-sky-400"
      >
        Deploy
      </button>
    </section>
  );
}
