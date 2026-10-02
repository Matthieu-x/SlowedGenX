import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import chalk from "chalk";
import fs from "fs";

async function pedirCodigoPairing(
  sock,
  numero,
  onPairingCode,
  etiqueta,
  intento = 1
) {
  const MAX_INTENTOS = 4;
  const ESPERA_INICIAL = 3000;

  if (intento === 1) {
    await new Promise((r) => setTimeout(r, ESPERA_INICIAL));
  }

  try {
    const code = await sock.requestPairingCode(numero.trim());
    onPairingCode(code);
  } catch (err) {
    console.log(
      chalk.red(
        `[${etiqueta}] Error pidiendo código (intento ${intento}/${MAX_INTENTOS}):`
      ),
      err?.message || err
    );

    if (intento < MAX_INTENTOS) {
      const espera = 1500 * intento;

      await new Promise((r) => setTimeout(r, espera));

      await pedirCodigoPairing(
        sock,
        numero,
        onPairingCode,
        etiqueta,
        intento + 1
      );
    } else {
      console.log(
        chalk.red(
          `[${etiqueta}] Se agotaron los intentos para pedir el código de vinculación. Probá desde otra red.`
        )
      );
    }
  }
}

function extraerRespuestaBoton(message) {
  const nativeFlow =
    message?.interactiveResponseMessage?.nativeFlowResponseMessage;

  if (!nativeFlow?.paramsJson) return null;

  try {
    const params = JSON.parse(nativeFlow.paramsJson);

    if (params.id) return params.id;
    if (params.list_item?.id) return params.list_item.id;

    return null;
  } catch {
    return null;
  }
}

