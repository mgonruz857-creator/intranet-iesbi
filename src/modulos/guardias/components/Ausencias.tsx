import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip, Pencil, Send, Trash2, X } from 'lucide-react';
import { llamarApi } from '../api';
import { etiquetaGrupo } from '../../panel/api';
import { fechaLarga, hoyTexto, leerComoBase64, type Avisar, type Guardia, type UsuarioGuardias } from '../tipos';

interface Props { usuario: UsuarioGuardias; avisar: Avisar }

interface Clase { desde: string; hasta: string; grupo: string; aula: string }
interface Hora extends Clase { marcada: boolean; tarea: string; archivo: File | null }
/** Hora ya comunicada en una ausencia de ese día (se puede quitar). */
interface Comunicada { id: string; idAusencia: string; desde: string; hasta: string; grupo: string; tarea: string; archivo: string; hecha: boolean }
interface Ausencia { id: string; fecha: string; motivo: string; horas: Guardia[] }

const MAX_BYTES = 8 * 1024 * 1024;

/** Comunicar una ausencia (con la tarea de cada hora) y ver las propias. */
export default function Ausencias({ usuario, avisar }: Props) {
  const [docente, setDocente] = useState(usuario.email);
  const [profesorado, setProfesorado] = useState<{ email: string; nombre: string }[]>([]);
  const [fecha, setFecha] = useState(hoyTexto);
  const [motivo, setMotivo] = useState('');
  const [horas, setHoras] = useState<Hora[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mias, setMias] = useState<Ausencia[] | null>(null);
  const [comunicadas, setComunicadas] = useState<Comunicada[]>([]);
  const [recarga, setRecarga] = useState(0);
  const [quitando, setQuitando] = useState('');
  const formulario = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!usuario.jefatura) return;
    llamarApi<{ profesorado: { email: string; nombre: string }[] }>('profesorado').then((r) => { if (r.ok) setProfesorado(r.profesorado); });
  }, [usuario.jefatura]);

  const cargarMias = useCallback(async () => {
    const r = await llamarApi<{ ausencias: Ausencia[] }>('misAusencias');
    setMias(r.ok ? r.ausencias : []);
  }, []);
  useEffect(() => { cargarMias(); }, [cargarMias]);

  useEffect(() => {
    let vigente = true;
    setHoras(null);
    llamarApi<{ clases: Clase[]; comunicadas?: Comunicada[] }>('misClases', { fecha, ...(docente !== usuario.email ? { email: docente } : {}) }).then((r) => {
      if (!vigente) return;
      if (!r.ok) { setHoras([]); setComunicadas([]); if (r.codigo !== 'ERROR_FECHA') avisar(r.mensaje || 'No se ha podido leer el horario.', true); return; }
      const ya = r.comunicadas || [];
      setComunicadas(ya);
      // Si ya hay ausencia ese día, se parte sin nada marcado: solo se marcan las horas que se quieren añadir
      setHoras(r.clases.map((c) => ({ ...c, marcada: !ya.length, tarea: '', archivo: null })));
    });
    return () => { vigente = false; };
  }, [fecha, docente, usuario.email, avisar, recarga]);

  const comunicadaDe = (h: Clase) => comunicadas.find((c) => c.desde < h.hasta && h.desde < c.hasta);
  const ausenciaDelDia = comunicadas[0]?.idAusencia || '';
  const pasado = fecha < hoyTexto() && !usuario.jefatura;

  const cambiar = (i: number, cambios: Partial<Hora>) => setHoras((h) => h && h.map((x, k) => (k === i ? { ...x, ...cambios } : x)));

  async function enviar() {
    const elegidas = (horas || []).filter((h) => h.marcada && !comunicadaDe(h));
    if (!elegidas.length) { avisar('Marque al menos una hora.', true); return; }
    if (elegidas.some((h) => h.archivo && h.archivo.size > MAX_BYTES)) { avisar('Cada archivo puede tener como máximo 8 MB.', true); return; }
    setEnviando(true);
    try {
      const datos = await Promise.all(elegidas.map(async (h) => ({
        desde: h.desde, hasta: h.hasta, grupo: h.grupo, aula: h.aula, tarea: h.tarea,
        archivo: h.archivo ? { nombre: h.archivo.name, tipo: h.archivo.type, base64: await leerComoBase64(h.archivo) } : undefined,
      })));
      const r = await llamarApi<{ sinCubrir?: number }>('registrarAusencia', {
        fecha, motivo, horas: datos, ...(docente !== usuario.email ? { email: docente } : {}),
        ...(ausenciaDelDia ? { ausencia: ausenciaDelDia } : {}),
      }, 90000);
      if (!r.ok) { avisar(r.mensaje || 'No se ha podido registrar la ausencia.', true); return; }
      // Solo Jefatura/Dirección recibe si alguna hora ha quedado sin cubrir
      const base = ausenciaDelDia ? 'Horas añadidas a la ausencia.' : 'Ausencia registrada.';
      avisar(r.sinCubrir ? `${base} ${r.sinCubrir} hora(s) han quedado sin cubrir.` : base);
      setMotivo('');
      setRecarga((n) => n + 1);
      cargarMias();
    } finally {
      setEnviando(false);
    }
  }

  async function quitar(c: Comunicada) {
    if (!confirm(`¿Quitar la hora de ${c.desde} a ${c.hasta} de la ausencia?` + (comunicadas.length === 1 ? ' Es la única: la ausencia se anulará.' : ''))) return;
    setQuitando(c.id);
    try {
      const r = await llamarApi<{ ausenciaAnulada?: boolean }>('quitarHora', { id: c.id });
      if (!r.ok) { avisar(r.mensaje || 'No se ha podido quitar la hora.', true); return; }
      avisar(r.ausenciaAnulada ? 'Hora quitada. Ya no queda ninguna: la ausencia se ha anulado.' : 'Hora quitada de la ausencia.');
      setRecarga((n) => n + 1);
      cargarMias();
    } finally {
      setQuitando('');
    }
  }

  function modificar(a: Ausencia) {
    setDocente(usuario.email);
    setFecha(a.fecha);
    formulario.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function anular(a: Ausencia) {
    if (!confirm('¿Anular la ausencia del ' + fechaLarga(a.fecha) + '? Se quitarán sus guardias.')) return;
    const r = await llamarApi('anularAusencia', { id: a.id });
    avisar(r.ok ? 'Ausencia anulada.' : r.mensaje || 'No se ha podido anular.', !r.ok);
    cargarMias();
  }

  return (
    <div className="space-y-4">
      <section ref={formulario} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 scroll-mt-20">
        <h2 className="text-sm font-bold">{comunicadas.length ? 'Modificar la ausencia de este día' : 'Comunicar una ausencia'}</h2>
        <div className="flex flex-wrap gap-3 items-end">
          {usuario.jefatura && (
            <label className="text-xs text-slate-600 space-y-1">
              <span className="block font-semibold">Docente</span>
              <select value={docente} onChange={(e) => setDocente(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm max-w-72">
                <option value={usuario.email}>Yo ({usuario.nombre})</option>
                {profesorado.filter((p) => p.email !== usuario.email).map((p) => <option key={p.email} value={p.email}>{p.nombre}</option>)}
              </select>
            </label>
          )}
          <label className="text-xs text-slate-600 space-y-1">
            <span className="block font-semibold">Día</span>
            <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </label>
          {!comunicadas.length && <label className="text-xs text-slate-600 space-y-1 flex-1 min-w-56">
            <span className="block font-semibold">Motivo <span className="font-normal">(solo lo ven Jefatura y Dirección)</span></span>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </label>}
        </div>

        {horas === null ? (
          <p className="text-sm text-slate-500">Cargando horario…</p>
        ) : !horas.length ? (
          <p className="text-sm text-slate-500">No hay clases en el horario para {fechaLarga(fecha)}.</p>
        ) : (
          <>
          {comunicadas.length > 0 && (
            <p className="text-sm text-sky-900 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
              Ya hay una ausencia comunicada este día. Puede quitar horas o marcar otras para añadirlas.
            </p>
          )}
          {!pasado && horas.some((h) => !comunicadaDe(h)) && <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setHoras((x) => x && x.map((h) => ({ ...h, marcada: true })))}
              className="min-h-[40px] px-4 rounded-xl border border-slate-300 text-sm font-semibold hover:bg-slate-50">Todo el día</button>
            <button type="button" onClick={() => setHoras((x) => x && x.map((h) => ({ ...h, marcada: false })))}
              className="min-h-[40px] px-4 rounded-xl border border-slate-300 text-sm font-semibold hover:bg-slate-50">Ninguna</button>
            <span className="text-xs text-slate-500 self-center">Marque las horas en las que no va a estar.</span>
          </div>}
          <ul className="space-y-2">
            {horas.map((h, i) => {
              const ya = comunicadaDe(h);
              if (ya) return (
                <li key={h.desde} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-semibold tabular-nums">{h.desde}–{h.hasta}</span>
                  <span className="font-semibold">{etiquetaGrupo(h.grupo)}</span>
                  <span className="text-xs text-amber-900 bg-amber-100 rounded-full px-2 py-0.5">{ya.hecha ? 'Comunicada · guardia hecha' : 'Comunicada'}</span>
                  {ya.tarea && <span className="text-xs text-slate-600 w-full sm:w-auto sm:flex-1 truncate">Tarea: {ya.tarea}</span>}
                  {!ya.hecha && !pasado && (
                    <button type="button" onClick={() => quitar(ya)} disabled={quitando === ya.id}
                      className="ml-auto inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl border border-red-200 bg-white text-red-700 text-sm font-semibold hover:bg-red-50 disabled:opacity-50">
                      <X className="w-4 h-4" /> {quitando === ya.id ? 'Quitando…' : 'Quitar esta hora'}
                    </button>
                  )}
                </li>
              );
              return (
              <li key={h.desde} className={'rounded-xl border p-3 space-y-2 ' + (h.marcada ? 'border-sky-200 bg-sky-50/40' : 'border-slate-200')}>
                <label className="flex items-center gap-3 text-sm font-semibold min-h-[40px] cursor-pointer">
                  <input type="checkbox" className="w-6 h-6 shrink-0 accent-sky-700" checked={h.marcada} onChange={(e) => cambiar(i, { marcada: e.target.checked })} />
                  <span className="tabular-nums">{h.desde}–{h.hasta}</span>
                  <span>{etiquetaGrupo(h.grupo)}</span>
                  {h.aula && <span className="font-normal text-slate-500">· Aula {h.aula}</span>}
                </label>
                {h.marcada && (
                  <div className="space-y-2">
                    <textarea value={h.tarea} onChange={(e) => cambiar(i, { tarea: e.target.value })} rows={2} maxLength={4000}
                      placeholder="Tarea para el grupo" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white" />
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <Paperclip className="w-4 h-4" />
                      <span>{h.archivo ? h.archivo.name : 'Adjuntar archivo (opcional, máx. 8 MB)'}</span>
                      <input type="file" className="hidden" onChange={(e) => cambiar(i, { archivo: e.target.files?.[0] || null })} />
                    </label>
                  </div>
                )}
              </li>
              );
            })}
          </ul>
          </>
        )}
        <div className="flex justify-end">
          {!pasado && (!comunicadas.length || horas?.some((h) => !comunicadaDe(h))) && (
          <button onClick={enviar} disabled={enviando || !horas?.some((h) => h.marcada && !comunicadaDe(h))}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800 disabled:opacity-50">
            <Send className="w-4 h-4" /> {enviando ? 'Enviando…' : comunicadas.length ? 'Añadir las horas marcadas' : 'Registrar ausencia'}
          </button>
          )}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
        <h2 className="text-sm font-bold">Mis ausencias</h2>
        {mias === null ? <p className="text-sm text-slate-500">Cargando…</p> : !mias.length ? (
          <p className="text-sm text-slate-500">No tiene ausencias registradas.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {mias.map((a) => (
              <li key={a.id} className="py-2 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold capitalize w-48">{fechaLarga(a.fecha)}</span>
                <span className="flex-1 text-slate-600 text-xs">
                  {a.horas.map((h) => `${h.desde} ${etiquetaGrupo(h.grupo)}` + (h.propia ? '' : `: ${h.asignadaNombre || 'sin cubrir'}${h.estado === 'HECHA' ? ' ✓' : ''}`)).join(' · ')}
                </span>
                {a.fecha >= hoyTexto() && (
                  <button onClick={() => modificar(a)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 text-xs hover:bg-sky-50 text-sky-800">
                    <Pencil className="w-3.5 h-3.5" /> Modificar
                  </button>
                )}
                {a.fecha >= hoyTexto() && (
                  <button onClick={() => anular(a)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 text-xs hover:bg-red-50 text-red-700">
                    <Trash2 className="w-3.5 h-3.5" /> Anular
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
