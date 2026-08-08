import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FaqAccordion, type FaqCategory } from "@/components/FaqAccordion";

export const metadata: Metadata = {
  title: "Preguntas Frecuentes — Cercana",
  description:
    "Respuestas a las preguntas más comunes sobre Cercana: cuenta y prueba gratuita, planes y precios, seguridad y privacidad, consentimiento informado, expedientes, psiquiatría, soporte y cancelación.",
};

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    category: "General",
    items: [
      {
        question: "¿Qué es Cercana?",
        answer:
          "Cercana es una plataforma de gestión clínica y administrativa para psicólogos, consultorios y clínicas de salud mental en República Dominicana. Centraliza expedientes clínicos, agenda, consentimientos con firma digital y reportes en un solo lugar, para que puedas dedicar más tiempo a tus pacientes y menos a la parte administrativa.",
      },
      {
        question: "¿Para quién es Cercana?",
        answer:
          "Para psicólogos y psiquiatras independientes, consultorios pequeños y clínicas con varios terapeutas, asistentes administrativas y supervisores clínicos.",
      },
      {
        question: "¿Necesito instalar algún programa?",
        answer:
          "No. Cercana funciona completamente desde el navegador, no hay que instalar ni descargar nada. Solo necesitas conexión a internet y un navegador actualizado (Chrome, Safari, Edge o Firefox).",
      },
      {
        question: "¿Funciona desde el celular?",
        answer:
          "Sí, puedes acceder desde cualquier dispositivo con navegador: computadora, tablet o celular. Más adelante también tendremos una aplicación móvil dedicada.",
      },
    ],
  },
  {
    category: "Cuenta y prueba gratuita",
    items: [
      {
        question: "¿Cómo empiezo a usar Cercana?",
        answer:
          "Regístrate desde cercanard.com con el correo de quien será el administrador de tu clínica. Tu prueba gratuita de 14 días comienza de inmediato.",
      },
      {
        question: "¿La prueba gratuita requiere tarjeta de crédito?",
        answer:
          "No es necesario registrar un método de pago para la prueba gratuita, solo completar el formulario de registro y subir los documentos requeridos.",
      },
      {
        question: "¿Qué pasa cuando termina la prueba gratuita?",
        answer:
          "Puedes elegir el plan que mejor se ajuste al tamaño de tu práctica y continuar sin interrupciones. Si no seleccionas un plan, tu cuenta pasa a modo de solo lectura, y tus datos se eliminan 90 días después de finalizado el periodo de prueba.",
      },
      {
        question: "¿Puedo cancelar cuando quiera?",
        answer: "Sí. Puedes cambiar de plan o cancelar tu suscripción en cualquier momento.",
      },
    ],
  },
  {
    category: "Planes y precios",
    items: [
      {
        question: "¿Cuál es la diferencia entre los planes?",
        answer:
          "Los planes se diferencian principalmente por la cantidad de terapeutas y los roles administrativos incluidos: Esencial (1 terapeuta), Dúo Clínico (2 terapeutas, agenda compartida), Profesional Plus (3 a 5 terapeutas, con administrador, asistente y supervisor clínico), Clínica en Crecimiento (6 a 10 terapeutas, con más asistentes y supervisores), e Institucional (11 o más terapeutas, con roles y permisos a la medida). Todos los planes incluyen expedientes clínicos, agenda, firma digital de consentimientos y reportes.",
      },
      {
        question: "¿Puedo cambiar de plan más adelante?",
        answer:
          "Sí, puedes subir o bajar de plan cuando lo necesites, según cómo crezca tu práctica o clínica.",
      },
      {
        question: "¿Los precios incluyen ITBIS?",
        answer: "Sí, los precios publicados ya incluyen el ITBIS.",
      },
      {
        question: "¿Qué pasa si necesito más terapeutas de los que incluye mi plan?",
        answer:
          "Puedes actualizar a un plan superior en cualquier momento, o contactarnos para un plan Institucional a la medida de tu clínica.",
      },
      {
        question: "¿Qué métodos de pago aceptan?",
        answer:
          "Por ahora, depósitos y transferencias bancarias. Más adelante estará disponible el pago automatizado con tarjeta.",
      },
    ],
  },
  {
    category: "Seguridad y privacidad de datos",
    items: [
      {
        question: "¿Mis datos y los de mis pacientes están seguros?",
        answer:
          "Sí. Cercana usa cifrado en tránsito y en reposo, control de acceso por rol, y un registro de auditoría que deja constancia de cada acceso a información clínica sensible.",
      },
      {
        question: "¿Cercana cumple con la Ley 172-13?",
        answer:
          "Sí. Cercana está diseñada bajo el marco de la Ley 172-13 de Protección Integral de Datos Personales, tratando los datos de salud como datos sensibles que requieren consentimiento expreso del paciente para su tratamiento.",
      },
      {
        question: "¿Dónde se almacenan mis datos?",
        answer:
          "Los datos se almacenan con proveedores de infraestructura en la nube fuera de República Dominicana. Esto se informa de forma explícita en el consentimiento que firma cada paciente, tal como exige la ley para la transferencia internacional de datos.",
      },
      {
        question: "¿Quién puede ver el expediente clínico de mis pacientes?",
        answer:
          "Solo el terapeuta o psiquiatra responsable del paciente puede ver y editar su expediente clínico. Un supervisor clínico puede consultarlo en modo de solo lectura. El administrador de la clínica no tiene acceso directo a las notas clínicas, solo a información administrativa (contacto, agenda, facturación), salvo un acceso puntual y auditado en casos excepcionales.",
      },
      {
        question: "¿La asistente administrativa puede ver las notas clínicas?",
        answer:
          "No. Las asistentes administrativas acceden a la agenda y a los datos de contacto del paciente, pero nunca a las notas clínicas, diagnósticos ni registros de recetas.",
      },
      {
        question: "¿Qué hago si pierdo mi contraseña o sospecho un acceso indebido a mi cuenta?",
        answer:
          "Ante la pérdida de tu contraseña, puedes restablecerla siguiendo el procedimiento disponible en la aplicación. Si sospechas un acceso indebido a tu cuenta, contáctanos por soporte para que realicemos una auditoría del sistema y, de confirmarse, se implementen de inmediato las medidas de seguridad necesarias para proteger tus datos.",
      },
    ],
  },
  {
    category: "Consentimiento informado y firma electrónica",
    items: [
      {
        question: "¿La firma electrónica de Cercana tiene validez legal?",
        answer:
          "Sí. Cercana usa firma electrónica avanzada con validez legal en República Dominicana, conforme a la Ley No. 126-02 sobre Comercio Electrónico, Documentos y Firmas Digitales, regulada por INDOTEL.",
      },
      {
        question: "¿Qué pasa si mi paciente es menor de edad?",
        answer:
          "El consentimiento debe firmarlo el padre, madre o tutor legal, nunca el menor. Cercana exige esto de forma automática, en línea con el Código para el Sistema de Protección y los Derechos Fundamentales de Niños, Niñas y Adolescentes (Ley 136-03).",
      },
    ],
  },
  {
    category: "Expedientes, agenda y funcionalidades",
    items: [
      {
        question: "¿Puedo migrar mis expedientes actuales (Excel, papel, otro sistema) a Cercana?",
        answer: "Sí, el sistema permite la importación y exportación masiva de datos.",
      },
      {
        question: "¿Cercana incluye videollamadas?",
        answer: "Todavía no — esta función se integrará más adelante.",
      },
      {
        question: "¿Cercana envía recordatorios automáticos a mis pacientes?",
        answer: "Esta función estará disponible más adelante.",
      },
      {
        question: "¿Puedo generar reportes o constancias para mis pacientes?",
        answer:
          "Sí, puedes generar reportes y estadísticas de tu práctica desde el panel, así como reportes individuales de cada paciente.",
      },
    ],
  },
  {
    category: "Psiquiatría",
    items: [
      {
        question: "¿Los psiquiatras pueden usar Cercana?",
        answer:
          "Sí. Los psiquiatras pueden registrar diagnósticos codificados según la CIE-11 (Clasificación Internacional de Enfermedades, publicada por la Organización Mundial de la Salud) y llevar un registro interno de las recetas que emiten a cada paciente.",
      },
      {
        question: "¿Un psicólogo y un psiquiatra pueden atender al mismo paciente en Cercana?",
        answer:
          "Sí. Cuando ambos forman parte del equipo de atención de un paciente, comparten el mismo expediente clínico: cada uno registra sus propias notas de consulta, y pueden ver el trabajo del otro para coordinar mejor el tratamiento — algo especialmente valioso cuando un paciente recibe psicoterapia y tratamiento psiquiátrico a la vez.",
      },
      {
        question: "¿Puedo emitir recetas desde Cercana?",
        answer:
          "Cercana no emite recetas con validez legal. En República Dominicana, la Ley 50-88 exige que las recetas de medicamentos controlados se emitan en papel, en el recetario físico numerado por la DNCD. Lo que sí permite Cercana es que el psiquiatra deje un registro interno de cada receta que emite físicamente (medicamento, dosis, frecuencia, indicaciones), para poder consultar el histórico de medicación de cada paciente en cualquier momento. Es una herramienta de organización clínica, no un documento legal ni un sustituto de la receta en papel.",
      },
    ],
  },
  {
    category: "Soporte",
    items: [
      {
        question: "¿Qué hago si tengo un problema técnico?",
        answer: "Puedes escribirnos a info@cercanard.com o por WhatsApp al 829-374-8878.",
      },
      {
        question: "¿Ofrecen capacitación para mi equipo?",
        answer:
          "Sí, ofrecemos asesoría personalizada incluida en todos los planes, para garantizar el uso óptimo de la aplicación.",
      },
    ],
  },
  {
    category: "Cancelación y tus datos",
    items: [
      {
        question: "¿Qué pasa con mis datos si cancelo mi cuenta?",
        answer:
          "Cancelar tu suscripción no implica la eliminación inmediata de tus datos. Al cancelar tu cuenta, tendrás un período de 30 días para acceder a tu información, exportar tus datos y, si lo deseas, reactivar tu suscripción. Durante este período no podrás realizar nuevas operaciones clínicas si tu plan ya ha finalizado. Una vez concluido este período, la cuenta podrá pasar a un estado de archivo y los datos clínicos serán conservados de forma segura y con acceso restringido durante el tiempo necesario conforme a las obligaciones legales, profesionales y sanitarias aplicables. Determinados elementos del expediente clínico pueden estar sujetos a períodos de conservación específicos y no podrán eliminarse simplemente por la cancelación de la suscripción. Cuando legalmente corresponda, Cercana podrá realizar procesos de depuración y eliminación segura de información; las copias de seguridad pueden permanecer un período adicional limitado, conforme a los ciclos técnicos de respaldo y recuperación ante desastres. Antes de cancelar tu cuenta, recomendamos usar la función Exportar mis datos para conservar una copia de la información necesaria para la continuidad y custodia de tus expedientes. El profesional o establecimiento de salud mantiene la responsabilidad sobre la custodia y conservación de los expedientes de sus pacientes; Cercana actúa como proveedor de la infraestructura tecnológica para su gestión, almacenamiento y protección, conforme a las condiciones del servicio.",
      },
      {
        question: "¿Puedo exportar la información de mis pacientes?",
        answer: "Sí, el sistema permite exportar tus datos en formatos PDF y CSV.",
      },
    ],
  },
];

