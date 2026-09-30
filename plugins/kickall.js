export default {
  command: ['kickall'],
  category: 'group',
  description: 'Elimina a todos los miembros excepto administradores',

  run: async (sock, msg, args, context) => {
    const { chatId } = context;

    // Verificar que sea un grupo
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, {
        text: '❌ Este comando solo puede usarse en grupos.'
      }, { quoted: msg });
    }

    // Obtener información del grupo
    const metadata = await sock.groupMetadata(chatId);
    const participants = metadata.participants;

    // Verificar que quien ejecuta sea administrador
    const senderId = msg.key.participant || msg.key.remoteJid;
    const sender = participants.find(p => p.id === senderId);

    if (!sender || !['admin', 'superadmin'].includes(sender.admin)) {
      return sock.sendMessage(chatId, {
        text: '❌ Solo los administradores pueden usar este comando.'
      }, { quoted: msg });
    }

    // Verificar que el bot sea administrador
    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const bot = participants.find(p => p.id === botId);

    if (!bot || !['admin', 'superadmin'].includes(bot.admin)) {
      return sock.sendMessage(chatId, {
        text: '❌ Necesito ser administrador para ejecutar este comando.'
      }, { quoted: msg });
    }

    // Seleccionar únicamente usuarios que NO sean administradores
    const targets = participants
      .filter(p => !['admin', 'superadmin'].includes(p.admin))
      .map(p => p.id);

    if (!targets.length) {
      return sock.sendMessage(chatId, {
        text: '☠︎ No hay miembros para eliminar. Los administradores permanecerán.'
      }, { quoted: msg });
    }

    await sock.sendMessage(chatId, {
      text: `☠︎ 𝙆𝙞𝙘𝙠 𝘼𝙡𝙡\n\nEliminando ${targets.length} miembro(s)...\n\n✦ Los administradores permanecerán en el grupo.`
    }, { quoted: msg });

    // Eliminar miembros
    await sock.groupParticipantsUpdate(
      chatId,
      targets,
      'remove'
    );

    await sock.sendMessage(chatId, {
      text: `✅ 𝙆𝙞𝙘𝙠 𝘼𝙡𝙡 𝙛𝙞𝙣𝙖𝙡𝙞𝙯𝙖𝙙𝙤.\n\n☠︎ Eliminados: ${targets.length}\n🛡️ Administradores conservados.`
    });
  }
};