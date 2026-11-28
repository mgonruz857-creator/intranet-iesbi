import { useMemo, useState } from 'react';
import { FileUp, Save, UserPlus, X } from 'lucide-react';
import { llamarApi, GRUPOS, etiquetaGrupo, nombreCompleto, nombreDeSeneca, conHorarioEfectivo, type DocentePanel, type FilaHorario, type HorarioPendiente, type Sustitucion } from '../api';
import Sustituciones from './Sustituciones';
import { AuthService } from '../../convivencia/services/authService';
import { buscarDocente, grupoAutomatico, interpretarPagina, tipoGuardia, type PaginaHorario } from '../../../nucleo/seneca/horarioSeneca';

const CLAVE_EQUIVALENCIAS = 'gbcs_equivalencias_grupos';
const NOMBRES_DIA = ['', 'L', 'M', 'X', 'J', 'V'];

interface Props {
  profesores: DocentePanel[];
  horarios: FilaHorario[];
  pendientes: HorarioPendiente[];
  sustituciones: Sustitucion[];
  /** Texto de grupo de Séneca → grupo de la intranet ('' = no es un grupo), guardado en el servidor. */
  equivalencias: Record<string, string>;
  avisar: (texto: string, error?: boolean) => void;
  alGuardar: () => void;
}

