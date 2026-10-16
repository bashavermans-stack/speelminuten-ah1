import { useDataset } from '../data';
import type { Filter } from '../stats/statistiek';

export function FilterBalk({ filter, onChange, metTegenstander = true }: { filter: Filter; onChange: (f: Filter) => void; metTegenstander?: boolean }) {
  const data = useDataset();
  const heeftThuisUit = data.wedstrijden.some((w) => w.thuisUit);
  return (
    <div className="filters">
      <select aria-label="Seizoen" value={filter.seizoen} onChange={(e) => onChange({ ...filter, seizoen: e.target.value })} className={metTegenstander ? '' : 'breed'}>
        <option value="alle">Alle seizoenen</option>
        {[...data.seizoenen].reverse().map((s) => (
          <option key={s} value={s}>Seizoen {s}</option>
        ))}
      </select>
      {metTegenstander && (
        <select aria-label="Tegenstander" value={filter.tegenstanderId} onChange={(e) => onChange({ ...filter, tegenstanderId: e.target.value })}>
          <option value="alle">Alle tegenstanders</option>
          {data.tegenstanders.map((t) => (
            <option key={t.id} value={t.id}>{t.naam}</option>
          ))}
        </select>
      )}
      {heeftThuisUit && (
        <select aria-label="Thuis of uit" className="breed" value={filter.thuisUit} onChange={(e) => onChange({ ...filter, thuisUit: e.target.value as Filter['thuisUit'] })}>
          <option value="alle">Thuis en uit</option>
          <option value="thuis">Alleen thuis</option>
          <option value="uit">Alleen uit</option>
        </select>
      )}
    </div>
  );
}
