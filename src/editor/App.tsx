import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Catalog, Frame } from '../catalog/types';
import { artBoxFor, templateFor } from '../catalog/types';
import { useCatalog, FRAMES_BASE } from '../catalog/useCatalog';
import { changeType, isBlankCard, newCard, type Card } from '../model/card';
import { parseSkillText } from '../model/skills';
import { AssetCache } from '../render/assets';
import { artPrintDpi, artQuality } from '../render/artQuality';
import { DEFAULT_FONTS, ensureFontsLoaded, registerUserFont, type FontConfig } from '../render/fonts';
import { renderCard } from '../render/renderCard';
import { buildSheetPdf, canvasToBytes, downloadBytes, isPng } from '../export/exportPdf';
import { buildTtsBack, buildTtsSheets } from '../export/ttsExport';
import { expandCopies, ttsFileName } from '../export/tts';
import type { TextOp } from '../render/textOps';
import { PROFILES, SCREEN_PROFILE, type PrintProfile, type RenderProfile } from '../render/printProfile';
import type { Paper } from '../export/paper';
import { BACK_PX, type BackChoice } from '../export/backs';
import { BLEED_PT } from '../export/bleed';
import { ExportDialog } from './ExportDialog';
import { Gallery } from './Gallery';
import { DeckChecks } from './DeckChecks';
import { lintContext, lintDeck } from './deckLint';
import { useThumbnails } from './useThumbnails';
import { TtsDialog, type TtsResult } from './TtsDialog';
import { HelpDialog } from './HelpDialog';
import { Welcome } from './Welcome';
import { useBackupStatus } from './useBackupStatus';
import { useInstallPrompt } from './useInstallPrompt';
import { recordBackup, recordChange } from '../store/backup';
import { EMPTY_HISTORY, isTextTarget, popRedo, popUndo, record, redoLabel, undoLabel, type History, type HistoryEntry } from './history';
import { nextCollector } from '../model/collector';
import { applyOrder, moveCard, nextOrder, normalizeOrder } from '../model/order';
import { sampleCards } from './sampleDeck';
import { clearCardsAndImages, deleteBackImage, deleteCard, getBackImage, getImage, getUserFont, putBackImage, listCards, loadDecks, pruneOrphanImages, putCard, putImage, saveCurrentDeck, saveDecks } from '../store/db';
import { deckFileName, deckSlug, importedDeckName, newDeckId, uniqueDeckName, type DeckMeta } from '../store/decks';
import { parseDeck, remapFrames, serializeDeck } from '../store/deckJson';
import { buildDeckList, deckListFileName } from '../store/deckList';
import { cardsFromRows, parseDelimited } from '../store/csvImport';
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

type Pane = 'cards' | 'frame' | 'edit' | 'preview';
const PANES: { id: Pane; label: string }[] = [
  { id: 'cards', label: 'Cards' },
  { id: 'frame', label: 'Frame' },
  { id: 'edit', label: 'Edit' },
  { id: 'preview', label: 'Preview' },
];

