import { Context, Dict, Random, Schema, Session, Time } from 'koishi'
import zh from './locales/zh.yml'
import en from './locales/en.yml'

export interface Config {
  tokenPrefix?: string
  generateToken?: () => string
}

export const name = 'bind'
export const using = ['database'] as const
export const Config: Schema<Config> = Schema.object({
  generateToken: Schema.function().hidden(),
})

export function apply(ctx: Context, config: Config = {}) {
  ctx.i18n.define('zh', zh)
  ctx.i18n.define('en', en)

  // 1: group (1st step)
  // 0: private
  // -1: group (2nd step)
  type TokenData = [platform: string, id: string, phase: number]
  const tokens: Dict<TokenData> = {}

  const { tokenPrefix: prefix = 'koishi/' } = config
  const { generateToken = () => `${prefix}` + Random.id(6, 10) } = config

  function generate(session: Session, phase: number) {
    const token = generateToken()
    tokens[token] = [session.platform, session.userId, phase]
    ctx.setTimeout(() => delete tokens[token], 5 * Time.minute)
    return token
  }

  async function bind(aid: number, platform: string, pid: string) {
    await ctx.database.set('binding', { platform, pid }, { aid })
  }

  ctx.command('bind', { authority: 0 })
    .action(({ session }) => {
      const token = generate(session, +(session.subtype !== 'private'))
      return session.text('.generated-1', [token])
    })

  ctx.middleware(async (session, next) => {
    const data = tokens[session.content]
    if (!data) return next()
    delete tokens[session.content]
    if (data[2] < 0) {
      const [binding] = await ctx.database.get('binding', { platform: data[0], pid: data[1] }, ['aid'])
      await bind(binding.aid, session.platform, session.userId)
      return session.text('commands.bind.messages.success')
    } else {
      const user = await ctx.database.getUser(session.platform, session.userId, ['id', 'authority'])
      if (!user.authority) return session.text('internal.low-authority')
      if (data[2]) {
        const token = generate(session, -1)
        return session.text('commands.bind.messages.generated-2', [token])
      } else {
        await bind(user.id, data[0], data[1])
        return session.text('commands.bind.messages.success')
      }
    }
  }, true)
}
