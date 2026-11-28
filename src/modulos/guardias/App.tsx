import { useCallback, useEffect, useState } from 'react';
import { BarChart3, BellRing, CalendarDays, Clock, LogOut, UserMinus } from 'lucide-react';
import Dia from './components/Dia';
import Ausencias from './components/Ausencias';
import Recuento from './components/Recuento';
import MiHorario from './components/MiHorario';
import RelojPruebas from '../../nucleo/RelojPruebas';
import { EVENTO_SESION_CADUCADA, guardarToken, llamarApi, tokenGuardado, usarServidorUnico } from './api';
import { ES_ENTORNO_PRUEBAS } from './config/entorno';
import type { Guardia, UsuarioGuardias } from './tipos';
import { etiquetaGrupo } from '../panel/api';
import { entrarServidorUnico, pedirVale, cerrarSesionIntranet } from '../../nucleo/accesoUnico';

type Vista = 'dia' | 'ausencias' | 'horario' | 'recuento';
const CLAVE_USUARIO = 'guardias_usuario';

interface AvisoDatos { texto: string; error: boolean; id: number }

function usuarioGuardado(): UsuarioGuardias | null {
  try { return JSON.parse(sessionStorage.getItem(CLAVE_USUARIO) || 'null'); } catch { return null; }
}

