import fs from "fs";
import path from "path";
import { config } from "../config.js";

// ─────────────────────────────────────────────
// Configuración automática de categorías
// ─────────────────────────────────────────────

const CATEGORY_ICONS = [
  "🌙",
  "🛠️",
  "🔌",
  "📥",
  "🎮",
  "👑",
  "⚙️",
  "💰",
  "🌸",
  "🔴",
  "✦",
  "🪐",
  "🪽",
  "🧩",
  "🖤",
  "⚡",
  "🌟",
  "🎀",
  "🦋",
  "🔮"
];

function limpiarCategoria(categoria) {
  return String(categoria || "general")
    .trim()
    .toLowerCase();
}

function nombreCategoria(categoria) {
  const key = limpiarCategoria(categoria);

  return key
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function descripcionCategoria(categoria) {
  const key = limpiarCategoria(categoria);

  return `Comandos de ${key.replace(/[-_]+/g, " ")}`;
}

function iconoCategoria(index) {
  return CATEGORY_ICONS[index % CATEGORY_ICONS.length];
}

// ─────────────────────────────────────────────
// Agrupar plugins automáticamente
// ─────────────────────────────────────────────

function agrupar(plugins) {
  const grupos = new Map();

  for (const plugin of plugins) {
    if (!plugin || !Array.isArray(plugin.command)) continue;

    const categoria = limpiarCategoria(plugin.category);

    if (!grupos.has(categoria)) {
      grupos.set(categoria, []);
    }

    grupos.get(categoria).push(plugin);
  }

  return grupos;
}

// ─────────────────────────────────────────────
// Render comando
// ─────────────────────────────────────────────

function renderComando(plugin) {
  const comandos = Array.isArray(plugin.command)
    ? plugin.command
    : [plugin.command];

  const principal = comandos[0] || "sin-comando";

  const alias =
    comandos.length > 1
      ? ` (${comandos.slice(1).join(", ")})`
      : "";

  const descripcion =
    plugin.description ||
    "Sin descripción";

  return (
    ` ┆╭┈ *○* • 🔮·ઈ ${principal}${alias}\n` +
    ` ┆┆${descripcion}\n`
  );
}

// ─────────────────────────────────────────────
// Render sección automática
// ─────────────────────────────────────────────

function renderSeccion(categoria, plugins, index) {
  const icon = iconoCategoria(index);
  const titulo = nombreCategoria(categoria);
  const descripcion = descripcionCategoria(categoria);

  const comandos = plugins
    .map(renderComando)
    .join("");

  return (
    `╭┈ ࣪ ${icon}⌒⏜ ׅ *${titulo}* ㅤ  ꒢∩᷼⌒\n` +
    ` ┆┆${descripcion}\n` +
    comandos +
    ` ╰۫╼࣪╼࣪╾ ○ ·🔮·𖹭 ִֶ •┄┈┈┈┈┈┈┈┈• •┄ׅ꣸⃪ꠋ᰷\n`
  );
}

// ─────────────────────────────────────────────
// Comando MENU
// ─────────────────────────────────────────────

export default {
  command: ["menu"],
  category: "main",
  description: "Muestra el menú de comandos",

  run: async (sock, msg, args, context) => {
    const {
      chatId,
      sender,
      allPlugins
    } = context;

    try {
      // ─────────────────────────────────────────
      // Indicador visual de escritura
      // Esto es solo UX, no una técnica antispam.
      // ─────────────────────────────────────────

      try {
        await sock.sendPresenceUpdate(
          "composing",
          chatId
        );

        await new Promise(resolve =>
          setTimeout(resolve, 3000)
        );
      } catch {}

      // ─────────────────────────────────────────
      // Datos generales
      // ─────────────────────────────────────────

      const pluginsValidos = Array.isArray(allPlugins)
        ? allPlugins.filter(
            p =>
              p &&
              Array.isArray(p.command) &&
              p.command.length > 0
          )
        : [];

      const totalComandos = pluginsValidos.reduce(
        (acc, plugin) =>
          acc + plugin.command.length,
        0
      );

      const totalPlugins = pluginsValidos.length;

      const tipo = chatId.endsWith("@g.us")
        ? "Grupal"
        : "Privado";

      const mention =
        "@" + sender.split("@")[0];

      const channelLine = config.canal
        ? `> *✦* Canal › *${config.canal}*\n`
        : "";

      // ─────────────────────────────────────────
      // Header
      // ─────────────────────────────────────────

      const header =
        `⏜᷼ᩘ۪۪۪۪⏜۪۪۪۪۪᷼︵᷼       ❀      ⏜᷼ᩘ۪۪۪۪⏜۪۪۪۪۪᷼︵᷼\n` +
        `> Hola *${mention}* soy *${config.botName}*, bienvenidx a mi menú.\n` +
        `╭┈┈↷\n` +
        `> *✦* Versión › *${config.version}*\n` +
        `> *✦* Tipo › *${tipo}*\n` +
        `> *✦* Comandos › *${totalComandos}*\n` +
        `> *✦* Plugins › *${totalPlugins}*\n` +
        `> ­\n` +
        channelLine +
        `╰ ━ ─ ━ ─ ☞︎︎︎ ✰ ☜︎︎︎ ─ ━ ─ ━ ╯\n\n`;

      // ─────────────────────────────────────────
      // Categorías automáticas
      // ─────────────────────────────────────────

      const grupos = agrupar(pluginsValidos);

      let secciones = "";

      let indice = 0;

      for (const [categoria, plugins] of grupos) {
        // Ordenar comandos alfabéticamente
        plugins.sort((a, b) => {
          const aName = String(a.command?.[0] || "");
          const bName = String(b.command?.[0] || "");

          return aName.localeCompare(
            bName,
            "es",
            { sensitivity: "base" }
          );
        });

        secciones += renderSeccion(
          categoria,
          plugins,
          indice
        );

        indice++;
      }

      // ─────────────────────────────────────────
      // Footer
      // ─────────────────────────────────────────

      const footer =
        `ㅤㅤㅤ⏜𖣣︶         ${config.creator} ׂᅟᅟ︶𖣣⏜\n` +
        `                      ͝  ͝ ⏝             ⃜          ⏝ ͝  ͝`;

      const texto =
        header +
        secciones +
        footer;

      // ─────────────────────────────────────────
      // Detener indicador de escritura
      // ─────────────────────────────────────────

      try {
        await sock.sendPresenceUpdate(
          "paused",
          chatId
        );
      } catch {}

      // ─────────────────────────────────────────
      // Imagen del menú
      // ─────────────────────────────────────────

      const rutaImagen = path.join(
        process.cwd(),
        "imagenes",
        "menu.jpeg"
      );

      if (fs.existsSync(rutaImagen)) {
        await sock.sendMessage(
          chatId,
          {
            image: fs.readFileSync(rutaImagen),
            caption: texto,
            mentions: [sender]
          },
          {
            quoted: msg
          }
        );
      } else {
        await sock.sendMessage(
          chatId,
          {
            text: texto,
            mentions: [sender]
          },
          {
            quoted: msg
          }
        );
      }

    } catch (error) {
      console.error(
        "[MENU ERROR]",
        error
      );

      try {
        await sock.sendPresenceUpdate(
          "paused",
          chatId
        );
      } catch {}

      await sock.sendMessage(
        chatId,
        {
          text:
            `❌ *Error al generar el menú*\n\n` +
            `${error.message || "Error desconocido"}`
        },
        {
          quoted: msg
        }
      );
    }
  }
};