function Editor({ catalog }: { catalog: Catalog }) {
  const assets = useMemo(() => new AssetCache(), []);
  const [fonts, setFonts] = useState<FontConfig>(DEFAULT_FONTS);
  const [decks, setDecks] = useState<DeckMeta[]>([]);
  const [deckId, setDeckId] = useState<string>('');
  const [cards, setCards] = useState<Card[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showFonts, setShowFonts] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showChecks, setShowChecks] = useState(false);
  const [customBack, setCustomBack] = useState<Blob | null>(null);
  const customBackUrl = useMemo(() => (customBack ? URL.createObjectURL(customBack) : null), [customBack]);
  useEffect(() => () => {
    if (customBackUrl) URL.revokeObjectURL(customBackUrl);
  }, [customBackUrl]);
  useEffect(() => {
    getBackImage().then((b) => setCustomBack(b ?? null), () => undefined);
  }, []);
  /** Which column a phone shows; the desktop grid shows all four and ignores it. */
  const [pane, setPane] = useState<Pane>('edit');
  const [showTts, setShowTts] = useState(false);
  const [ttsResult, setTtsResult] = useState<TtsResult | null>(null);
  /** Cards headed for the print sheet whose artwork prints below 300 dpi. */
  const lowArt = useMemo(
    () =>
      cards.flatMap((c) => {
        if (!c.image || c.copies <= 0) return [];
        const fr = catalog.frames.find((f) => f.id === c.frameId);
        if (!fr) return [];
        const box = artBoxFor(fr, templateFor(catalog, fr));
        const dpi = artPrintDpi(c.image.crop, box[2] - box[0]);
        return artQuality(dpi) === 'good' ? [] : [{ name: c.name || c.fields.title || '(untitled)', dpi }];
      }),
    [cards, catalog],
  );

  const [showHelp, setShowHelp] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const saveTimers = useRef(new Map<string, number>());
  const backup = useBackupStatus();
  const thumbs = useThumbnails(cards, currentId, catalog, fonts, assets, showGallery);
  const deckLint = useMemo(() => lintDeck(cards, lintContext(catalog)), [cards, catalog]);
  const installer = useInstallPrompt();
  const [history, setHistory] = useState<History>(EMPTY_HISTORY);
  const cardsRef = useRef<Card[]>([]);
  cardsRef.current = cards;

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
      const { decks: registry, currentId: openDeck } = await loadDecks();
      pruneOrphanImages().catch(() => undefined);
      const stored = await listCards(openDeck);
      if (cancelled) return;
      setFonts(f);
      setDecks(registry);
      setDeckId(openDeck);
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
        const ordered = normalizeOrder(saved);
        for (const c of ordered.changed) await putCard(c);
        setCards(ordered.cards);
        setCurrentId(ordered.cards[ordered.cards.length - 1].id);
      } else {
        const first = catalog.frames.find((fr) => fr.type === 'personnel') ?? catalog.frames[0];
        const c = newCard(first.type, first.id, openDeck);
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

  /** Save several changed cards as one undoable step (deck numbering, the edge line everywhere). */
  const applyBulk = async (updated: Card[]) => {
    if (!updated.length) return;
    const cs = cardsRef.current;
    const before = updated.map((u) => cs.find((c) => c.id === u.id)).filter((c): c is Card => !!c);
    setHistory((h) => record(h, { kind: 'bulk', before, after: updated, at: Date.now() }));
    const byId = new Map(updated.map((u) => [u.id, u]));
    setCards(cs.map((c) => byId.get(c.id) ?? c));
    for (const u of updated) {
      cancelSave(u.id);
      await putCard(u);
    }
    recordChange(updated.length);
  };

  const updateCard = useCallback((card: Card) => {
    const before = cardsRef.current.find((c) => c.id === card.id);
    if (before) setHistory((h) => record(h, { kind: 'edit', before, after: card, at: Date.now() }));
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
    setPane('edit');
  };

  const addCard = async (base?: Card) => {
    const c = base
      ? { ...structuredClone(base), id: newCard(base.type, base.frameId).id, name: base.name ? `${base.name} (copy)` : '', updatedAt: Date.now() }
      : newCard(current?.type ?? 'personnel', current?.frameId ?? catalog.frames[0].id, deckId);
    if (base) c.deckId = deckId;
    else if (current) {
      // a fresh card continues the set: same set and rarity, next number, same edge line
      c.fields.collectorInfo = nextCollector(current.fields.collectorInfo ?? '');
      c.fields.credit = current.fields.credit ?? '';
    }
    c.order = nextOrder(cards);
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
    setHistory((h) => record(h, { kind: 'add', card: c, at: Date.now() }));
    await putCard(c);
  };

  const removeCard = async (id: string) => {
    const index = cards.findIndex((c) => c.id === id);
    const card = cards[index];
    if (!card) return;
    if (!window.confirm(`Delete "${card.name || card.fields.title || 'this card'}"?`)) return;
    cancelSave(id);
    const rest = cards.filter((c) => c.id !== id);
    setCards(rest);
    if (currentId === id) setCurrentId(rest.length ? rest[rest.length - 1].id : null);
    setHistory((h) => record(h, { kind: 'delete', card, index, at: Date.now() }));
    await deleteCard(id);
    recordChange();
    if (!rest.length) addCard();
  };

  const cancelSave = (id: string) => {
    const timer = saveTimers.current.get(id);
    if (timer) window.clearTimeout(timer);
    saveTimers.current.delete(id);
  };

  /** Move a card to another position in the list (drag and drop, or Alt+arrow). */
  const reorderIndex = async (from: number, to: number) => {
    const { cards: next, changed } = moveCard(cards, from, to);
    if (!changed.length) return;
    setHistory((h) => record(h, { kind: 'reorder', before: cards.map((c) => c.id), after: next.map((c) => c.id), at: Date.now() }));
    setCards(next);
    for (const c of changed) await putCard(c);
    recordChange();
  };
  const reorder = (fromId: string, toId: string) =>
    reorderIndex(
      cards.findIndex((c) => c.id === fromId),
      cards.findIndex((c) => c.id === toId),
    );
  const moveBy = (id: string, delta: number) => {
    const i = cards.findIndex((c) => c.id === id);
    if (i >= 0) reorderIndex(i, Math.max(0, Math.min(cards.length - 1, i + delta)));
  };

  /** Put a card back (undo delete / redo add) at a position, or take one out (undo add / redo delete). */
  const restoreCard = async (card: Card, index: number) => {
    const next = [...cardsRef.current];
    next.splice(Math.min(index, next.length), 0, card);
    setCards(next);
    setCurrentId(card.id);
    await putCard(card);
  };
  const dropCard = async (id: string) => {
    cancelSave(id);
    let next = cardsRef.current.filter((c) => c.id !== id);
    if (!next.length) {
      const first = catalog.frames.find((fr) => fr.type === 'personnel') ?? catalog.frames[0];
      next = [newCard(first.type, first.id, deckId)];
      await putCard(next[0]);
    }
    setCards(next);
    if (currentId === id) setCurrentId(next[next.length - 1].id);
    await deleteCard(id);
  };

  const applyEntry = async (e: HistoryEntry, direction: 'undo' | 'redo') => {
    const cs = cardsRef.current;
    if (e.kind === 'edit') {
      const target = direction === 'undo' ? e.before : e.after;
      cancelSave(target.id);
      setCards(cs.some((c) => c.id === target.id) ? cs.map((c) => (c.id === target.id ? target : c)) : [...cs, target]);
      setCurrentId(target.id);
      await putCard(target);
    } else if (e.kind === 'add') {
      if (direction === 'undo') await dropCard(e.card.id);
      else await restoreCard(e.card, cs.length);
    } else if (e.kind === 'delete') {
      if (direction === 'undo') await restoreCard(e.card, e.index);
      else await dropCard(e.card.id);
    } else if (e.kind === 'bulk') {
      const target = direction === 'undo' ? e.before : e.after;
      const byId = new Map(target.map((c) => [c.id, c]));
      setCards(cs.map((c) => byId.get(c.id) ?? c));
      for (const c of target) {
        cancelSave(c.id);
        await putCard(c);
      }
    } else {
      const { cards: next, changed } = applyOrder(cs, direction === 'undo' ? e.before : e.after);
      setCards(next);
      for (const c of changed) await putCard(c);
    }
    recordChange();
  };

  const undo = async () => {
    const p = popUndo(history);
    if (!p) return;
    setHistory(p.history);
    await applyEntry(p.entry, 'undo');
  };
  const redo = async () => {
    const p = popRedo(history);
    if (!p) return;
    setHistory(p.history);
    await applyEntry(p.entry, 'redo');
  };
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  undoRef.current = undo;
  redoRef.current = redo;

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y) outside text fields, which keep their own undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || isTextTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoRef.current();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        redoRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
    const removed = await clearCardsAndImages(deckId);
    recordChange();
    setHistory(EMPTY_HISTORY);
    const first = catalog.frames.find((fr) => fr.type === 'personnel') ?? catalog.frames[0];
    const fresh = newCard(first.type, first.id, deckId);
    setCards([fresh]);
    setCurrentId(fresh.id);
    await putCard(fresh);
    setNotice(`Removed ${removed} card${removed === 1 ? '' : 's'}.`);
  };

  /** Render every card with copies, in deck order; `withText` records the text for the PDF's vector layer. */
  const renderDeck = async (profile: RenderProfile, withText: boolean, squareCorners = false) => {
    const items: { canvas: HTMLCanvasElement; copies: number; textOps?: TextOp[] }[] = [];
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
        const textSink: TextOp[] | undefined = withText ? [] : undefined;
        const r = await renderCard(card, { catalog, frame: fr, template: templateFor(catalog, fr), fonts, assets, userImage, base: FRAMES_BASE, profile, textSink, squareCorners });
        items.push({ canvas: r.canvas, copies: card.copies, textOps: r.textOps });
      } catch {
        skipped.push(card.name || card.fields.title || card.id);
      }
    }
    return { items, skipped };
  };

  const pickCustomBack = async (file: File | null) => {
    try {
      if (file) await putBackImage(file);
      else await deleteBackImage();
      setCustomBack(file);
    } catch (e) {
      setNotice(`Could not store the back picture: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /** Bytes for the chosen card back: a generated plain back, or the stored picture (re-encoded unless it is already PNG or JPEG). */
  const backBytes = async (back: BackChoice): Promise<Uint8Array | undefined> => {
    if (back === 'plain') {
      const deckName = decks.find((d) => d.id === deckId)?.name ?? '';
      return canvasToBytes(buildTtsBack(BACK_PX.w, BACK_PX.h, deckName, fonts), 'image/png');
    }
    if (back === 'custom' && customBack) {
      if (customBack.type === 'image/png' || customBack.type === 'image/jpeg') return new Uint8Array(await customBack.arrayBuffer());
      const img = await assets.getBlobImage('back:image', customBack);
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')?.drawImage(img, 0, 0);
      return canvasToBytes(c, 'image/png');
    }
    return undefined;
  };

  const exportPdf = async (profileName: PrintProfile, paper: Paper, back: BackChoice, bleed: boolean) => {
    setShowExport(false);
    setExporting(true);
    setNotice(null);
    const profile = PROFILES[profileName];
    try {
      const { items, skipped } = await renderDeck(profile, true, bleed);
      const userFonts: { title?: ArrayBuffer; body?: ArrayBuffer } = {};
      for (const slot of ['title', 'body'] as const) {
        const blob = await getUserFont(slot);
        if (blob) userFonts[slot] = await blob.arrayBuffer();
      }
      const backImage = await backBytes(back);
      const bytes = await buildSheetPdf(items, profile.lossless, { userFonts, paper, back: backImage, bleed: bleed ? BLEED_PT : 0 });
      downloadBytes(bytes, `trek-cards-sheet${paper === 'a4' ? '-a4' : ''}${profileName === 'inkjet' ? '-inkjet' : ''}${backImage ? '-duplex' : ''}.pdf`);
      if (skipped.length) setNotice(`Skipped (could not render): ${skipped.join(', ')}`);
    } catch (e) {
      setNotice(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
  };

  /** Tabletop Simulator sheets: 10 × 7 grids of up to 69 cards each, plus an optional plain back. */
  const exportTts = async (includeBack: boolean) => {
    setExporting(true);
    setNotice(null);
    setTtsResult(null);
    try {
      const { items, skipped } = await renderDeck(SCREEN_PROFILE, false);
      const deckName = decks.find((d) => d.id === deckId)?.name ?? '';
      const slug = deckSlug(deckName);
      const sheets = buildTtsSheets(expandCopies(items).map((i) => i.canvas));
      const files: TtsResult['files'] = [];
      for (const [i, sheet] of sheets.entries()) {
        // WebKit may return PNG when asked for JPEG; name the file by what it holds
        const bytes = await canvasToBytes(sheet.canvas, 'image/jpeg', 0.92);
        const png = isPng(bytes);
        const name = ttsFileName(slug, i + 1, sheets.length, png ? 'png' : 'jpg');
        downloadBytes(bytes, name, png ? 'image/png' : 'image/jpeg');
        files.push({ name, role: 'face', cols: sheet.cols, rows: sheet.rows, count: sheet.count });
        // browsers drop downloads fired in the same tick
        await new Promise((r) => setTimeout(r, 400));
      }
      if (includeBack && sheets.length) {
        const name = ttsFileName(slug, 'back', sheets.length, 'png');
        const back = buildTtsBack(sheets[0].cellW, sheets[0].cellH, deckName, fonts);
        downloadBytes(await canvasToBytes(back, 'image/png'), name, 'image/png');
        files.push({ name, role: 'back', cols: 1, rows: 1, count: 1 });
      }
      setTtsResult({ files });
      if (skipped.length) setNotice(`Skipped (could not render): ${skipped.join(', ')}`);
    } catch (e) {
      setShowTts(false);
      setNotice(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
  };

  const exportList = () => {
    const deckName = decks.find((d) => d.id === deckId)?.name ?? '';
    downloadBytes(new TextEncoder().encode(buildDeckList(cards, deckName)), deckListFileName(deckName), 'text/plain');
  };

  const exportJson = async () => {
    const images: Record<string, string> = {};
    for (const c of cards) {
      if (!c.image) continue;
      const blob = await getImage(c.image.blobKey);
      if (blob) images[c.image.blobKey] = await blobToDataUrl(blob);
    }
    const deckName = decks.find((d) => d.id === deckId)?.name ?? '';
    downloadBytes(new TextEncoder().encode(serializeDeck(cards, images, deckName)), deckFileName(deckName), 'application/json');
    recordBackup();
  };

  /** Show a deck: flush nothing (pending saves carry their own deck id), load its cards, and give an empty deck a starter card. */
  const openDeck = async (id: string, preloaded?: Card[]) => {
    setDeckId(id);
    setHistory(EMPTY_HISTORY);
    await saveCurrentDeck(id);
    let next = preloaded ?? (await listCards(id));
    if (!next.length) {
      const first = catalog.frames.find((fr) => fr.type === 'personnel') ?? catalog.frames[0];
      const starter = newCard(first.type, first.id, id);
      await putCard(starter);
      next = [starter];
    }
    const ordered = normalizeOrder(next);
    for (const c of ordered.changed) await putCard(c);
    setCards(ordered.cards);
    setCurrentId(ordered.cards[ordered.cards.length - 1].id);
  };

  const createDeck = async (wanted?: string): Promise<DeckMeta | null> => {
    const name = wanted ?? window.prompt('Name for the new deck', uniqueDeckName('Deck', decks));
    if (name === null) return null;
    const meta: DeckMeta = { id: newDeckId(), name: uniqueDeckName(name, decks), createdAt: Date.now() };
    const next = [...decks, meta];
    setDecks(next);
    await saveDecks(next);
    return meta;
  };

  const newDeck = async () => {
    const meta = await createDeck();
    if (meta) await openDeck(meta.id);
  };

  const renameDeck = async () => {
    const cur = decks.find((d) => d.id === deckId);
    if (!cur) return;
    const name = window.prompt('Rename deck', cur.name);
    if (name === null || !name.trim() || name.trim() === cur.name) return;
    const next = decks.map((d) => (d.id === deckId ? { ...d, name: uniqueDeckName(name, decks.filter((x) => x.id !== deckId)) } : d));
    setDecks(next);
    await saveDecks(next);
  };

  const removeDeck = async () => {
    const cur = decks.find((d) => d.id === deckId);
    if (!cur) return;
    const n = cards.length;
    if (!window.confirm(`Delete the deck "${cur.name}" and its ${n} card${n === 1 ? '' : 's'}? This cannot be undone. Export it first if you want to keep it.`)) return;
    for (const timer of saveTimers.current.values()) window.clearTimeout(timer);
    saveTimers.current.clear();
    for (const c of cards) if (c.image) assets.dropBlob(c.image.blobKey);
    await clearCardsAndImages(deckId);
    recordChange();
    let rest = decks.filter((d) => d.id !== deckId);
    if (!rest.length) rest = [{ id: newDeckId(), name: uniqueDeckName('My deck', []), createdAt: Date.now() }];
    setDecks(rest);
    await saveDecks(rest);
    await openDeck(rest[0].id);
    setNotice(`Deleted deck "${cur.name}".`);
  };

  /** Append cards to the deck (fresh ids for any already taken), select the last one, and return what was added. */
  const addCards = async (incoming: Card[], into = deckId, present = cards): Promise<Card[]> => {
    const existing = new Set(present.map((c) => c.id));
    let order = nextOrder(present);
    const fresh = incoming.map((c) => ({ ...c, deckId: into, order: order++, ...(existing.has(c.id) ? { id: newCard(c.type, c.frameId).id } : {}) }));
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
      // Each file becomes its own deck, named from the file, and the editor switches to it.
      const meta = await createDeck(importedDeckName(file.name, parsed.name, decks));
      if (!meta) return;
      setDeckId(meta.id);
      await saveCurrentDeck(meta.id);
      setCards([]);
      const fresh = await addCards(incoming, meta.id, []);
      if (!fresh.length) await openDeck(meta.id);
      setNotice(`Imported ${fresh.length} card${fresh.length === 1 ? '' : 's'} into the new deck "${meta.name}"${remapped ? ` (${remapped} moved to base frames)` : ''}.`);
    } catch (e) {
      setNotice(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /** Rows from a spreadsheet become cards in the current deck; the notice carries the first few warnings. */
  const importCsv = async (file: File) => {
    try {
      const rows = parseDelimited(await file.text());
      const { cards: incoming, warnings } = cardsFromRows(rows, catalog, deckId);
      const fresh = await addCards(incoming);
      const notes = warnings.length ? ` ${warnings.slice(0, 3).join(' ')}${warnings.length > 3 ? ` (${warnings.length - 3} more)` : ''}` : '';
      setNotice(`Added ${fresh.length} card${fresh.length === 1 ? '' : 's'} from ${file.name}.${notes}`);
    } catch (e) {
      setNotice(`CSV import failed: ${e instanceof Error ? e.message : String(e)}`);
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
        <button onClick={undo} disabled={!undoLabel(history)} title="Ctrl+Z">
          {undoLabel(history) ?? 'Undo'}
        </button>
        <button onClick={redo} disabled={!redoLabel(history)} title="Ctrl+Shift+Z">
          {redoLabel(history) ?? 'Redo'}
        </button>
        <button onClick={() => setShowGallery(true)} disabled={!cards.length} title="Every card in this deck as a picture">
          Gallery
        </button>
        <button
          onClick={() => setShowChecks(true)}
          disabled={!cards.length}
          className={deckLint.warnings ? 'attention' : ''}
          title="Every card's checks in one place, plus numbering and the edge line for the whole deck"
        >
          Checks{deckLint.warnings ? ` · ${deckLint.warnings}` : ''}
        </button>
        {installer.canInstall && (
          <button onClick={installer.install} title="Add Trek Card Maker to your desktop or home screen; it works offline">
            Install
          </button>
        )}
        <button onClick={() => setShowHelp(true)}>Help</button>
        <button onClick={() => setShowFonts(true)}>Fonts…</button>
      </header>
      <div className="columns" data-pane={pane}>
        <DeckList
          cards={cards}
          currentId={currentId}
          busy={exporting}
          backup={backup}
          decks={decks}
          deckId={deckId}
          onSwitchDeck={openDeck}
          onNewDeck={newDeck}
          onRenameDeck={renameDeck}
          onDeleteDeck={removeDeck}
          onSelect={(id) => {
            setCurrentId(id);
            setPane('edit');
          }}
          onNew={() => {
            addCard();
            setPane('edit');
          }}
          onDuplicate={(id) => {
            const c = cards.find((x) => x.id === id);
            if (c) addCard(c);
          }}
          onDelete={removeCard}
          onReorder={reorder}
          onMoveBy={moveBy}
          onClearAll={clearAll}
          onCopiesChange={(id, copies) => {
            const c = cards.find((x) => x.id === id);
            if (c) updateCard({ ...c, copies });
          }}
          onExportPdf={() => setShowExport(true)}
          onExportTts={() => setShowTts(true)}
          onExportJson={exportJson}
          onExportList={exportList}
          onImportJson={importJson}
          onImportCsv={importCsv}
        />
        <FramePicker catalog={catalog} selectedId={current?.frameId ?? ''} onSelect={selectFrame} />
        <div className="middle">
          {pristine && <Welcome onLoadSample={loadSample} onHelp={() => setShowHelp(true)} />}
          {current && frame && template && <ImageSection card={current} frame={frame} template={template} assets={assets} onChange={updateCard} />}
          {current && <FieldsForm card={current} catalog={catalog} template={template} onChange={updateCard} />}
        </div>
        <Preview render={render} filename={current?.name || current?.fields.title || 'card'} />
      </div>
      <nav className="mobile-nav" aria-label="Sections">
        {PANES.map((p) => (
          <button key={p.id} className={pane === p.id ? 'on' : ''} onClick={() => setPane(p.id)} aria-pressed={pane === p.id}>
            {p.label}
          </button>
        ))}
      </nav>
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
      {showGallery && (
        <Gallery
          cards={cards}
          currentId={currentId}
          deckName={decks.find((d) => d.id === deckId)?.name ?? ''}
          thumbs={thumbs}
          onSelect={(id) => {
            setCurrentId(id);
            setShowGallery(false);
          }}
          onClose={() => setShowGallery(false)}
        />
      )}
      {showChecks && (
        <DeckChecks
          cards={cards}
          deckName={decks.find((d) => d.id === deckId)?.name ?? ''}
          lint={deckLint}
          onSelect={(id) => {
            setCurrentId(id);
            setPane('edit');
          }}
          onApply={applyBulk}
          onClose={() => setShowChecks(false)}
        />
      )}
      {showExport && (
        <ExportDialog
          cardCount={cards.reduce((n, c) => n + Math.max(0, c.copies), 0)}
          lowArt={lowArt}
          customBackUrl={customBackUrl}
          onCustomBack={pickCustomBack}
          onExport={exportPdf}
          onCancel={() => setShowExport(false)}
        />
      )}
      {showTts && (
        <TtsDialog
          cardCount={cards.reduce((n, c) => n + Math.max(0, c.copies), 0)}
          deckName={decks.find((d) => d.id === deckId)?.name ?? ''}
          busy={exporting}
          result={ttsResult}
          onExport={exportTts}
          onClose={() => {
            setShowTts(false);
            setTtsResult(null);
          }}
        />
      )}
    </div>
  );
}