export async function crearBot({
  sessionFolder,
  etiqueta = "BOT",
  mostrarQR = false,
  numeroParaPairing = null,
  onPairingCode = null,
  onReady = null,
  onLoggedOut = null,
  isSubBot = false,
  onSock = null,
  onMessage = null,
  onGroupParticipantsUpdate = null,
  onGroupsUpdate = null,
}) {
  const groupMetadataCache = new Map();

  fs.mkdirSync(sessionFolder, { recursive: true });

  const { state, saveCreds } =
    await useMultiFileAuthState(sessionFolder);

  let ultimoGuardado = Promise.resolve();

  const { version } = await fetchLatestBaileysVersion();

  const yaRegistrado = fs.existsSync(
    `${sessionFolder}/creds.json`
  );

  const sock = makeWASocket({
    version,
    auth: state,

    printQRInTerminal: mostrarQR && !yaRegistrado,

    browser: Browsers.ubuntu("Chrome"),

    logger: pino({
      level: "silent",
    }),

    syncFullHistory: false,

    cachedGroupMetadata: async (jid) =>
      groupMetadataCache.get(jid),
  });

  if (onSock) {
    onSock(sock);
  }

  // ============================================================
  // MENSAJES ENVIADOS POR EL PROPIO BOT
  // ============================================================

  const idsPropiosEnviados = new Set();

  const enviarOriginal = sock.sendMessage.bind(sock);

  sock.sendMessage = async (...params) => {
    const resultado = await enviarOriginal(...params);

    if (resultado?.key?.id) {
      idsPropiosEnviados.add(resultado.key.id);

      if (idsPropiosEnviados.size > 500) {
        idsPropiosEnviados.delete(
          idsPropiosEnviados.values().next().value
        );
      }
    }

    return resultado;
  };

  // ============================================================
  // CACHE DE GRUPOS
  // ============================================================

  async function actualizarCacheGrupo(chatId) {
    try {
      const metadata = await sock.groupMetadata(chatId);

      groupMetadataCache.set(chatId, metadata);

      return metadata;
    } catch (err) {
      console.log(
        chalk.red(
          `[${etiqueta}] Error obteniendo metadata de grupo ${chatId}:`
        ),
        err.message
      );

      return groupMetadataCache.get(chatId) || null;
    }
  }

  sock.groupMetadataCache = groupMetadataCache;
  sock.actualizarCacheGrupo = actualizarCacheGrupo;

  // ============================================================
  // CONTACTOS
  // ============================================================

  sock.contacts = {};

  sock.ev.on("contacts.upsert", (contactos) => {
    for (const c of contactos) {
      sock.contacts[c.id] = c;
    }
  });

  sock.ev.on("contacts.update", (actualizaciones) => {
    for (const act of actualizaciones) {
      if (sock.contacts[act.id]) {
        Object.assign(sock.contacts[act.id], act);
      } else {
        sock.contacts[act.id] = act;
      }
    }
  });

  // ============================================================
  // PAIRING
  // ============================================================

  if (!yaRegistrado && numeroParaPairing && onPairingCode) {
    pedirCodigoPairing(
      sock,
      numeroParaPairing,
      onPairingCode,
      etiqueta
    );
  }

  // ============================================================
  // CONEXIÓN
  // ============================================================

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const statusCode =
        new Boom(lastDisconnect?.error)?.output?.statusCode;

      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut;

      const esRestartPorPairing =
        statusCode === DisconnectReason.restartRequired;

      console.log(
        chalk.red(`[${etiqueta}] Conexión cerrada.`)
      );

      if (shouldReconnect) {
        const colchon = esRestartPorPairing ? 400 : 200;

        (async () => {
          try {
            await ultimoGuardado;
          } catch (_) {}

          await new Promise((r) =>
            setTimeout(r, colchon)
          );

          crearBot({
            sessionFolder,
            etiqueta,
            mostrarQR,

            numeroParaPairing: esRestartPorPairing
              ? null
              : numeroParaPairing,

            onPairingCode: esRestartPorPairing
              ? null
              : onPairingCode,

            onReady,
            onLoggedOut,
            isSubBot,
            onSock,
            onMessage,
            onGroupParticipantsUpdate,
            onGroupsUpdate,
          });
        })();
      } else {
        console.log(
          chalk.yellow(
            `[${etiqueta}] Sesión cerrada por el usuario.`
          )
        );

        if (onLoggedOut) {
          onLoggedOut();
        }
      }
    }

    // ==========================================================
    // CONEXIÓN ABIERTA
    // ==========================================================

    else if (connection === "open") {
      console.log(
        chalk.greenBright(
          `[${etiqueta}] conectada correctamente.`
        )
      );

      (async () => {
        try {
          const todosLosGrupos =
            await sock.groupFetchAllParticipating();

          for (const chatId of Object.keys(todosLosGrupos)) {
            groupMetadataCache.set(
              chatId,
              todosLosGrupos[chatId]
            );
          }
        } catch (_) {}
      })();

      if (onReady) {
        onReady(sock);
      }
    }
  });

  // ============================================================
  // GUARDAR CREDENCIALES
  // ============================================================

  sock.ev.on("creds.update", () => {
    ultimoGuardado = saveCreds();
  });

  // ============================================================
  // PARTICIPANTES DE GRUPO
  // ============================================================

  sock.ev.on(
    "group-participants.update",
    async (update) => {
      const metadata =
        await actualizarCacheGrupo(update.id);

      if (onGroupParticipantsUpdate) {
        try {
          await onGroupParticipantsUpdate(
            sock,
            update,
            metadata
          );
        } catch (err) {
          console.log(
            chalk.red(
              `[${etiqueta}] Error en onGroupParticipantsUpdate:`
            ),
            err
          );
        }
      }
    }
  );

  // ============================================================
  // ACTUALIZACIÓN DE GRUPOS
  // ============================================================

  sock.ev.on("groups.update", async ([event]) => {
    if (!event?.id) return;

    const anterior =
      groupMetadataCache.get(event.id);

    if (onGroupsUpdate) {
      try {
        await onGroupsUpdate(
          sock,
          event,
          anterior
        );
      } catch (err) {
        console.log(
          chalk.red(
            `[${etiqueta}] Error en onGroupsUpdate:`
          ),
          err
        );
      }
    }

    await actualizarCacheGrupo(event.id);
  });

  // ============================================================
  // MENSAJES
  // ============================================================

  sock.ev.on(
    "messages.upsert",
    async ({ messages, type }) => {
      if (type !== "notify") return;

      const msg = messages[0];

      if (!msg?.message) return;

      // Ignorar mensajes propios
      if (
        msg.key.fromMe &&
        idsPropiosEnviados.has(msg.key.id)
      ) {
        return;
      }

      // ========================================================
      // IDs ORIGINALES
      // ========================================================

      const chatIdRaw = msg.key.remoteJid;

      const senderRaw =
        msg.key.participant ||
        msg.key.remoteJid;

      // ========================================================
      // RESOLVER LID -> JID
      // ========================================================

      let chatId = chatIdRaw;
      let sender = senderRaw;

      // Resolver chatId solamente si es LID
      if (
        chatIdRaw &&
        chatIdRaw.endsWith("@lid")
      ) {
        try {
          const resuelto =
            await sock.resolveLidToJid(chatIdRaw);

          if (resuelto) {
            chatId = resuelto;
          }
        } catch (_) {}
      }

      // Resolver sender solamente si es LID
      if (
        senderRaw &&
        senderRaw.endsWith("@lid")
      ) {
        try {
          const resuelto =
            await sock.resolveLidToJid(senderRaw);

          if (resuelto) {
            sender = resuelto;
          }
        } catch (_) {}
      }

      // ========================================================
      // TEXTO DEL MENSAJE
      // ========================================================

      const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        extraerRespuestaBoton(msg.message) ||
        "";

      // ========================================================
      // GRUPO
      // ========================================================

      const esGrupo =
        chatIdRaw?.endsWith("@g.us");

      // ========================================================
      // LOG
      // ========================================================

      console.log(
        chalk.blueBright(
          `[${etiqueta}] ` +
          `${sender.split("@")[0]}` +
          `${esGrupo ? " (grupo)" : ""}: `
        ) +
        (body || "(mensaje sin texto)")
      );

      // ========================================================
      // ENVIAR AL CORE
      // ========================================================

      if (onMessage) {
        try {
          await onMessage(sock, msg, {
            // Chat resuelto
            chatId,

            // Chat original
            chatIdRaw,

            // Usuario resuelto
            sender,

            // Usuario original
            senderRaw,

            // Texto
            body,

            // Grupo
            esGrupo,

            // Subbot
            isSubBot,
          });
        } catch (err) {
          console.log(
            chalk.red(
              `[${etiqueta}] Error en onMessage:`
            ),
            err
          );
        }
      }
    }
  );

  return sock;
}

Con esto el core recibe los dos valores:

chatIdRaw   // valor original
chatId      // JID resuelto si era LID

senderRaw   // valor original
sender      // JID resuelto si era LID

Y además no intentará resolver un grupo "@g.us" como si fuera LID. El cambio clave es que ahora solo se ejecuta "resolveLidToJid()" cuando realmente termina en "@lid".