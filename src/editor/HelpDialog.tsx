import { useMemo, useState } from 'react';
import type { Catalog } from '../catalog/types';
import { CARD_TYPES, iconsInGroup } from '../catalog/types';
import { COMMON_FIELDS, FIELD_DEFS } from '../model/card';
import { STANDARD_SKILLS } from '../model/skills';
import { DECK_VERSION } from '../store/deckJson';
import { downloadBytes } from '../export/exportPdf';
import { sampleDeckJson } from './sampleDeck';
import { ISSUES_URL, REPO_URL } from './links';
import { csvTemplate } from '../store/csvImport';

interface Props {
  catalog: Catalog;
  onClose: () => void;
  /** Adds the sample cards to the deck (the same two shown in the JSON below). */
  onLoadSample?: () => void;
}

type Tab = 'deck' | 'csv' | 'markup' | 'fields';

export function HelpDialog({ catalog, onClose, onLoadSample }: Props) {
  const [tab, setTab] = useState<Tab>('deck');
  const [copied, setCopied] = useState(false);
  const sample = useMemo(() => sampleDeckJson(catalog), [catalog]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sample);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: the text can still be selected */
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal help" onClick={(e) => e.stopPropagation()}>
        <div className="help-head">
          <h2>Help</h2>
          <div className="type-tabs">
            <button className={tab === 'deck' ? 'tab active' : 'tab'} onClick={() => setTab('deck')}>
              Deck JSON
            </button>
            <button className={tab === 'csv' ? 'tab active' : 'tab'} onClick={() => setTab('csv')}>
              Spreadsheet
            </button>
            <button className={tab === 'markup' ? 'tab active' : 'tab'} onClick={() => setTab('markup')}>
              Text markup
            </button>
            <button className={tab === 'fields' ? 'tab active' : 'tab'} onClick={() => setTab('fields')}>
              Fields by card type
            </button>
          </div>
          <span className="spacer" />
          <a className="button-link" href={ISSUES_URL} target="_blank" rel="noopener noreferrer" title={`Opens the issue tracker at ${REPO_URL}`}>
            Report a problem
          </a>
          <button onClick={onClose}>Close</button>
        </div>

        {tab === 'deck' && (
          <div className="help-body">
            <p>
              <strong>Export deck (JSON)</strong> writes a version {DECK_VERSION} file and <strong>Import deck (JSON)…</strong> reads it back
              (version 1 files from the first release import too). The file is a JSON object:
            </p>
            <ul>
              <li>
                <code>version</code>: {DECK_VERSION}. <code>exportedAt</code>: ISO timestamp, informational. <code>name</code>: optional deck
                name; importing creates a new deck called this (else named after the file).
              </li>
              <li>
                <code>cards</code>: one object per card. <code>id</code> any unique string; <code>name</code> is the deck-list label;{' '}
                <code>type</code> one of {CARD_TYPES.join(', ')}; <code>frameId</code> a base frame id (unknown ids fall back to the first frame
                of the type); <code>fields</code> the text fields for the type (see Fields by card type); <code>skills</code> personnel only, each{' '}
                <code>{'{ "name", "count" }'}</code>; <code>icons</code> Other Icon ids (personnel, ship) or affiliation ids (mission) in draw order;{' '}
                <code>copies</code> how many to print; <code>image</code> optional.
              </li>
              <li>
                <code>image</code>: <code>blobKey</code> names an entry in <code>images</code>; <code>crop</code> is the box in source pixels
                (it may extend past the picture when zoomed out); <code>srcW</code>/<code>srcH</code> the picture size; <code>fill</code> the colour
                behind a zoomed-out picture.
              </li>
              <li>
                <code>images</code>: <code>blobKey</code> → data URL (<code>data:image/png;base64,…</code>). Leave it empty and omit each card's{' '}
                <code>image</code> to import text-only cards.
              </li>
            </ul>
            <p className="muted small">
              Frame ids in this catalog: {catalog.frames.map((f) => f.id).join(', ')}.
              <br />
              Other Icon ids: {iconsInGroup(catalog, 'other').map((i) => i.id).join(', ')}.
              <br />
              Mission affiliation ids: {iconsInGroup(catalog, 'missionAffiliation').map((i) => i.id).join(', ')}.
            </p>
            <div className="row">
              <strong>Sample (two cards, no images)</strong>
              <span className="spacer" />
              {onLoadSample && <button onClick={onLoadSample}>Add these cards to my deck</button>}
              <button onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
              <button onClick={() => downloadBytes(new TextEncoder().encode(sample), 'sample-deck.json', 'application/json')}>Download sample-deck.json</button>
            </div>
            <pre className="help-sample">{sample}</pre>
          </div>
        )}

        {tab === 'csv' && (
          <div className="help-body">
            <p>
              <strong>Import cards (CSV)…</strong> adds a row per card to the current deck from a spreadsheet saved as CSV (or tab-separated
              text). The first row names the columns; order does not matter and unknown columns are ignored.
            </p>
            <ul>
              <li>
                <code>type</code> (personnel, ship, equipment, event, interrupt, mission, dilemma) and <code>frame</code> (an affiliation such as
                Klingon, or Planet / Space / Headquarters / Dual for missions and dilemmas). A missing frame falls back to the first of the type.
              </li>
              <li>
                <code>title</code>, <code>unique</code> (yes / 1 / x), <code>subtitle</code>, <code>species</code>, <code>class</code>,{' '}
                <code>cost</code>, <code>integrity</code>, <code>cunning</code>, <code>strength</code>, <code>range</code>, <code>weapons</code>,{' '}
                <code>shields</code>, <code>quadrant</code>, <code>points</code>, <code>span</code>, <code>requirements</code>, <code>hq</code>,{' '}
                <code>game text</code>, <code>lore</code>, <code>set</code>, <code>rarity</code>, <code>number</code> (or one{' '}
                <code>collector</code> column holding “25 V 1”), <code>credit</code> (the line up the right edge), <code>copies</code>.
              </li>
              <li>
                <code>skills</code>: comma-separated, "2 Leadership" for multiples. <code>staffing</code>: command, staff. <code>icons</code>:
                Other Icon names (command, staff, past…) or mission affiliations (Klingon, Federation…), comma-separated.
              </li>
              <li>Game text takes the same markup as the editor. Artwork is not part of the import; add it per card afterwards.</li>
            </ul>
            <button onClick={() => downloadBytes(new TextEncoder().encode(csvTemplate()), 'trek-cards-template.csv', 'text/csv')}>
              Download template (CSV)
            </button>
          </div>
        )}

        {tab === 'markup' && (
          <div className="help-body">
            <p>Game text, lore and requirements accept a small markup:</p>
            <ul>
              <li>
                <code>**bold**</code> for keywords, <code>*italic*</code> for emphasis.
              </li>
              <li>
                <code>{'{icon:id}'}</code> draws an inline icon. Available ids:{' '}
                {iconsInGroup(catalog, 'inline')
                  .map((i) => i.id)
                  .join(', ')}
                .
              </li>
              <li>A line break starts a new line; a blank line starts a new paragraph.</li>
              <li>
                The B, I and icon buttons above each text field (or Ctrl+B and Ctrl+I) wrap the selected words; <em>Order</em> and{' '}
                <em>Interrupt</em> insert the usual bold opening, and the <em>Keyword…</em> menu inserts one of the keywords the real cards
                print in bold (Admiral, Commander: ship, Decay: n and so on).
              </li>
              <li>
                <strong>Checks</strong> under the card text compares the wording with the printed cards: bold requirements after “Unless you
                have”, capitalised skill names, Cunning&gt;30 without spaces, a period at the end, misspelt skills, unknown icon ids. They are
                advice only; nothing stops you saving or printing.
              </li>
              <li>
                Typography is applied when the card is drawn, so type with a plain keyboard: straight quotes print as “curly” quotes, a hyphen
                between spaces or <code>--</code> as an en dash (–), <code>---</code> as an em dash (—) and <code>...</code> as an ellipsis. Hyphens
                inside words, like Non-Aligned, are kept.
              </li>
              <li>Skills print as the name, or "2 Name" when the count is above one. Standard skills: {STANDARD_SKILLS.join(', ')}.</li>
            </ul>
          </div>
        )}

        {tab === 'fields' && (
          <div className="help-body">
            <p>
              Every card has: {COMMON_FIELDS.map((f) => `${f.id} (${f.label})`).join(', ')}. Checkbox fields hold "1" when ticked, number fields
              hold the number as text.
            </p>
            {CARD_TYPES.map((t) => (
              <p key={t}>
                <strong>{t}</strong>: {FIELD_DEFS[t].length ? FIELD_DEFS[t].map((f) => `${f.id} (${f.label})`).join(', ') : 'no extra fields'}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
