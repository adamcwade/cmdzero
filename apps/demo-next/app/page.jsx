import Counter from './components/Counter.jsx';

const PLANS = [
  { name: 'Starter', price: '$0', blurb: 'For trying things out on a side project.' },
  { name: 'Pro', price: '$19', blurb: 'For teams shipping to production weekly.' },
  { name: 'Scale', price: '$49', blurb: 'For platforms with serious traffic.' },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <p className="text-sm font-medium uppercase tracking-widest text-sky-400">
        Northwind Cloud
      </p>
      <h1 className="mt-4 font-bold tracking-tight text-6xl">
        Deploy your backend in seconds
      </h1>
      <p className="mt-5 max-w-xl text-lg text-zinc-400">
        Northwind gives you managed databases, queues, and cron in one CLI. This page is a
        server component — every element still maps to its source.
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.name} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="text-lg font-semibold text-sky-300">{p.name}</h3>
            <p className="mt-1 text-3xl font-bold">{p.price}</p>
            <p className="mt-3 text-sm text-zinc-400">{p.blurb}</p>
          </div>
        ))}
      </div>

      <Counter />
    </main>
  );
}
