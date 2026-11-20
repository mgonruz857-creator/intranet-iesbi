import { useCallback, useEffect, useState } from 'react';
import { Paperclip, Send, Trash2 } from 'lucide-react';
import { llamarApi } from '../api';
import { etiquetaGrupo } from '../../panel/api';
import { fechaLarga, hoyTexto, leerComoBase64, type Avisar, type Guardia, type UsuarioGuardias } from '../tipos';

interface Props { usuario: UsuarioGuardias; avisar: Avisar }

interface Clase { desde: string; hasta: string; grupo: string; aula: string }
interface Hora extends Clase { marcada: boolean; tarea: string; archivo: File | null }
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
    llamarApi<{ clases: Clase[] }>('misClases', { fecha, ...(docente !== usuario.email ? { email: docente } : {}) }).then((r) => {
      if (!vigente) return;
      if (!r.ok) { setHoras([]); if (r.codigo !== 'ERROR_FECHA') avisar(r.mensaje || 'No se ha podido leer el horario.', true); return; }
      setHoras(r.clases.map((c) => ({ ...c, marcada: true, tarea: '', archivo: null })));
    });
    return () => { vigente = false; };
  }, [fecha, docente, usuario.email, avisar]);

  const cambiar = (i: number, cambios: Partial<Hora>) => setHoras((h) => h && h.map((x, k) => (k === i ? { ...x, ...cambios } : x)));

  async function enviar() {
    const elegidas = (horas || []).filter((h) => h.marcada);
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
      }, 90000);
      if (!r.ok) { avisar(r.mensaje || 'No se ha podido registrar la ausencia.', true); return; }
      // Solo Jefatura/Dirección recibe si alguna hora ha quedado sin cubrir
      avisar(r.sinCubrir ? `Ausencia registrada. ${r.sinCubrir} hora(s) han quedado sin cubrir.` : 'Ausencia registrada.');
      setMotivo('');
      setHoras((h) => h && h.map((x) => ({ ...x, tarea: '', archivo: null })));
      cargarMias();
    } finally {
      setEnviando(false);
    }
  }

  async function anular(a: Ausencia) {
    if (!confirm('¿Anular la ausencia del ' + fechaLarga(a.fecha) + '? Se quitarán sus guardias.')) return;
    const r = await llamarApi('anularAusencia', { id: a.id });
    avisar(r.ok ? 'Ausencia anulada.' : r.mensaje || 'No se ha podido anular.', !r.ok);
    cargarMias();
  }

  return (
    <div className="space-y-4">
      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <h2 className="text-sm font-bold">Comunicar una ausencia</h2>
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
          <label className="text-xs text-slate-600 space-y-1 flex-1 min-w-56">
            <span className="block font-semibold">Motivo <span className="font-normal">(solo lo ven Jefatura y Dirección)</span></span>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </label>
        </div>

        {horas === null ? (
          <p className="text-sm text-slate-500">Cargando horario…</p>
        ) : !horas.length ? (
          <p className="text-sm text-slate-500">No hay clases en el horario para {fechaLarga(fecha)}.</p>
        ) : (
          <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setHoras((x) => x && x.map((h) => ({ ...h, marcada: true })))}
              className="min-h-[40px] px-4 rounded-xl border border-slate-300 text-sm font-semibold hover:bg-slate-50">Todo el día</button>
            <button type="button" onClick={() => setHoras((x) => x && x.map((h) => ({ ...h, marcada: false })))}
              className="min-h-[40px] px-4 rounded-xl border border-slate-300 text-sm font-semibold hover:bg-slate-50">Ninguna</button>
            <span className="text-xs text-slate-500 self-center">Marque las horas en las que no va a estar.</span>
          </div>
          <ul className="space-y-2">
            {horas.map((h, i) => (
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
            ))}
          </ul>
          </>
        )}
        <div className="flex justify-end">
          <button onClick={enviar} disabled={enviando || !horas?.some((h) => h.marcada)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800 disabled:opacity-50">
            <Send className="w-4 h-4" /> {enviando ? 'Enviando…' : 'Registrar ausencia'}
          </button>
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
