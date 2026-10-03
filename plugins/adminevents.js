import fs from 'fs';

const DATABASE_FILE = './database.json';

const BIENVENIDA_DEFAULT =
  '╭─〔 🫧 BIENVENIDO/A 〕─╮\n\n' +
  '👤 @user\n' +
  '🫧 Bienvenido/a a @grupo\n\n' +
  '👥 Miembros: @total\n\n' +
  '📜 @desc\n\n' +
  '╰────────────────╯';

const DESPEDIDA_DEFAULT =
  '╭─〔 🫧 DESPEDIDA 〕─╮\n\n' +
  '👤 @user\n' +
  'ha salido de @grupo.\n\n' +
  '👥 Miembros restantes: @total\n\n' +
  '╰────────────────╯';


/* ============================================================
 * DATABASE
 * ============================================================ */

function cargarDatabase() {
  try {

    if (!fs.existsSync(DATABASE_FILE)) {
      return {};
    }

    const contenido =
      fs.readFileSync(
        DATABASE_FILE,
        'utf8'
      );

    if (!contenido.trim()) {
      return {};
    }

    return JSON.parse(contenido);

  } catch (error) {

    console.error(
      '[WELCOME] Error leyendo database.json:',
      error
    );

    return {};
  }
}


/* ============================================================
 * REEMPLAZAR VARIABLES
 * ============================================================ */

function prepararMensaje(
  texto,
  usuario,
  metadata
) {

  const grupo =
    metadata?.subject ||
    'este grupo';

  const total =
    metadata?.participants?.length ||
    0;

  const desc =
    metadata?.desc ||
    'Sin descripción';

  return texto
    .replace(
      /@user/g,
      `@${usuario.split('@')[0]}`
    )
    .replace(
      /@grupo/g,
      grupo
    )
    .replace(
      /@total/g,
      String(total)
    )
    .replace(
      /@desc/g,
      desc
    );
}


/* ============================================================
 * EVENTOS
 * ============================================================ */

export async function manejarCambioAdmin(
  sock,
  update,
  metadata
) {

  try {

    console.log(
      '[GROUP EVENT]',
      JSON.stringify(update, null, 2)
    );


    const chatId =
      update?.id;


    if (!chatId?.endsWith('@g.us')) {
      return;
    }


    const participantes =
      update?.participants || [];


    if (!participantes.length) {
      return;
    }


    /* ========================================================
     * BIENVENIDAS / DESPEDIDAS
     * ======================================================== */

    if (
      update.action === 'add' ||
      update.action === 'remove'
    ) {

      const database =
        cargarDatabase();


      const config =
        database?.welcome?.[chatId];


      /*
       * Si el grupo todavía no tiene configuración,
       * usamos bienvenida activada por defecto.
       */

      const enabled =
        config?.enabled ??
        true;


      if (!enabled) {
        return;
      }


      const mensajeBase =
        update.action === 'add'
          ? (
              config?.welcomeMessage ||
              BIENVENIDA_DEFAULT
            )
          : (
              config?.byeMessage ||
              DESPEDIDA_DEFAULT
            );


      for (
        const participante of participantes
      ) {

        if (!participante) {
          continue;
        }


        /*
         * Actualizamos la cantidad real de miembros
         * después del evento.
         */

        let metadataActual =
          metadata;


        try {

          metadataActual =
            await sock.groupMetadata(
              chatId
            );

        } catch (error) {

          console.log(
            '[WELCOME] No se pudo actualizar metadata:',
            error?.message || error
          );
        }


        const texto =
          prepararMensaje(
            mensajeBase,
            participante,
            metadataActual
          );


        await sock.sendMessage(
          chatId,
          {
            text,
            mentions: [
              participante
            ]
          }
        );


        console.log(
          update.action === 'add'
            ? `[WELCOME] Bienvenida enviada a ${participante}`
            : `[WELCOME] Despedida enviada a ${participante}`
        );
      }


      return;
    }


    /* ========================================================
     * ADMINISTRADORES
     * ======================================================== */

    if (
      update.action !== 'promote' &&
      update.action !== 'demote'
    ) {
      return;
    }


    let autor =
      update.author;


    if (!autor) {

      console.log(
        '[ADMIN EVENT] No se encontró el autor.'
      );

      return;
    }


    const mentions =
      [autor];


    const objetivos =
      [];


    for (
      const participante of participantes
    ) {

      mentions.push(
        participante
      );


      objetivos.push(
        `@${participante.split('@')[0]}`
      );
    }


    const autorTexto =
      `@${autor.split('@')[0]}`;


    let texto =
      '';


    if (
      update.action === 'promote'
    ) {

      texto =
        `👑 ${autorTexto} le dio admin a ${objetivos.join(', ')}\n\n` +
        `✨ ¡Nuevo administrador en la casa! ` +
        `Cuida ese poder. 🛡️`;
    }


    if (
      update.action === 'demote'
    ) {

      texto =
        `🥀 ${autorTexto} le quitó admin a ${objetivos.join(', ')}\n\n` +
        `⚡ El poder fue retirado. ` +
        `Toca volver a las filas. 😭`;
    }


    await sock.sendMessage(
      chatId,
      {
        text,
        mentions: [
          ...new Set(
            mentions
          )
        ]
      }
    );


  } catch (error) {

    console.error(
      '[GROUP EVENTS ERROR]',
      error?.stack || error
    );
  }
}