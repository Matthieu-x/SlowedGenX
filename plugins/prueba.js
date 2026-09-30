// .n → misma función que .hidetag

export default {
  command: ['n'],
  category: 'group',
  description: 'Menciona a todos sin mostrar etiquetas',

  async execute(sock, m, args) {
    try {
      const jid = m.key.remoteJid

      if (!jid.endsWith('@g.us')) {
        return await sock.sendMessage(jid, {
          text: '❌ Este comando solo funciona en grupos.'
        })
      }

      const metadata = await sock.groupMetadata(jid)
      const participantes = metadata.participants.map(p => p.id)

      const texto = args.length
        ? args.join(' ')
        : '📢 Atención a todos'

      await sock.sendMessage(jid, {
        text: texto,
        mentions: participantes
      })

    } catch (error) {
      console.error('Error en .n:', error)

      await sock.sendMessage(m.key.remoteJid, {
        text: '❌ Ocurrió un error al ejecutar el comando.'
      })
    }
  }
}