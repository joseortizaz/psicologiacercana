import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta: verde azulado profundo (confianza clínica sin frialdad)
        // sobre un fondo cálido neutro, con un acento coral suave para
        // acciones -- deliberadamente distinto del morado/gradiente SaaS
        // genérico y del cliché "cream + terracota" de diseño con IA.
        ink: "#12242A", // texto principal
        deep: "#173A3F", // verde azulado profundo -- marca
        deepLight: "#2B565C",
        paper: "#FAF7F2", // fondo cálido neutro
        paperMuted: "#F0EBE1",
        line: "#DFD8C9", // bordes sutiles
        coral: "#C9694F", // acento de acción, cálido pero no estridente
        coralDark: "#A8543D",
        sage: "#7C9885", // estado positivo/activo
        clay: "#B3532E", // estado de alerta/urgente
      },
      fontFamily: {
        display: ["'Fraunces'", "ui-serif", "Georgia", "serif"],
        sans: ["'Inter'", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
