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

import { manejarCambioAdmin } from "./adminEvents.js";

/* ============================================================
 * PREFIJO POR DEFECTO
 * ============================================================ */

export const PREFIX = ".";


/* ============================================================
 * PAIRING
 * ============================================================ */

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
    await new Promise((r) =>
      setTimeout(r, ESPERA_INICIAL)
    );
  }

  try {
    const code =
      await sock.requestPairingCode(
        numero.trim()
      );

    onPairingCode(code);

  } catch (err) {

    console.log(
      chalk.red(
        `[${etiqueta}] Error pidiendo código ` +
        `(intento ${intento}/${MAX_INTENTOS}):`
      ),
      err?.message || err
    );

    if (intento < MAX_INTENTOS) {

      const espera =
        1500 * intento;

      await new Promise((r) =>
        setTimeout(r, espera)
      );

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


/* ============================================================
 * BOTONES
 * ============================================================ */

function extraerRespuestaBoton(message) {

  const nativeFlow =
    message?.interactiveResponseMessage
      ?.nativeFlowResponseMessage;

  if (!nativeFlow?.paramsJson) {
    return null;
  }

  try {

    const params =
      JSON.parse(
        nativeFlow.paramsJson
      );

    if (params.id) {
      return params.id;
    }

    if (params.list_item?.id) {
      return params.list_item.id;
    }

    return null;

  } catch {
    return null;
  }
}


/* ============================================================
 * CREAR BOT
 * ============================================================ */

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

  const groupMetadataCache =
    new Map();


  fs.mkdirSync(
    sessionFolder,
    {
      recursive: true
    }
  );


  /* ==========================================================
   * AUTENTICACIÓN
   * ========================================================== */

  const {
    state,
    saveCreds
  } =
    await useMultiFileAuthState(
      sessionFolder
    );


  let ultimoGuardado =
    Promise.resolve();


  const { version } =
    await fetchLatestBaileysVersion();


  const yaRegistrado =
    fs.existsSync(
      `${sessionFolder}/creds.json`
    );


  /* ==========================================================
   * SOCKET
   * ========================================================== */

  const sock =
    makeWASocket({
      version,
      auth: state,

      printQRInTerminal:
        mostrarQR && !yaRegistrado,

      browser:
        Browsers.ubuntu("Chrome"),

      logger:
        pino({
          level: "silent",
        }),

      syncFullHistory: false,

      cachedGroupMetadata:
        async (jid) =>
          groupMetadataCache.get(jid),
    });


  sock.prefix =
    PREFIX;


  if (onSock) {
    onSock(sock);
  }


  /* ==========================================================
   * MENSAJES ENVIADOS POR EL BOT
   * ========================================================== */

  const idsPropiosEnviados =
    new Set();


  const enviarOriginal =
    sock.sendMessage.bind(sock);


  sock.sendMessage =
    async (...params) => {

      const resultado =
        await enviarOriginal(
          ...params
        );


      if (resultado?.key?.id) {

        idsPropiosEnviados.add(
          resultado.key.id
        );


        if (
          idsPropiosEnviados.size > 500
        ) {

          idsPropiosEnviados.delete(
            idsPropiosEnviados
              .values()
              .next()
              .value
          );
        }
      }


      return resultado;
    };


  /* ==========================================================
   * CACHE DE GRUPO
   * ========================================================== */

  async function actualizarCacheGrupo(
    chatId
  ) {

    try {

      const metadata =
        await sock.groupMetadata(
          chatId
        );


      groupMetadataCache.set(
        chatId,
        metadata
      );


      return metadata;

    } catch (err) {

      console.log(
        chalk.red(
          `[${etiqueta}] Error obteniendo metadata de grupo ${chatId}:`
        ),
        err.message
      );


      return (
        groupMetadataCache.get(
          chatId
        ) || null
      );
    }
  }


  sock.groupMetadataCache =
    groupMetadataCache;


  sock.actualizarCacheGrupo =
    actualizarCacheGrupo;


  /* ==========================================================
   * CONTACTOS
   * ========================================================== */

  sock.contacts = {};


  sock.ev.on(
    "contacts.upsert",
    (contactos) => {

      for (const c of contactos) {

        sock.contacts[c.id] =
          c;
      }
    }
  );


  sock.ev.on(
    "contacts.update",
    (actualizaciones) => {

      for (const act of actualizaciones) {

        if (
          sock.contacts[act.id]
        ) {

          Object.assign(
            sock.contacts[act.id],
            act
          );

        } else {

          sock.contacts[act.id] =
            act;
        }
      }
    }
  );


  /* ==========================================================
   * PAIRING
   * ========================================================== */

  if (
    !yaRegistrado &&
    numeroParaPairing &&
    onPairingCode
  ) {

    pedirCodigoPairing(
      sock,
      numeroParaPairing,
      onPairingCode,
      etiqueta
    );
  }


  /* ==========================================================
   * ACTUALIZACIÓN DE CREDENCIALES
   * ========================================================== */

  sock.ev.on(
    "creds.update",
    async () => {

      ultimoGuardado =
        ultimoGuardado
          .then(() => saveCreds())
          .catch((err) => {

            console.log(
              chalk.red(
                `[${etiqueta}] Error guardando credenciales:`
              ),
              err
            );

          });

      await ultimoGuardado;
    }
  );


  /* ==========================================================
   * CONEXIÓN
   * ========================================================== */

  sock.ev.on(
    "connection.update",
    async (update) => {

      const {
        connection,
        lastDisconnect,
      } = update;


      /* ------------------------------------------------------
       * CONEXIÓN ABIERTA
       * ------------------------------------------------------ */

      if (connection === "open") {

        console.log(
          chalk.green(
            `[${etiqueta}] WhatsApp conectado correctamente.`
          )
        );


        /* ----------------------------------------------------
         * CARGAR METADATA DE GRUPOS
         * ---------------------------------------------------- */

        try {

          const grupos =
            await sock.groupFetchAllParticipating();


          for (
            const [jid, metadata]
            of Object.entries(grupos)
          ) {

            groupMetadataCache.set(
              jid,
              metadata
            );
          }


          console.log(
            chalk.green(
              `[${etiqueta}] ${Object.keys(grupos).length} grupos cargados en caché.`
            )
          );

        } catch (err) {

          console.log(
            chalk.yellow(
              `[${etiqueta}] No se pudo cargar la metadata de los grupos:`
            ),
            err?.message || err
          );
        }


        if (onReady) {

          try {

            await onReady(sock);

          } catch (err) {

            console.log(
              chalk.red(
                `[${etiqueta}] Error en onReady:`
              ),
              err
            );
          }
        }

        return;
      }


      /* ------------------------------------------------------
       * CONEXIÓN CERRADA
       * ------------------------------------------------------ */

      if (connection === "close") {

        let statusCode;

        try {

          statusCode =
            new Boom(
              lastDisconnect?.error
            ).output?.statusCode;

        } catch {

          statusCode =
            undefined;
        }


        console.log(
          chalk.yellow(
            `[${etiqueta}] Conexión cerrada. Código: ${statusCode ?? "desconocido"}`
          )
        );


        /* ----------------------------------------------------
         * SESIÓN CERRADA / LOGOUT
         * ---------------------------------------------------- */

        if (
          statusCode ===
          DisconnectReason.loggedOut
        ) {

          console.log(
            chalk.red(
              `[${etiqueta}] La sesión fue cerrada. No se reconectará automáticamente.`
            )
          );


          if (onLoggedOut) {

            try {

              await onLoggedOut();

            } catch (err) {

              console.log(
                chalk.red(
                  `[${etiqueta}] Error en onLoggedOut:`
                ),
                err
              );
            }
          }

          return;
        }


        /* ----------------------------------------------------
         * ESPERAR A QUE TERMINE EL GUARDADO
         * ---------------------------------------------------- */

        try {

          await ultimoGuardado;

        } catch {}


        /* ----------------------------------------------------
         * RECONEXIÓN
         * ---------------------------------------------------- */

        const espera =
          statusCode ===
          DisconnectReason.restartRequired
            ? 400
            : 200;


        console.log(
          chalk.cyan(
            `[${etiqueta}] Reconectando en ${espera}ms...`
          )
        );


        setTimeout(
          () => {

            crearBot({
              sessionFolder,

              etiqueta,

              mostrarQR: false,

              numeroParaPairing: null,

              onPairingCode: null,

              onReady,

              onLoggedOut,

              isSubBot,

              onSock,

              onMessage,

              onGroupParticipantsUpdate,

              onGroupsUpdate,

            }).catch((err) => {

              console.log(
                chalk.red(
                  `[${etiqueta}] Error creando nuevo socket:`
                ),
                err
              );

            });

          },
          espera
        );
      }
    }
  );


  /* ==========================================================
   * CAMBIOS DE PARTICIPANTES
   * ========================================================== */

  sock.ev.on(
    "group-participants.update",
    async (update) => {

      const metadata =
        await actualizarCacheGrupo(
          update.id
        );


      /* ------------------------------------------------------
       * MANEJAR CAMBIO DE ADMIN
       * ------------------------------------------------------ */

      try {

        if (typeof manejarCambioAdmin === "function") {

          await manejarCambioAdmin(
            sock,
            update,
            metadata
          );
        }

      } catch (err) {

        console.log(
          chalk.red(
            `[${etiqueta}] Error en manejarCambioAdmin:`
          ),
          err
        );
      }


      /* ------------------------------------------------------
       * CALLBACK EXTERNO
       * ------------------------------------------------------ */

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


  /* ==========================================================
   * ACTUALIZACIONES DE GRUPOS
   * ========================================================== */

  sock.ev.on(
    "groups.update",
    async (updates) => {

      for (const event of updates) {

        if (!event?.id) {
          continue;
        }


        const anterior =
          groupMetadataCache.get(
            event.id
          );


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


        await actualizarCacheGrupo(
          event.id
        );
      }
    }
  );


  /* ==========================================================
   * MENSAJES
   * ========================================================== */

  sock.ev.on(
    "messages.upsert",
    async ({ messages, type }) => {

      if (type !== "notify") {
        return;
      }


      for (const msg of messages) {

        if (!msg?.message) {
          continue;
        }


        if (
          msg.key.fromMe &&
          idsPropiosEnviados.has(
            msg.key.id
          )
        ) {
          continue;
        }


        const chatIdRaw =
          msg.key.remoteJid;


        const senderRaw =
          msg.key.participant ||
          msg.key.remoteJid;


        let chatId =
          chatIdRaw;


        let sender =
          senderRaw;


        /* ----------------------------------------------------
         * RESOLVER CHAT LID
         * ---------------------------------------------------- */

        if (
          chatIdRaw &&
          chatIdRaw.endsWith("@lid")
        ) {

          try {

            const resuelto =
              await sock.resolveLidToJid(
                chatIdRaw
              );


            if (resuelto) {
              chatId = resuelto;
            }

          } catch (_) {}
        }


        /* ----------------------------------------------------
         * RESOLVER SENDER LID
         * ---------------------------------------------------- */

        if (
          senderRaw &&
          senderRaw.endsWith("@lid")
        ) {

          try {

            const resuelto =
              await sock.resolveLidToJid(
                senderRaw
              );


            if (resuelto) {
              sender = resuelto;
            }

          } catch (_) {}
        }


        /* ----------------------------------------------------
         * TEXTO DEL MENSAJE
         * ---------------------------------------------------- */

        const body =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          msg.message.videoMessage?.caption ||
          extraerRespuestaBoton(
            msg.message
          ) ||
          "";


        const esGrupo =
          chatIdRaw?.endsWith("@g.us");


        console.log(
          chalk.blueBright(
            `[${etiqueta}] ` +
            `${sender?.split("@")[0] || "desconocido"}` +
            `${esGrupo ? " (grupo)" : ""}: `
          ) +
          (
            body ||
            "(mensaje sin texto)"
          )
        );


        /* ----------------------------------------------------
         * CALLBACK DE MENSAJES
         * ---------------------------------------------------- */

        if (onMessage) {

          try {

            await onMessage(
              sock,
              msg,
              {
                chatId,
                chatIdRaw,

                sender,
                senderRaw,

                body,
                esGrupo,

                isSubBot,

                prefix: PREFIX,
              }
            );

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
    }
  );


  return sock;
}