import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Política de Privacidad — Cercana",
};

export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de Privacidad" updatedAt="6 de agosto de 2026">
      <h2>1. Responsable del tratamiento de datos</h2>
      <p>
        <strong>Narnia Tech Solution, SRL</strong>, sociedad constituida bajo las leyes de la
        República Dominicana, RNC No. <strong>1-33-74485-6</strong>, es la responsable del
        tratamiento de los datos personales que se recopilan a través del Portal Cercana (el
        &ldquo;Portal&rdquo;), de conformidad con la Ley No. 172-13 sobre Protección de Datos de
        Carácter Personal y demás normativa aplicable. Puede contactarnos en{" "}
        <a href="mailto:info@cercanard.com">info@cercanard.com</a>.
      </p>

      <h2>2. Alcance de esta Política</h2>
      <p>
        Esta Política de Privacidad describe cómo recopilamos, usamos, almacenamos, compartimos y
        protegemos los datos personales de: (a) los profesionales y personal administrativo que se
        registran y utilizan el Portal (&ldquo;Usuarios&rdquo;), y (b) en la medida en que el
        Portal permite a los Usuarios registrar datos de sus pacientes, los datos de dichos
        pacientes (&ldquo;Datos de Pacientes&rdquo;), respecto de los cuales Narnia Tech Solution,
        SRL actúa como encargado del tratamiento, según se explica en la sección 9.
      </p>

      <h2>3. Datos que recopilamos</h2>
      <ul>
        <li>
          <strong>Datos de registro profesional:</strong> nombre completo, correo electrónico,
          teléfono, número de exequátur o licencia profesional, especialidad, y nombre de la
          clínica o consultorio.
        </li>
        <li>
          <strong>Documentos de verificación:</strong> copia digital (JPG, PNG o PDF) de su
          documento de identidad, de su carnet o título profesional y de su licencia o exequátur,
          cargados de forma separada durante el proceso de autoregistro y utilizados
          exclusivamente para validar su idoneidad profesional antes de aprobar el acceso a la
          cuenta.
        </li>
        <li>
          <strong>Datos de cuenta y uso:</strong> credenciales de acceso, rol asignado dentro de
          la organización, registros de actividad (auditoría) y preferencias de configuración.
        </li>
        <li>
          <strong>Datos de facturación:</strong> información necesaria para gestionar su plan de
          suscripción y facturación.
        </li>
        <li>
          <strong>Datos de Pacientes:</strong> cuando un terapeuta registra información clínica de
          sus pacientes (identificación, historia clínica, notas de sesión, diagnósticos,
          consentimientos firmados, etc.), dicha información constituye datos sensibles de salud,
          ingresada y gestionada bajo la exclusiva responsabilidad del terapeuta y/o la clínica
          correspondiente.
        </li>
      </ul>

      <h2>4. Finalidades del tratamiento</h2>
      <p>Utilizamos los datos personales para:</p>
      <ul>
        <li>Evaluar y aprobar solicitudes de registro.</li>
        <li>Crear y administrar cuentas de Usuario.</li>
        <li>Prestar las funcionalidades del Portal (expedientes clínicos, agenda, firma de consentimientos, reportes).</li>
        <li>Gestionar la facturación y los planes de suscripción.</li>
        <li>Enviar comunicaciones operativas (confirmaciones, avisos de aprobación o rechazo de solicitudes, restablecimiento de contraseña).</li>
        <li>Cumplir obligaciones legales y regulatorias.</li>
        <li>Mejorar la seguridad y el funcionamiento del Portal.</li>
      </ul>

      <h2>5. Datos sensibles y consentimiento</h2>
      <p>
        De conformidad con la Ley No. 172-13, los datos relativos a la salud constituyen datos
        sensibles y reciben protección reforzada. Al registrarse, el Usuario otorga su
        consentimiento expreso para el tratamiento de sus propios datos sensibles (por ejemplo,
        los contenidos en su documentación profesional). Respecto de los Datos de Pacientes,
        corresponde al terapeuta obtener el consentimiento informado correspondiente de cada
        paciente antes de registrar su información en el Portal.
      </p>

      <h2>6. Conservación de la información</h2>
      <p>
        Los documentos de verificación profesional (identidad, carnet/título y licencia) se
        almacenan en un repositorio privado y cifrado, con acceso restringido exclusivamente al
        superadministrador durante el proceso de revisión, y se conservan mientras la cuenta
        permanezca activa o mientras sea necesario para fines de auditoría o cumplimiento legal.
      </p>
      <p>
        Los Datos de Pacientes se conservan mientras la cuenta del terapeuta u organización esté
        activa, salvo instrucción distinta del responsable del tratamiento correspondiente o
        requerimiento legal. Al eliminarse una cuenta, los datos se conservarán únicamente durante
        el plazo necesario para cumplir obligaciones legales, contables o fiscales, tras lo cual
        serán eliminados o anonimizados.
      </p>

      <h2>7. Cómo protegemos su información</h2>
      <p>
        Implementamos medidas técnicas y organizativas razonables para proteger los datos
        personales, incluyendo: cifrado de datos en tránsito y en reposo, control de acceso
        basado en roles, aislamiento de datos entre organizaciones (arquitectura multi-tenant con
        seguridad a nivel de fila), enlaces de descarga con caducidad para documentos sensibles, y
        registros de auditoría de accesos y cambios relevantes.
      </p>

      <h2>8. Con quién compartimos la información</h2>
      <p>No vendemos ni alquilamos datos personales a terceros. Podemos compartir datos con:</p>
      <ul>
        <li>
          Proveedores de infraestructura tecnológica (hosting, base de datos y almacenamiento en
          la nube) que procesan datos en nuestro nombre bajo obligaciones contractuales de
          confidencialidad y seguridad.
        </li>
        <li>Proveedores de servicios de correo electrónico, para el envío de comunicaciones operativas.</li>
        <li>Autoridades competentes, cuando así lo exija la ley o una orden judicial.</li>
      </ul>
      <p>
        Cuando la infraestructura de alojamiento se encuentre fuera del territorio dominicano,
        adoptamos las salvaguardas necesarias para asegurar un nivel adecuado de protección,
        conforme a lo previsto en la Ley No. 172-13 para las transferencias internacionales de
        datos.
      </p>

      <h2>9. Rol de Narnia Tech Solution respecto de los Datos de Pacientes</h2>
      <p>
        Para los Datos de Pacientes ingresados por los terapeutas, Narnia Tech Solution, SRL actúa
        exclusivamente como encargado del tratamiento (proveedor tecnológico), procesando la
        información según las instrucciones del terapeuta u organización responsable, sin
        utilizarla para fines propios distintos a la prestación del Servicio. El terapeuta y/o la
        clínica correspondiente son los responsables del tratamiento frente a sus pacientes y
        deben cumplir sus propias obligaciones bajo la Ley No. 172-13 y la Ley No. 42-01 General
        de Salud.
      </p>

      <h2>10. Sus derechos (Habeas Data)</h2>
      <p>
        Conforme al Artículo 44 de la Constitución dominicana y a la Ley No. 172-13, Usted tiene
        derecho a acceder, actualizar, rectificar y, cuando proceda, solicitar la eliminación u
        oposición al tratamiento de sus datos personales. Puede ejercer estos derechos escribiendo
        a <a href="mailto:info@cercanard.com">info@cercanard.com</a>. Responderemos su solicitud
        dentro de los plazos establecidos por la normativa aplicable. Si su solicitud es denegada
        o no es atendida, Usted conserva el derecho a interponer una acción de Habeas Data ante los
        tribunales competentes.
      </p>

      <h2>11. Cookies y tecnologías similares</h2>
      <p>
        El Portal puede utilizar cookies y tecnologías similares estrictamente necesarias para el
        funcionamiento del Servicio (por ejemplo, mantener su sesión iniciada). No utilizamos
        cookies de publicidad de terceros.
      </p>

      <h2>12. Menores de edad</h2>
      <p>
        El Portal no está dirigido a menores de edad en su calidad de Usuarios registrados. En
        caso de que un paciente sea menor de edad, corresponde al terapeuta obtener el
        consentimiento de su padre, madre o tutor legal antes de registrar su información,
        conforme a la legislación aplicable.
      </p>

      <h2>13. Cambios a esta Política</h2>
      <p>
        Podremos actualizar esta Política de Privacidad periódicamente. Cualquier cambio
        sustancial será comunicado a través del Portal o por correo electrónico. La fecha de
        &ldquo;Última actualización&rdquo; indicada al inicio de este documento refleja la versión
        vigente.
      </p>

      <h2>14. Contacto</h2>
      <p>
        Para preguntas, solicitudes o reclamos relacionados con el tratamiento de sus datos
        personales, puede contactarnos en:
      </p>
      <ul>
        <li>Narnia Tech Solution, SRL — RNC 1-33-74485-6</li>
        <li>
          Correo: <a href="mailto:info@cercanard.com">info@cercanard.com</a>
        </li>
        <li>
          WhatsApp:{" "}
          <a href="https://wa.me/18293748878" target="_blank" rel="noreferrer">
            829-374-8878
          </a>
        </li>
      </ul>
    </LegalPage>
  );
}
