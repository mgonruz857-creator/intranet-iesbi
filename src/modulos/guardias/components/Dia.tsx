import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Download, Hand, Printer, RefreshCw, UserCog } from 'lucide-react';
import { llamarApi } from '../api';
import { etiquetaGrupo } from '../../panel/api';
import { descargarBase64, fechaLarga, hoyTexto, sumarDias, type Avisar, type FranjaCuadrante, type Guardia, type UsuarioGuardias } from '../tipos';

interface Props { usuario: UsuarioGuardias; avisar: Avisar }

/** Pantalla del día: guardias por hora (ausente, grupo, aula, tarea, quién cubre) y cuadrante de guardia. */
export default function Dia({ usuario, avisar }: Props) {
  const [fecha, setFecha] = useState(hoyTexto);
  const [guardias, setGuardias] = useState<Guardia[] | null>(null);
  const [cuadrante, setCuadrante] = useState<FranjaCuadrante[]>([]);
  const [soloMias, setSoloMias] = useState(false);

  const cargar = useCallback(async () => {
    const r = await llamarApi<{ guardias: Guardia[]; cuadrante: FranjaCuadrante[] }>('dia', { fecha });
    if (!r.ok) { avisar(r.mensaje || 'No se ha podido cargar el día.', true); setGuardias([]); return; }
    setGuardias(r.guardias);
    setCuadrante(r.cuadrante);
  }, [fecha, avisar]);

  useEffect(() => {
    setGuardias(null);
    cargar();
    const t = setInterval(cargar, 60000);
    return () => clearInterval(t);
  }, [cargar]);

  const lista = (guardias || []).filter((g) => !soloMias || g.mia);
  const sinCubrir = (guardias || []).filter((g) => !g.asignada && !g.propia).length;

  return (
    <>
    {usuario.jefatura && guardias && <ParteDia fecha={fecha} guardias={guardias} cuadrante={cuadrante} />}
    <div className="space-y-4 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setFecha(sumarDias(fecha, -1))} className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50" aria-label="Día anterior">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm" aria-label="Fecha" />
        <button onClick={() => setFecha(sumarDias(fecha, 1))} className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50" aria-label="Día siguiente">
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-slate-700 capitalize">{fechaLarga(fecha)}</span>
        {fecha !== hoyTexto() && <button onClick={() => setFecha(hoyTexto())} className="text-xs font-semibold text-sky-700 hover:underline">Hoy</button>}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={soloMias} onChange={(e) => setSoloMias(e.target.checked)} /> Solo las mías
        </label>
        <button onClick={cargar} className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50" aria-label="Actualizar">
          <RefreshCw className="w-4 h-4" />
        </button>
        {usuario.jefatura && (
          <button onClick={() => window.print()} disabled={!guardias}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-700 text-white text-xs font-semibold hover:bg-sky-800 disabled:opacity-50">
            <Printer className="w-4 h-4" /> Imprimir parte del día
          </button>
        )}
      </div>

      {usuario.jefatura && sinCubrir > 0 && (
        <div className="px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 font-semibold">
          {sinCubrir} {sinCubrir === 1 ? 'hora sin cubrir' : 'horas sin cubrir'}
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <h2 className="text-sm font-bold px-4 pt-4">Guardias del día</h2>
        {guardias === null ? (
          <p className="p-4 text-sm text-slate-500">Cargando…</p>
        ) : !lista.length ? (
          <p className="p-4 text-sm text-slate-500">{soloMias ? 'No tiene guardias asignadas este día.' : 'No hay ausencias registradas este día.'}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lista.map((g) => <FilaGuardia key={g.id} g={g} usuario={usuario} cuadrante={cuadrante} avisar={avisar} alCambiar={cargar} />)}
          </ul>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
        <h2 className="text-sm font-bold">Profesorado de guardia</h2>
        {!cuadrante.length ? (
          <p className="text-sm text-slate-500">No hay horas de guardia en el horario de este día (se cargan desde el PDF de Séneca en el Panel del centro).</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cuadrante.map((f) => (
              <div key={f.desde + f.hasta} className={'rounded-xl border p-3 text-sm ' + (f.recreo ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200')}>
                <div className="font-semibold tabular-nums">{f.desde}–{f.hasta}{f.recreo && <span className="ml-1.5 text-xs text-amber-800">Recreo</span>}</div>
                <div className="text-xs text-slate-600 mt-1">{f.docentes.map((d) => d.nombre).join(' · ')}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
    </>
  );
}

/** Parte diario de guardias para imprimir (Jefatura/Dirección). Solo se ve al imprimir. Sin motivos de ausencia. */
function ParteDia({ fecha, guardias, cuadrante }: { fecha: string; guardias: Guardia[]; cuadrante: FranjaCuadrante[] }) {
  const celda = 'border border-slate-400 px-2 py-1 align-top';
  const sinCubrir = guardias.filter((g) => !g.asignada).length;
  return (
    <div className="hidden print:block text-black text-[11px]">
      <div className="flex items-end justify-between border-b-2 border-black pb-1 mb-3">
        <div>
          <div className="text-base font-bold">Parte de guardias</div>
          <div className="capitalize text-sm">{fechaLarga(fecha)}</div>
        </div>
        <div className="text-right">IES Blas Infante · Córdoba</div>
      </div>
      {!guardias.length ? (
        <p>No hay ausencias registradas este día.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className={celda + ' text-left w-20'}>Hora</th>
              <th className={celda + ' text-left'}>Grupo</th>
              <th className={celda + ' text-left w-14'}>Aula</th>
              <th className={celda + ' text-left'}>Docente ausente</th>
              <th className={celda + ' text-left'}>Cubre</th>
              <th className={celda + ' text-left'}>Tarea</th>
            </tr>
          </thead>
          <tbody>
            {guardias.map((g) => (
              <tr key={g.id} className="break-inside-avoid">
                <td className={celda + ' tabular-nums whitespace-nowrap'}>{g.desde}–{g.hasta}</td>
                <td className={celda}>{etiquetaGrupo(g.grupo)}</td>
                <td className={celda}>{g.aula}</td>
                <td className={celda}>{g.ausente}</td>
                <td className={celda + (g.asignada ? '' : ' font-bold')}>{g.asignada ? g.asignadaNombre : 'SIN CUBRIR'}</td>
                <td className={celda}>{(g.tarea || '').slice(0, 160)}{(g.tarea || '').length > 160 ? '…' : ''}{g.archivo ? ' (archivo adjunto)' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sinCubrir > 0 && <p className="mt-2 font-bold">{sinCubrir} {sinCubrir === 1 ? 'hora sin cubrir' : 'horas sin cubrir'}.</p>}
      {cuadrante.length > 0 && (
        <div className="mt-4">
          <div className="font-bold mb-1">Profesorado de guardia</div>
          {cuadrante.map((f) => (
            <div key={f.desde + f.hasta}><span className="tabular-nums font-semibold">{f.desde}–{f.hasta}{f.recreo ? ' (recreo)' : ''}:</span> {f.docentes.map((d) => d.nombre).join(' · ')}</div>
          ))}
        </div>
      )}
      <div className="mt-6 text-[10px] text-slate-600">Impreso el {new Date().toLocaleString('es-ES')}</div>
    </div>
  );
}

interface FilaProps { g: Guardia; usuario: UsuarioGuardias; cuadrante: FranjaCuadrante[]; avisar: Avisar; alCambiar: () => void }

function FilaGuardia({ g, usuario, cuadrante, avisar, alCambiar }: FilaProps) {
  const [abierta, setAbierta] = useState(false);
  const [incidencias, setIncidencias] = useState(g.incidencias);
  const [ocupado, setOcupado] = useState(false);
  const deGuardia = cuadrante.filter((f) => !f.recreo && f.desde < g.hasta && g.desde < f.hasta).flatMap((f) => f.docentes);
  const yoDeGuardia = deGuardia.some((d) => d.email === usuario.email);

  async function accion(nombre: string, datos: Record<string, unknown>, ok: string) {
    setOcupado(true);
    const r = await llamarApi(nombre, { id: g.id, ...datos });
    setOcupado(false);
    avisar(r.ok ? ok : r.mensaje || 'No se ha podido guardar.', !r.ok);
    if (r.ok) alCambiar();
  }

  async function descargar() {
    const r = await llamarApi<{ nombre: string; tipo: string; base64: string }>('descargarTarea', { id: g.id }, 60000);
    if (!r.ok) { avisar(r.mensaje || 'No se ha podido descargar.', true); return; }
    descargarBase64(r.nombre, r.tipo, r.base64);
  }

  return (
    <li className={'p-4 ' + (g.mia ? 'bg-sky-50/60' : '')}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="w-24 shrink-0 font-semibold tabular-nums text-sm">{g.desde}–{g.hasta}</div>
        <div className="flex-1 min-w-48 text-sm">
          <div className="font-semibold">{etiquetaGrupo(g.grupo)}{g.aula && <span className="font-normal text-slate-500"> · Aula {g.aula}</span>}</div>
          <div className="text-xs text-slate-500">Ausente: {g.ausente}{g.motivo !== undefined && g.motivo && <span> · Motivo: {g.motivo}</span>}</div>
        </div>
        <div className="text-sm text-right">
          {g.propia ? (
            <div className="text-slate-500">Su ausencia</div>
          ) : g.asignada ? (
            <div className={g.mia ? 'font-bold text-sky-800' : 'text-slate-700'}>{g.mia ? 'Le toca a usted' : g.asignadaNombre}</div>
          ) : (
            <div className="font-bold text-red-700">Sin cubrir</div>
          )}
          {g.estado === 'HECHA' && <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1 justify-end"><CheckCircle2 className="w-3.5 h-3.5" /> Hecha</div>}
        </div>
        <button onClick={() => setAbierta(!abierta)} className="text-xs font-semibold text-sky-700 hover:underline self-center">
          {abierta ? 'Cerrar' : 'Tarea'}
        </button>
      </div>
      {abierta && (
        <div className="mt-3 ml-0 sm:ml-24 space-y-3 text-sm">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 whitespace-pre-wrap">{g.tarea || <span className="text-slate-500">Sin tarea escrita.</span>}</div>
          {g.archivo && (
            <button onClick={descargar} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50">
              <Download className="w-4 h-4" /> {g.archivo}
            </button>
          )}
          {(g.mia || usuario.jefatura) && g.asignada && (
            <div className="space-y-2">
              <textarea value={incidencias} onChange={(e) => setIncidencias(e.target.value)} rows={2} maxLength={2000}
                placeholder="Incidencias (opcional)" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <div className="flex flex-wrap gap-2">
                <button disabled={ocupado} onClick={() => accion('marcarHecha', { incidencias, hecha: true }, 'Guardia marcada como hecha.')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50">
                  <CheckCircle2 className="w-4 h-4" /> {g.estado === 'HECHA' ? 'Guardar incidencias' : 'Marcar como hecha'}
                </button>
                {g.estado === 'HECHA' && (
                  <button disabled={ocupado} onClick={() => accion('marcarHecha', { incidencias, hecha: false }, 'Guardia pendiente de nuevo.')}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50">Deshacer</button>
                )}
              </div>
            </div>
          )}
          {!g.asignada && !g.propia && yoDeGuardia && (
            <button disabled={ocupado} onClick={() => accion('coger', {}, 'Guardia asignada a usted.')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-700 text-white text-xs font-semibold hover:bg-sky-800">
              <Hand className="w-4 h-4" /> Cogerla yo
            </button>
          )}
          {usuario.jefatura && g.estado !== 'HECHA' && (
            <label className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <UserCog className="w-4 h-4" /> Cambiar quién la cubre:
              <select value={g.asignada} disabled={ocupado} onChange={(e) => accion('asignar', { email: e.target.value }, 'Guardia reasignada.')}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs">
                <option value="">Sin cubrir</option>
                {deGuardia.map((d) => <option key={d.email} value={d.email}>{d.nombre} (de guardia)</option>)}
                {g.asignada && !deGuardia.some((d) => d.email === g.asignada) && <option value={g.asignada}>{g.asignadaNombre}</option>}
              </select>
            </label>
          )}
        </div>
      )}
    </li>
  );
}
