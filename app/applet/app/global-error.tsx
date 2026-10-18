'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-4 font-['Nunito',sans-serif]">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Something went wrong!</h2>
          <p className="text-sm text-slate-600 mb-4">{error?.message || 'An unexpected error occurred.'}</p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-[#be123c] text-white rounded-xl text-xs font-bold"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
