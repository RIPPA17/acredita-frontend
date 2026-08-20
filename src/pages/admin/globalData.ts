import { getContratistas, getProyectos, getMandantes, getPlantillas } from "../../data/localStorageDb";

export const GLOBAL_MANDANTES = getMandantes();
export const GLOBAL_PROYECTOS = getProyectos();
export const GLOBAL_CONTRATISTAS = getContratistas();
export const GLOBAL_PLANTILLA_DOCUMENTOS = getPlantillas();
