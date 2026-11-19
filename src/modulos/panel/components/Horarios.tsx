import { useMemo, useState } from 'react';
import { FileUp, Save } from 'lucide-react';
import { llamarApi, GRUPOS, etiquetaGrupo, nombreCompleto, type DocentePanel, type FilaHorario } from '../api';
import { buscarDocente, grupoAutomatico, interpretarPagina, type PaginaHorario } from '../../../nucleo/seneca/horarioSeneca';

const CLAVE_EQUIVALENCIAS = 'gbcs_equivalencias_grupos';
const NOMBRES_DIA = ['', 'L', 'M', 'X', 'J', 'V'];

interface Props {
  profesores: DocentePanel[];
  horarios: FilaHorario[];
  avisar: (texto: string, error?: boolean) => void;
  alGuardar: () => void;
}

export default function Horarios({ profesores, horarios, avisar, alGuardar }: Props) {
  const activos = profesores.filter((p) => p.estado !== 'INACTIVO');
  // En Séneca el nombre viene como "APELLIDOS,NOMBRE"
  const docentes = activos.map((p) => ({ email: p.email.toLowerCase(), nombre: nombreCompleto(p) }));
  const conHorario = new Set(horarios.map((f) => f[0]));
  const sinHorario = docentes.filter((d) => !conHorario.has(d.email));
  return (
    <div className="space-y-4">
      <ImportarHorario docentes={docentes} grupos={GRUPOS} avisar={avisar} alGuardar={alGuardar} />
      <section className="bg-white border border-slate-200 rounded-2xl p-4 text-sm space-y-2">
        <h2 className="text-sm font-bold">Estado</h2>
        <p className="text-slate-600">
          {conHorario.size} docentes con horario ({horarios.length} horas guardadas) · {sinHorario.length} sin horario.
        </p>
        {sinHorario.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer font-semibold text-slate-700">Ver docentes sin horario</summary>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {sinHorario.map((d) => <li key={d.email} className="text-slate-600">{d.nombre}</li>)}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

// ───────── Importar horario desde los PDF de Séneca ─────────

interface ImportarProps {
  docentes: { email: string; nombre: string }[];
  grupos: string[];
  avisar: (texto: string, error?: boolean) => void;
  alGuardar: () => void;
}

function leerEquivalencias(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CLAVE_EQUIVALENCIAS) || '{}'); } catch { return {}; }
}

