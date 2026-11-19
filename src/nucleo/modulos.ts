/**
 * Módulos de la intranet. Cada uno vive en src/modulos/<id> y se carga solo cuando se entra en él.
 * Para añadir uno: crear su carpeta, ponerlo aquí y en CARGADORES de src/App.tsx.
 */
import type { LucideIcon } from 'lucide-react';
import { ShieldCheck, DoorOpen, CalendarClock, Settings2 } from 'lucide-react';

export type IdModulo = 'convivencia' | 'salidas' | 'guardias' | 'panel';

export interface Modulo {
  id: IdModulo;
  nombre: string;
  descripcion: string;
  icono: LucideIcon;
  disponible: boolean;
  /** Solo para los administradores del panel */
  soloPanel?: boolean;
}

export const MODULOS: Modulo[] = [
  {
    id: 'convivencia',
    nombre: 'Convivencia',
    descripcion: 'Partes, carnet de puntos, sanciones, Aula PAC y tutoría.',
    icono: ShieldCheck,
    disponible: true,
  },
  {
    id: 'salidas',
    nombre: 'Salidas al baño',
    descripcion: 'Autorizar y registrar las salidas del alumnado durante las clases.',
    icono: DoorOpen,
    disponible: true,
  },
  {
    id: 'guardias',
    nombre: 'Guardias',
    descripcion: 'Ausencias del profesorado y cobertura de guardias.',
    icono: CalendarClock,
    disponible: true,
  },
  {
    id: 'panel',
    nombre: 'Panel del centro',
    descripcion: 'Profesorado, permisos de cada módulo y horarios.',
    icono: Settings2,
    disponible: true,
    soloPanel: true,
  },
];
