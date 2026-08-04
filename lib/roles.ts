import type { UserRole } from "@/lib/types";

/**
 * Roles que un org_admin puede asignar a un miembro de su equipo (al
 * invitar o al editar). `super_admin` queda deliberadamente fuera: nada en
 * RLS/CHECK constraints lo impide a nivel de base de datos, así que el
 * límite se aplica aquí, en la capa de aplicación.
 */
export const ASSIGNABLE_ROLES: { value: UserRole; label: string; needsClinic: boolean }[] = [
  { value: "therapist", label: "Terapeuta", needsClinic: true },
  { value: "assistant", label: "Asistente administrativa", needsClinic: true },
  { value: "supervisor", label: "Supervisor clínico", needsClinic: true },
  { value: "org_admin", label: "Administrador de clínica", needsClinic: false },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super administrador",
  org_admin: "Administrador",
  therapist: "Terapeuta",
  assistant: "Asistente",
  supervisor: "Supervisor",
};
