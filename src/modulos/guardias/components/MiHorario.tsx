import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { llamarApi } from '../api';
import { etiquetaGrupo } from '../../panel/api';
import type { Avisar, UsuarioGuardias } from '../tipos';

interface Hora { dia: number; desde: string; hasta: string; grupo: string; aula: string }
interface Props { usuario: UsuarioGuardias; avisar: Avisar }

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

/** Horario semanal del docente (el de Séneca, con las horas prestadas si es sustituto). Jefatura puede ver el de cualquiera. */
export default function MiHorario({ usuario, avisar }: Props) {
  const [email, setEmail] = useState(usuario.email);
  const [horas, setHoras] = useState<Hora[] | null>(null);
  const [profesorado, setProfesorado] = useState<{ email: string; nombre: string }[]>([]);

  useEffect(() => {
    if (!usuario.jefatura) return;
    llamarApi<{ profesorado: { email: string; nombre: string }[] }>('profesorado').then((r) => { if (r.ok) setProfesorado(r.profesorado); });
  }, [usuario.jefatura]);

  useEffect(() => {
    let vigente = true;
    setHoras(null);
    llamarApi<{ horas: Hora[] }>('miHorario', email !== usuario.email ? { email } : {}).then((r) => {
      if (!vigente) return;
      if (!r.ok) { avisar(r.mensaje || 'No se ha podido cargar el horario.', true); setHoras([]); return; }
      setHoras(r.horas);
    });
    return () => { vigente = false; };
  }, [email, usuario.email, avisar]);

  const franjas = Array.from(new Set((horas || []).map((h) => h.desde + '-' + h.hasta))).sort();
  const nombre = email === usuario.email ? usuario.nombre : profesorado.find((p) => p.email === email)?.nombre || email;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {usuario.jefatura && profesorado.length > 0 && (
          <select value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Docente"
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm bg-white max-w-xs">
            <option value={usuario.email}>Mi horario</option>
            {profesorado.filter((p) => p.email !== usuario.email).map((p) => <option key={p.email} value={p.email}>{p.nombre}</option>)}
          </select>
        )}
        <button onClick={() => window.print()} disabled={!horas || !horas.length}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold hover:bg-slate-50 disabled:opacity-50">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 print:border-0 print:p-0">
        <h2 className="text-sm font-bold">Horario de {nombre}</h2>
        {horas === null ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : !horas.length ? (
          <p className="text-sm text-slate-500">No hay horario cargado. Se carga desde el PDF de Séneca en el Panel del centro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs min-w-[640px]">
              <thead>
                <tr>
                  <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 w-24 text-left">Hora</th>
                  {DIAS.map((d) => <th key={d} className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-left">{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {franjas.map((f) => {
                  const [desde, hasta] = f.split('-');
                  return (
                    <tr key={f}>
                      <td className="border border-slate-200 px-2 py-1.5 tabular-nums font-semibold whitespace-nowrap">{desde}–{hasta}</td>
                      {DIAS.map((_, i) => {
                        const aqui = horas.filter((h) => h.dia === i + 1 && h.desde === desde && h.hasta === hasta);
                        const guardia = aqui.some((h) => /^GUARDIA/.test(h.grupo));
                        return (
                          <td key={i} className={'border border-slate-200 px-2 py-1.5 align-top ' + (guardia ? 'bg-amber-50' : '')}>
                            {aqui.map((h, k) => (
                              <div key={k}>
                                <span className="font-semibold">{etiquetaGrupo(h.grupo)}</span>
                                {h.aula && <span className="text-slate-500"> · {h.aula}</span>}
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
