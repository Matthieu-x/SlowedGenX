import fs from "fs";
import path from "path";
import { config } from "../config.js";

// ─────────────────────────────────────────────
// 𖤐 Configuración de categorías
// ─────────────────────────────────────────────

const CATEGORY_ICONS = [
  "𖤐", "𖦹", "✦", "✧", "⟡",
  "⊹", "⋆", "𖥔", "༺", "❖",
  "⚡", "♢", "☾", "⌁", "◈",
  "✶", "𖠿", "⛧", "✷", "❂"
];

// Canal oficial
const CANAL_URL =
  "https://whatsapp.com/channel/0029VbEWxrVCXC3Dd4eDg71P";

// ─────────────────────────────────────────────
// 𖤐 Funciones
// ─────────────────────────────────────────────

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
  return CATEGORY_ICONS[
    index % CATEGORY_ICONS.length
  ];
}

// ─────────────────────────────────────────────
// 𖤐 Agrupar plugins
// ─────────────────────────────────────────────

function agrupar(plugins) {
  const grupos = new Map();

  for (const plugin of plugins) {
    if (!plugin || !Array.isArray(plugin.command)) {
      continue;
    }

    const categoria = limpiarCategoria(
      plugin.category
    );

    if (!grupos.has(categoria)) {
      grupos.set(categoria, []);
    }

    grupos.get(categoria).push(plugin);
  }

  return grupos;
}

// ─────────────────────────────────────────────
// 𖦹 Render comando
// ─────────────────────────────────────────────

function renderComando(plugin) {
  const comandos = Array.isArray(plugin.command)
    ? plugin.command
    : [plugin.command];

  const principal =
    comandos[0] || "sin-comando";

  const alias =
    comandos.length > 1
      ? ` 〔 ${comandos.slice(1).join(" • ")} 〕`
      : "";

  const descripcion =
    plugin.description ||
    "Sin descripción";

  return (
    `│ 𖦹 *.${principal}*${alias}\n` +
    `│   ╰─ ${descripcion}\n`
  );
}

// ─────────────────────────────────────────────
// ✦ Render sección
// ─────────────────────────────────────────────

function renderSeccion(
  categoria,
  plugins,
  index
) {
  const icon =
    iconoCategoria(index);

  const titulo =
    nombreCategoria(categoria);

  const descripcion =
    descripcionCategoria(categoria);

  const comandos =
    plugins
      .map(renderComando)
      .join("");

  return (
    `\n` +
    `╭─〔 ${icon} *${titulo}* 〕─╮\n` +
    `│ ✦ ${descripcion}\n` +
    comandos +
    `╰────────────────────╯\n`
  );
}

// ─────────────────────────────────────────────
// 𖤐 COMANDO MENU
// ─────────────────────────────────────────────