export default function PreguntasFrecuentesPage() {
  return (
    <main className="min-h-screen px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-10 text-center">
          <Link href="/">
            <Image
              src="/brand/logo-cercana-full.png"
              alt="Cercana"
              width={855}
              height={410}
              priority
              className="mx-auto h-10 w-auto"
            />
          </Link>
        </div>

        <div className="rounded-lg border border-line bg-white/60 p-6 shadow-sm sm:p-10">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/40">Ayuda</p>
          <h1 className="mt-2 font-display text-2xl text-deep sm:text-3xl">
            Preguntas Frecuentes
          </h1>
          <p className="mt-1.5 text-sm text-ink/50">
            ¿No encuentras lo que buscas? Escríbenos a{" "}
            <a
              href="mailto:info@cercanard.com"
              className="underline decoration-ink/20 underline-offset-2 hover:text-deep"
            >
              info@cercanard.com
            </a>{" "}
            o por WhatsApp al{" "}
            <a
              href="https://wa.me/18293748878"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-ink/20 underline-offset-2 hover:text-deep"
            >
              829-374-8878
            </a>
            .
          </p>

          <div className="mt-8">
            <FaqAccordion categories={FAQ_CATEGORIES} />
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-ink/40">
          <Link href="/" className="underline decoration-ink/20 underline-offset-2">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </main>
  );
}
