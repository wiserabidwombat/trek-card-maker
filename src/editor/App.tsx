import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Catalog, Frame } from '../catalog/types';
import { templateFor } from '../catalog/types';
import { useCatalog, FRAMES_BASE } from '../catalog/useCatalog';
import { changeType, isBlankCard, newCard, type Card } from '../model/card';
import { parseSkillText } from '../model/skills';
import { AssetCache } from '../render/assets';
import { DEFAULT_FONTS, ensureFontsLoaded, registerUserFont, type FontConfig } from '../render/fonts';
import { renderCard } from '../render/renderCard';
import { buildSheetPdf, downloadBytes } from '../export/exportPdf';
import { PROFILES, type PrintProfile } from '../render/printProfile';
import type { Paper } from '../export/paper';
import { ExportDialog } from './ExportDialog';
import { HelpDialog } from './HelpDialog';
import { Welcome } from './Welcome';
import { useBackupStatus } from './useBackupStatus';
import { recordBackup, recordChange } from '../store/backup';
import { sampleCards } from './sampleDeck';
import { clearCardsAndImages, deleteCard, getImage, getUserFont, listCards, putCard, putImage } from '../store/db';
import { parseDeck, remapFrames, serializeDeck } from '../store/deckJson';
import { DeckList } from './DeckList';
import { FieldsForm } from './FieldsForm';
import { FontSettings } from './FontSettings';
import { FramePicker } from './FramePicker';
import { ImageSection } from './ImageSection';
import { Preview } from './Preview';
import { SetupScreen } from './SetupScreen';
import { useRenderer } from './useRenderer';

