// En-têtes porteurs d'un secret : masqués dans le détail d'exécution, retirés quand une
// redirection change de domaine
export const SENSITIVE_HEADER = /authorization|cookie|token|secret|api[-_]?key/i;
