interface Props {
  error?: string;
}

export function SetupScreen({ error }: Props) {
  return (
    <main className="setup">
      <h1>Trek Card Maker</h1>
      {error ? (
        <p className="badge error">The frame catalog could not be loaded: {error}</p>
      ) : (
        <p>The frame catalog has not been generated yet.</p>
      )}
      <p>Run the extractor once against the TrekCC PDFs, then reload this page:</p>
      <pre>{`python -I -X utf8 tools/extract_frames.py --pdf-dir "C:/Users/altil/Downloads/TrekCC" --out public/frames`}</pre>
      <p className="muted">It writes frames, icons and layout templates into public/frames (about 650 frames, a few minutes).</p>
    </main>
  );
}
