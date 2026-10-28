import React, { Suspense, lazy } from 'react';
import { Portada } from './nucleo/Portada';
import { BarraIntranet } from './nucleo/BarraIntranet';
import { MODULOS, type IdModulo } from './nucleo/modulos';
import { useRuta } from './nucleo/ruta';
import { useSesionIntranet, avisarCambioSesion } from './nucleo/accesoUnico';
import { EntornoBanner } from './modulos/convivencia/components/EntornoBanner';
import { LoginView } from './modulos/convivencia/components/LoginView';

// Cada módulo se descarga solo al entrar en él
const CARGADORES: Partial<Record<IdModulo, React.LazyExoticComponent<React.ComponentType>>> = {
  convivencia: lazy(() => import('./modulos/convivencia/App')),
  salidas: lazy(() => import('./modulos/salidas/App')),
};

export default function App() {
  const ruta = useRuta();
  const usuario = useSesionIntranet();

  // Un solo inicio de sesión para toda la intranet (el de convivencia). Tras entrar se sigue
  // en la dirección pedida (#/salidas…) o en la portada.
  if (!usuario) {
    return (
      <>
        <EntornoBanner />
        <LoginView onLoginSuccess={avisarCambioSesion} titulo="Intranet IESBI" subtitulo="Aplicaciones del IES Blas Infante" />
      </>
    );
  }

  const modulo = MODULOS.find((m) => m.id === ruta && m.disponible);
  const Componente = modulo && CARGADORES[modulo.id];
  if (!modulo || !Componente) return <Portada usuario={usuario} />;
  return (
    <>
      <BarraIntranet modulo={modulo.nombre} />
      <Suspense fallback={<div className="p-10 text-center text-slate-500">Cargando {modulo.nombre}…</div>}>
        <Componente />
      </Suspense>
    </>
  );
}
