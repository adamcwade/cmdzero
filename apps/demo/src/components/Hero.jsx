export default function Hero() {
  return (
    <section className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-indigo-400">
        Acme Analytics
      </p>
      <h1 className="mt-4 text-5xl font-bold tracking-tight">
        Know your users in minutes
      </h1>
      <p className="mt-6 text-lg text-slate-400">
        Acme turns raw product events into clear answers, so your team ships the right thing every week.
      </p>
      <div className="mt-8 flex justify-center gap-4">
        <button className="rounded-lg bg-indigo-500 p-4 font-semibold text-white hover:bg-indigo-400">
          Start free trial
        </button>
        <button className="rounded-lg border border-slate-700 p-4 font-semibold text-slate-300 hover:border-slate-500">
          Book a demo
        </button>
      </div>
    </section>
  );
}
