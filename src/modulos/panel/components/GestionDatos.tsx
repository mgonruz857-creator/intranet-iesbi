import { useCallback, useEffect, useState } from 'react';
import { EtlImportView } from '../../convivencia/components/EtlImportView';
import { StorageService } from '../../convivencia/services/storageService';
import { AuthService } from '../../convivencia/services/authService';
import { GoogleDriveSyncService } from '../../convivencia/services/googleDriveSyncService';
import { guardarCola, hayCambiosSinSubir } from '../../convivencia/services/colaPendiente';
import type { Alumno, AuditLog, Profesor } from '../../convivencia/types/convivencia';

/**
 * Altas, bajas, edición, contraseñas, importación de Séneca y copias de seguridad del profesorado y el alumnado.
 * Son los datos del servidor central (el de convivencia): se usan las mismas pantallas y el mismo guardado
 * que tenía Convivencia, ahora desde el panel. Hace falta ser administrador de Convivencia.
 */
interface Props {
  seccion: 'profesorado' | 'alumnado' | 'copias';
  /** Tras guardar, para que las demás pestañas del panel (permisos, horarios) se actualicen. */
  alCambiar?: () => void;
}

const CANAL = 'sigc_bi_realtime_sync';

function avisarOtrasPestanas() {
  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(CANAL);
      bc.postMessage({ type: 'DATA_UPDATED', timestamp: Date.now() });
      bc.close();
    }
  } catch { /* sin canal: no pasa nada */ }
}

export default function GestionDatos({ seccion, alCambiar }: Props) {
  const usuario: Profesor | null = AuthService.getCurrentUser();
  const esAdmin = AuthService.isAdmin(usuario);
  const [cargado, setCargado] = useState(StorageService.hasLoadedFromDrive());
  const [error, setError] = useState('');
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [registro, setRegistro] = useState<AuditLog[]>([]);

  const refrescar = useCallback(() => {
    setProfesores(StorageService.getProfesores());
    setAlumnos(StorageService.getAlumnos());
    setRegistro(StorageService.getAuditLogs());
  }, []);

  useEffect(() => {
    if (!esAdmin) return;
    refrescar();
    let vivo = true;
    const traer = () => {
      if (document.visibilityState === 'hidden') return;
      GoogleDriveSyncService.pullFromGoogleDrive({ forceRefresh: true })
        .then((r) => {
          if (!vivo) return;
          if (r.success) { setCargado(true); setError(''); refrescar(); }
          else if (!StorageService.hasLoadedFromDrive()) setError(r.message || 'No se han podido cargar los datos.');
        })
        .catch(() => { if (vivo && !StorageService.hasLoadedFromDrive()) setError('No se han podido cargar los datos.'); });
    };
    traer();
    const intervalo = setInterval(traer, 10000);
    let canal: BroadcastChannel | null = null;
    try {
      canal = new BroadcastChannel(CANAL);
      canal.onmessage = (e) => { if (e.data?.type === 'DATA_UPDATED') refrescar(); };
    } catch { canal = null; }
    // Como en Convivencia: lo que no se haya subido se guarda en el navegador y se avisa antes de cerrar
    const alCerrar = (e: BeforeUnloadEvent) => {
      const email = AuthService.getCurrentUser()?.email;
      guardarCola(email);
      if (email && hayCambiosSinSubir()) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', alCerrar);
    window.addEventListener('focus', traer);
    return () => {
      vivo = false;
      clearInterval(intervalo);
      canal?.close();
      window.removeEventListener('beforeunload', alCerrar);
      window.removeEventListener('focus', traer);
    };
  }, [esAdmin, refrescar]);

  if (!usuario || !esAdmin) {
    return (
      <section className="bg-white border border-amber-200 rounded-2xl p-5 text-sm text-amber-900">
        Para dar de alta o de baja, editar o importar profesorado y alumnado hace falta ser <b>administrador de
        Convivencia</b> (rol en la ficha del docente). Pídaselo a Jefatura de Estudios o a Dirección.
      </section>
    );
  }
  if (error) {
    return <div className="bg-white border border-red-200 rounded-2xl p-6 text-center text-sm text-red-700">{error}</div>;
  }
  if (!cargado) return <div className="p-10 text-center text-slate-500">Cargando datos del centro…</div>;

  return (
    <div className="space-y-3">
      {seccion === 'copias' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 text-sm text-slate-700 space-y-2">
          <h2 className="font-bold text-slate-900">Copias de seguridad</h2>
          <p>
            El servidor central hace <b>una copia automática cada día</b> en la carpeta <code>COPIAS_SEGURIDAD</code> de su
            carpeta de datos en Drive. Además, aquí abajo puede descargar ahora una copia completa a su equipo.
          </p>
          <p className="text-slate-500">
            Para recuperar una copia diaria hay que hacerlo desde el editor de Apps Script del servidor central
            (función <code>restaurarCopiaDiaria</code>). Es una operación delicada: consúltelo antes con el responsable
            de la intranet.
          </p>
        </section>
      )}
      <EtlImportView
        currentUser={usuario}
        seccion={seccion}
        auditLogs={registro}
        profesores={profesores}
        alumnos={alumnos}
        onImportCompleted={() => {
          refrescar();
          avisarOtrasPestanas();
          GoogleDriveSyncService.triggerFastSync(150);
          if (alCambiar) setTimeout(alCambiar, 4000);
        }}
      />
    </div>
  );
}
