import { useMemo, useState } from 'react';
import { AlertTriangle, Archive, CalendarRange } from 'lucide-react';
import { llamarApi, nombreCompleto, type DocentePanel, type Sustitucion } from '../api';

export interface CursoArchivado {
  id_curso: string; archivo: string; fecha_cierre: string; cerrado_por: string;
  total_alumnos: number; total_sanciones: number; total_compensaciones: number;
}

interface Props {
  curso: string;
  archivados: CursoArchivado[];
  profesores: DocentePanel[];
  sustituciones: Sustitucion[];
  avisar: (texto: string, error?: boolean) => void;
  alCambiar: () => void;
}

function siguiente(curso: string): string {
  const m = /^(\d{4})\/(\d{4})$/.exec(curso);
  return m ? `${Number(m[1]) + 1}/${Number(m[2]) + 1}` : '';
}

/** Cambio de curso escolar para toda la intranet (solo administradores del panel). */
export default function CursoEscolar({ curso, archivados, profesores, sustituciones, avisar, alCambiar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [nuevo, setNuevo] = useState(() => siguiente(curso));
  const [confirmacion, setConfirmacion] = useState('');
  const [vaciarAlumnos, setVaciarAlumnos] = useState(false);
  const [siguen, setSiguen] = useState<Record<string, boolean>>({});
  const [enviando, setEnviando] = useState(false);

  const nombre = useMemo(() => {
    const m = new Map(profesores.map((p) => [p.email.toLowerCase(), nombreCompleto(p)]));
    return (e: string) => m.get(e.toLowerCase()) || e;
  }, [profesores]);
  const activas = sustituciones.filter((s) => s.estado === 'ACTIVA');
  const listo = /^\d{4}\/\d{4}$/.test(nuevo) && confirmacion.trim() === nuevo;

  async function cambiar() {
    if (!listo) return;
    setEnviando(true);
    const r = await llamarApi('cambiarCurso', {
      nuevo, confirmacion: confirmacion.trim(), vaciarAlumnos,
      siguen: activas.filter((s) => siguen[s.sustituto]).map((s) => s.sustituto),
    }, 120000);
    setEnviando(false);
    if (!r.ok) { avisar(r.error || 'No se ha podido cambiar de curso.', true); return; }
    avisar(`Curso ${r.curso} abierto. El curso ${r.archivado} queda archivado en ${r.archivo}.`);
    setAbierto(false);
    setConfirmacion('');
    alCambiar();
  }

  return (
    <div className="space-y-4">
      <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <CalendarRange className="w-5 h-5 text-sky-700" />
          <div className="mr-auto">
            <div className="text-xs text-slate-500">Curso escolar actual de toda la intranet</div>
            <div className="text-xl font-bold font-mono">{curso}</div>
          </div>
          {!abierto && (
            <button onClick={() => { setAbierto(true); setNuevo(siguiente(curso)); }}
              className="px-4 py-2 rounded-xl bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800">
              Cambiar de curso…
            </button>
          )}
        </div>
      </section>

      {abierto && (
        <section className="bg-white border-2 border-amber-300 rounded-2xl p-5 space-y-4">
          <h2 className="font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-600" /> Cerrar el curso {curso} y abrir uno nuevo</h2>
          <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1">
            <li>Antes de nada se hace una <strong>copia de seguridad</strong> completa.</li>
            <li>Alumnado, partes, compensaciones y expedientes del curso {curso} se guardan en un <strong>archivo aparte</strong>, que se consulta en Convivencia → Analítica.</li>
            <li>Partes y compensaciones vuelven a cero. Los <strong>expedientes abiertos</strong> siguen en el curso nuevo.</li>
            <li>El alumnado se mantiene con 10 puntos (después se actualizan los grupos con el archivo de Séneca del curso nuevo).</li>
            <li>Se borran los <strong>horarios</strong> (se suben los nuevos desde el PDF de Séneca) y se quitan todas las <strong>tutorías</strong>.</li>
            <li>Terminan las <strong>sustituciones</strong>: los titulares vuelven a tener acceso.</li>
            <li>Profesorado y permisos se mantienen. Guardias y salidas no cambian.</li>
          </ul>

          <label className="block text-sm">
            <span className="font-semibold">Curso nuevo</span>
            <input value={nuevo} onChange={(e) => setNuevo(e.target.value.trim())} placeholder="2027/2028"
              className="mt-1 block w-40 rounded-xl border border-slate-300 px-3 py-1.5 font-mono" />
          </label>

          {activas.length > 0 && (
            <div className="text-sm space-y-1.5">
              <div className="font-semibold">Sustitutos que siguen en el claustro del curso nuevo</div>
              <p className="text-xs text-slate-500">Los no marcados se dan de baja al terminar su sustitución.</p>
              {activas.map((s) => (
                <label key={s.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={!!siguen[s.sustituto]} onChange={(e) => setSiguen({ ...siguen, [s.sustituto]: e.target.checked })} />
                  <span>{nombre(s.sustituto)} <span className="text-slate-500">(sustituye a {nombre(s.titular)})</span></span>
                </label>
              ))}
            </div>
          )}

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={vaciarAlumnos} onChange={(e) => setVaciarAlumnos(e.target.checked)} />
            <span>Vaciar el alumnado para cargarlo entero de nuevo desde Séneca (no se borra quien tenga un expediente abierto). <span className="text-slate-500">Normalmente no hace falta.</span></span>
          </label>

          <label className="block text-sm">
            <span className="font-semibold">Para confirmar, escriba el curso nuevo: <span className="font-mono">{nuevo || '…'}</span></span>
            <input value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoComplete="off"
              className="mt-1 block w-40 rounded-xl border border-slate-300 px-3 py-1.5 font-mono" aria-label="Confirmación del curso nuevo" />
          </label>

          <div className="flex gap-2">
            <button onClick={cambiar} disabled={!listo || enviando}
              className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-40">
              {enviando ? 'Cambiando de curso…' : `Cerrar ${curso} y abrir ${nuevo || 'el curso nuevo'}`}
            </button>
            <button onClick={() => { setAbierto(false); setConfirmacion(''); }} disabled={enviando}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50">Cancelar</button>
          </div>
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
        <h2 className="text-sm font-bold flex items-center gap-2"><Archive className="w-4 h-4 text-slate-500" /> Cursos cerrados</h2>
        {!archivados.length ? (
          <p className="text-sm text-slate-500">Todavía no se ha cerrado ningún curso desde el panel.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Curso</th><th>Cerrado el</th><th>Por</th><th className="text-right">Alumnado</th><th className="text-right">Partes</th><th>Archivo en Drive</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {archivados.map((c) => (
                <tr key={c.id_curso}>
                  <td className="py-1.5 font-mono font-semibold">{c.id_curso}</td>
                  <td>{new Date(c.fecha_cierre).toLocaleDateString('es-ES')}</td>
                  <td className="text-xs">{nombre(c.cerrado_por)}</td>
                  <td className="text-right tabular-nums">{c.total_alumnos}</td>
                  <td className="text-right tabular-nums">{c.total_sanciones}</td>
                  <td className="text-xs font-mono">{c.archivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
