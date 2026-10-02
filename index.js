import readline from "readline";
import chalk from "chalk";
import fs from "fs";

import { config } from "./config.js";
import { loadPlugins, agruparPorCategoria } from "./pluginLoader.js";
import { crearBot } from "./core.js";
import { reconectarSubBots, listarSubBots } from "./subbots.js";

process.on("uncaughtException", (err) => {
  console.log(chalk.red("[ERROR] Excepción no capturada:"), err);
});

process.on("unhandledRejection", (reason) => {
  console.log(chalk.red("[ERROR] Promesa rechazada sin manejar:"), reason);
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (text) =>
  new Promise((resolve) => rl.question(text, resolve));

const ANCHO = 78;

function centrar(texto = "") {
  const pad = Math.max(0, ANCHO - texto.length);
  const izq = Math.floor(pad / 2);
  return " ".repeat(izq) + texto + " ".repeat(pad - izq);
}

const cajaSuperior = (c) =>
  c("┌" + "─".repeat(ANCHO) + "┐");

const cajaDivisor = (c) =>
  c("├" + "─".repeat(ANCHO) + "┤");

const cajaInferior = (c) =>
  c("└" + "─".repeat(ANCHO) + "┘");

const cajaLinea = (c, contenido) =>
  c("│") + contenido + c("│");

function banner(plugins) {
  const c = chalk.cyan;
  const totalComandos = plugins.reduce(
    (acc, p) => acc + p.command.length,
    0
  );

  const categorias = agruparPorCategoria(plugins).size;

  console.log(cajaSuperior(c));
  console.log(
    cajaLinea(
      c,
      chalk.bold.whiteBright(
        centrar(config.botName.toUpperCase())
      )
    )
  );

  console.log(
    cajaLinea(
      c,
      chalk.gray(
        centrar(`v${config.version}  ·  by ${config.creator}`)
      )
    )
  );

  console.log(cajaDivisor(c));

  console.log(
    cajaLinea(
      c,
      chalk.white(
        centrar(`Plugins cargados       ${plugins.length}`)
      )
    )
  );

  console.log(
    cajaLinea(
      c,
      chalk.white(
        centrar(`Comandos totales       ${totalComandos}`)
      )
    )
  );

  console.log(
    cajaLinea(
      c,
      chalk.white(
        centrar(`Categorías              ${categorias}`)
      )
    )
  );

  console.log(
    cajaLinea(
      c,
      chalk.white(
        centrar(
          `Sub-bots registrados    ${listarSubBots().length}`
        )
      )
    )
  );

  console.log(cajaInferior(c));
}

function avisoConectado() {
  const c = chalk.green;

  console.log("\n" + cajaSuperior(c));

  console.log(
    cajaLinea(
      c,
      chalk.bold.whiteBright(
        centrar(`${config.botName} — conectada`)
      )
    )
  );

  console.log(
    cajaLinea(
      c,
      chalk.gray(
        centrar('Escribí ".menu" o "menu" para ver los comandos')
      )
    )
  );

  if (config.canal) {
    console.log(
      cajaLinea(
        c,
        chalk.gray(centrar(config.canal))
      )
    );
  }

  console.log(cajaInferior(c) + "\n");
}

async function iniciar() {
  const plugins = await loadPlugins();

  banner(plugins);

  const usePairingCode =
    !fs.existsSync(`${config.sessionFolder}/creds.json`);

  let numeroParaPairing = null;
  let mostrarQR = false;

  if (usePairingCode) {
    const metodo = await question(
      chalk.yellow(
        `\n¿Cómo quieres vincular a ${config.botName}?\n1) Código de 8 dígitos\n2) Código QR\nElige 1 o 2: `
      )
    );

    if (metodo.trim() === "1") {
      numeroParaPairing = await question(
        chalk.yellow(
          "\nEscribe tu número de WhatsApp con código de país (sin + ni espacios). Ej: 50499999999\nNúmero: "
        )
      );
    } else {
      mostrarQR = true;

      console.log(
        chalk.yellow(
          "\nEscanea el código QR que aparecerá abajo con WhatsApp > Dispositivos vinculados.\n"
        )
      );
    }
  }

  rl.close();

  const pendingReplies = new Map();

  function esperarRespuesta(
    chatId,
    sender,
    handler,
    timeoutMs = 5 * 60 * 1000
  ) {
    const key = `${chatId}:${sender}`;

    pendingReplies.set(key, handler);

    setTimeout(() => {
      if (pendingReplies.get(key) === handler) {
        pendingReplies.delete(key);
      }
    }, timeoutMs);
  }

  const onMessage = async (sock, msg, context) => {
    const { body, chatId, sender } = context;

    if (!body) return;

    const texto = body.trim();

    const pendingKey = `${chatId}:${sender}`;
    const pending = pendingReplies.get(pendingKey);

    const baseContext = {
      ...context,
      allPlugins: plugins,
      onMessage,
      esperarRespuesta: (handler, timeoutMs) =>
        esperarRespuesta(
          chatId,
          sender,
          handler,
          timeoutMs
        ),
    };

    if (pending) {
      pendingReplies.delete(pendingKey);

      try {
        await pending(sock, msg, baseContext);
      } catch (err) {
        console.log(
          chalk.red("Error en respuesta pendiente:"),
          err
        );
      }

      return;
    }

    /*
     * ============================================================
     * PROCESADOR DE COMANDOS
     *
     * Acepta:
     *
     * .menu
     * menu
     * .ping
     * ping
     * .jid
     * jid
     *
     * El punto inicial se elimina antes de buscar el plugin.
     * ============================================================
     */

    const palabras = texto.split(/\s+/);

    const primeraPalabra = palabras[0]
      .replace(/^\./, "")
      .toLowerCase();

    const args = palabras.slice(1);

    for (const plugin of plugins) {
      const comandos = plugin.command.map((cmd) =>
        String(cmd).toLowerCase()
      );

      if (comandos.includes(primeraPalabra)) {
        console.log(
          `[PLUGIN_MATCH] Ejecutando comando "${primeraPalabra}" con archivo ${plugin.fileName}, args: ${JSON.stringify(args)}`
        );

        try {
          await plugin.run(
            sock,
            msg,
            args,
            baseContext
          );
        } catch (err) {
          console.log(
            chalk.red(
              `Error ejecutando el plugin ${plugin.fileName}:`
            ),
            err
          );

          console.error(
            `[PLUGIN_ERROR] ${plugin.fileName}:`,
            err.message,
            err.stack
          );
        }

        break;
      }
    }
  };

  await crearBot({
    sessionFolder: config.sessionFolder,
    etiqueta: "MAIN",
    mostrarQR,
    numeroParaPairing,
    onMessage,

    onPairingCode: (codigo) => {
      console.log(
        chalk.greenBright(
          "\nCÓDIGO DE VINCULACIÓN:\n"
        )
      );

      console.log(
        chalk.bold.cyan(`${codigo}\n`)
      );
    },

    onReady: async () => {
      avisoConectado();

      await reconectarSubBots({
        onMessage,
      });
    },
  });
}

iniciar().catch((err) => {
  console.log(
    chalk.red("[ERROR] Error fatal iniciando el bot:"),
    err
  );

  process.exit(1);
});