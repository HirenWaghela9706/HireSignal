'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body style={{ padding: '2rem' }}>
        <h2>Something went wrong</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
