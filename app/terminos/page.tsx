import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Términos y Condiciones — Cercana",
};

export default function TerminosPage() {
  return (
    <LegalPage title="Términos y Condiciones" updatedAt="6 de agosto de 2026">
      <h2>1. Identificación del prestador del servicio</h2>
      <p>
        Cercana es una plataforma de gestión clínica para profesionales de la salud mental,
        operada por <strong>Narnia Tech Solution, SRL</strong>, sociedad comercial constituida y
        que opera de conformidad con las leyes de la República Dominicana, con Registro Nacional
        de Contribuyentes (RNC) No. <strong>1-33-74485-6</strong> (en adelante, &ldquo;Narnia Tech
        Solution&rdquo;, &ldquo;Cercana&rdquo;, &ldquo;nosotros&rdquo; o &ldquo;la
        Empresa&rdquo;).
      </p>
      <p>
        Estos Términos y Condiciones (los &ldquo;Términos&rdquo;) rigen el acceso y uso del sitio
        web, portal y aplicaciones asociadas a Cercana (en conjunto, el &ldquo;Portal&rdquo; o
        &ldquo;el Servicio&rdquo;) por parte de cualquier persona que se registre, solicite acceso
        o utilice el Servicio (el &ldquo;Usuario&rdquo; o &ldquo;Usted&rdquo;).
      </p>

      <h2>2. Aceptación de los Términos</h2>
      <p>
        Al acceder, registrarse o utilizar el Portal, Usted declara haber leído, comprendido y
        aceptado íntegramente estos Términos, así como nuestra{" "}
        <a href="/privacidad">Política de Privacidad</a>, la cual forma parte integral de este
        documento. Si no está de acuerdo con alguno de estos Términos, debe abstenerse de utilizar
        el Servicio.
      </p>

      <h2>3. Descripción del Servicio</h2>
      <p>
        Cercana es un software como servicio (SaaS) que permite a psicólogos, psiquiatras,
        clínicas y consultorios gestionar expedientes clínicos, agendas, consentimientos
        informados con firma electrónica, planes de suscripción y demás funcionalidades
        administrativas propias de la práctica de la salud mental. El Portal opera bajo un modelo
        de organizaciones y clínicas, con distintos roles de acceso (super administrador,
        administrador de organización, supervisor clínico, asistente administrativo y terapeuta),
        cada uno con permisos definidos según su función.
      </p>

      <h2>4. Registro, solicitud de acceso y veracidad de la información</h2>
      <p>
        Para utilizar el Servicio como terapeuta, el interesado debe completar el formulario de
        autoregistro disponible en el Portal, aportando sus datos profesionales y cargando, en
        formato JPG, PNG o PDF, copia de su documento de identidad, de su carnet o título
        profesional y de su licencia o exequátur vigente.
      </p>
      <p>
        Toda solicitud de registro queda sujeta a revisión y aprobación por parte del
        superadministrador de Cercana antes de otorgar el primer acceso a la cuenta. Cercana se
        reserva el derecho de rechazar cualquier solicitud que no cumpla con los requisitos
        establecidos o que contenga información incompleta, inexacta o presuntamente falsa.
      </p>
      <p>
        El Usuario declara y garantiza que toda la información y documentación suministrada es
        veraz, exacta y vigente, y que cuenta con las licencias y autorizaciones profesionales
        correspondientes para ejercer la psicología, psiquiatría u otra profesión de la salud
        mental en la República Dominicana. La falsedad en la información suministrada es causal de
        suspensión o cancelación inmediata de la cuenta, sin perjuicio de las acciones legales que
        correspondan.
      </p>
      <p>
        Cada Usuario es responsable de mantener la confidencialidad de sus credenciales de acceso
        y de todas las actividades realizadas bajo su cuenta.
      </p>

      <h2>5. Planes, precios, prueba gratuita y facturación</h2>
      <p>
        Cercana ofrece distintos planes de suscripción, cuyos precios se expresan en pesos
        dominicanos (RD$) y están sujetos a los impuestos aplicables conforme a la legislación
        fiscal dominicana, incluyendo el Impuesto sobre Transferencia de Bienes Industrializados y
        Servicios (ITBIS), cuando corresponda.
      </p>
      <p>
        Los nuevos Usuarios pueden acceder a una prueba gratuita de 14 días, sujeta a la
        aprobación de su solicitud de registro. Al finalizar el periodo de prueba, la continuidad
        del Servicio queda sujeta a la contratación de un plan de pago.
      </p>
      <p>
        Los precios, características y límites de cada plan (número de terapeutas,
        administradores, supervisores y asistentes) se detallan en el Portal y pueden ser
        modificados por Cercana previo aviso razonable a los Usuarios afectados.
      </p>
      <p>
        El Usuario puede cambiar de plan o cancelar su suscripción en cualquier momento a través
        del Portal o contactando a <a href="mailto:info@cercanard.com">info@cercanard.com</a>.
        Cercana no reembolsa períodos ya facturados, salvo que la ley aplicable disponga lo
        contrario.
      </p>

      <h2>6. Obligaciones y uso aceptable</h2>
      <p>El Usuario se compromete a:</p>
      <ul>
        <li>Utilizar el Servicio exclusivamente para fines lícitos y relacionados con su práctica profesional en salud mental.</li>
        <li>No compartir sus credenciales de acceso con terceros no autorizados.</li>
        <li>No intentar vulnerar la seguridad, disponibilidad o integridad del Portal.</li>
        <li>No cargar contenido ilícito, difamatorio, o que infrinja derechos de terceros.</li>
        <li>Cumplir con toda la normativa aplicable a su profesión, incluyendo el secreto profesional y la Ley No. 42-01 General de Salud.</li>
      </ul>

      <h2>7. Responsabilidad profesional y clínica</h2>
      <p>
        Cercana es una herramienta tecnológica de apoyo administrativo y de gestión clínica.
        Cercana no presta servicios de salud, no sustituye el juicio clínico, ético o profesional
        del terapeuta, ni supervisa la calidad de la atención brindada por los Usuarios a sus
        pacientes. Cada profesional es el único responsable del contenido clínico que registra, de
        las decisiones terapéuticas que adopta y del cumplimiento de su código de ética
        profesional y de la normativa de salud vigente.
      </p>

      <h2>8. Datos de pacientes y confidencialidad</h2>
      <p>
        En su relación con sus propios pacientes, el terapeuta y/o la clínica u organización a la
        que pertenece actúan como responsables del tratamiento de los datos personales y de salud
        que registran en el Portal, mientras que Narnia Tech Solution, SRL actúa como encargado
        del tratamiento, procesando dichos datos únicamente para prestar el Servicio y siguiendo
        las instrucciones del Usuario.
      </p>
      <p>
        El Usuario es responsable de contar con el consentimiento informado de sus pacientes para
        el registro y tratamiento de su información en el Portal, conforme a la Ley No. 172-13
        sobre Protección de Datos de Carácter Personal y a la Ley No. 42-01 General de Salud. Los
        detalles sobre el tratamiento de datos personales se describen en nuestra{" "}
        <a href="/privacidad">Política de Privacidad</a>.
      </p>

      <h2>9. Firma electrónica</h2>
      <p>
        Los consentimientos y documentos firmados electrónicamente a través del Portal tienen la
        validez jurídica reconocida por la Ley No. 126-02 sobre Comercio Electrónico, Documentos y
        Firmas Digitales y su Reglamento de Aplicación (Decreto No. 335-03), siempre que se
        cumplan los requisitos técnicos establecidos por dicha normativa.
      </p>

      <h2>10. Propiedad intelectual</h2>
      <p>
        El Portal, su software, diseño, marcas (incluyendo &ldquo;Cercana&rdquo; y sus
        logotipos), y demás contenidos son propiedad de Narnia Tech Solution, SRL o de sus
        licenciantes, y están protegidos por la legislación dominicana e internacional sobre
        propiedad intelectual. Se prohíbe su reproducción, distribución o uso no autorizado. El
        Usuario conserva la titularidad de los datos clínicos y administrativos que ingresa al
        Portal.
      </p>

      <h2>11. Disponibilidad del servicio y limitación de responsabilidad</h2>
      <p>
        Cercana procura mantener el Portal disponible de forma continua, pero no garantiza un
        servicio ininterrumpido o libre de errores. Podremos suspender temporalmente el acceso por
        mantenimiento, actualizaciones o causas de fuerza mayor.
      </p>
      <p>
        En la máxima medida permitida por la ley, Narnia Tech Solution, SRL no será responsable
        por daños indirectos, incidentales o consecuenciales derivados del uso o la imposibilidad
        de uso del Portal, ni por decisiones clínicas o profesionales adoptadas por los Usuarios.
      </p>

      <h2>12. Suspensión y terminación de cuenta</h2>
      <p>
        Cercana podrá suspender o cancelar el acceso de un Usuario, con o sin previo aviso, en
        caso de incumplimiento de estos Términos, falta de pago, uso indebido del Servicio, o por
        requerimiento de autoridad competente. El Usuario puede solicitar la cancelación de su
        cuenta en cualquier momento.
      </p>

      <h2>13. Modificaciones a los Términos</h2>
      <p>
        Podremos actualizar estos Términos periódicamente. Los cambios sustanciales serán
        notificados a través del Portal o por correo electrónico, y entrarán en vigor a partir de
        su publicación. El uso continuado del Servicio implica la aceptación de los Términos
        actualizados.
      </p>

      <h2>14. Legislación aplicable y jurisdicción</h2>
      <p>
        Estos Términos se rigen por las leyes de la República Dominicana. Cualquier controversia
        derivada de su interpretación o aplicación será sometida a los tribunales competentes de
        Santo Domingo de Guzmán, Distrito Nacional, República Dominicana, con renuncia expresa a
        cualquier otro fuero que pudiera corresponder al Usuario.
      </p>

      <h2>15. Contacto</h2>
      <p>
        Para consultas relacionadas con estos Términos, puede contactarnos a través de{" "}
        <a href="mailto:info@cercanard.com">info@cercanard.com</a> o al WhatsApp{" "}
        <a href="https://wa.me/18293748878" target="_blank" rel="noreferrer">
          829-374-8878
        </a>
        .
      </p>
    </LegalPage>
  );
}
