interface Props {
  error?: string;
}

export function SetupScreen({ error }: Props) {
  return (
    <main className="setup">
      <h1>Trek Card Maker</h1>
      {error ? (
        <>
          <p className="badge error">The frame catalog could not be loaded: {error}</p>
          <p>
            Check your connection and reload the page. If you are running the app from source, make sure <code>npm run dev</code> is still
            running.
          </p>
        </>
      ) : (
        <>
          <p>The frame catalog is missing from this copy of the app.</p>
          <p className="muted">
            The hosted app and a fresh clone include it under <code>public/frames</code>. If it was removed, rebuild it from the TrekCC PDFs
            and reload:
          </p>
          <pre>{`python -I -X utf8 tools/extract_frames.py --pdf-dir "C:/Users/altil/Downloads/TrekCC" --rulebook "C:/Users/altil/Downloads/rulebook.pdf" --out public/frames`}</pre>
        </>
      )}
      <button className="primary" onClick={() => window.location.reload()}>
        Reload
      </button>
    </main>
  );
}
