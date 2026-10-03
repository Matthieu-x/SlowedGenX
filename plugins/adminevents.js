export async function manejarCambioAdmin(sock, update, metadata) {
  try {
    // Solo nos interesan cambios de administrador
    if (!['promote', 'demote'].includes(update.action)) {
      return;
    }

    const chatId = update.id;

    // Solo grupos
    if (!chatId?.endsWith('@g.us')) {
      return;
    }

    const participantes = update.participants || [];

    if (!participantes.length) {
      return;
    }

    // Persona que realizó el cambio
    const autor = update.author;

    if (!autor) {
      return;
    }

    const mentions = [autor, ...participantes];

    let texto = '';

    if (update.action === 'promote') {
      texto =
        `👑 @${autor.split('@')[0]} le dio admin a ` +
        participantes
          .map(p => `@${p.split('@')[0]}`)
          .join(', ') +
        `\n\n` +
        `✨ ¡Nuevo administrador en la casa! ` +
        `Cuida ese poder. 🛡️`;
    }

    if (update.action === 'demote') {
      texto =
        `🥀 @${autor.split('@')[0]} le quitó admin a ` +
        participantes
          .map(p => `@${p.split('@')[0]}`)
          .join(', ') +
        `\n\n` +
        `⚡ El poder fue retirado. ` +
        `Toca volver a las filas. 😭`;
    }

    await sock.sendMessage(chatId, {
      text: texto,
      mentions: [...new Set(mentions)]
    });

  } catch (error) {
    console.error(
      '[ADMIN EVENTS ERROR]',
      error?.message || error
    );
  }
}