export default {
  command: ["menu"],
  category: "main",
  description: "Muestra el menú de comandos",

  run: async (
    sock,
    msg,
    args,
    context
  ) => {
    const {
      chatId,
      sender,
      allPlugins
    } = context;

    try {

      // ─────────────────────────────────────────
      // Indicador de escritura
      // ─────────────────────────────────────────

      try {
        await sock.sendPresenceUpdate(
          "composing",
          chatId
        );

        await new Promise(
          resolve =>
            setTimeout(resolve, 3000)
        );
      } catch {}

      // ─────────────────────────────────────────
      // Plugins válidos
      // ─────────────────────────────────────────

      const pluginsValidos =
        Array.isArray(allPlugins)
          ? allPlugins.filter(
              p =>
                p &&
                Array.isArray(p.command) &&
                p.command.length > 0
            )
          : [];

      const totalComandos =
        pluginsValidos.reduce(
          (acc, plugin) =>
            acc + plugin.command.length,
          0
        );

      const totalPlugins =
        pluginsValidos.length;

      const tipo =
        chatId.endsWith("@g.us")
          ? "Grupal"
          : "Privado";

      const mention =
        "@" + sender.split("@")[0];

      // ─────────────────────────────────────────
      // 𖤐 HEADER
      // ─────────────────────────────────────────

      const header =
        `╭━━━━━━━━━━━━━━━━━━━━━━╮\n` +
        `│\n` +
        `│    𖤐 *${config.botName}* 𖤐\n` +
        `│      『 MENÚ PRINCIPAL 』\n` +
        `│\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +

        `╭─〔 𖦹 *BIENVENIDA* 〕─╮\n` +
        `│\n` +
        `│ 𖤐 Hola *${mention}*\n` +
        `│ 𖦹 Soy *${config.botName}*\n` +
        `│ 𖦹 Bienvenido a mi menú\n` +
        `│\n` +
        `├─〔 ⟡ *INFORMACIÓN* 〕\n` +
        `│\n` +
        `│ 𖤐 Versión › *${config.version}*\n` +
        `│ 𖦹 Tipo › *${tipo}*\n` +
        `│ ✦ Comandos › *${totalComandos}*\n` +
        `│ ✧ Plugins › *${totalPlugins}*\n` +
        `╰────────────────────╯\n`;

      // ─────────────────────────────────────────
      // 𖦹 Categorías
      // ─────────────────────────────────────────

      const grupos =
        agrupar(pluginsValidos);

      let secciones = "";
      let indice = 0;

      for (
        const [categoria, plugins]
        of grupos
      ) {

        plugins.sort((a, b) => {

          const aName =
            String(
              a.command?.[0] || ""
            );

          const bName =
            String(
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

        secciones +=
          renderSeccion(
            categoria,
            plugins,
            indice
          );

        indice++;
      }

      // ─────────────────────────────────────────
      // ✦ FOOTER
      // ─────────────────────────────────────────

      const footer =
        `\n` +
        `╭━━━━━━━━━━━━━━━━━━━━━━╮\n` +
        `│ 𖤐 *${config.botName}*\n` +
        `│ 𖦹 Creador › *${config.creator}*\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━╯\n` +
        `\n𖤐 ━━━ ✦ ━━━ 𖤐\n`;

      const texto =
        header +
        secciones +
        footer;

      // ─────────────────────────────────────────
      // Detener escritura
      // ─────────────────────────────────────────

      try {
        await sock.sendPresenceUpdate(
          "paused",
          chatId
        );
      } catch {}

      // ─────────────────────────────────────────
      // 🖼️ Imagen del menú
      // ─────────────────────────────────────────

      const rutaImagen =
        path.join(
          process.cwd(),
          "imagenes",
          "menu.jpeg"
        );

      // ─────────────────────────────────────────
      // 📢 Tarjeta del canal
      // ─────────────────────────────────────────

      const contextInfo = {
        externalAdReply: {
          title:
            "📢 Canal oficial de SlowedGenX",

          body:
            "Únete al canal oficial",

          sourceUrl:
            CANAL_URL,

          mediaType: 1,

          renderLargerThumbnail:
            false,

          showAdAttribution:
            false
        }
      };

      // ─────────────────────────────────────────
      // Enviar menú
      // ─────────────────────────────────────────

      if (
        fs.existsSync(rutaImagen)
      ) {

        await sock.sendMessage(
          chatId,
          {
            image:
              fs.readFileSync(
                rutaImagen
              ),

            caption:
              texto,

            mentions:
              [sender],

            contextInfo
          },
          {
            quoted:
              msg
          }
        );

      } else {

        await sock.sendMessage(
          chatId,
          {
            text:
              texto,

            mentions:
              [sender],

            contextInfo
          },
          {
            quoted:
              msg
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
            `╭━━〔 ❌ *ERROR DEL MENÚ* 〕━━╮\n` +
            `│\n` +
            `│ No se pudo generar el menú.\n` +
            `│\n` +
            `│ ⚡ ${error.message || "Error desconocido"}\n` +
            `│\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━━━╯`
        },
        {
          quoted:
            msg
        }
      );
    }
  }
};