export function ImportarHorario({ docentes, grupos, avisar, alGuardar }: ImportarProps) {
  const [paginas, setPaginas] = useState<PaginaHorario[]>([]);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [docenteDe, setDocenteDe] = useState<Record<string, string>>({});   // nombre Séneca → correo
  const [grupoDe, setGrupoDe] = useState<Record<string, string>>(leerEquivalencias); // texto Séneca → código

  async function leer(archivos: File[]) {
    if (!archivos.length) return;
    setLeyendo(true);
    try {
      const { textosDelPdf } = await import('../../../nucleo/seneca/leerPdf');
      const leidas: PaginaHorario[] = [];
      for (const a of archivos) {
        for (const textos of await textosDelPdf(await a.arrayBuffer())) {
          const p = interpretarPagina(textos);
          if (p && p.tramos.length) leidas.push(p);
        }
      }
      // Si un docente aparece dos veces, se queda la última lectura
      const porDocente = new Map(leidas.map((p) => [p.profesor, p]));
      setPaginas([...porDocente.values()]);
      const auto: Record<string, string> = {};
      porDocente.forEach((_, nombre) => { auto[nombre] = buscarDocente(nombre, docentes); });
      setDocenteDe(auto);
      if (!leidas.length) avisar('No se ha encontrado ningún horario de profesorado en el PDF.', true);
    } catch (e: any) {
      avisar('No se pudo leer el PDF: ' + (e && e.message || e), true);
    }
    setLeyendo(false);
  }

  // Textos de grupo de Séneca que aparecen, con el código propuesto
  const textosGrupo = useMemo(() => {
    const s = new Set<string>();
    paginas.forEach((p) => p.tramos.forEach((t) => t.grupos.forEach((g) => s.add(g))));
    return [...s].sort();
  }, [paginas]);

  const codigo = (texto: string) => grupoDe[texto] ?? grupoAutomatico(texto, grupos);

  const filas = useMemo(() => {
    const out: [string, number, string, string, string][] = [];
    paginas.forEach((p) => {
      const email = docenteDe[p.profesor];
      if (!email) return;
      p.tramos.forEach((t) => {
        const g = t.grupos.map(codigo).find(Boolean);
        if (g) out.push([email, t.dia, t.desde, t.hasta, g]);
      });
    });
    return out;
  }, [paginas, docenteDe, grupoDe, grupos]); // eslint-disable-line react-hooks/exhaustive-deps

  function elegirGrupo(texto: string, g: string) {
    const nuevo = { ...grupoDe, [texto]: g };
    setGrupoDe(nuevo);
    try { localStorage.setItem(CLAVE_EQUIVALENCIAS, JSON.stringify(nuevo)); } catch { /* nada */ }
  }

  async function guardar() {
    const correos = [...new Set(paginas.map((p) => docenteDe[p.profesor]).filter(Boolean))];
    if (!correos.length) { avisar('Asigne al menos un docente.', true); return; }
    setGuardando(true);
    const r = await llamarApi('guardarHorarios', { filas, docentes: correos }, 60000);
    setGuardando(false);
    if (!r.ok) { avisar(r.error || 'No se pudo guardar el horario.', true); return; }
    avisar('Horario guardado: ' + r.guardados + ' horas de ' + r.docentes + ' docentes.');
    setPaginas([]);
    alGuardar();
  }

  const sinDocente = paginas.filter((p) => !docenteDe[p.profesor]).length;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
      <h2 className="text-sm font-bold">Horario del profesorado</h2>
      <p className="text-xs text-slate-600">
        Suba el PDF <b>Horarios de profesores</b> de Séneca (uno con todo el claustro o varios, uno por docente).
        El PDF se lee en este navegador; solo se guarda qué grupo tiene cada docente a cada hora.
        Lo usan salidas (para proponer el grupo) y guardias.
      </p>
      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sm font-semibold text-sky-900 cursor-pointer">
        <FileUp className="w-4 h-4" /> {leyendo ? 'Leyendo…' : 'Elegir PDF de horarios'}
        <input type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => { leer(Array.from(e.target.files || [])); e.target.value = ''; }} />
      </label>

      {paginas.length > 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-700 mb-1.5">
              Docentes leídos: {paginas.length}{sinDocente ? ' · ' + sinDocente + ' sin identificar (no se guardarán)' : ''}
            </h3>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {paginas.map((p) => (
                <div key={p.profesor} className={'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ' + (docenteDe[p.profesor] ? 'border-slate-200' : 'border-amber-200 bg-amber-50')}>
                  <span className="font-semibold flex-1 min-w-0 truncate" title={p.profesor}>{p.profesor}</span>
                  <select value={docenteDe[p.profesor] || ''} onChange={(e) => setDocenteDe({ ...docenteDe, [p.profesor]: e.target.value })}
                    className="rounded-lg border border-slate-200 px-1.5 py-1 max-w-[55%]" aria-label={'Docente para ' + p.profesor}>
                    <option value="">— Sin identificar —</option>
                    {docentes.map((d) => <option key={d.email} value={d.email}>{d.nombre}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-700 mb-1.5">Grupos de Séneca → grupos de la intranet</h3>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {textosGrupo.map((t) => (
                <div key={t} className={'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ' + (codigo(t) ? 'border-slate-200' : 'border-amber-200 bg-amber-50')}>
                  <span className="font-semibold flex-1">{t}</span>
                  <select value={codigo(t)} onChange={(e) => elegirGrupo(t, e.target.value)} className="rounded-lg border border-slate-200 px-1.5 py-1" aria-label={'Grupo para ' + t}>
                    <option value="">— No es un grupo —</option>
                    {grupos.map((g) => <option key={g} value={g}>{etiquetaGrupo(g)}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer font-semibold text-slate-700">Ver lo que se va a guardar ({filas.length} horas)</summary>
            <div className="max-h-64 overflow-auto mt-2 border border-slate-200 rounded-lg">
              <table className="w-full">
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-2 py-1 break-all">{f[0]}</td><td className="px-2 py-1">{NOMBRES_DIA[f[1]]}</td>
                      <td className="px-2 py-1 tabular-nums">{f[2]}–{f[3]}</td><td className="px-2 py-1">{etiquetaGrupo(f[4])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setPaginas([])} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50">Descartar</button>
            <button onClick={guardar} disabled={guardando || !filas.length}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold disabled:opacity-50">
              <Save className="w-4 h-4" /> {guardando ? 'Guardando…' : 'Guardar horario'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
