import { STANDARD_SKILLS, isStandardSkill, type Skill } from '../model/skills';

interface Props {
  skills: Skill[];
  /** Skill names from the catalog; falls back to the built-in list. */
  names?: string[];
  onChange: (skills: Skill[]) => void;
}

const CUSTOM = '__custom__';

export function SkillsEditor({ skills, names, onChange }: Props) {
  const list = names && names.length ? names : [...STANDARD_SKILLS];
  const update = (i: number, patch: Partial<Skill>) => onChange(skills.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= skills.length) return;
    const next = [...skills];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="skills">
      <label>Skills</label>
      {skills.map((s, i) => {
        const standard = isStandardSkill(s.name, list);
        return (
          <div className="skill-row" key={i}>
            <input
              className="count"
              type="number"
              min={1}
              max={9}
              value={s.count}
              title="Multiplier"
              onChange={(e) => update(i, { count: Math.max(1, Math.min(9, Number(e.target.value) || 1)) })}
            />
            <select
              value={standard ? s.name : CUSTOM}
              onChange={(e) => update(i, { name: e.target.value === CUSTOM ? (standard ? '' : s.name) : e.target.value })}
            >
              {list.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value={CUSTOM}>Custom…</option>
            </select>
            {!standard && <input value={s.name} placeholder="Custom skill" onChange={(e) => update(i, { name: e.target.value })} />}
            <button onClick={() => move(i, -1)} title="Move up">
              ↑
            </button>
            <button onClick={() => move(i, 1)} title="Move down">
              ↓
            </button>
            <button onClick={() => onChange(skills.filter((_, k) => k !== i))} title="Remove">
              ×
            </button>
          </div>
        );
      })}
      <button className="add" onClick={() => onChange([...skills, { name: list[0], count: 1 }])}>
        + Add skill
      </button>
    </div>
  );
}
