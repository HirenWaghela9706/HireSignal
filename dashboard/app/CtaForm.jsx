'use client';

export default function CtaForm() {
  return (
    <form
      className="mt-stack-md grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 max-w-2xl"
      onSubmit={(e) => e.preventDefault()}
    >
      <label className="font-bebas tracking-widest text-sm flex flex-col gap-2 sm:col-span-2">
        YOUR EMAIL
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="input-sharp w-full"
        />
      </label>
      <button type="submit" className="btn-stamp btn-stamp--black sm:col-span-1">
        JOIN THE REVOLT
      </button>
    </form>
  );
}
