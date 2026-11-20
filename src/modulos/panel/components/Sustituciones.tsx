import { useState } from 'react';
import { ArrowRight, Repeat, UserCheck, UserPlus } from 'lucide-react';
import { llamarApi, etiquetaGrupo, nombreCompleto, type DocentePanel, type Sustitucion } from '../api';
import { AuthService } from '../../convivencia/services/authService';

interface Props {
  profesores: DocentePanel[];
  sustituciones: Sustitucion[];
  avisar: (texto: string, error?: boolean) => void;
  alCambiar: () => void;
}

const fecha = (f: string) => (f ? f.split('-').reverse().join('/') : '');

/**
 * Sustituciones: el titular de baja temporal no entra en la intranet y su horario y su tutoría los usa el
 * sustituto. Si el sustituto también se va, se asigna otro. Al volver el titular, todo vuelve a él.
 */
export default function Sustituciones({ profesores, sustituciones, avisar, alCambiar }: Props) {
  const nombreDe = (email: string) => {
    const p = profesores.find((x) => x.email.toLowerCase() === email);
    return p ? nombreCompleto(p) : email;
  };
  const activas = sustituciones.filter((s) => s.estado === 'ACTIVA');
  const pasadas = sustituciones.filter((s) => s.estado !== 'ACTIVA');
  const ocupados = new Set(activas.flatMap((s) => [s.titular, s.sustituto]));
  const activos = profesores.filter((p) => p.estado !== 'INACTIVO');
  const [nueva, setNueva] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(datos: Record<string, unknown>, ok: string): Promise<boolean> {
    setOcupado(true);
    const r = await llamarApi('gestionarSustitucion', datos);
    setOcupado(false);
    if (!r.ok) { avisar(r.error || 'No se ha podido guardar.', true); return false; }
    avisar(ok);
    alCambiar();
    return true;
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 text-sm space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="text-sm font-bold">Sustituciones</h2>
          <p className="text-xs text-slate-500">
            Mientras dura, el titular no puede entrar en la intranet y el sustituto usa su horario y su tutoría.
          </p>
        </div>
        <button onClick={() => setNueva(!nueva)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-700 text-white text-xs font-semibold hover:bg-sky-800">
          <UserPlus className="w-4 h-4" /> Nueva sustitución
        </button>
      </div>

      {nueva && (
        <FormSustituto
          titulo="Nueva sustitución"
          conTitular
          titulares={activos.filter((p) => !ocupados.has(p.email.toLowerCase()))}
          candidatos={activos.filter((p) => !ocupados.has(p.email.toLowerCase()))}
          ocupado={ocupado}
          avisar={avisar}
          alCancelar={() => setNueva(false)}
          alEnviar={async (d) => { if (await enviar({ operacion: 'iniciar', ...d }, 'Sustitución registrada.')) setNueva(false); }}
        />
      )}

      {!activas.length ? (
        <p className="text-slate-500">No hay sustituciones en curso.</p>
      ) : (
        <ul className="space-y-2">
          {activas.map((s) => (
            <FilaSustitucion key={s.id} s={s} nombreDe={nombreDe} candidatos={activos.filter((p) => !ocupados.has(p.email.toLowerCase()))}
              ocupado={ocupado} avisar={avisar} enviar={enviar} />
          ))}
        </ul>
      )}

      {pasadas.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-slate-700">Sustituciones terminadas ({pasadas.length})</summary>
          <ul className="mt-2 space-y-1 text-slate-600">
            {pasadas.slice().reverse().map((s) => (
              <li key={s.id}>
                {nombreDe(s.titular)}: {[...s.anteriores.map((a) => nombreDe(a.sustituto)), nombreDe(s.sustituto)].join(', ')}
                {' '}(hasta el {fecha(s.hasta)})
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

interface FilaProps {
  s: Sustitucion;
  nombreDe: (email: string) => string;
  candidatos: DocentePanel[];
  ocupado: boolean;
  avisar: (texto: string, error?: boolean) => void;
  enviar: (datos: Record<string, unknown>, ok: string) => Promise<boolean>;
}

function FilaSustitucion({ s, nombreDe, candidatos, ocupado, avisar, enviar }: FilaProps) {
  const [modo, setModo] = useState<'' | 'cambiar' | 'finalizar'>('');
  const [bajaSustituto, setBajaSustituto] = useState(true);
  return (
    <li className="rounded-xl border border-slate-200 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{nombreDe(s.titular)}</span>
        <span className="text-xs text-slate-500">de baja</span>
        <ArrowRight className="w-4 h-4 text-slate-400" />
        <span className="font-semibold text-sky-800">{nombreDe(s.sustituto)}</span>
        <span className="text-xs text-slate-500 mr-auto">
          desde el {fecha(s.desde)}{s.tutoria ? ' · tutoría de ' + etiquetaGrupo(s.tutoria) : ''}
          {s.anteriores.length > 0 && ' · antes: ' + s.anteriores.map((a) => nombreDe(a.sustituto)).join(', ')}
        </span>
        <button onClick={() => setModo(modo === 'cambiar' ? '' : 'cambiar')}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50">
          <Repeat className="w-3.5 h-3.5" /> Cambiar sustituto
        </button>
        <button onClick={() => setModo(modo === 'finalizar' ? '' : 'finalizar')}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs font-semibold hover:bg-emerald-100">
          <UserCheck className="w-3.5 h-3.5" /> Vuelve el titular
        </button>
      </div>
      {modo === 'cambiar' && (
        <FormSustituto
          titulo={'Nuevo sustituto de ' + nombreDe(s.titular)}
          candidatos={candidatos}
          bajaAnterior={nombreDe(s.sustituto)}
          ocupado={ocupado}
          avisar={avisar}
          alCancelar={() => setModo('')}
          alEnviar={async (d) => { if (await enviar({ operacion: 'cambiar', id: s.id, ...d }, 'Sustituto cambiado.')) setModo(''); }}
        />
      )}
      {modo === 'finalizar' && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-emerald-50/60 border border-emerald-200 p-2 text-xs">
          <label className="flex items-center gap-1.5 mr-auto">
            <input type="checkbox" checked={bajaSustituto} onChange={(e) => setBajaSustituto(e.target.checked)} />
            Dar de baja a {nombreDe(s.sustituto)} (se conserva todo lo que haya registrado)
          </label>
          <button disabled={ocupado} onClick={() => enviar({ operacion: 'finalizar', id: s.id, bajaSustituto }, 'Sustitución terminada: el titular recupera su horario y su acceso.')}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50">
            Terminar sustitución
          </button>
        </div>
      )}
    </li>
  );
}

interface FormProps {
  titulo: string;
  conTitular?: boolean;
  titulares?: DocentePanel[];
  candidatos: DocentePanel[];
  /** Nombre del sustituto que se va (al cambiar de sustituto) */
  bajaAnterior?: string;
  ocupado: boolean;
  avisar: (texto: string, error?: boolean) => void;
  alCancelar: () => void;
  alEnviar: (datos: Record<string, unknown>) => void;
}

function FormSustituto({ titulo, conTitular, titulares = [], candidatos, bajaAnterior, ocupado, avisar, alCancelar, alEnviar }: FormProps) {
  const [titular, setTitular] = useState('');
  const [existente, setExistente] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [email, setEmail] = useState('');
  const [baja, setBaja] = useState(true);
  const puedeAlta = AuthService.isAdmin(AuthService.getCurrentUser());

  function enviar() {
    if (conTitular && !titular) { avisar('Elija el docente de baja.', true); return; }
    const datos: Record<string, unknown> = conTitular ? { titular } : { bajaAnterior: baja };
    if (existente && existente !== 'nuevo') {
      if (existente === titular) { avisar('El sustituto no puede ser el titular.', true); return; }
      alEnviar({ ...datos, email: existente });
      return;
    }
    const correo = email.trim().toLowerCase();
    if (!nombre.trim() || !apellidos.trim()) { avisar('Escriba el nombre y los apellidos del sustituto.', true); return; }
    if (!/^[^@\s]+@g\.educaand\.es$/.test(correo)) { avisar('El correo debe ser del dominio @g.educaand.es.', true); return; }
    alEnviar({ ...datos, email: correo, nombre: nombre.trim(), apellidos: apellidos.trim() });
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3 space-y-2 text-xs">
      <div className="font-semibold text-slate-700">{titulo}</div>
      <div className="flex flex-wrap items-end gap-2">
        {conTitular && (
          <label className="space-y-1"><span className="block font-semibold text-slate-600">Docente de baja (titular)</span>
            <select value={titular} onChange={(e) => setTitular(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm max-w-64">
              <option value="">Elegir…</option>
              {titulares.map((p) => <option key={p.email} value={p.email.toLowerCase()}>{nombreCompleto(p)}</option>)}
            </select>
          </label>
        )}
        <label className="space-y-1"><span className="block font-semibold text-slate-600">Sustituto</span>
          <select value={existente} onChange={(e) => setExistente(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm max-w-64">
            <option value="">Elegir…</option>
            {puedeAlta && <option value="nuevo">Docente nuevo (dar de alta)</option>}
            {candidatos.filter((p) => p.email.toLowerCase() !== titular).map((p) => <option key={p.email} value={p.email.toLowerCase()}>{nombreCompleto(p)}</option>)}
          </select>
        </label>
        {existente === 'nuevo' && (
          <>
            <label className="space-y-1"><span className="block font-semibold text-slate-600">Nombre</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></label>
            <label className="space-y-1"><span className="block font-semibold text-slate-600">Apellidos</span>
              <input value={apellidos} onChange={(e) => setApellidos(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></label>
            <label className="space-y-1 flex-1 min-w-52"><span className="block font-semibold text-slate-600">Correo @g.educaand.es</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@g.educaand.es"
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></label>
          </>
        )}
      </div>
      {bajaAnterior && (
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={baja} onChange={(e) => setBaja(e.target.checked)} />
          Dar de baja a {bajaAnterior} (se conserva todo lo que haya registrado)
        </label>
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={alCancelar} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold hover:bg-slate-50">Cancelar</button>
        <button disabled={ocupado || !existente} onClick={enviar} className="px-3 py-1.5 rounded-lg bg-sky-700 text-white font-semibold hover:bg-sky-800 disabled:opacity-50">Guardar</button>
      </div>
    </div>
  );
}
