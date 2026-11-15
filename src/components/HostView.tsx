import { model } from '../data';
import type { Component } from '../data/types';
import { useI18n } from '../i18n';

/**
 * How a part shows up on the host: PCIe bus, Linux interface and RDMA device,
 * straight from the guide's Table 2.4.
 */
export function HostView({ component, index }: { component: Component; index: number | undefined }) {
  const i18n = useI18n();
  const { t } = i18n;
  const rows = (model.topology.pcieDevices ?? []).filter(
    (r) => r.component === component.id && (index === undefined || r.index === undefined || r.index === index),
  );
  if (rows.length === 0) return null;
  const source = rows[0]!.source;
  return (
    <section>
      <h3>{t('host.title')}</h3>
      <div className="table-scroll">
        <table className="host-table">
          <thead>
            <tr>
              <th scope="col">{t('host.label')}</th>
              <th scope="col">{t('host.bus')}</th>
              <th scope="col">{t('host.interface')}</th>
              <th scope="col">{t('host.rdma')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.label}|${r.bus}`}>
                <td>{r.label}</td>
                <td>
                  <code>{r.bus}</code>
                </td>
                <td>{r.interface ? <code>{r.interface}</code> : <span className="muted">{t('host.na')}</span>}</td>
                <td>{r.rdma ? <code>{r.rdma}</code> : <span className="muted">{t('host.na')}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {[...new Set(rows.map((r) => r.note).filter(Boolean))].map((n) => (
        <p key={n} className="note">
          {i18n.pcieNote(n)}
        </p>
      ))}
      <p className="spec-source">
        {t('panel.sourceLabel')}{' '}
        <a href={source.url} target="_blank" rel="noopener noreferrer">
          {source.section}
        </a>
        {index === undefined && rows.some((r) => r.index !== undefined) && t('host.allInstances')}
      </p>
    </section>
  );
}
