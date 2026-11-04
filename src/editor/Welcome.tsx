interface Props {
  onLoadSample: () => void;
  onHelp: () => void;
}

/** Shown in place of nothing in particular while the deck holds only untouched cards. */
export function Welcome({ onLoadSample, onHelp }: Props) {
  return (
    <section className="welcome">
      <h2>Welcome</h2>
      <p>Design your own Star Trek CCG Second Edition cards and print them at the TrekCC card size.</p>
      <ol>
        <li>
          Pick a <strong>frame</strong> in the column to the left: the card type, then the affiliation.
        </li>
        <li>
          Add <strong>artwork</strong> and fill in the <strong>card text</strong> below. The preview on the right follows as you type.
        </li>
        <li>
          Set each card's copy count, then <strong>Export print sheet</strong> for a PDF with cut marks.
        </li>
      </ol>
      <p className="muted small">
        Cards are saved in this browser only. <em>Export deck (JSON)</em> makes a backup you can import on another machine.
      </p>
      <div className="row">
        <button className="primary" onClick={onLoadSample}>
          Load sample deck
        </button>
        <button onClick={onHelp}>Help</button>
      </div>
    </section>
  );
}
