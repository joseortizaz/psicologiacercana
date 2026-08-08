export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqCategory {
  category: string;
  items: FaqItem[];
}

/** Acordeón de preguntas frecuentes agrupado por categoría. Usa <details>/
 *  <summary> nativos (sin JS ni estado en cliente) para mantenerse coherente
 *  con el resto de páginas públicas del sitio (terminos/privacidad), que son
 *  Server Components. Los estilos siguen los mismos tokens de Tailwind que
 *  el resto de la app (ver tailwind.config.ts). */
export function FaqAccordion({ categories }: { categories: FaqCategory[] }) {
  return (
    <div className="flex flex-col gap-10">
      {categories.map((cat) => (
        <section key={cat.category}>
          <h2 className="font-display text-xl text-deep">{cat.category}</h2>
          <div className="mt-4 flex flex-col gap-3">
            {cat.items.map((item) => (
              <details
                key={item.question}
                className="group rounded-lg border border-line bg-white/60 open:bg-white/80"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
                  <span>{item.question}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="flex-none text-ink/40 transition-transform duration-200 group-open:rotate-180"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </summary>
                <div className="whitespace-pre-line px-5 pb-4 text-sm leading-relaxed text-ink/70">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