export default function Horarios({ profesores, horarios, pendientes, sustituciones, equivalencias, avisar, alGuardar }: Props) {
  const activos = profesores.filter((p) => p.estado !== 'INACTIVO');
  // En Séneca el nombre viene como "APELLIDOS,NOMBRE"
  const docentes = activos.map((p) => ({ email: p.email.toLowerCase(), nombre: nombreCompleto(p) }));
  const conHorario = conHorarioEfectivo(horarios, sustituciones);
  const sinHorario = docentes.filter((d) => !conHorario.has(d.email));
  return (
    <div className="space-y-4">
      <ImportarHorario docentes={docentes} grupos={GRUPOS} equivalencias={equivalencias} avisar={avisar} alGuardar={alGuardar} />
      {pendientes.length > 0 && (
        <section className="bg-white border border-amber-200 rounded-2xl p-4 text-sm space-y-3">
          <div>
            <h2 className="text-sm font-bold text-amber-900">Horarios de Séneca sin docente ({pendientes.length})</h2>
            <p className="text-xs text-slate-600">
              Estos horarios no coinciden con ningún docente dado de alta. Asígnelos a un docente, dé de alta al docente
              (el horario se le asigna solo) o descártelos si ya no está en el centro.
            </p>
          </div>
          <ul className="space-y-2">
            {pendientes.map((p) => (
              <PendienteFila key={p.nombre} pendiente={p} docentes={docentes} avisar={avisar} alResolver={alGuardar} />
            ))}
          </ul>
        </section>
      )}
      <Sustituciones profesores={profesores} sustituciones={sustituciones} avisar={avisar} alCambiar={alGuardar} />
      <section className="bg-white border border-slate-200 rounded-2xl p-4 text-sm space-y-2">
        <h2 className="text-sm font-bold">Estado</h2>
        <p className="text-slate-600">
          {conHorario.size} docentes con horario ({horarios.length} horas guardadas, de ellas{' '}
          {horarios.filter((f) => String(f[4]).startsWith('GUARDIA')).length} de guardia) · {sinHorario.length} sin horario.
        </p>
        {sinHorario.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer font-semibold text-slate-700">Ver docentes sin horario</summary>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {sinHorario.map((d) => <li key={d.email} className="text-slate-600">{d.nombre}</li>)}
            </ul>
          </details>
        )}
        {Object.keys(equivalencias).length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer font-semibold text-slate-700">
              Ver grupos de Séneca y su grupo en la intranet ({Object.keys(equivalencias).length})
            </summary>
            <p className="mt-2 text-slate-500">
              Para cambiar alguno, vuelva a subir el PDF de Séneca: la lista saldrá con estos valores, en cualquier ordenador.
            </p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(equivalencias).sort(([a], [b]) => a.localeCompare(b, 'es')).map(([t, g]) => (
                <li key={t} className={g ? 'text-slate-600' : 'text-amber-800'}>
                  <span className="font-mono">{t}</span> → {g ? etiquetaGrupo(g) : 'No es un grupo'}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

// ───────── Horario de Séneca sin docente ─────────

interface PendienteProps {
  pendiente: HorarioPendiente;
  docentes: { email: string; nombre: string }[];
  avisar: (texto: string, error?: boolean) => void;
  alResolver: () => void;
}

function PendienteFila({ pendiente, docentes, avisar, alResolver }: PendienteProps) {
  const propuesto = nombreDeSeneca(pendiente.nombre);
  const [modo, setModo] = useState<'' | 'alta'>('');
  const [existente, setExistente] = useState('');
  const [nombre, setNombre] = useState(propuesto.nombre);
  const [apellidos, setApellidos] = useState(propuesto.apellidos);
  const [email, setEmail] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const puedeAlta = AuthService.isAdmin(AuthService.getCurrentUser());
  const clases = pendiente.filas.filter((f) => !f[3].startsWith('GUARDIA')).length;

  async function resolver(datos: Record<string, unknown>, ok: string) {
    setOcupado(true);
    const r = await llamarApi('resolverHorarioPendiente', { nombreSeneca: pendiente.nombre, ...datos });
    setOcupado(false);
    if (!r.ok) { avisar(r.error || 'No se ha podido guardar.', true); return; }
    avisar(ok);
    alResolver();
  }

  function darDeAlta() {
    const correo = email.trim().toLowerCase();
    if (!nombre.trim() || !apellidos.trim()) { avisar('Escriba el nombre y los apellidos.', true); return; }
    if (!/^[^@\s]+@g\.educaand\.es$/.test(correo)) { avisar('El correo debe ser del dominio @g.educaand.es.', true); return; }
    resolver({ email: correo, nombre: nombre.trim(), apellidos: apellidos.trim() }, 'Docente dado de alta con su horario.');
  }

  return (
    <li className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold mr-auto">{pendiente.nombre}
          <span className="font-normal text-xs text-slate-500"> · {clases} clases y {pendiente.filas.length - clases} horas de guardia</span>
        </span>
        <select value={existente} onChange={(e) => setExistente(e.target.value)} disabled={ocupado}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs max-w-60" aria-label={'Docente para ' + pendiente.nombre}>
          <option value="">Asignar a un docente…</option>
          {docentes.map((d) => <option key={d.email} value={d.email}>{d.nombre}</option>)}
        </select>
        {existente && (
          <button disabled={ocupado} onClick={() => resolver({ email: existente }, 'Horario asignado.')}
            className="px-2.5 py-1 rounded-lg bg-sky-700 text-white text-xs font-semibold hover:bg-sky-800">Asignar</button>
        )}
        {puedeAlta && (
          <button disabled={ocupado} onClick={() => setModo(modo ? '' : 'alta')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold hover:bg-slate-50">
            <UserPlus className="w-3.5 h-3.5" /> Dar de alta
          </button>
        )}
        <button disabled={ocupado} title="Descartar este horario"
          onClick={() => confirm('¿Descartar el horario de ' + pendiente.nombre + '?') && resolver({ accion2: 'descartar' }, 'Horario descartado.')}
          className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-red-50 text-slate-500 hover:text-red-700">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {modo === 'alta' && (
        <div className="flex flex-wrap items-end gap-2 text-xs">
          <label className="space-y-1"><span className="block font-semibold text-slate-600">Nombre</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></label>
          <label className="space-y-1"><span className="block font-semibold text-slate-600">Apellidos</span>
            <input value={apellidos} onChange={(e) => setApellidos(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></label>
          <label className="space-y-1 flex-1 min-w-56"><span className="block font-semibold text-slate-600">Correo @g.educaand.es</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@g.educaand.es"
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></label>
          <button disabled={ocupado} onClick={darDeAlta}
            className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50">
            Dar de alta y asignar horario
          </button>
        </div>
      )}
    </li>
  );
}

// ───────── Importar horario desde los PDF de Séneca ─────────

interface ImportarProps {
  docentes: { email: string; nombre: string }[];
  grupos: string[];
  /** Equivalencias guardadas en el servidor (texto de Séneca → grupo; '' = no es un grupo). */
  equivalencias?: Record<string, string>;
  avisar: (texto: string, error?: boolean) => void;
  alGuardar: () => void;
}

function leerEquivalencias(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CLAVE_EQUIVALENCIAS) || '{}'); } catch { return {}; }
}

export function ImportarHorario({ docentes, grupos, equivalencias = {}, avisar, alGuardar }: ImportarProps) {
  const [paginas, setPaginas] = useState<PaginaHorario[]>([]);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [docenteDe, setDocenteDe] = useState<Record<string, string>>({});   // nombre Séneca → correo
  const [grupoDe, setGrupoDe] = useState<Record<string, string>>(() => ({ ...leerEquivalencias(), ...equivalencias })); // texto Séneca → código

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
    const out: FilaHorario[] = [];
    paginas.forEach((p) => {
      const email = docenteDe[p.profesor];
      if (!email) return;
      p.tramos.forEach((t) => {
        const guardia = tipoGuardia(t);
        const g = guardia || t.grupos.map(codigo).find(Boolean);
        if (g) out.push([email, t.dia, t.desde, t.hasta, g, guardia ? '' : t.aula]);
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
    if (!correos.length && !paginas.length) { avisar('No hay horarios que guardar.', true); return; }
    setGuardando(true);
    // Las páginas sin docente se guardan como pendientes, para resolverlas después
    const pendientes = paginas.filter((p) => !docenteDe[p.profesor]).map((p) => ({
      nombre: p.profesor,
      filas: p.tramos.map((t) => {
        const guardia = tipoGuardia(t);
        const g = guardia || t.grupos.map(codigo).find(Boolean) || '';
        return [t.dia, t.desde, t.hasta, g, guardia ? '' : t.aula];
      }).filter((f) => f[3]),
    })).filter((p) => p.filas.length);
    const resueltos = paginas.filter((p) => docenteDe[p.profesor]).map((p) => p.profesor);
    const usadas: Record<string, string> = {};
    textosGrupo.forEach((t) => { usadas[t] = codigo(t); });
    const r = await llamarApi('guardarHorarios', { filas, docentes: correos, pendientes, resueltos, equivalencias: usadas }, 60000);
    setGuardando(false);
    if (!r.ok) { avisar(r.error || 'No se pudo guardar el horario.', true); return; }
    avisar('Horario guardado: ' + r.guardados + ' horas de ' + r.docentes + ' docentes.' +
      (r.pendientes ? ' Hay ' + r.pendientes + ' horarios sin docente pendientes.' : ''));
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
              Docentes leídos: {paginas.length}{sinDocente ? ' · ' + sinDocente + ' sin identificar (quedarán pendientes para darlos de alta o asignarlos)' : ''}
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
                      <td className="px-2 py-1 tabular-nums">{f[2]}–{f[3]}</td><td className="px-2 py-1">{etiquetaGrupo(f[4])}</td><td className="px-2 py-1">{f[5] || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setPaginas([])} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50">Descartar</button>
            <button onClick={guardar} disabled={guardando || !paginas.length}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-sm font-semibold disabled:opacity-50">
              <Save className="w-4 h-4" /> {guardando ? 'Guardando…' : 'Guardar horario'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
