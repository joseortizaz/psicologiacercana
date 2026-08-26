import type { UserRole } from "@/lib/types";

/**
 * Roles que un org_admin puede asignar a un miembro de su equipo (al
 * invitar o al editar). `super_admin` queda deliberadamente fuera: nada en
 * RLS/CHECK constraints lo impide a nivel de base de datos, así que el
 * límite se aplica aquí, en la capa de aplicación.
 */
export const ASSIGNABLE_ROLES: { value: UserRole; label: string; needsClinic: boolean }[] = [
  { value: "therapist", label: "Terapeuta", needsClinic: true },
  { value: "psychiatrist", label: "Psiquiatra", needsClinic: true },
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
  psychiatrist: "Psiquiatra",
};

/** Roles que pueden formar parte del equipo de atención de un expediente
 * clínico (ver clinical_record_team_members). Se usa para poblar el
 * selector de "agregar miembro" en TeamMembersPanel. */
export const CARE_TEAM_ROLES: UserRole[] = ["therapist", "psychiatrist", "supervisor"];

/**
 * ¿Esta persona tiene capacidad administrativa? Espejo, en el frontend, de
 * is_org_admin_or_super() en la base de datos (ver
 * plan-independientes-y-credenciales-cercana.md, sección A.1): además de
 * org_admin/super_admin, un therapist/psychiatrist con is_org_admin = true
 * (profesional independiente que administra su propia "clínica" de una
 * persona) también cuenta. Se usa para las mismas rutas /org-admin/* que
 * antes solo aceptaban role === 'org_admin'.
 */
export function hasAdminAccess(profile: { role: UserRole; is_org_admin?: boolean | null }): boolean {
  return profile.role === "org_admin" || profile.role === "super_admin" || !!profile.is_org_admin;
}