/** Guardias: solo se entra con la sesión de la intranet (acceso único), sin contraseña propia. */
export default function App() {
  const [usuario, setUsuario] = useState<UsuarioGuardias | null>(() => (tokenGuardado() ? usuarioGuardado() : null));
  const [entrando, setEntrando] = useState(() => !tokenGuardado());
  const [error, setError] = useState('');
  const [vista, setVista] = useState<Vista>('dia');
  const [aviso, setAviso] = useState<AvisoDatos | null>(null);
  const [misGuardias, setMisGuardias] = useState<Guardia[]>([]);
  const [reloj, setReloj] = useState(0); // cambia al simular otro día y hora (solo PRUEBAS)

  // Al entrar: las guardias que tiene asignadas hoy
  useEffect(() => {
    if (!usuario) { setMisGuardias([]); return; }
    let vigente = true;
    llamarApi<{ guardias: Guardia[] }>('misGuardias').then((r) => { if (vigente && r.ok) setMisGuardias(r.guardias || []); });
    return () => { vigente = false; };
  }, [usuario, vista, reloj]);

  const avisar = useCallback((texto: string, esError = false) => setAviso({ texto, error: esError, id: Date.now() }), []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  useEffect(() => {
    const caducada = () => {
      guardarToken('');
      try { sessionStorage.removeItem(CLAVE_USUARIO); } catch { /* nada */ }
      setUsuario(null);
      setEntrando(true); // se vuelve a entrar con la sesión de la intranet
    };
    window.addEventListener(EVENTO_SESION_CADUCADA, caducada);
    return () => window.removeEventListener(EVENTO_SESION_CADUCADA, caducada);
  }, []);

  useEffect(() => {
    if (!entrando) return;
    let vigente = true;
    (async () => {
      // Primero, el servidor único de la intranet (una sola llamada); si aún no lleva guardias, su servidor propio
      const u = await entrarServidorUnico<UsuarioGuardias>('guardias');
      if (!vigente) return;
      if (!u.noDisponible) {
        usarServidorUnico(u.ok);
        if (u.ok && u.token && u.usuario) {
          guardarToken(u.token);
          try { sessionStorage.setItem(CLAVE_USUARIO, JSON.stringify(u.usuario)); } catch { /* nada */ }
          setUsuario(u.usuario);
          setError('');
        } else {
          setError(u.mensaje || 'No se ha podido entrar en Guardias.');
        }
        setEntrando(false);
        return;
      }
      usarServidorUnico(false);
      const v = await pedirVale('guardias');
      if (!vigente) return;
      if (!v.ok) { setError(v.mensaje || 'No se ha podido entrar con la sesión de la intranet.'); setEntrando(false); return; }
      const r = await llamarApi<{ token: string; usuario: UsuarioGuardias }>('entrarConVale', { vale: v.vale });
      if (!vigente) return;
      if (r.ok) {
        guardarToken(r.token);
        try { sessionStorage.setItem(CLAVE_USUARIO, JSON.stringify(r.usuario)); } catch { /* nada */ }
        setUsuario(r.usuario);
        setError('');
      } else {
        setError(r.mensaje || 'No se ha podido entrar en Guardias.');
      }
      setEntrando(false);
    })();
    return () => { vigente = false; };
  }, [entrando]);

  async function cerrarSesion() {
    await llamarApi('logout');
    guardarToken('');
    try { sessionStorage.removeItem(CLAVE_USUARIO); } catch { /* nada */ }
    setUsuario(null);
    cerrarSesionIntranet();
  }

  const pestana = (v: Vista, texto: string, Icono: typeof CalendarDays) => (
    <button onClick={() => setVista(v)}
      className={'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ' +
        (vista === v ? 'bg-sky-50 border-sky-200 text-sky-950' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')}>
      <Icono className="w-4 h-4 text-sky-600" />
      <span>{texto}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 print:bg-white print:min-h-0">
      {ES_ENTORNO_PRUEBAS && (
        <div className="bg-amber-100 border-b border-amber-200 text-amber-900 text-[11px] font-semibold text-center py-1 px-4 print:hidden">
          Entorno de PRUEBAS · datos ficticios
        </div>
      )}
      {entrando ? (
        <div className="p-10 text-center text-slate-500">Entrando con su sesión de la intranet…</div>
      ) : !usuario ? (
        <div className="max-w-md mx-auto mt-16 bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-3">
          <p className="text-slate-700">{error || 'No se ha podido entrar en Guardias.'}</p>
          <div className="flex justify-center gap-4 text-sm font-semibold">
            <button onClick={() => setEntrando(true)} className="text-sky-700 hover:underline">Reintentar</button>
            <a href="#/" className="text-sky-700 hover:underline">Volver a la intranet</a>
          </div>
        </div>
      ) : (
        <>
          <header className="print:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
            <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3 flex-wrap">
              <div className="mr-auto leading-tight">
                <div className="font-bold text-sky-950">Guardias</div>
                <div className="text-[11px] text-slate-500">IES Blas Infante · Córdoba</div>
              </div>
              <nav className="flex items-center gap-1.5 flex-wrap">
                {pestana('dia', 'Día', CalendarDays)}
                {pestana('ausencias', 'Ausencias', UserMinus)}
                {pestana('horario', 'Mi horario', Clock)}
                {usuario.jefatura && pestana('recuento', 'Recuento', BarChart3)}
              </nav>
              <span className="hidden lg:block text-xs text-slate-500 max-w-56 truncate" title={usuario.email}>{usuario.nombre}</span>
              <button onClick={cerrarSesion} title="Cerrar sesión"
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-red-50 text-slate-600 hover:text-red-700">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </header>
          <main className="max-w-6xl mx-auto px-4 py-4 print:max-w-none print:p-0">
            <div className="print:hidden mb-4 empty:hidden"><RelojPruebas llamar={llamarApi} alCambiar={() => setReloj((n) => n + 1)} /></div>
            {misGuardias.length > 0 && (
              <div role="status" className="print:hidden mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-950">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <BellRing className="w-5 h-5 text-amber-700" />
                  {misGuardias.length === 1 ? 'Hoy tiene 1 guardia asignada' : `Hoy tiene ${misGuardias.length} guardias asignadas`}
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {misGuardias.map((g) => (
                    <li key={g.id} className="flex flex-wrap gap-x-2">
                      <span className="font-semibold tabular-nums">{g.desde}–{g.hasta}</span>
                      <span>{etiquetaGrupo(g.grupo)}{g.aula ? ` · Aula ${g.aula}` : ''}</span>
                      {g.ausente && <span className="text-amber-900">· en lugar de {g.ausente}</span>}
                      {g.estado === 'HECHA' && <span className="text-emerald-800 font-semibold">· hecha</span>}
                    </li>
                  ))}
                </ul>
                {vista !== 'dia' && (
                  <button onClick={() => setVista('dia')} className="mt-2 text-sm font-semibold text-sky-800 hover:underline">Ver la tarea y marcarla como hecha</button>
                )}
              </div>
            )}
            {vista === 'dia' && <Dia key={reloj} usuario={usuario} avisar={avisar} />}
            {vista === 'ausencias' && <Ausencias key={reloj} usuario={usuario} avisar={avisar} />}
            {vista === 'horario' && <MiHorario key={reloj} usuario={usuario} avisar={avisar} />}
            {vista === 'recuento' && usuario.jefatura && <Recuento key={reloj} avisar={avisar} />}
          </main>
        </>
      )}
      {aviso && (
        <div role="status" className={'print:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium ' +
          (aviso.error ? 'bg-red-600 text-white' : 'bg-slate-900 text-white')}>
          {aviso.texto}
        </div>
      )}
    </div>
  );
}
