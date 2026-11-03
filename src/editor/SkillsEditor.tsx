import type { IconDef } from '../catalog/types';
import type { Skill } from '../model/card';
import { FRAMES_BASE } from '../catalog/useCatalog';

interface Props {
  skills: Skill[];
  icons: IconDef[];
  onChange: (skills: Skill[]) => void;
}

export function defaultBullet(icons: IconDef[]): string {
  return icons.find((i) => i.id === 'skill-dot')?.id ?? icons[0]?.id ?? '';
}

export function SkillsEditor({ skills, icons, onChange }: Props) {
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
      {skills.map((s, i) => (
        <div className="skill-row" key={i}>
          <select value={s.icon} onChange={(e) => update(i, { icon: e.target.value })} title="Bullet icon">
            {icons.map((ic) => (
              <option key={ic.id} value={ic.id}>
                {ic.id}
              </option>
            ))}
          </select>
          {icons.find((ic) => ic.id === s.icon) && (
            <img className="icon-sm" src={FRAMES_BASE + icons.find((ic) => ic.id === s.icon)!.file} alt="" />
          )}
          <input value={s.text} placeholder="2 Engineer" onChange={(e) => update(i, { text: e.target.value })} />
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
      ))}
      <button className="add" onClick={() => onChange([...skills, { icon: defaultBullet(icons), text: '' }])}>
        + Add skill
      </button>
    </div>
  );
}
