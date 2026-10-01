import fs from "fs";
import path from "path";
import { config } from "../config.js";

// ─────────────────────────────────────────────
// Configuración de categorías — Estilo Calavera
// ─────────────────────────────────────────────

const CATEGORY_ICONS = [
  "☠️",
  "🩸",
  "⛓️",
  "🕸️",
  "🖤",
  "🥀",
  "⚰️",
  "🔮",
  "🦇",
  "🌑",
  "🪦",
  "♰",
  "💀",
  "🕷️",
  "🌹",
  "⚔️",
  "🔥",
  "🌙",
  "👁️",
  "🩶"
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
    ` ┆╭─ ☠︎ *${principal}${alias}*\n` +
    ` ┆└─ 🩸 ${descripcion}\n`
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
    `╭━━━〔 ${icon} *${titulo}* ${icon} 〕━━━╮\n` +
    `┃ 🕸️ ${descripcion}\n` +
    `┃\n` +
    comandos +
    `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`
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

      // ─────────────────────────────────────────
      // Header — Estilo Calavera
      // ─────────────────────────────────────────

      const header =
        `╭━━━〔 ☠︎ 𖤐 *${config.botName}* 𖤐 ☠︎ 〕━━━╮\n` +
        `┃\n` +
        `┃       𓆩☠︎𓆪 *MENU PRINCIPAL* 𓆩☠︎𓆪\n` +
        `┃\n` +
        `┃ ☠︎ Hola *${mention}* 🖤\n` +
        `┃ └─ Bienvenidx a mi menú.\n` +
        `┃\n` +
        `┣━━━〔 🩸 *INFORMACIÓN* 〕━━━┫\n` +
        `┃ ☠︎ Versión › *${config.version}*\n` +
        `┃ ☠︎ Tipo › *${tipo}*\n` +
        `┃ ☠︎ Comandos › *${totalComandos}*\n` +
        `┃ ☠︎ Plugins › *${totalPlugins}*\n` +
        (config.canal
          ? `┃ ☠︎ Canal › *${config.canal}*\n`
          : "") +
        `┃\n` +
        `╰━━━━━━━〔 ☠︎ 〕━━━━━━━━╯\n\n`;

      // ─────────────────────────────────────────
      // Categorías automáticas
      // ─────────────────────────────────────────

      const grupos = agrupar(pluginsValidos);

      // ─────────────────────────────────────────
      // Comandos agregados manualmente
      // ─────────────────────────────────────────

      const comandosExtra = [
        {
          command: ["debug"],
          category: "tools",
          description: "Muestra información de depuración"
        },
        {
          command: ["kickall"],
          category: "group",
          description: "Expulsa a todos los miembros del grupo"
        }
      ];

      for (const plugin of comandosExtra) {

        const categoria = limpiarCategoria(
          plugin.category
        );

        if (!grupos.has(categoria)) {
          grupos.set(categoria, []);
        }

        // Evitar duplicados
        const existe = grupos
          .get(categoria)
          .some(p =>
            Array.isArray(p.command) &&
            p.command.includes(
              plugin.command[0]
            )
          );

        if (!existe) {
          grupos
            .get(categoria)
            .push(plugin);
        }
      }

      // ─────────────────────────────────────────
      // Generar secciones
      // ─────────────────────────────────────────

      let secciones = "";

      let indice = 0;

      for (const [categoria, plugins] of grupos) {

        // Ordenar comandos alfabéticamente
        plugins.sort((a, b) => {

          const aName = String(
            a.command?.[0] || ""
          );

          const bName = String(
            b.command?.[0] || ""
          );

          return aName.localeCompare(
            bName,
            "es",
            {
              sensitivity: "base"
            }
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
      // Footer — Estilo Calavera
      // ─────────────────────────────────────────

      const footer =
        `\n` +
        `╭━━━━━━〔 ☠︎ 𖤐 ☠︎ 〕━━━━━━╮\n` +
        `┃     🥀 *${config.creator}* 🥀\n` +
        `┃       𓆩☠︎𓆪 𝑭𝒊𝒏 𓆩☠︎𓆪\n` +
        `╰━━━━━━━━━━━━━━━━━━━━╯`;

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
            `☠️ *ERROR AL GENERAR EL MENÚ*\n\n` +
            `🩸 ${error.message || "Error desconocido"}`
        },
        {
          quoted: msg
        }
      );
    }
  }
};