import { useMemo, useState } from 'react';
import { llamarApi, etiquetaGrupo, nombreCompleto, type DocentePanel, type FilaHorario, type PermisosIntranet } from '../api';

interface Props {
  profesores: DocentePanel[];
  horarios: FilaHorario[];
  avisar: (texto: string, error?: boolean) => void;
  alCambiar: (lista: DocentePanel[]) => void;
}

const OPCIONES = {
  salidas: [['DOCENTE', 'Docente'], ['DIRECTIVO', 'Equipo directivo']],
  guardias: [['DOCENTE', 'Docente'], ['JEFATURA', 'Jefatura']],
} as const;

export default function Profesorado({ profesores, horarios, avisar, alCambiar }: Props) {
  const [filtro, setFiltro] = useState('');
  const [verBajas, setVerBajas] = useState(false);
  const [guardando, setGuardando] = useState('');

  const horasDe = useMemo(() => {
    const m: Record<string, number> = {};
    horarios.forEach((f) => { m[f[0]] = (m[f[0]] || 0) + 1; });
    return m;
  }, [horarios]);

  const q = filtro.toLowerCase();
  const lista = profesores
    .filter((d) => verBajas || d.estado !== 'INACTIVO')
    .filter((d) => !q || (nombreCompleto(d) + ' ' + d.email).toLowerCase().includes(q))
    .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'));

  async function cambiar(d: DocentePanel, cambio: Partial<PermisosIntranet>) {
    setGuardando(d.email);
    const r = await llamarApi('guardarPermisos', { email: d.email, permisos: cambio });
    setGuardando('');
    if (!r.ok) { avisar(r.error || 'No se ha podido guardar el permiso.', true); return; }
    alCambiar(profesores.map((p) => (p.email === d.email ? { ...p, permisos: r.permisos } : p)));
    avisar('Permisos de ' + nombreCompleto(d) + ' guardados.');
  }

  const admins = profesores.filter((d) => d.estado !== 'INACTIVO' && d.permisos.panel).length;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <h2 className="text-sm font-bold mr-auto">Profesorado y permisos</h2>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={verBajas} onChange={(e) => setVerBajas(e.target.checked)} /> Ver bajas
        </label>
        <input type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar…"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm" aria-label="Buscar docente" />
      </div>
      <p className="text-xs text-slate-500">
        Los cambios se guardan al momento y llegan a cada módulo en unos minutos. Administradores del panel: {admins}
        {' '}(siempre debe quedar al menos uno). El permiso de convivencia (administrador o docente) se cambia en el rol de la ficha, en la pestaña Profesorado.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="p-2 font-semibold">Docente</th>
              <th className="p-2 font-semibold">Tutoría</th>
              <th className="p-2 font-semibold">Horario</th>
              <th className="p-2 font-semibold">Convivencia</th>
              <th className="p-2 font-semibold">Salidas</th>
              <th className="p-2 font-semibold">Guardias</th>
              <th className="p-2 font-semibold">Admin. panel</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((d) => {
              const ocupado = guardando === d.email;
              return (
                <tr key={d.email} className={'border-b border-slate-100 ' + (d.estado === 'INACTIVO' ? 'opacity-50' : '')}>
                  <td className="p-2">
                    <div className="font-semibold">{nombreCompleto(d)}{d.estado === 'INACTIVO' && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200">BAJA</span>}</div>
                    <div className="text-xs text-slate-500 break-all">{d.email}</div>
                  </td>
                  <td className="p-2 whitespace-nowrap text-xs">{d.tutor_de_grupo ? etiquetaGrupo(d.tutor_de_grupo) : '—'}</td>
                  <td className="p-2 whitespace-nowrap text-xs">
                    {horasDe[d.email.toLowerCase()] ? horasDe[d.email.toLowerCase()] + ' h' : <span className="text-amber-700">Sin horario</span>}
                  </td>
                  <td className="p-2 whitespace-nowrap text-xs">{d.permisos.convivencia === 'ADMIN' ? 'Administrador' : 'Docente'}</td>
                  {(['salidas', 'guardias'] as const).map((m) => (
                    <td key={m} className="p-2">
                      <select value={d.permisos[m]} disabled={ocupado} onChange={(e) => cambiar(d, { [m]: e.target.value } as Partial<PermisosIntranet>)}
                        className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs" aria-label={'Permiso en ' + m + ' de ' + nombreCompleto(d)}>
                        {OPCIONES[m].map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                      </select>
                    </td>
                  ))}
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={d.permisos.panel} disabled={ocupado} onChange={(e) => cambiar(d, { panel: e.target.checked })}
                      aria-label={'Administrador del panel: ' + nombreCompleto(d)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
