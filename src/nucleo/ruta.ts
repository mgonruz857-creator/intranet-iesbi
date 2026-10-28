/**
 * Navegación por la parte "#" de la dirección (#/convivencia, #/salidas…),
 * que GitHub Pages sirve sin configuración extra.
 */
import { useEffect, useState } from 'react';

function leerRuta(): string {
  return window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
}

export function useRuta(): string {
  const [ruta, setRuta] = useState(leerRuta);
  useEffect(() => {
    const alCambiar = () => setRuta(leerRuta());
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);
  return ruta;
}

export function irA(ruta: string) {
  window.location.hash = ruta ? `/${ruta}` : '';
}
