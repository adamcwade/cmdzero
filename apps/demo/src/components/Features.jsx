const FEATURES = [
  {
    title: 'Instant funnels',
    body: 'Build conversion funnels in seconds without writing SQL.',
  },
  {
    title: 'Session replays',
    body: 'Watch real sessions to see exactly where users get stuck.',
  },
  {
    title: 'Smart alerts',
    body: 'Get notified the moment a key metric moves unexpectedly.',
  },
];

export default function Features() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-center text-3xl font-bold">Everything you need</h2>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-indigo-300">{f.title}</h3>
            <p className="mt-2 text-sm text-slate-400">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
