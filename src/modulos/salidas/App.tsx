import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, DoorOpen, KeyRound, LogOut, Users } from 'lucide-react';
import Login from './components/Login';
import Aula from './components/Aula';
import Historico from './components/Historico';
import Profesorado from './components/Profesorado';
import CambiarClave from './components/CambiarClave';
import { Aviso, type AvisoDatos } from './components/Aviso';
import { EVENTO_SESION_CADUCADA, guardarToken, llamarApi, tokenGuardado } from './services/api';
import { ES_ENTORNO_PRUEBAS } from './config/entorno';
import type { Usuario } from './tipos';
import { pedirVale, cerrarSesionIntranet } from '../../nucleo/accesoUnico';

type Vista = 'aula' | 'historico' | 'profesorado';
const CLAVE_USUARIO = 'gbcs_usuario';
// Sesión abierta con el acceso único de la intranet (sin contraseña propia de este módulo)
const CLAVE_ACCESO_UNICO = 'gbcs_acceso_unico';

function leerAccesoUnico(): boolean {
  try { return sessionStorage.getItem(CLAVE_ACCESO_UNICO) === '1'; } catch { return false; }
}

function usuarioGuardado(): Usuario | null {
  try { return JSON.parse(sessionStorage.getItem(CLAVE_USUARIO) || 'null'); } catch { return null; }
}

export default function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(() => (tokenGuardado() ? usuarioGuardado() : null));
  const [vista, setVista] = useState<Vista>('aula');
  const [aviso, setAviso] = useState<AvisoDatos | null>(null);
  const [cambiandoClave, setCambiandoClave] = useState(false);
  const [accesoUnico, setAccesoUnico] = useState(leerAccesoUnico);
  // Sin sesión propia, se intenta primero el acceso único de la intranet
  const [entrando, setEntrando] = useState(() => !tokenGuardado());
  const [sinAlta, setSinAlta] = useState('');

  const avisar = useCallback((texto: string, error = false) => setAviso({ texto, error, id: Date.now() }), []);

  const salir = useCallback((motivo?: string) => {
    guardarToken('');
    try { sessionStorage.removeItem(CLAVE_USUARIO); sessionStorage.removeItem(CLAVE_ACCESO_UNICO); } catch { /* nada */ }
    setAccesoUnico(false);
    setUsuario(null);
    setVista('aula');
    if (motivo) avisar(motivo, true);
  }, [avisar]);

  useEffect(() => {
    const caducada = (e: Event) => {
      salir((e as CustomEvent).detail || 'La sesión ha caducado. Vuelva a iniciar sesión.');
      setEntrando(true); // se vuelve a intentar con la sesión de la intranet
    };
    window.addEventListener(EVENTO_SESION_CADUCADA, caducada);
    return () => window.removeEventListener(EVENTO_SESION_CADUCADA, caducada);
  }, [salir]);

  useEffect(() => {
    if (!entrando) return;
    let vigente = true;
    (async () => {
      const v = await pedirVale('salidas');
      if (!vigente) return;
      const r = v.ok ? await llamarApi<{ token: string; usuario: Usuario }>('entrarConVale', { vale: v.vale }) : null;
      if (!vigente) return;
      if (r?.ok) {
        try { sessionStorage.setItem(CLAVE_ACCESO_UNICO, '1'); } catch { /* nada */ }
        setAccesoUnico(true);
        entrar(r.token, r.usuario, false);
      } else if (r?.codigo === '401_UNAUTHORIZED') {
        setSinAlta(r.mensaje || 'Su cuenta no está dada de alta en Salidas al baño.');
      } else if (r && r.codigo !== 'SIN_ACCESO_UNICO' && r.codigo !== 'ERROR_ACCION') {
        avisar(r.mensaje || 'No se ha podido entrar con la sesión de la intranet.', true);
      } else if (!v.ok && !v.sinConfigurar) {
        avisar(v.mensaje, true);
      }
      // Si el acceso único no está configurado en algún servidor, se pide la contraseña de este módulo
      setEntrando(false);
    })();
    return () => { vigente = false; };
  }, [entrando, avisar]);

  function entrar(token: string, u: Usuario, primerAcceso: boolean) {
    guardarToken(token);
    try { sessionStorage.setItem(CLAVE_USUARIO, JSON.stringify(u)); } catch { /* nada */ }
    setUsuario(u);
    if (primerAcceso) avisar('Contraseña guardada. La usará en sus próximos accesos.');
  }

  async function cerrarSesion() {
    await llamarApi('logout');
    salir();
    // Con el acceso único, salir de aquí es salir de la intranet
    if (accesoUnico) cerrarSesionIntranet();
  }

  const pestana = (v: Vista, texto: string, Icono: typeof DoorOpen) => (
    <button onClick={() => setVista(v)}
      className={'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ' +
        (vista === v ? 'bg-sky-50 border-sky-200 text-sky-950' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')}>
      <Icono className="w-4 h-4 text-sky-600" />
      <span>{texto}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {ES_ENTORNO_PRUEBAS && (
        <div className="bg-amber-100 border-b border-amber-200 text-amber-900 text-[11px] font-semibold text-center py-1 px-4">
          Entorno de PRUEBAS · datos ficticios
        </div>
      )}
      {entrando ? (
        <div className="p-10 text-center text-slate-500">Entrando con su sesión de la intranet…</div>
      ) : sinAlta ? (
        <div className="max-w-md mx-auto mt-16 bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <p className="text-slate-700">{sinAlta}</p>
          <a href="#/" className="inline-block mt-4 text-sm font-semibold text-sky-700 hover:underline">Volver a la intranet</a>
        </div>
      ) : !usuario ? (
        <Login alEntrar={entrar} />
      ) : (
        <>
          <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
            <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 mr-auto">
                <img src="./logo_rectangular.png" alt="IES Blas Infante" className="h-10 w-auto" />
                <div className="leading-tight">
                  <div className="font-bold text-sky-950">Salidas al baño</div>
                  <div className="text-[11px] text-slate-500">IES Blas Infante · Córdoba</div>
                </div>
              </div>
              <nav className="flex items-center gap-1.5 flex-wrap">
                {pestana('aula', 'Aula', DoorOpen)}
                {usuario.directivo && pestana('historico', 'Histórico', ClipboardList)}
                {usuario.directivo && pestana('profesorado', 'Profesorado', Users)}
              </nav>
              <div className="flex items-center gap-1.5">
                <span className="hidden lg:block text-xs text-slate-500 max-w-56 truncate" title={usuario.email}>{usuario.nombre}</span>
                {!accesoUnico && (
                  <button onClick={() => setCambiandoClave(true)} title="Cambiar mi contraseña"
                    className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-sky-50 text-slate-600">
                    <KeyRound className="w-4 h-4" />
                  </button>
                )}
                <button onClick={cerrarSesion} title="Cerrar sesión"
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-red-50 text-slate-600 hover:text-red-700">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>
          <main className="max-w-6xl mx-auto px-4 py-4">
            {vista === 'aula' && <Aula usuario={usuario} avisar={avisar} />}
            {vista === 'historico' && usuario.directivo && <Historico avisar={avisar} />}
            {vista === 'profesorado' && usuario.directivo && <Profesorado avisar={avisar} />}
          </main>
          {cambiandoClave && <CambiarClave cerrar={() => setCambiandoClave(false)} avisar={avisar} />}
        </>
      )}
      <Aviso aviso={aviso} />
    </div>
  );
}