export default function App() {
  const cat = useCatalog();
  if (cat.status === 'loading') return <main className="setup">Loading frame catalog…</main>;
  if (cat.status === 'missing') return <SetupScreen />;
  if (cat.status === 'error') return <SetupScreen error={cat.error} />;
  return <Editor catalog={cat.catalog} />;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

function Editor({ catalog }: { catalog: Catalog }) {
  const assets = useMemo(() => new AssetCache(), []);
  const [fonts, setFonts] = useState<FontConfig>(DEFAULT_FONTS);
  const [cards, setCards] = useState<Card[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showFonts, setShowFonts] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const saveTimers = useRef(new Map<string, number>());
  const backup = useBackupStatus();

  const current = cards.find((c) => c.id === currentId) ?? null;
  const frame = current ? catalog.frames.find((f) => f.id === current.frameId) ?? null : null;
  const template = frame ? templateFor(catalog, frame) : null;

  // initial load: user fonts, then saved cards
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const f: FontConfig = { ...DEFAULT_FONTS };
      for (const slot of ['title', 'body'] as const) {
        const blob = await getUserFont(slot);
        if (blob) {
          try {
            f[slot] = await registerUserFont(slot, await blob.arrayBuffer());
          } catch {
            /* ignore a corrupt stored font */
          }
        }
      }
      await ensureFontsLoaded(f);
      const stored = await listCards();
      if (cancelled) return;
      setFonts(f);
      if (stored.length) {
        // cards saved against an older catalog (per-card frames, text skills) are moved to base frames
        const { cards: saved, remapped } = remapFrames(
          stored.map((c) => ({
            ...c,
            icons: Array.isArray(c.icons) ? c.icons : [],
            skills: (c.skills ?? []).map((s) => ('name' in s ? s : parseSkillText(String((s as { text?: string }).text ?? '')))),
          })),
          catalog,
        );
        if (remapped) {
          for (const c of saved) await putCard(c);
          setNotice(`${remapped} card${remapped === 1 ? '' : 's'} moved to the new base frames; check their frame and icons.`);
        }
        setCards(saved);
        setCurrentId(saved[saved.length - 1].id);
      } else {
        const first = catalog.frames.find((fr) => fr.type === 'personnel') ?? catalog.frames[0];
        const c = newCard(first.type, first.id);
        setCards([c]);
        setCurrentId(c.id);
        await putCard(c);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [catalog]);

  const render = useRenderer(current, catalog, fonts, assets);

  const updateCard = useCallback((card: Card) => {
    setCards((cs) => cs.map((c) => (c.id === card.id ? card : c)));
    const timers = saveTimers.current;
    const prev = timers.get(card.id);
    if (prev) window.clearTimeout(prev);
    timers.set(
      card.id,
      window.setTimeout(() => {
        putCard(card)
          .then(() => recordChange())
          .catch((e) => setNotice(`Could not save: ${e instanceof Error ? e.message : String(e)}`));
        timers.delete(card.id);
      }, 300),
    );
  }, []);

  const selectFrame = (f: Frame) => {
    if (!current) return;
    updateCard(f.type === current.type ? { ...current, frameId: f.id, updatedAt: Date.now() } : changeType(current, f.type, f.id));
  };

  const addCard = async (base?: Card) => {
    const c = base
      ? { ...structuredClone(base), id: newCard(base.type, base.frameId).id, name: base.name ? `${base.name} (copy)` : '', updatedAt: Date.now() }
      : newCard(current?.type ?? 'personnel', current?.frameId ?? catalog.frames[0].id);
    if (base?.image) {
      // duplicate the stored image so the copies can be edited independently
      const blob = await getImage(base.image.blobKey);
      if (blob) {
        const key = `img-${c.id}`;
        await putImage(key, blob);
        c.image = { ...base.image, blobKey: key };
      }
    }
    setCards((cs) => [...cs, c]);
    setCurrentId(c.id);
    await putCard(c);
  };

  const removeCard = async (id: string) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    if (!window.confirm(`Delete "${card.name || card.fields.title || 'this card'}"?`)) return;
    const rest = cards.filter((c) => c.id !== id);
    setCards(rest);
    if (currentId === id) setCurrentId(rest.length ? rest[rest.length - 1].id : null);
    await deleteCard(id);
    recordChange();
    if (!rest.length) addCard();
  };

  const clearAll = async () => {
    const n = cards.length;
    if (!n) return;
    const ok = window.confirm(
      `Delete all ${n} card${n === 1 ? '' : 's'} and their images? This cannot be undone. Export the deck first if you want to keep them.`,
    );
    if (!ok) return;
    for (const timer of saveTimers.current.values()) window.clearTimeout(timer);
    saveTimers.current.clear();
    for (const c of cards) if (c.image) assets.dropBlob(c.image.blobKey);
    const removed = await clearCardsAndImages();
    recordChange();
    const first = catalog.frames.find((fr) => fr.type === 'personnel') ?? catalog.frames[0];
    const fresh = newCard(first.type, first.id);
    setCards([fresh]);
    setCurrentId(fresh.id);
    await putCard(fresh);
    setNotice(`Removed ${removed} card${removed === 1 ? '' : 's'}.`);
  };

  const exportPdf = async (profileName: PrintProfile, paper: Paper) => {
    setShowExport(false);
    setExporting(true);
    setNotice(null);
    const profile = PROFILES[profileName];
    try {
      const items = [];
      const skipped: string[] = [];
      for (const card of cards) {
        if (card.copies <= 0) continue;
        const fr = catalog.frames.find((f) => f.id === card.frameId);
        if (!fr) {
          skipped.push(card.name || card.fields.title || card.id);
          continue;
        }
        let userImage: HTMLImageElement | undefined;
        if (card.image) {
          const blob = await getImage(card.image.blobKey);
          if (blob) userImage = await assets.getBlobImage(card.image.blobKey, blob);
        }
        try {
          const textSink: import('../render/textOps').TextOp[] = [];
          const r = await renderCard(card, { catalog, frame: fr, template: templateFor(catalog, fr), fonts, assets, userImage, base: FRAMES_BASE, profile, textSink });
          items.push({ canvas: r.canvas, copies: card.copies, textOps: r.textOps });
        } catch {
          skipped.push(card.name || card.fields.title || card.id);
        }
      }
      const userFonts: { title?: ArrayBuffer; body?: ArrayBuffer } = {};
      for (const slot of ['title', 'body'] as const) {
        const blob = await getUserFont(slot);
        if (blob) userFonts[slot] = await blob.arrayBuffer();
      }
      const bytes = await buildSheetPdf(items, profile.lossless, { userFonts, paper });
      downloadBytes(bytes, `trek-cards-sheet${paper === 'a4' ? '-a4' : ''}${profileName === 'inkjet' ? '-inkjet' : ''}.pdf`);
      if (skipped.length) setNotice(`Skipped (could not render): ${skipped.join(', ')}`);
    } catch (e) {
      setNotice(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
  };

  const exportJson = async () => {
    const images: Record<string, string> = {};
    for (const c of cards) {
      if (!c.image) continue;
      const blob = await getImage(c.image.blobKey);
      if (blob) images[c.image.blobKey] = await blobToDataUrl(blob);
    }
    downloadBytes(new TextEncoder().encode(serializeDeck(cards, images)), 'trek-cards-deck.json', 'application/json');
    recordBackup();
  };

  /** Append cards to the deck (fresh ids for any already taken), select the last one, and return what was added. */
  const addCards = async (incoming: Card[]): Promise<Card[]> => {
    const existing = new Set(cards.map((c) => c.id));
    const fresh = incoming.map((c) => (existing.has(c.id) ? { ...c, id: newCard(c.type, c.frameId).id } : c));
    for (const c of fresh) await putCard(c);
    if (fresh.length) recordChange(fresh.length);
    setCards((cs) => [...cs, ...fresh]);
    if (fresh.length) setCurrentId(fresh[fresh.length - 1].id);
    return fresh;
  };

  /** Add the two example cards from Help; an untouched starter card is dropped rather than left as an empty extra. */
  const loadSample = async () => {
    const blank = cards.filter(isBlankCard);
    const added = await addCards(sampleCards(catalog));
    for (const c of blank) {
      const timer = saveTimers.current.get(c.id);
      if (timer) window.clearTimeout(timer);
      saveTimers.current.delete(c.id);
      await deleteCard(c.id);
    }
    const dropped = new Set(blank.map((c) => c.id));
    setCards((cs) => cs.filter((c) => !dropped.has(c.id)));
    setNotice(`Added ${added.length} sample cards.`);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = parseDeck(await file.text());
      const { cards: incoming, remapped } = remapFrames(parsed.cards, catalog);
      const images = parsed.images;
      for (const [key, url] of Object.entries(images)) await putImage(key, await dataUrlToBlob(url));
      const fresh = await addCards(incoming);
      setNotice(`Imported ${fresh.length} card${fresh.length === 1 ? '' : 's'}${remapped ? ` (${remapped} moved to base frames)` : ''}.`);
    } catch (e) {
      setNotice(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (!loaded) return <main className="setup">Loading your cards…</main>;

  const pristine = cards.every(isBlankCard);

  return (
    <div className="app">
      <header className="topbar">
        <h1>Trek Card Maker</h1>
        <span className="muted small">{catalog.frames.length} frames · {catalog.icons.length} icons</span>
        <span className="spacer" />
        {notice && (
          <span className="badge" onClick={() => setNotice(null)} title="Dismiss">
            {notice}
          </span>
        )}
        <button onClick={() => setShowHelp(true)}>Help</button>
        <button onClick={() => setShowFonts(true)}>Fonts…</button>
      </header>
      <div className="columns">
        <DeckList
          cards={cards}
          currentId={currentId}
          busy={exporting}
          backup={backup}
          onSelect={setCurrentId}
          onNew={() => addCard()}
          onDuplicate={(id) => {
            const c = cards.find((x) => x.id === id);
            if (c) addCard(c);
          }}
          onDelete={removeCard}
          onClearAll={clearAll}
          onCopiesChange={(id, copies) => {
            const c = cards.find((x) => x.id === id);
            if (c) updateCard({ ...c, copies });
          }}
          onExportPdf={() => setShowExport(true)}
          onExportJson={exportJson}
          onImportJson={importJson}
        />
        <FramePicker catalog={catalog} selectedId={current?.frameId ?? ''} onSelect={selectFrame} />
        <div className="middle">
          {pristine && <Welcome onLoadSample={loadSample} onHelp={() => setShowHelp(true)} />}
          {current && frame && template && <ImageSection card={current} frame={frame} template={template} assets={assets} onChange={updateCard} />}
          {current && <FieldsForm card={current} catalog={catalog} template={template} onChange={updateCard} />}
        </div>
        <Preview render={render} filename={current?.name || current?.fields.title || 'card'} />
      </div>
      {showFonts && <FontSettings fonts={fonts} onChange={setFonts} onClose={() => setShowFonts(false)} />}
      {showHelp && (
        <HelpDialog
          catalog={catalog}
          onClose={() => setShowHelp(false)}
          onLoadSample={() => {
            setShowHelp(false);
            loadSample();
          }}
        />
      )}
      {showExport && (
        <ExportDialog cardCount={cards.reduce((n, c) => n + Math.max(0, c.copies), 0)} onExport={exportPdf} onCancel={() => setShowExport(false)} />
      )}
    </div>
  );
}
